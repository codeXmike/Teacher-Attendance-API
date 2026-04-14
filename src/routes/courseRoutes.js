import { Router } from "express";
import { createCourse, listCourses } from "../controllers/courseController.js";
import { authenticate } from "../middleware/auth.js";
import { asyncHandler } from "../utils/asyncHandler.js";

export const courseRoutes = Router();

courseRoutes.use(authenticate(["lecturer"]));
courseRoutes.get("/", asyncHandler(listCourses));
courseRoutes.post("/", asyncHandler(createCourse));
