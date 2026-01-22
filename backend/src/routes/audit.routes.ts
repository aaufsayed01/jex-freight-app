import { Router } from "express";
import { prisma } from "../prisma";
import { authMiddleware, AuthRequest } from "../auth";

const router = Router();

/**
 * GET /api/audit-logs
 * Admin/Internal only
 * Query params:
 * - companyId (optional for ADMIN, ignored for others)
 * - userId
 * - entity
 * - entityId
 * - action
 * - from (ISO date)
 * - to (ISO date)
 * - take (default 50, max 200)
 * - cursor (createdAt ISO) + cursorId (id) for stable pagination
 */
router.get("/audit-logs", authMiddleware, async (req: AuthRequest, res) => {
  try {
    if (!req.user) return res.status(401).json({ error: "Unauthorized" });

    const isStaff = req.user.role === "ADMIN" || req.user.role === "INTERNAL_STAFF";
    if (!isStaff) return res.status(403).json({ error: "Forbidden" });

    const {
      companyId: companyIdQuery,
      userId,
      entity,
      entityId,
      action,
      from,
      to,
      take,
      cursor,
      cursorId,
    } = req.query as Record<string, string | undefined>;

    // Staff scoping:
    // - INTERNAL_STAFF can only see their own company
    // - ADMIN can optionally filter by companyId, otherwise default to their company if present
    const companyId =
      req.user.role === "INTERNAL_STAFF"
        ? (req.user.companyId ?? null)
        : (companyIdQuery ?? req.user.companyId ?? null);

    if (!companyId) {
      return res.status(400).json({ error: "No company scope available" });
    }

    const parsedFrom = from ? new Date(from) : null;
    const parsedTo = to ? new Date(to) : null;
    if (parsedFrom && Number.isNaN(parsedFrom.getTime())) return res.status(400).json({ error: "from is invalid ISO date" });
    if (parsedTo && Number.isNaN(parsedTo.getTime())) return res.status(400).json({ error: "to is invalid ISO date" });

    const takeNum = Math.min(Math.max(Number(take ?? 50), 1), 200);

    // Stable pagination: sort by createdAt desc, then id desc.
    // If cursor provided, fetch "older than" cursor.
    const where: any = {
      companyId,
      ...(userId ? { userId } : {}),
      ...(entity ? { entity } : {}),
      ...(entityId ? { entityId } : {}),
      ...(action ? { action } : {}),
      ...(parsedFrom || parsedTo
        ? {
            createdAt: {
              ...(parsedFrom ? { gte: parsedFrom } : {}),
              ...(parsedTo ? { lte: parsedTo } : {}),
            },
          }
        : {}),
    };

    // Cursor logic:
    // If cursor date provided, we want createdAt < cursor OR (createdAt = cursor AND id < cursorId)
    if (cursor) {
      const cursorDate = new Date(cursor);
      if (Number.isNaN(cursorDate.getTime())) return res.status(400).json({ error: "cursor is invalid ISO date" });
      if (!cursorId) return res.status(400).json({ error: "cursorId is required when cursor is provided" });

      where.OR = [
        { createdAt: { lt: cursorDate } },
        { createdAt: cursorDate, id: { lt: cursorId } },
      ];
    }

    const rows = await prisma.auditLog.findMany({
      where,
      orderBy: [{ createdAt: "desc" }, { id: "desc" }],
      take: takeNum,
      select: {
        id: true,
        action: true,
        entity: true,
        entityId: true,
        message: true,
        userId: true,
        companyId: true,
        ip: true,
        userAgent: true,
        metadata: true,
        createdAt: true,
        user: { select: { id: true, email: true, fullName: true, role: true } },
      },
    });

    const nextCursor =
      rows.length > 0
        ? { cursor: rows[rows.length - 1].createdAt.toISOString(), cursorId: rows[rows.length - 1].id }
        : null;

    return res.json({ items: rows, nextCursor });
  } catch (err) {
    console.error("Error in GET /audit-logs:", err);
    return res.status(500).json({ error: "Internal server error" });
  }
});

/**
 * GET /api/audit-logs/:id
 * Admin/Internal only
 */
router.get("/audit-logs/:id", authMiddleware, async (req: AuthRequest, res) => {
  try {
    if (!req.user) return res.status(401).json({ error: "Unauthorized" });

    const isStaff = req.user.role === "ADMIN" || req.user.role === "INTERNAL_STAFF";
    if (!isStaff) return res.status(403).json({ error: "Forbidden" });

    const id = req.params.id;

    const row = await prisma.auditLog.findUnique({
      where: { id },
      include: {
        user: { select: { id: true, email: true, fullName: true, role: true } },
        company: { select: { id: true, name: true, type: true } },
      },
    });

    if (!row) return res.status(404).json({ error: "Audit log not found" });

    // Company scoping: INTERNAL_STAFF only their company
    if (req.user.role === "INTERNAL_STAFF" && row.companyId !== req.user.companyId) {
      return res.status(403).json({ error: "Forbidden" });
    }

    // ADMIN: allow (or enforce same company if you want; current allows cross-company only if you have it)
    if (req.user.role === "ADMIN" && req.user.companyId && row.companyId !== req.user.companyId) {
      // If you want to lock admin to company scope, uncomment:
      // return res.status(403).json({ error: "Forbidden" });
    }

    return res.json(row);
  } catch (err) {
    console.error("Error in GET /audit-logs/:id:", err);
    return res.status(500).json({ error: "Internal server error" });
  }
});

export default router;
