import { Attendance } from "../models/Attendance.js";
import { Course } from "../models/Course.js";
import { Session } from "../models/Session.js";
import { env } from "../config/env.js";
import { issueSessionToken } from "../services/tokenService.js";
import { HttpError } from "../utils/errors.js";

const getEffectiveStudentLimit = (session, attendanceCount = 0) => {
  const limit = Number(session?.studentLimit || 0);
  if (Number.isInteger(limit) && limit > 0) {
    return limit;
  }

  return attendanceCount;
};

const serializeSession = (session, token, attendanceCount = 0, qrAttendanceCount = 0) => ({
  id: session.id,
  courseId: session.courseId,
  lecturerId: session.lecturerId,
  token,
  createdAt: session.createdAt,
  expiresAt: session.expiresAt,
  rotationIntervalSeconds: session.rotationIntervalSeconds,
  studentLimit: getEffectiveStudentLimit(session, attendanceCount),
  isActive: session.isActive,
  attendanceCount,
  qrAttendanceCount
});

export const startSession = (io) => async (req, res) => {
  try {
    const { courseId, studentLimit } = req.body;

    if (!courseId) {
      throw new HttpError(400, "Course is required");
    }
    const normalizedStudentLimit = Number(studentLimit);
    if (!Number.isInteger(normalizedStudentLimit) || normalizedStudentLimit < 1) {
      throw new HttpError(400, "Student limit must be a whole number greater than 0");
    }

    const course = await Course.findOne({ _id: courseId, lecturerId: req.auth.lecturerId });
    if (!course) {
      throw new HttpError(404, "Course not found");
    }

    await Session.updateMany(
      { courseId: course.id, lecturerId: req.auth.lecturerId, isActive: true },
      { isActive: false }
    );

    const { token, tokenHash, expiresAt } = issueSessionToken(env.sessionTokenTtlSeconds);
    const session = await Session.create({
      courseId: course.id,
      lecturerId: req.auth.lecturerId,
      tokenValue: token,
      tokenHash,
      expiresAt,
      rotationIntervalSeconds: env.sessionRotationSeconds,
      studentLimit: normalizedStudentLimit,
      isActive: true
    });

    io.to(`lecturer:${req.auth.lecturerId}`).emit("session:started", { sessionId: session.id, courseId: course.id });
    res.status(201).json({
      ...serializeSession(session, token, 0, 0),
      course
    });
  } catch (error) {
    if (error instanceof HttpError) {
      return res.status(error.status).json({ message: error.message });
    }
    res.status(500).json({ message: "Failed to start session", error: error.message });
    console.error("Failed to start session:", error);
  }
};

export const rotateSession = (io) => async (req, res) => {
  try {
    const session = await Session.findOne({
      _id: req.params.id,
      lecturerId: req.auth.lecturerId,
      isActive: true
    });

    if (!session) {
      throw new HttpError(404, "Active session not found");
    }

    const { token, tokenHash, expiresAt } = issueSessionToken(session.rotationIntervalSeconds);
    session.tokenValue = token;
    session.tokenHash = tokenHash;
    session.expiresAt = expiresAt;
    await session.save({ validateBeforeSave: false });

    const attendanceCount = await Attendance.countDocuments({ sessionId: session.id });
    io.to(`session:${session.id}`).emit("session:rotated", {
      sessionId: session.id,
      expiresAt: session.expiresAt,
      token,
      qrAttendanceCount: 0
    });

    res.json({
      ...serializeSession(session, token, attendanceCount, 0),
      rotationIntervalSeconds: session.rotationIntervalSeconds
    });
  } catch (error) {
    if (error instanceof HttpError) {
      return res.status(error.status).json({ message: error.message });
    }
    res.status(500).json({ message: "Failed to rotate session" });
  }
};

export const getSession = async (req, res) => {
  try {
    const session = await Session.findOne({
      _id: req.params.id,
      lecturerId: req.auth.lecturerId
    }).populate("courseId");

    if (!session) {
      throw new HttpError(404, "Session not found");
    }

    const attendanceCount = await Attendance.countDocuments({ sessionId: session.id });
    res.json({
      id: session.id,
      course: session.courseId,
      lecturerId: session.lecturerId,
      token: session.isActive ? session.tokenValue : null,
      expiresAt: session.expiresAt,
      createdAt: session.createdAt,
      isActive: session.isActive,
      attendanceCount,
      studentLimit: getEffectiveStudentLimit(session, attendanceCount)
    });
  } catch (error) {
    if (error instanceof HttpError) {
      return res.status(error.status).json({ message: error.message });
    }
    res.status(500).json({ message: "Failed to get session" });
  }
};

export const listSessions = async (req, res) => {
  try {
    const query = { lecturerId: req.auth.lecturerId };
    if (req.query.courseId) {
      query.courseId = req.query.courseId;
    }

    const sessions = await Session.find(query).sort({ createdAt: -1 }).populate("courseId");
    const counts = await Attendance.aggregate([
      {
        $match: {
          lecturerId: req.auth.lecturerId
        }
      },
      {
        $group: {
          _id: "$sessionId",
          count: { $sum: 1 }
        }
      }
    ]);

    const countMap = new Map(counts.map((entry) => [entry._id.toString(), entry.count]));

    res.json(
      sessions.map((session) => {
        const attendanceCount = countMap.get(session.id.toString()) || 0;

        return {
          id: session.id,
          course: session.courseId,
          token: session.isActive ? session.tokenValue : null,
          expiresAt: session.expiresAt,
          createdAt: session.createdAt,
          isActive: session.isActive,
          attendanceCount,
          studentLimit: getEffectiveStudentLimit(session, attendanceCount)
        };
      })
    );
  } catch (error) {
    if (error instanceof HttpError) {
      return res.status(error.status).json({ message: error.message });
    }
    res.status(500).json({ message: "Failed to list sessions" });
  }
};

export const stopSession = (io) => async (req, res) => {
  try {
    const session = await Session.findOne({
      _id: req.params.id,
      lecturerId: req.auth.lecturerId,
      isActive: true
    });

    if (!session) {
      throw new HttpError(404, "Active session not found");
    }

    session.isActive = false;
    await session.save({ validateBeforeSave: false });
    io.to(`session:${session.id}`).emit("session:stopped", { sessionId: session.id });
    res.json({ success: true });
  } catch (error) {
    if (error instanceof HttpError) {
      return res.status(error.status).json({ message: error.message });
    }
    console.error("Failed to stop session:", error);
    res.status(500).json({ message: "Failed to stop session" });
  }
};

export const deleteSession = (io) => async (req, res) => {
  try {
    const session = await Session.findOne({
      _id: req.params.id,
      lecturerId: req.auth.lecturerId
    });

    if (!session) {
      throw new HttpError(404, "Session not found");
    }

    await Attendance.deleteMany({ sessionId: session.id, lecturerId: req.auth.lecturerId });
    await Session.deleteOne({ _id: session.id });

    io.to(`session:${session.id}`).emit("session:deleted", { sessionId: session.id });
    res.json({ success: true });
  } catch (error) {
    if (error instanceof HttpError) {
      return res.status(error.status).json({ message: error.message });
    }
    console.error("Failed to delete session:", error);
    res.status(500).json({ message: "Failed to delete session" });
  }
};
