import jwt from "jsonwebtoken";
import { Request, Response, NextFunction } from "express";
import { prisma } from "./prisma";
import { UserRole } from "@prisma/client";

const secret = process.env.JWT_SECRET;

if (!secret) {
  throw new Error("JWT_SECRET is not set in .env");
}

const JWT_SECRET: string = secret;

/**
 * What you store inside the JWT (keep it minimal).
 */
export interface JwtPayload {
  userId: string;
}

/**
 * What you attach to req.user after looking up the user in DB.
 */
export type AuthUser = {
  id: string;
  email: string;
  fullName: string;
  role: UserRole;
  companyId: string | null;
  isActive: boolean;
  isEmailVerified: boolean;
  emailVerifiedAt: Date | null;
};

export interface AuthRequest extends Request {
  user?: AuthUser;
}

export function generateToken(payload: JwtPayload) {
  return jwt.sign(payload, JWT_SECRET, { expiresIn: "7d" });
}

export async function authMiddleware(req: AuthRequest, res: Response, next: NextFunction) {
  const authHeader = req.headers.authorization;

  if (!authHeader || !authHeader.startsWith("Bearer ")) {
    return res.status(401).json({ error: "Missing or invalid Authorization header" });
  }

  const token = authHeader.split(" ")[1];

  try {
    const decoded = jwt.verify(token, JWT_SECRET) as jwt.JwtPayload;

    const userId = decoded.userId as string | undefined;
    if (!userId) return res.status(401).json({ error: "Invalid token payload" });

    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: {
        id: true,
        email: true,
        fullName: true,
        role: true,
        companyId: true,
        isActive: true,
        isEmailVerified: true,
        emailVerifiedAt: true,
      },
    });

    if (!user) return res.status(401).json({ error: "Unauthorized" });
    if (!user.isActive) return res.status(403).json({ error: "Account is inactive" });

    req.user = user;
    return next();
  } catch (err) {
    console.error("JWT verification error:", err);
    return res.status(401).json({ error: "Invalid or expired token" });
  }
}

