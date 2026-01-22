import { Router } from "express";
import { prisma } from "../prisma";
import { authMiddleware, AuthRequest } from "../auth";
import { NotificationType, UserRole, ShipmentStatus } from "@prisma/client";
import { notifyCompanyUsers } from "../services/notifications.service";
import { emailShipmentStatusChanged } from "../services/notificationEmail";
import { emailAwaitingDocuments } from "../services/notificationEmail";
import { requireEmailVerified } from "../middlewares/requireVerifiedUser";
import { requireRole } from "../middlewares/requireRole";
import { logAudit, getReqContext } from "../services/audit.service";
import { AuditAction, AuditEntity } from "@prisma/client";

const router = Router();
const STATUS_UPDATE_ROLES = ["ADMIN", "INTERNAL_STAFF"];

/**
 * Quick health check
 * (If your routes are mounted under /api, this becomes GET /api/tracking-ping)
 */
router.get("/tracking-ping", (_req, res) => res.json({ ok: true }));

function isAllowedStatus(status: any): status is ShipmentStatus {
  return Object.values(ShipmentStatus).includes(status);
}

/**
 * Central mapping: status -> default tracking event description
 * (Keeps messages consistent and easy to change later)
 */
const STATUS_EVENT_MAP: Partial<
  Record<ShipmentStatus, { description: string; isMilestone?: boolean }>
> = {
  BOOKED: { description: "Shipment booked" },
  IN_TRANSIT: { description: "Shipment in transit" },
  DEPARTED: { description: "Shipment departed origin", isMilestone: true },
  ARRIVED: { description: "Shipment arrived at destination", isMilestone: true },
  DELIVERED: { description: "Shipment delivered successfully", isMilestone: true },
  CANCELLED: { description: "Shipment cancelled" },
};

/**
 * Optional guardrails: prevent “nonsense” transitions
 * (You can expand this later based on your workflow)
 */
const INVALID_TRANSITIONS: Partial<Record<ShipmentStatus, ShipmentStatus[]>> = {
  DELIVERED: ["IN_TRANSIT", "DEPARTED", "ARRIVED", "BOOKED"],
  CANCELLED: ["DELIVERED"],
};

/**
 * @openapi
 * /shipments/{id}/status:
 *   patch:
 *     tags: [Shipments]
 *     summary: Update shipment status and automatically create a tracking event
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema: { type: string }
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [status]
 *             properties:
 *               status:
 *                 type: string
 *                 example: IN_TRANSIT
 *               description:
 *                 type: string
 *                 example: Departed DXB hub
 *               location:
 *                 type: string
 *                 example: Dubai, UAE
 *               eventTime:
 *                 type: string
 *                 example: "2025-12-14T10:00:00.000Z"
 *     responses:
 *       200:
 *         description: Shipment updated and tracking event created
 */
