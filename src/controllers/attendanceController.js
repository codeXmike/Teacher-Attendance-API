import jwt from "jsonwebtoken";
import { Attendance } from "../models/Attendance.js";
import { Course } from "../models/Course.js";
import { Session } from "../models/Session.js";
import { Student } from "../models/Student.js";
import { hashToken } from "../utils/crypto.js";
import { HttpError } from "../utils/errors.js";
import { validateLocation } from "../utils/validation.js";
import { env } from "../config/env.js";

export const scanAttendance = (io) => async (req, res) => {
  const { token, studentId, lecturerId, location } = req.body;

  if (!token) {
    throw new HttpError(400, "Token is required");
  }

  if (location) {
    try {
      validateLocation(location);
    } catch (err) {
      throw new HttpError(400, err.message);
    }
  }

  let authPayload = null;
  const authorization = req.headers.authorization || "";
  if (authorization.startsWith("Bearer ")) {
    const jwtToken = authorization.slice(7);
    try {
      authPayload = jwt.verify(jwtToken, env.jwtSecret);
    } catch {
      throw new HttpError(401, "Invalid authentication token");
    }
  }

  const authStudentId = authPayload?.id;
  const authLecturerId = authPayload?.lecturerId;

  const finalStudentId = authStudentId || studentId;
  const finalLecturerId = authLecturerId || lecturerId;

  if (!finalStudentId || !finalLecturerId) {
    throw new HttpError(400, "Student and lecturer identification required");
  }

  // ✅ FIXED (no lecturerId check)
  const student = await Student.findById(finalStudentId);
  if (!student) {
    throw new HttpError(404, "Student not found");
  }

  const session = await Session.findOne({
    lecturerId: finalLecturerId,
    tokenHash: hashToken(token),
    isActive: true
  }).populate("courseId");

  if (!session || session.expiresAt.getTime() < Date.now()) {
    throw new HttpError(400, "Session token is invalid or expired");
  }

  const alreadyRecorded = await Attendance.findOne({
    studentId: student.id,
    sessionId: session.id
  });

  if (alreadyRecorded) {
    throw new HttpError(409, "Attendance already recorded for this session");
  }

  const attendance = await Attendance.create({
    lecturerId: finalLecturerId,
    studentId: student.id,
    sessionId: session.id,
    timestamp: new Date()
  });

  const attendanceCount = await Attendance.countDocuments({
    sessionId: session.id
  });

  io.to(`session:${session.id}`).emit("attendance:created", {
    id: attendance.id,
    sessionId: session.id,
    attendanceCount,
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
      isActive: session.isActive
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

  io.to(`session:${sessionId}`).emit("attendance:deleted", {
    id: attendanceId,
    sessionId,
    attendanceCount
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

  // ✅ FIXED (no lecturerId check)
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

  const attendance = await Attendance.create({
    lecturerId: req.auth.lecturerId,
    studentId: student.id,
    sessionId: session.id,
    timestamp: new Date()
  });

  const attendanceCount = await Attendance.countDocuments({
    sessionId: session.id
  });

  io.to(`session:${session.id}`).emit("attendance:created", {
    id: attendance.id,
    sessionId: session.id,
    attendanceCount,
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

  const course = await Course.findById(session.courseId);

  // ✅ FIXED (no lecturerId filter)
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

  const attendedSet = new Set(
    attendedStudents.map((a) => a.studentId.toString())
  );

  const available = students.filter(
    (s) => !attendedSet.has(s._id.toString())
  );

  res.json(available);
};