import mongoose from "mongoose";

const courseSchema = new mongoose.Schema(
  {
    lecturerId: { type: mongoose.Schema.Types.ObjectId, ref: "Lecturer", required: true, index: true },
    courseCode: { type: String, required: true, trim: true },
    courseTitle: { type: String, required: true, trim: true }
  },
  { timestamps: true }
);

courseSchema.index({ lecturerId: 1, courseCode: 1 }, { unique: true });

export const Course = mongoose.model("Course", courseSchema);