router.patch("/shipments/:id/status", authMiddleware,requireEmailVerified,requireRole("ADMIN","INTERNAL_STAFF"), async (req: AuthRequest, res) => {
  try {
    if (!req.user) return res.status(401).json({ error: "Unauthorized" });

    const shipmentId = req.params.id;
    // ✅ FIX: define companyId properly
    const companyId = req.user.companyId;
    if (!companyId) return res.status(400).json({ error: "User not linked to a company" });

    const { status, description, location, eventTime } = req.body as {
      status: ShipmentStatus;
      description?: string;
      location?: string;
      eventTime?: string;
    };

    if (!status) return res.status(400).json({ error: "status is required" });
    if (!isAllowedStatus(status)) {
      return res.status(400).json({
        error: `Invalid status. Allowed: ${Object.values(ShipmentStatus).join(", ")}`,
      });
    }

    const shipment = await prisma.shipment.findUnique({
      where: { id: shipmentId },
      select: { id: true, companyId: true, status: true, currentLocation: true },
    });

    if (!shipment) return res.status(404).json({ error: "Shipment not found" });

     // ✅ Recommended: only ADMIN updates shipment status
   const canUpdateStatus =
     req.user.role === "ADMIN" ||
     req.user.role === "INTERNAL_STAFF";

   if (shipment.companyId !== companyId) {
     return res.status(403).json({ error: "Forbidden" });
    }

    // ✅ Prevent no-op spam events
    if (shipment.status === status) {
      return res.status(200).json({ ok: true, message: "Status unchanged", shipment });
    }

    // ✅ Optional invalid transition guard
    if (INVALID_TRANSITIONS[shipment.status]?.includes(status)) {
      return res.status(400).json({
        error: `Cannot change status from ${shipment.status} to ${status}`,
      });
    }

    // Parse event time
    const parsedEventTime = eventTime ? new Date(eventTime) : new Date();
    if (Number.isNaN(parsedEventTime.getTime())) {
      return res.status(400).json({ error: "eventTime is invalid ISO date" });
    }

    const result = await prisma.$transaction(async (tx) => {
      // ✅ Update shipment (and milestone timestamps)
      const updatedShipment = await tx.shipment.update({
        where: { id: shipmentId },
        data: {
          status,
          currentLocation: location ?? undefined,
          ...(status === "DEPARTED" && { atd: parsedEventTime }),
          ...(status === "ARRIVED" && { ata: parsedEventTime }),
        },

        
      });

      // ✅ Create tracking event automatically
      const trackingEvent = await tx.trackingEvent.create({
        data: {
          shipmentId,
          status,
          description:
            description ??
            STATUS_EVENT_MAP[status]?.description ??
            `Status changed to ${status}`,
          location: location ?? updatedShipment.currentLocation ?? shipment.currentLocation ?? null,
          eventTime: parsedEventTime,
        },
      });

      await logAudit({
           action: AuditAction.CREATE,
           entity: AuditEntity.SHIPMENT,
           entityId: shipmentId,
           message: "Tracking event created",
           userId: req.user?.id ?? null,
           companyId,
           ...getReqContext(req),
           metadata: {
             trackingEventId: trackingEvent.id,
              status,
              location: location ?? null,
              eventTime: parsedEventTime.toISOString(),
              description: trackingEvent.description,
            },
        });


      // fetch customer email + shipment ref (adjust fields to your schema)
      const fullShipment = await tx.shipment.findUnique({
          where: { id: shipmentId },
          select: {
          id: true,
          shipmentRef: true, // if you have it
          owner: { select: { email: true } },
        },
      });

        await emailShipmentStatusChanged({
          toCustomerEmail: fullShipment?.owner.email ?? null,
          shipmentRef: fullShipment?.shipmentRef ?? shipmentId,
          status,
          description,
          location,
          eventTime: parsedEventTime,
        });

        if (status === ShipmentStatus.AWAITING_DOCUMENTS) {
         await emailAwaitingDocuments({
             toCustomerEmail: fullShipment?.owner.email ?? null,
             shipmentRef: fullShipment?.shipmentRef ?? shipmentId,
           });
        }
      await notifyCompanyUsers({
         companyId,
         type: NotificationType.SHIPMENT_STATUS,
         title: `Shipment ${updatedShipment.shipmentRef} status updated`,
         message: `Status changed to ${status}${location ? ` at ${location}` : ""}.`,
         entityType: "SHIPMENT",
         entityId: shipmentId,
         roles: [UserRole.CORPORATE_CLIENT, UserRole.INTERNAL_STAFF, UserRole.ADMIN],
       });

      await logAudit({
         action: AuditAction.STATUS_CHANGE,
         entity: AuditEntity.SHIPMENT,
         entityId: shipmentId,
         message: `Shipment status changed from ${shipment.status} to ${status}`,
         userId: req.user?.id ?? null,
         companyId,
         ...getReqContext(req),
         metadata: {
             from: shipment.status,
             to: status,
             location: location ?? null,
             eventTime: parsedEventTime.toISOString(),
            },
        });

      return { updatedShipment, trackingEvent };
    });

    return res.json(result);
  } catch (err) {
    console.error("Error in PATCH /shipments/:id/status:", err);
    return res.status(500).json({ error: "Internal server error" });
  }
});

/**
 * @openapi
 * /shipments/{id}/tracking:
 *   get:
 *     tags: [Shipments]
 *     summary: Get tracking timeline for a shipment
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema: { type: string }
 *     responses:
 *       200:
 *         description: List of tracking events
 */
router.get("/shipments/:id/tracking", authMiddleware, async (req: AuthRequest, res) => {
  try {
    if (!req.user) return res.status(401).json({ error: "Unauthorized" });

    const shipmentId = req.params.id;
    const companyId = req.user.companyId;
    if (!companyId) return res.status(400).json({ error: "User not linked to a company" });

    const shipment = await prisma.shipment.findUnique({
      where: { id: shipmentId },
      select: { id: true, companyId: true },
    });

    if (!shipment) return res.status(404).json({ error: "Shipment not found" });

    // ✅ Allow ADMIN to view any shipment; others only their company
    const isStaff = req.user.role === "ADMIN" || req.user.role === "INTERNAL_STAFF";
    if (!isStaff && shipment.companyId !== companyId) {
     return res.status(403).json({ error: "Forbidden" });
    }


    const events = await prisma.trackingEvent.findMany({
      where: { shipmentId },
      orderBy: { eventTime: "asc" },
    });

    return res.json(events);
  } catch (err) {
    console.error("Error in GET /shipments/:id/tracking:", err);
    return res.status(500).json({ error: "Internal server error" });
  }
});

export default router;
