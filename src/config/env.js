import path from "path";
import { fileURLToPath } from "url";
import dotenv from "dotenv";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const rootEnvPath = path.resolve(__dirname, "../../../../.env");

dotenv.config({
  path: process.env.ENV_FILE || rootEnvPath
});

export const env = {
  port: Number(process.env.PORT || 4000),
  mongodbUri: process.env.MONGODB_URI || "mongodb://127.0.0.1:27017/attendance_platform",
  jwtSecret: process.env.JWT_SECRET || "development-secret",
  clientUrl: process.env.CLIENT_URL || "http://localhost:5173",
  clientUrls: (process.env.CLIENT_URLS || process.env.CLIENT_URL || "http://localhost:5173")
    .split(",")
    .map((value) => value.trim())
    .filter(Boolean),
  sessionTokenTtlSeconds: Number(process.env.SESSION_TOKEN_TTL_SECONDS || 90),
  sessionRotationSeconds: Number(process.env.SESSION_ROTATION_SECONDS || 75),
  defaultAttendanceRadiusMeters: Number(process.env.DEFAULT_ATTENDANCE_RADIUS_METERS || 100)
};
