import mongoose from "mongoose";

const sessionSchema = new mongoose.Schema(
  {
    courseId: { type: mongoose.Schema.Types.ObjectId, ref: "Course", required: true, index: true },
    lecturerId: { type: mongoose.Schema.Types.ObjectId, ref: "Lecturer", required: true, index: true },
    tokenValue: { type: String, default: null },
    tokenHash: { type: String, required: true },
    expiresAt: { type: Date, default: null },
    rotationIntervalSeconds: { type: Number, required: true },
    studentLimit: { type: Number, default: 0, min: 0 },
    isActive: { type: Boolean, default: true, index: true },
  },
  { timestamps: true }
);

export const Session = mongoose.model("Session", sessionSchema);
