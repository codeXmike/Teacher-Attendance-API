import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";
import { Lecturer } from "../models/Lecturer.js";
import { Student } from "../models/Student.js";
import { env } from "../config/env.js";
import { HttpError } from "../utils/errors.js";

const signToken = (payload) =>
  jwt.sign(payload, env.jwtSecret, {
    expiresIn: "12h"
  });

export const register = async (req, res) => {

  const { role, name, email, password, matricNo, deviceId } = req.body;

  if (!role || !name || !password) {
    throw new HttpError(400, "Role, name, and password are required");
  }

  const passwordHash = await bcrypt.hash(password, 10);

  if (role === "lecturer") {
    if (!email) {
      throw new HttpError(400, "Email is required for lecturers");
    }

    const existing = await Lecturer.findOne({ email: email.toLowerCase() });
    if (existing) {
      throw new HttpError(409, "Lecturer already exists");
    }

    const lecturer = await Lecturer.create({
      name,
      email: email.toLowerCase(),
      passwordHash
    });

    const token = signToken({ id: lecturer.id, role: "lecturer", lecturerId: lecturer.id, name: lecturer.name });
    return res.status(201).json({
      token,
      user: { id: lecturer.id, role: "lecturer", name: lecturer.name, email: lecturer.email, lecturerId: lecturer.id }
    });
  }

  if (role === "student") {
    if (!matricNo) {
      throw new HttpError(400, "Matric number is required for students");
    }

    // const lecturer = await Lecturer.findOne({ email: lecturerEmail.toLowerCase() });
    // if (!lecturer) {
    //   throw new HttpError(404, "Lecturer workspace not found");
    // }

    const existing = await Student.findOne({ matricNo: matricNo.trim() });
    if (existing) {
      throw new HttpError(409, "Student already exists in this attendance workspace");
    }

    const student = await Student.create({
      name,
      matricNo: matricNo.trim(),
      passwordHash,
      deviceId: deviceId || null
    });

    const token = signToken({
      id: student.id,
      role: "student",
      name: student.name,
      matricNo: student.matricNo
    });

    return res.status(201).json({
      token,
      user: {
        id: student.id,
        role: "student",
        name: student.name,
        matricNo: student.matricNo
      }
    });
  }

  throw new HttpError(400, "Unsupported role");
};

export const login = async (req, res) => {
  const { role, email, matricNo, password } = req.body;

  if (!role || !password) {
    throw new HttpError(400, "Role and password are required");
  }

  if (role === "lecturer") {
    const lecturer = await Lecturer.findOne({ email: (email || "").toLowerCase() });
    if (!lecturer || !(await bcrypt.compare(password, lecturer.passwordHash))) {
      throw new HttpError(401, "Invalid credentials");
    }

    const token = signToken({ id: lecturer.id, role: "lecturer", lecturerId: lecturer.id, name: lecturer.name });
    return res.json({
      token,
      user: { id: lecturer.id, role: "lecturer", name: lecturer.name, email: lecturer.email, lecturerId: lecturer.id }
    });
  }

  if (role === "student") {
    // const lecturer = await Lecturer.findOne({ email: (lecturerEmail || "").toLowerCase() });
    // if (!lecturer) {
    //   throw new HttpError(401, "Invalid credentials");
    // }

    const student = await Student.findOne({ matricNo: (matricNo || "").trim() });
    if (!student || !(await bcrypt.compare(password, student.passwordHash))) {
      throw new HttpError(401, "Invalid credentials");
    }

    const token = signToken({
      id: student.id,
      role: "student",
      name: student.name,
      matricNo: student.matricNo
    });

    return res.json({
      token,
      user: {
        id: student.id,
        role: "student",
        name: student.name,
        matricNo: student.matricNo,
      }
    });
  }

  throw new HttpError(400, "Unsupported role");
};
