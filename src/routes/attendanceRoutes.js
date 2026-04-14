import { Router } from "express";
import { listAttendanceBySession, scanAttendance, deleteAttendance, manuallyAddAttendance, getAvailableStudents } from "../controllers/attendanceController.js";
import { getAttendanceSummary } from "../controllers/attendanceSummaryController.js";
import { authenticate } from "../middleware/auth.js";
import { asyncHandler } from "../utils/asyncHandler.js";

export const createAttendanceRoutes = (io) => {
  const router = Router();

  router.post("/scan", asyncHandler(scanAttendance(io)));
  router.get("/session/:id", authenticate(["lecturer"]), asyncHandler(listAttendanceBySession));
  router.delete("/:attendanceId", authenticate(["lecturer"]), asyncHandler(deleteAttendance(io)));
  router.post("/manual", authenticate(["lecturer"]), asyncHandler(manuallyAddAttendance(io)));
  router.get("/available/students", authenticate(["lecturer"]), asyncHandler(getAvailableStudents));
  router.get("/summary/:courseId", authenticate(["lecturer"]), asyncHandler(getAttendanceSummary));

  return router;
};