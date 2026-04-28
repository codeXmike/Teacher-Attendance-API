import { Attendance } from "../models/Attendance.js";
import { Course } from "../models/Course.js";
import { Session } from "../models/Session.js";
import { Student } from "../models/Student.js";
import { hashToken } from "../utils/crypto.js";
import { HttpError } from "../utils/errors.js";
import { validateLocation } from "../utils/validation.js";

const normalizeScanToken = (input) => {
  if (input == null) {
    return "";
  }

  if (typeof input === "object") {
    const nested = input.token ?? input.qrToken ?? input.sessionToken ?? input.data ?? input.value ?? input.payload;
    return normalizeScanToken(nested);
  }

  const rawValue = String(input).trim();
  if (!rawValue) {
    return "";
  }

  if (rawValue.startsWith("{") || rawValue.startsWith("[")) {
    try {
      const parsed = JSON.parse(rawValue);
      return normalizeScanToken(parsed);
    } catch {
      // fall through to URL/raw handling
    }
  }

  try {
    const url = new URL(rawValue);
    const queryKeys = ["token", "qrToken", "sessionToken", "data"];

    for (const key of queryKeys) {
      const nextValue = url.searchParams.get(key);
      if (nextValue) {
        return normalizeScanToken(nextValue);
      }
    }

    const hashValue = url.hash.replace(/^#/, "").trim();
    if (hashValue) {
      return normalizeScanToken(hashValue);
    }
  } catch {
    // Not a URL, continue with raw text fallback.
  }

  return rawValue;
};

export const scanAttendance = (io) => async (req, res) => {
  const { location } = req.body;
  const normalizedToken = normalizeScanToken(
    req.body?.token ?? req.body?.qrToken ?? req.body?.sessionToken ?? req.body?.data ?? req.body?.value ?? req.body?.payload
  );

  if (!normalizedToken) {
    throw new HttpError(400, "QR token is required");
  }

  if (location) {
    try {
      validateLocation(location);
    } catch (err) {
      throw new HttpError(400, err.message);
    }
  }

  const finalStudentId = req.auth.id;
  const session = await Session.findOne({
    tokenHash: hashToken(normalizedToken),
    isActive: true
  }).populate("courseId");

  if (!session) {
    throw new HttpError(404, "QR is expired...");
  }

  const finalLecturerId = session.lecturerId;

  if (!finalStudentId) {
    throw new HttpError(400, "Student identification required");
  }
  if (!finalLecturerId) {
    throw new HttpError(400, "Lecturer identification required");
  }

  const student = await Student.findById(finalStudentId);
  if (!student) {
    throw new HttpError(404, "Student not found");
  }

  const alreadyRecorded = await Attendance.findOne({
    studentId: student.id,
    sessionId: session.id
  });

  if (alreadyRecorded) {
    throw new HttpError(409, "Attendance already recorded for this session");
  }

  const attendanceCount = await Attendance.countDocuments({
    sessionId: session.id
  });

  if (attendanceCount >= session.studentLimit) {
    throw new HttpError(410, "Attendance limit reached for this session.");
  }

  const attendance = await Attendance.create({
    lecturerId: finalLecturerId,
    studentId: student.id,
    sessionId: session.id,
    qrTokenHash: session.tokenHash,
    timestamp: new Date()
  });

  const nextAttendanceCount = attendanceCount + 1;

  io.to(`session:${session.id}`).emit("attendance:created", {
    id: attendance.id,
    sessionId: session.id,
    attendanceCount: nextAttendanceCount,
    qrAttendanceCount: nextAttendanceCount,
    student: {
      id: student.id,
      name: student.name,
      matricNo: student.matricNo
    },
    timestamp: attendance.timestamp
  });

  res.status(201).json({
    id: attendance.id,
    timestamp: attendance.timestamp,
    course: session.courseId
  });
};

export const listAttendanceBySession = async (req, res) => {
  const session = await Session.findOne({
    _id: req.params.id,
    lecturerId: req.auth.lecturerId
  });

  if (!session) {
    throw new HttpError(404, "Session not found");
  }

  const attendance = await Attendance.find({
    sessionId: session.id,
    lecturerId: req.auth.lecturerId
  })
    .sort({ timestamp: -1 })
    .populate("studentId", "name matricNo");

  const course = await Course.findById(session.courseId);

  res.json({
    session: {
      id: session.id,
      course,
      expiresAt: session.expiresAt,
      isActive: session.isActive,
      studentLimit: session.studentLimit
    },
    rows: attendance.map((entry) => ({
      id: entry.id,
      timestamp: entry.timestamp,
      student: entry.studentId
    }))
  });
};

export const deleteAttendance = (io) => async (req, res) => {
  const { attendanceId } = req.params;

  const attendance = await Attendance.findOne({
    _id: attendanceId,
    lecturerId: req.auth.lecturerId
  });

  if (!attendance) {
    throw new HttpError(404, "Attendance record not found");
  }

  const sessionId = attendance.sessionId;

  await Attendance.deleteOne({ _id: attendanceId });

  const attendanceCount = await Attendance.countDocuments({ sessionId });
  const session = await Session.findById(sessionId).select("tokenHash isActive studentLimit");

  if (session && !session.isActive && session.studentLimit > attendanceCount) {
    session.studentLimit = attendanceCount;
    await session.save();
  }

  const qrAttendanceCount = session
    ? await Attendance.countDocuments({ sessionId, qrTokenHash: session.tokenHash })
    : 0;

  io.to(`session:${sessionId}`).emit("attendance:deleted", {
    id: attendanceId,
    sessionId,
    attendanceCount,
    qrAttendanceCount
  });

  res.json({ success: true });
};

export const manuallyAddAttendance = (io) => async (req, res) => {
  const { sessionId, studentId } = req.body;

  if (!sessionId || !studentId) {
    throw new HttpError(400, "Session and student are required");
  }

  const session = await Session.findOne({
    _id: sessionId,
    lecturerId: req.auth.lecturerId
  }).populate("courseId");

  if (!session) {
    throw new HttpError(404, "Session not found");
  }

  const student = await Student.findById(studentId);
  if (!student) {
    throw new HttpError(404, "Student not found");
  }

  const alreadyRecorded = await Attendance.findOne({
    studentId: student.id,
    sessionId: session.id
  });

  if (alreadyRecorded) {
    throw new HttpError(409, "Attendance already recorded for this session");
  }

  const attendanceCount = await Attendance.countDocuments({
    sessionId: session.id
  });

  if (session.isActive) {
    throw new HttpError(400, "Manual attendance can only be added after the session has ended.");
  }

  const attendance = await Attendance.create({
    lecturerId: req.auth.lecturerId,
    studentId: student.id,
    sessionId: session.id,
    timestamp: new Date()
  });

  const nextAttendanceCount = attendanceCount + 1;

  if (!session.isActive) {
    session.studentLimit = Math.max(session.studentLimit, nextAttendanceCount);
    await session.save();
  }

  io.to(`session:${session.id}`).emit("attendance:created", {
    id: attendance.id,
    sessionId: session.id,
    attendanceCount: nextAttendanceCount,
    qrAttendanceCount: nextAttendanceCount,
    student: {
      id: student.id,
      name: student.name,
      matricNo: student.matricNo
    },
    timestamp: attendance.timestamp
  });

  res.status(201).json({
    id: attendance.id,
    timestamp: attendance.timestamp,
    course: session.courseId
  });
};

export const getAvailableStudents = async (req, res) => {
  const { sessionId, searchQuery } = req.query;

  if (!sessionId) {
    throw new HttpError(400, "Session is required");
  }

  const session = await Session.findOne({
    _id: sessionId,
    lecturerId: req.auth.lecturerId
  });

  if (!session) {
    throw new HttpError(404, "Session not found");
  }

  let query = {};

  if (searchQuery) {
    query.$or = [
      { name: { $regex: searchQuery, $options: "i" } },
      { matricNo: { $regex: searchQuery, $options: "i" } }
    ];
  }

  const students = await Student.find(query).select("_id name matricNo");

  const attendedStudents = await Attendance.find({
    sessionId: session.id
  }).select("studentId");

  const attendedSet = new Set(attendedStudents.map((a) => a.studentId.toString()));

  const available = students.filter((s) => !attendedSet.has(s._id.toString()));

  res.json(available);
};
