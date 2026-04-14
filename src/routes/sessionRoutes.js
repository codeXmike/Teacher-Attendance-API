import { Router } from "express";
import { getSession, listSessions, rotateSession, startSession, stopSession } from "../controllers/sessionController.js";
import { authenticate } from "../middleware/auth.js";
import { asyncHandler } from "../utils/asyncHandler.js";

export const createSessionRoutes = (io) => {
  const router = Router();

  router.use(authenticate(["lecturer"]));
  router.get("/", asyncHandler(listSessions));
  router.post("/start", asyncHandler(startSession(io)));
  router.get("/:id", asyncHandler(getSession));
  router.post("/:id/rotate", asyncHandler(rotateSession(io)));
  router.post("/:id/stop", asyncHandler(stopSession(io)));

  return router;
};
