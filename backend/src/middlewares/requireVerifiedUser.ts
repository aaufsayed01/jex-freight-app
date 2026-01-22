import { Response, NextFunction } from "express";
import { AuthRequest } from "../auth";

export function requireEmailVerified(req: AuthRequest, res: Response, next: NextFunction) {
  if (!req.user) return res.status(401).json({ error: "Unauthorized" });

  if (!req.user.isEmailVerified) {
    return res.status(403).json({
      error: "Email not verified. Please verify your email to continue.",
    });
  }

  return next();
}
