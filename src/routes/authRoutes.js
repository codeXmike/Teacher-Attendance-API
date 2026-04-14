import { Router } from "express";
import { asyncHandler } from "../utils/asyncHandler.js";
import { login, register } from "../controllers/authController.js";

export const authRoutes = Router();

authRoutes.post("/register", asyncHandler(register));
authRoutes.post("/login", asyncHandler(login));
