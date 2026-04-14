import { Course } from "../models/Course.js";
import { HttpError } from "../utils/errors.js";

export const listCourses = async (req, res) => {
  const courses = await Course.find({ lecturerId: req.auth.lecturerId }).sort({ courseCode: 1 });
  res.json(courses);
};

export const createCourse = async (req, res) => {
  const { courseCode, courseTitle } = req.body;

  if (!courseCode || !courseTitle) {
    throw new HttpError(400, "Course code and title are required");
  }

  const course = await Course.create({
    lecturerId: req.auth.lecturerId,
    courseCode: courseCode.trim().toUpperCase(),
    courseTitle: courseTitle.trim()
  });

  res.status(201).json(course);
};
