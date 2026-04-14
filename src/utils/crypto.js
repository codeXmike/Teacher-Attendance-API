import crypto from "crypto";
import { env } from "../config/env.js";

export const generateSecureToken = () => crypto.randomBytes(32).toString("hex");

export const hashToken = (token) =>
  crypto.createHmac("sha256", env.jwtSecret).update(token).digest("hex");
