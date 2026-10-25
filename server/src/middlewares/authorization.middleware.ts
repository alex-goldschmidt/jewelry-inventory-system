import { Request, Response, NextFunction } from "express";
import { ForbiddenError, UnauthorizedError } from "../config/exceptions";
import { UserIdStringSchema } from "../utils/authClaims";

/**
 * Authorization middleware that verifies the authenticated user
 * has permission to access the requested resource.
 *
 * This middleware should be used AFTER authenticateToken middleware.
 * It checks if the authenticated user matches the userId in the route params.
 */
export function authorizeUserId(
  req: Request<{ userId: string }>,
  _res: Response,
  next: NextFunction
): void {
  const sub = req.user?.sub;
  if (!sub) {
    throw new UnauthorizedError("Missing user identity");
  }
  if (
    !UserIdStringSchema.safeParse(sub).success ||
    !UserIdStringSchema.safeParse(req.params.userId).success
  ) {
    throw new UnauthorizedError("Invalid user identifier");
  }

  if (Number(sub) !== Number(req.params.userId)) {
    throw new ForbiddenError("You are not authorized to access this user");
  }

  next();
}
