import mongoose from "mongoose";

const sessionSchema = new mongoose.Schema(
  {
    courseId: { type: mongoose.Schema.Types.ObjectId, ref: "Course", required: true, index: true },
    lecturerId: { type: mongoose.Schema.Types.ObjectId, ref: "Lecturer", required: true, index: true },
    tokenHash: { type: String, required: true },
    rotationIntervalSeconds: { type: Number, required: true },
    isActive: { type: Boolean, default: true, index: true },
  },
  { timestamps: true }
);

export const Session = mongoose.model("Session", sessionSchema);
