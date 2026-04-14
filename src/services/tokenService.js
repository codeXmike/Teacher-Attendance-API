import { env } from "../config/env.js";
import { generateSecureToken, hashToken } from "../utils/crypto.js";

export const issueSessionToken = (rotationSeconds = env.sessionTokenTtlSeconds) => {
  const token = generateSecureToken();
  const expiresAt = new Date(Date.now() + rotationSeconds * 1000);

  return {
    token,
    tokenHash: hashToken(token),
    expiresAt
  };
};
