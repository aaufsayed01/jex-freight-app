import { prisma } from "../prisma";
import { UserRole } from "@prisma/client";

export async function assertPricingEditableOrAdmin(quoteId: string, user: any) {
  // Admin is never blocked
  if (user?.role === UserRole.ADMIN) return;

  const q = await prisma.quoteRequest.findUnique({
    where: { id: quoteId },
    select: { pricingLockedAt: true },
  });

  if (q?.pricingLockedAt) {
    const lockedAt = q.pricingLockedAt.toISOString();
    throw new Error(`PRICING_LOCKED:${lockedAt}`);
  }
}
