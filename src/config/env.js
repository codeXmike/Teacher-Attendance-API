import path from "path";
import { fileURLToPath } from "url";
import dotenv from "dotenv";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
// const rootEnvPath = path.resolve(__dirname, "../../../../.env");
const rootEnvPath = path.resolve(__dirname, "../../.env");

dotenv.config({
  path: process.env.ENV_FILE || rootEnvPath
});

export const env = {
  port: Number(process.env.PORT || 4000),
  mongodbUri: process.env.MONGODB_URI,
  jwtSecret: process.env.JWT_SECRET,
  clientUrl: process.env.CLIENT_URL || "https://teacher-attend.xystems.tech",
  clientUrls: (process.env.CLIENT_URLS || process.env.CLIENT_URL || "https://teacher-attend.xystems.tech")
    .split(",")
    .map((value) => value.trim())
    .filter(Boolean),
  sessionTokenTtlSeconds: Number(process.env.SESSION_TOKEN_TTL_SECONDS || 90),
  sessionRotationSeconds: Number(process.env.SESSION_ROTATION_SECONDS || 75),
  defaultAttendanceRadiusMeters: Number(process.env.DEFAULT_ATTENDANCE_RADIUS_METERS || 100)
};
