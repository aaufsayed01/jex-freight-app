import { Router } from "express";
import { prisma } from "../prisma";
import { authMiddleware, AuthRequest } from "../auth";
import {
  DocumentRequestStatus,
  DocumentType,
  NotificationType,
  ShipmentStatus,
} from "@prisma/client";

// ⬇️ Use your existing email functions here
// Update these imports to match your file (you already have notificationEmail services)
import { emailDocumentRequestToCustomer,} from "../services/notificationEmail";
import { logAudit } from "../services/audit.service";

const router = Router();

function isOps(role: string) {
  return role === "ADMIN" || role === "INTERNAL_STAFF";
}

/**
 * POST /api/shipments/:id/document-requests
 * Ops creates/updates required doc requests for a shipment
 * Body:
 * { "requests": [{ "type": "PACKING_LIST", "note": "..." , "dueDate": "2025-12-30T00:00:00.000Z" }, ...] }
 */
router.post("/shipments/:id/document-requests", authMiddleware, async (req: AuthRequest, res) => {
  try {
    if (!req.user) return res.status(401).json({ error: "Unauthorized" });
    if (!isOps(req.user.role)) return res.status(403).json({ error: "Forbidden (ops only)" });

    const shipmentId = req.params.id;

    const shipment = await prisma.shipment.findUnique({
      where: { id: shipmentId },
      select: {
        id: true,
        shipmentRef: true,
        status: true,
        companyId: true,
        company: { select: { name: true } },
      },
    });
    if (!shipment) return res.status(404).json({ error: "Shipment not found" });

    const { requests } = req.body as {
      requests: Array<{ type: DocumentType; note?: string; dueDate?: string }>;
    };

    if (!Array.isArray(requests) || requests.length === 0) {
      return res.status(400).json({ error: "requests array is required" });
    }

    for (const r of requests) {
      if (!r?.type || !Object.values(DocumentType).includes(r.type)) {
        return res.status(400).json({
          error: `Invalid document type: ${String(r?.type)}. Allowed: ${Object.values(DocumentType).join(", ")}`,
        });
      }
    }

    const createdOrUpdated = await prisma.$transaction(
      requests.map((r) =>
        prisma.documentRequest.upsert({
          where: { shipmentId_type: { shipmentId, type: r.type } },
          create: {
            companyId: shipment.companyId,
            shipmentId,
            requestedById: req.user!.id,
            type: r.type,
            status: DocumentRequestStatus.PENDING,
            note: r.note,
            dueDate: r.dueDate ? new Date(r.dueDate) : null,
          },
          update: {
            status: DocumentRequestStatus.PENDING,
            note: r.note ?? undefined,
            dueDate: r.dueDate ? new Date(r.dueDate) : undefined,
            fulfilledByDocumentId: null,
          },
        })
      )
    );

    // Set shipment to AWAITING_DOCUMENTS
    if (shipment.status !== ShipmentStatus.AWAITING_DOCUMENTS) {
      await prisma.shipment.update({
        where: { id: shipmentId },
        data: { status: ShipmentStatus.AWAITING_DOCUMENTS },
      });
    }

    // Create notification record
    await prisma.notification.create({
      data: {
        companyId: shipment.companyId,
        type: NotificationType.DOCUMENT_REQUEST,
        title: "Documents requested",
        message: `JEX requested documents for shipment ${shipment.shipmentRef}.`,
        entityType: "SHIPMENT",
        entityId: shipmentId,
      },
    });

    // Email customers (all corporate client users in the company)
    const recipients = await prisma.user.findMany({
      where: { companyId: shipment.companyId, role: "CORPORATE_CLIENT", isActive: true },
      select: { email: true, fullName: true },
    });

    // Call your existing email service (recommended)
    if (recipients.length > 0) {
      await emailDocumentRequestToCustomer({
        to: recipients.map((r) => r.email),
        shipmentRef: shipment.shipmentRef,
        requestedDocs: requests.map((r) => r.type),
      });
    }

    await logAudit({
     action: "CREATE",
     entity: "DOCUMENT",
     entityId: shipmentId,
     userId: req.user.id,
     companyId: shipment.companyId,
     message: `Requested documents for shipment ${shipment.shipmentRef}`,
     metadata: { requestedDocs: requests.map(r => r.type) },
    });


    return res.status(201).json(createdOrUpdated);
  } catch (err: any) {
    return res.status(500).json({ error: err.message || "Server error" });
  }
});

/**
 * GET /api/shipments/:id/document-requests
 * Ops can view all, clients only their company shipment
 */
router.get("/shipments/:id/document-requests", authMiddleware, async (req: AuthRequest, res) => {
  try {
    if (!req.user) return res.status(401).json({ error: "Unauthorized" });

    const shipmentId = req.params.id;

    const shipment = await prisma.shipment.findUnique({
      where: { id: shipmentId },
      select: { id: true, companyId: true },
    });
    if (!shipment) return res.status(404).json({ error: "Shipment not found" });

    if (!isOps(req.user.role) && req.user.companyId !== shipment.companyId) {
      return res.status(403).json({ error: "Forbidden" });
    }

    const requests = await prisma.documentRequest.findMany({
      where: { shipmentId },
      orderBy: [{ status: "asc" }, { createdAt: "desc" }],
      include: {
        fulfilledByDocument: {
          select: { id: true, type: true, filename: true, createdAt: true },
        },
      },
    });

    return res.json(requests);
  } catch (err: any) {
    return res.status(500).json({ error: err.message || "Server error" });
  }
});

