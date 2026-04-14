import express from "express";
import cors from "cors";
import { Server } from "socket.io";
import { createServer } from "http";
import { env } from "./config/env.js";
import { authRoutes } from "./routes/authRoutes.js";
import { courseRoutes } from "./routes/courseRoutes.js";
import { createSessionRoutes } from "./routes/sessionRoutes.js";
import { createAttendanceRoutes } from "./routes/attendanceRoutes.js";
import { errorHandler } from "./middleware/errorHandler.js";
import jwt from "jsonwebtoken";

export const createApp = () => {
  const app = express();
  const httpServer = createServer(app);
  const allowedOrigins = new Set(env.clientUrls);
  const isOriginAllowed = (origin) => {
    if (!origin) {
      return true;
    }

    if (allowedOrigins.has(origin)) {
      return true;
    }
    

    if (/^http:\/\/localhost:\d+$/.test(origin) || /^http:\/\/127\.0\.0\.1:\d+$/.test(origin)) {
      return true;
    }

    if (origin === "null") {
      return true;
    }

    return false;
  };

  const corsOptions = {
    origin(origin, callback) {
      if (isOriginAllowed(origin)) {
        callback(null, true);
        return;
      }

      callback(new Error(`CORS blocked for origin: ${origin}`));
    },
    credentials: true
  };

  const io = new Server(httpServer, {
    cors: corsOptions
  });


  io.use((socket, next) => {
    try {
      const token = socket.handshake.auth?.token;
      if (!token) {
        return next(new Error("Authentication required"));
      }
      const payload = jwt.verify(token, env.jwtSecret);
      socket.data.auth = payload;
      next();
    } catch (_error) {
      next(new Error("Invalid token"));
    }
  });

  io.on("connection", (socket) => {
    const auth = socket.data.auth;
    if (auth.role === "lecturer") {
      socket.join(`lecturer:${auth.lecturerId}`);
    }

    if (socket.handshake.query.sessionId) {
      socket.join(`session:${socket.handshake.query.sessionId}`);
    }
  });

  app.use(
    cors(corsOptions)
  );
  app.use(express.json());

  app.get("/", (_req, res) => {
    res.send("Hello World!");
  });
  app.get("/health", (_req, res) => {
    res.json({ status: "ok" });
  });

  app.use("/auth", authRoutes);
  app.use("/courses", courseRoutes);
  app.use("/session", createSessionRoutes(io));
  app.use("/attendance", createAttendanceRoutes(io));
  app.use(errorHandler);

  return { app, httpServer };
};
