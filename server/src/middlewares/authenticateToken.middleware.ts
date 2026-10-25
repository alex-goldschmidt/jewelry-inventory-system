import jwt from "jsonwebtoken";
import { ForbiddenError, UnauthorizedError } from "../config/exceptions";
import { Request, Response, NextFunction } from "express";
import dotenv from "dotenv";
import { getRequiredEnv, JwtSecretEnv } from "../config/env";
import { parseTokenClaims } from "../utils/authClaims";
dotenv.config();

function getAccessTokenSecret(next: NextFunction): string | undefined {
  try {
    return getRequiredEnv(JwtSecretEnv.AccessToken);
  } catch (err) {
    next(err);
    return undefined;
  }
}

export function authenticateToken<P = Record<string, string>>(
  req: Request<P>,
  _res: Response,
  next: NextFunction
): void {
  const authHeader = req.headers.authorization;

  if (!authHeader?.startsWith("Bearer ")) {
    return next(new UnauthorizedError("Missing token"));
  }

  const token = authHeader.slice(7);

  const secret = getAccessTokenSecret(next);
  if (secret === undefined) {
    return;
  }

  try {
    const verifiedPayload = jwt.verify(token, secret, { algorithms: ["HS256"] });
    const decoded = parseTokenClaims(verifiedPayload);
    req.user = decoded;
    return next();
  } catch (err) {
    if (err instanceof jwt.TokenExpiredError) {
      return next(new ForbiddenError("Token expired"));
    }
    if (err instanceof jwt.JsonWebTokenError) {
      return next(new ForbiddenError("Invalid token"));
    }
    return next(new ForbiddenError("Authentication failed"));
  }
}
