import mongoose from "mongoose";

const attendanceSchema = new mongoose.Schema(
  {
    lecturerId: { type: mongoose.Schema.Types.ObjectId, ref: "Lecturer", required: true, index: true },
    studentId: { type: mongoose.Schema.Types.ObjectId, ref: "Student", required: true, index: true },
    sessionId: { type: mongoose.Schema.Types.ObjectId, ref: "Session", required: true, index: true },
    timestamp: { type: Date, default: Date.now },
    
  },
  { timestamps: true }
);

attendanceSchema.index({ studentId: 1, sessionId: 1 }, { unique: true });

export const Attendance = mongoose.model("Attendance", attendanceSchema);
