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

  // Get all students for this lecturer
  const students = await Student.find({
    lecturerId: req.auth.lecturerId
  }).sort({ name: 1 });

  if (students.length === 0) {
    return res.json({
      totalStudents: 0,
      averageAttendance: 0,
      students: []
    });
  }

  // Get all sessions for this course
  const sessions = await Session.find({
    courseId: courseId,
    lecturerId: req.auth.lecturerId
  });

  const totalSessions = sessions.length;

  if (totalSessions === 0) {
    // No sessions yet, return students with 0 attendance
    const studentSummaries = students.map(student => ({
      id: student._id,
      name: student.name,
      matricNo: student.matricNo,
      presentCount: 0,
      totalSessions: 0
    }));

    return res.json({
      totalStudents: students.length,
      averageAttendance: 0,
      students: studentSummaries
    });
  }

  // Get all session IDs
  const sessionIds = sessions.map(s => s._id);

  // Get attendance records for all sessions in this course
  const attendanceRecords = await Attendance.find({
    lecturerId: req.auth.lecturerId,
    sessionId: { $in: sessionIds }
  });

  // Create a map of student attendance counts
  const attendanceMap = new Map();
  
  // Initialize map with all students
  students.forEach(student => {
    attendanceMap.set(student._id.toString(), {
      presentCount: 0,
      totalSessions: totalSessions
    });
  });

  // Count attendance per student
  attendanceRecords.forEach(record => {
    const studentId = record.studentId.toString();
    if (attendanceMap.has(studentId)) {
      const current = attendanceMap.get(studentId);
      attendanceMap.set(studentId, {
        ...current,
        presentCount: current.presentCount + 1
      });
    }
  });

  // Build the response array
  const studentSummaries = students.map(student => {
    const stats = attendanceMap.get(student._id.toString());
    return {
      id: student._id,
      name: student.name,
      matricNo: student.matricNo,
      presentCount: stats.presentCount,
      totalSessions: stats.totalSessions
    };
  });

  // Calculate average attendance percentage
  let totalAttendancePercentage = 0;
  studentSummaries.forEach(student => {
    const percentage = student.totalSessions > 0 
      ? (student.presentCount / student.totalSessions) * 100 
      : 0;
    totalAttendancePercentage += percentage;
  });
  
  const averageAttendance = studentSummaries.length > 0 
    ? totalAttendancePercentage / studentSummaries.length 
    : 0;

  res.json({
    totalStudents: students.length,
    averageAttendance: Math.round(averageAttendance * 10) / 10, // Round to 1 decimal
    students: studentSummaries
  });
};