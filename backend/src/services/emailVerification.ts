import crypto from "crypto";
import { prisma } from "../prisma";

export function makeVerifyToken() {
  return crypto.randomBytes(32).toString("hex");
}

export function hashToken(token: string) {
  return crypto.createHash("sha256").update(token).digest("hex");
}

export async function createEmailVerification(userId: string) {
  const token = makeVerifyToken();
  const tokenHash = hashToken(token);
  const expiresAt = new Date(Date.now() + 24 * 60 * 60 * 1000); // 24h

  // one token per user (overwrite old)
  await prisma.emailVerificationToken.upsert({
    where: { userId },
    update: { tokenHash, expiresAt },
    create: { userId, tokenHash, expiresAt },
  });

  return token; // send this via email (NOT the hash)
}
