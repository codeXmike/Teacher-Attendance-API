import mongoose from "mongoose";

const studentSchema = new mongoose.Schema(
  {
    lecturerId: { type: mongoose.Schema.Types.ObjectId, ref: "Lecturer", required: true, index: true },
    name: { type: String, required: true },
    matricNo: { type: String, required: true, trim: true },
    passwordHash: { type: String, required: true },
    deviceId: { type: String, default: null }
  },
  { timestamps: true }
);

studentSchema.index({ lecturerId: 1, matricNo: 1 }, { unique: true });

export const Student = mongoose.model("Student", studentSchema);
