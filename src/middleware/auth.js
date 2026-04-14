import jwt from "jsonwebtoken";
import { env } from "../config/env.js";
import { HttpError } from "../utils/errors.js";

export const authenticate = (allowedRoles = []) => (req, _res, next) => {
  const authorization = req.headers.authorization || "";
  const token = authorization.startsWith("Bearer ") ? authorization.slice(7) : null;

  if (!token) {
    return next(new HttpError(401, "Authentication required"));
  }

  try {
    const payload = jwt.verify(token, env.jwtSecret);

    if (allowedRoles.length > 0 && !allowedRoles.includes(payload.role)) {
      throw new HttpError(403, "Forbidden");
    }

    req.auth = payload;
    next();
  } catch (error) {
    next(error.status ? error : new HttpError(401, "Invalid token"));
  }
};
