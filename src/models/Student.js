import mongoose from "mongoose";

const studentSchema = new mongoose.Schema(
  {
    name: { type: String, required: true },
    matricNo: { type: String, required: true, trim: true },
    passwordHash: { type: String, required: true },
    deviceId: { type: String, default: null }
  },
  { timestamps: true }
);

studentSchema.index({ matricNo: 1 }, { unique: true });

export const Student = mongoose.model("Student", studentSchema);
