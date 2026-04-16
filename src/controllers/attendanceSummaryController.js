import { Attendance } from "../models/Attendance.js";
import { Course } from "../models/Course.js";
import { Session } from "../models/Session.js";
import { Student } from "../models/Student.js";
import { HttpError } from "../utils/errors.js";

export const getAttendanceSummary = async (req, res) => {
  const { courseId } = req.params;
  if (!courseId) {
    throw new HttpError(400, "Course ID is required");
  }

  // Verify the course belongs to the lecturer
  const course = await Course.findOne({
    _id: courseId,
    lecturerId: req.auth.lecturerId
  });
  if (!course) {
    throw new HttpError(404, "Course not found");
  }

  // Get all sessions for this course
  const sessions = await Session.find({
    courseId: courseId,
    lecturerId: req.auth.lecturerId
  });
  const totalSessions = sessions.length;
  const sessionIds = sessions.map(s => s._id);

  // Get all attendance records for this course's sessions
  const attendanceRecords = await Attendance.find({
    sessionId: { $in: sessionIds },
    lecturerId: req.auth.lecturerId
  }).populate("studentId", "name matricNo");

  if (totalSessions === 0 || attendanceRecords.length === 0) {
    return res.json({
      totalStudents: 0,
      totalSessions,
      averageAttendance: 0,
      students: []
    });
  }

  // Build a map of unique students and their attendance counts
  // keyed by studentId string
  const studentMap = new Map();

  attendanceRecords.forEach(record => {
    const student = record.studentId; // populated
    const studentId = student._id.toString();

    if (!studentMap.has(studentId)) {
      studentMap.set(studentId, {
        id: student._id,
        name: student.name,
        matricNo: student.matricNo,
        presentCount: 0,
        totalSessions
      });
    }

    studentMap.get(studentId).presentCount += 1;
  });

  const studentSummaries = Array.from(studentMap.values()).sort((a, b) =>
    a.name.localeCompare(b.name)
  );

  // Calculate average attendance percentage across all known students
  const totalAttendancePercentage = studentSummaries.reduce((sum, student) => {
    return sum + (student.presentCount / student.totalSessions) * 100;
  }, 0);

  const averageAttendance =
    studentSummaries.length > 0
      ? totalAttendancePercentage / studentSummaries.length
      : 0;

  res.json({
    totalStudents: studentSummaries.length,
    totalSessions,
    averageAttendance: Math.round(averageAttendance * 10) / 10,
    students: studentSummaries
  });
};