/**
 * PATCH /api/document-requests/:id
 * Ops can waive/reopen
 * Body: { status: "WAIVED" | "PENDING" }
 */
router.patch("/document-requests/:id", authMiddleware, async (req: AuthRequest, res) => {
  try {
    if (!req.user) return res.status(401).json({ error: "Unauthorized" });
    if (!isOps(req.user.role)) return res.status(403).json({ error: "Forbidden (ops only)" });

    const id = req.params.id;
    const { status } = req.body as { status: DocumentRequestStatus };

    if (!status || !Object.values(DocumentRequestStatus).includes(status)) {
      return res.status(400).json({
        error: `Invalid status. Allowed: ${Object.values(DocumentRequestStatus).join(", ")}`,
      });
    }

    const updated = await prisma.documentRequest.update({
      where: { id },
      data: { status },
    });

    await logAudit({
     action: "UPDATE",
     entity: "DOCUMENT",
     entityId: updated.id,
     userId: req.user.id,
     companyId: updated.companyId,
     message: `Document request status changed to ${updated.status}`,
    });

    return res.json(updated);
  } catch (err: any) {
    return res.status(500).json({ error: err.message || "Server error" });
  }
});

router.get(
  "/shipments/:id/document-requests/summary",
  authMiddleware,
  async (req: AuthRequest, res) => {
    try {
      if (!req.user) return res.status(401).json({ error: "Unauthorized" });

      const shipmentId = req.params.id;

      const shipment = await prisma.shipment.findUnique({
        where: { id: shipmentId },
        select: { id: true, companyId: true, shipmentRef: true },
      });
      if (!shipment) return res.status(404).json({ error: "Shipment not found" });

      const isOps = req.user.role === "ADMIN" || req.user.role === "INTERNAL_STAFF";
      if (!isOps && req.user.companyId !== shipment.companyId) {
        return res.status(403).json({ error: "Forbidden" });
      }

      const requests = await prisma.documentRequest.findMany({
        where: { shipmentId },
        select: { type: true, status: true, dueDate: true },
        orderBy: { createdAt: "asc" },
      });

      const pending = requests.filter((r) => r.status === "PENDING").map((r) => r.type);
      const fulfilled = requests.filter((r) => r.status === "FULFILLED").map((r) => r.type);
      const waived = requests.filter((r) => r.status === "WAIVED").map((r) => r.type);

      return res.json({
        shipmentId,
        shipmentRef: shipment.shipmentRef,
        totals: {
          all: requests.length,
          pending: pending.length,
          fulfilled: fulfilled.length,
          waived: waived.length,
        },
        pending,
        fulfilled,
        waived,
      });
    } catch (err: any) {
      return res.status(500).json({ error: err.message || "Server error" });
    }
  }
);

router.post(
  "/shipments/:id/document-requests/remind",
  authMiddleware,
  async (req: AuthRequest, res) => {
    try {
      if (!req.user) return res.status(401).json({ error: "Unauthorized" });

      const isOps = req.user.role === "ADMIN" || req.user.role === "INTERNAL_STAFF";
      if (!isOps) return res.status(403).json({ error: "Forbidden (ops only)" });

      const shipmentId = req.params.id;

      const shipment = await prisma.shipment.findUnique({
        where: { id: shipmentId },
        select: { id: true, shipmentRef: true, companyId: true },
      });
      if (!shipment) return res.status(404).json({ error: "Shipment not found" });

      const pendingRequests = await prisma.documentRequest.findMany({
        where: { shipmentId, status: "PENDING" },
        select: { type: true },
        orderBy: { createdAt: "asc" },
      });

      const pendingTypes = pendingRequests.map((r) => r.type);
      if (pendingTypes.length === 0) {
        return res.status(200).json({ message: "No pending document requests to remind." });
      }

      const recipients = await prisma.user.findMany({
        where: { companyId: shipment.companyId, role: "CORPORATE_CLIENT", isActive: true },
        select: { email: true },
      });

      if (recipients.length > 0) {
        await emailDocumentRequestToCustomer({
          to: recipients.map((u) => u.email),
          shipmentRef: shipment.shipmentRef,
          requestedDocs: pendingTypes,
        });
      }

      await prisma.notification.create({
        data: {
          companyId: shipment.companyId,
          type: "DOCUMENT_REQUEST",
          title: "Document reminder sent",
          message: `Reminder sent for pending documents on shipment ${shipment.shipmentRef}.`,
          entityType: "SHIPMENT",
          entityId: shipmentId,
        },
      });

      await logAudit({
         action: "UPDATE",
         entity: "NOTIFICATION",
         entityId: shipmentId,
         userId: req.user.id,
         companyId: shipment.companyId,
         message: "Document reminder sent",
        });

      return res.json({
        message: "Reminder sent",
        shipmentId,
        shipmentRef: shipment.shipmentRef,
        pendingDocs: pendingTypes,
        recipients: recipients.map((r) => r.email),
      });
    } catch (err: any) {
      return res.status(500).json({ error: err.message || "Server error" });
    }
  }
);


export default router;
