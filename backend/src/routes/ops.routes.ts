import { Router } from "express";
import { prisma } from "../prisma";
import { authMiddleware, AuthRequest } from "../auth";
import { ShipmentStatus } from "@prisma/client";

const router = Router();

function isOps(role: string) {
  return role === "ADMIN" || role === "INTERNAL_STAFF";
}

/**
 * GET /api/ops/shipments/awaiting-documents
 * Ops dashboard: shipments that are awaiting documents + pending counts/types
 */
router.get(
  "/ops/shipments/awaiting-documents",
  authMiddleware,
  async (req: AuthRequest, res) => {
    try {
      if (!req.user) return res.status(401).json({ error: "Unauthorized" });
      if (!isOps(req.user.role)) return res.status(403).json({ error: "Forbidden (ops only)" });

      const { companyId, limit, sort } = req.query as {
        companyId?: string;
        limit?: string;
        sort?: string;
      };

      const take = Math.min(Math.max(Number(limit || 50), 1), 200); // default 50, max 200

      // base where: awaiting docs
      const where: any = {
        status: ShipmentStatus.AWAITING_DOCUMENTS,
        ...(companyId ? { companyId } : {}),
      };

      const shipments = await prisma.shipment.findMany({
        where,
        // default view: most recently updated first
        orderBy: { updatedAt: "desc" },
        take,
        select: {
          id: true,
          shipmentRef: true,
          status: true,
          origin: true,
          destination: true,
          updatedAt: true,
          createdAt: true,
          companyId: true,
          company: { select: { name: true } },
          documentRequests: {
            where: { status: "PENDING" },
            orderBy: { createdAt: "asc" },
            select: { id: true, type: true, dueDate: true, createdAt: true },
          },
        },
      });

      // Map + compute SLA fields
      const mapped = shipments.map((s) => {
        const pendingDocs = s.documentRequests.map((r) => r.type);
        const pendingCount = pendingDocs.length;

        const oldestRequestAt = s.documentRequests[0]?.createdAt ?? null;

        const nearestDueDate =
          s.documentRequests
            .map((r) => r.dueDate)
            .filter(Boolean)
            .sort((a, b) => a!.getTime() - b!.getTime())[0] ?? null;

        return {
          shipmentId: s.id,
          shipmentRef: s.shipmentRef,
          companyId: s.companyId,
          companyName: s.company?.name ?? null,

          status: s.status,
          origin: s.origin,
          destination: s.destination,

          pendingCount,
          pendingDocs,

          oldestRequestAt,
          nearestDueDate,

          updatedAt: s.updatedAt,
          createdAt: s.createdAt,
        };
      });

      // Only shipments with actual pending requests
      let filtered = mapped.filter((x) => x.pendingCount > 0);

      // Optional SLA sort: oldest pending request first
      if ((sort || "").toLowerCase() === "oldest") {
        filtered = filtered.sort((a, b) => {
          const at = a.oldestRequestAt ? new Date(a.oldestRequestAt).getTime() : Number.POSITIVE_INFINITY;
          const bt = b.oldestRequestAt ? new Date(b.oldestRequestAt).getTime() : Number.POSITIVE_INFINITY;
          return at - bt;
        });
      }

      return res.json({
        filters: {
          companyId: companyId ?? null,
          limit: take,
          sort: sort ?? "updatedAt_desc",
        },
        totalReturned: filtered.length,
        shipments: filtered,
      });
    } catch (err: any) {
      console.error("Error in GET /ops/shipments/awaiting-documents:", err);
      return res.status(500).json({ error: err.message || "Server error" });
    }
  }
);

router.get(
  "/ops/shipments/attention",
  authMiddleware,
  async (req: AuthRequest, res) => {
    try {
      if (!req.user) return res.status(401).json({ error: "Unauthorized" });
      if (!isOps(req.user.role)) return res.status(403).json({ error: "Forbidden (ops only)" });

      const { companyId, limit, q } = req.query as {
        companyId?: string;
        limit?: string;
        q?: string;
      };

      const take = Math.min(Math.max(Number(limit || 50), 1), 200);

      const where: any = {
        status: { in: [ShipmentStatus.EXCEPTION, ShipmentStatus.ON_HOLD] },
        ...(companyId ? { companyId } : {}),
        ...(q
          ? {
              OR: [
                { shipmentRef: { contains: q, mode: "insensitive" } },
                { company: { name: { contains: q, mode: "insensitive" } } },
              ],
            }
          : {}),
      };

      const shipments = await prisma.shipment.findMany({
        where,
        orderBy: { updatedAt: "desc" },
        take,
        select: {
          id: true,
          shipmentRef: true,
          status: true,
          origin: true,
          destination: true,
          updatedAt: true,
          createdAt: true,
          companyId: true,
          company: { select: { name: true } },
          trackingEvents: {
            orderBy: { createdAt: "desc" },
            take: 1,
            select: { status: true, description: true, location: true, eventTime: true },
          },
        },
      });

      return res.json({
        filters: {
          companyId: companyId ?? null,
          limit: take,
          q: q ?? null,
        },
        totalReturned: shipments.length,
        shipments: shipments.map((s) => ({
          shipmentId: s.id,
          shipmentRef: s.shipmentRef,
          companyId: s.companyId,
          companyName: s.company?.name ?? null,
          status: s.status,
          origin: s.origin,
          destination: s.destination,
          lastEvent: s.trackingEvents[0] ?? null,
          updatedAt: s.updatedAt,
          createdAt: s.createdAt,
        })),
      });
    } catch (err: any) {
      console.error("Error in GET /ops/shipments/attention:", err);
      return res.status(500).json({ error: err.message || "Server error" });
    }
  }
);

export default router;
