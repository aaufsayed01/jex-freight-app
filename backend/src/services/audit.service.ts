import { prisma } from "../prisma";
import { AuditAction, AuditEntity } from "@prisma/client";

type LogAuditInput = {
  action: AuditAction;
  entity: AuditEntity;
  entityId?: string | null;
  message?: string;
  userId?: string | null;
  companyId?: string | null;
  ip?: string;
  userAgent?: string;
  metadata?: unknown;
};


export async function logAudit(input: LogAuditInput) {
  try {
    await prisma.auditLog.create({
      data: {
        action: input.action,
        entity: input.entity,
        entityId: input.entityId,
        message: input.message,
        userId: input.userId,
        companyId: input.companyId,
        ip: input.ip,
        userAgent: input.userAgent,
        metadata: input.metadata as any,
      },
    });
  } catch (err) {
    // Don't block business flows if audit logging fails
    console.error("Audit log failed:", err);
  }
}

// helpers for Express req context
export function getReqContext(req: any) {
  const xf = req.headers?.["x-forwarded-for"];
  const ip =
    (Array.isArray(xf) ? xf[0] : typeof xf === "string" ? xf.split(",")[0] : undefined) ||
    req.ip ||
    req.socket?.remoteAddress;

  const userAgent = req.headers?.["user-agent"];
  return { ip: ip?.toString(), userAgent: userAgent?.toString() };
}
