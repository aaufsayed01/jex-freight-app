// src/services/notifications.service.ts
import { prisma } from "../prisma";
import { NotificationType, UserRole } from "@prisma/client";

export async function notifyUsers(params: {
  companyId: string;
  userIds: string[];
  type: NotificationType;
  title: string;
  message: string;
  entityType?: string | null;
  entityId?: string | null;
}) {
  if (!params.userIds.length) return { count: 0 };

  return prisma.notification.createMany({
    data: params.userIds.map((id) => ({
      companyId: params.companyId,
      userId: id,
      type: params.type,
      title: params.title,
      message: params.message,
      entityType: params.entityType ?? null,
      entityId: params.entityId ?? null,
      readAt: null,
    })),
  });
}

export async function notifyCompanyUsers(params: {
  companyId: string;
  type: NotificationType;
  title: string;
  message: string;
  entityType?: string | null;
  entityId?: string | null;
  roles?: UserRole[];
}) {
  const users = await prisma.user.findMany({
    where: {
      companyId: params.companyId,
      isActive: true,
      ...(params.roles?.length ? { role: { in: params.roles } } : {}),
    },
    select: { id: true },
  });

  return notifyUsers({
    companyId: params.companyId,
    userIds: users.map((u) => u.id),
    type: params.type,
    title: params.title,
    message: params.message,
    entityType: params.entityType ?? null,
    entityId: params.entityId ?? null,
  });
}

// ✅ company-wide notification (userId = null)
export async function notifyCompanyWide(params: {
  companyId: string;
  type: NotificationType;
  title: string;
  message: string;
  entityType?: string | null;
  entityId?: string | null;
}) {
  return prisma.notification.create({
    data: {
      companyId: params.companyId,
      userId: null,
      type: params.type,
      title: params.title,
      message: params.message,
      entityType: params.entityType ?? null,
      entityId: params.entityId ?? null,
      readAt: null,
    },
  });
}

