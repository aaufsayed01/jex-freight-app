import { Router, Response, NextFunction } from "express";
import { prisma } from "../prisma";
import { authMiddleware, AuthRequest } from "../auth";
import { uploadDocToS3, signDocDownloadUrl, deleteDocFromS3 } from "../services/s3Docs.service";
import { DocumentType, NotificationType } from "@prisma/client";
import { notifyCompanyUsers } from "../services/notifications.service";
import { emailDocumentUploaded } from "../services/notificationEmail";
import { emailDocumentVisibilityChanged } from "../services/notificationEmail";
import { upload } from "../middlewares/upload";
import { logAudit, getReqContext } from "../services/audit.service";
import { AuditAction, AuditEntity } from "@prisma/client";


const router = Router();

// Memory upload (S3)

function requireRole(...roles: string[]) {
  return (req: AuthRequest, res: Response, next: NextFunction) => {
    if (!req.user) return res.status(401).json({ error: "Unauthorized" });
    if (!roles.includes(req.user.role)) return res.status(403).json({ error: "Forbidden" });
    next();
  };
}

function isClientRole(role: string) {
  return role === "CORPORATE_CLIENT";
}

const quoteDocsUpload = upload.array("files", 10);


/**
 * @openapi
 * /shipments/{id}/documents:
 *   post:
 *     tags: [Documents]
 *     summary: Upload a document to a shipment
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema: { type: string }
 *     requestBody:
 *       required: true
 *       content:
 *         multipart/form-data:
 *           schema:
 *             type: object
 *             required: [file, type]
 *             properties:
 *               file:
 *                 type: string
 *                 format: binary
 *               type:
 *                 type: string
 *                 example: AWB
 *     responses:
 *       201:
 *         description: Document created
 */
router.post(
  "/shipments/:id/documents",
  authMiddleware,
  upload.single("file"),
  async (req: AuthRequest, res) => {
    try {
      if (!req.user) return res.status(401).json({ error: "Unauthorized" });

      const shipmentId = req.params.id;
      const companyId = req.user.companyId;
      if (!companyId) return res.status(400).json({ error: "User not linked to a company" });

      const type = req.body.type as DocumentType;
      const allowedTypes = Object.values(DocumentType);

      if (!type) return res.status(400).json({ error: "type is required" });
      if (!allowedTypes.includes(type)) {
        return res.status(400).json({
          error: `Invalid document type. Allowed: ${allowedTypes.join(", ")}`,
        });
      }
      if (!req.file) return res.status(400).json({ error: "No file uploaded" });

      const shipment = await prisma.shipment.findUnique({
        where: { id: shipmentId },
        select: { id: true, companyId: true },
      });

      if (!shipment) return res.status(404).json({ error: "Shipment not found" });

      if (req.user.role !== "ADMIN" && shipment.companyId !== companyId) {
        return res.status(403).json({ error: "Forbidden" });
      }

      // versioning
      const last = await prisma.document.findFirst({
        where: { companyId, shipmentId, type, deletedAt: null },
        orderBy: { version: "desc" },
        select: { version: true },
      });

      const nextVersion = (last?.version ?? 0) + 1;

      // Upload to S3
      const uploaded = await uploadDocToS3({
        buffer: req.file.buffer,
        contentType: req.file.mimetype,
        originalName: req.file.originalname,
        companyId,
        shipmentId,
      });

      // Save in DB
      const doc = await prisma.document.create({
        data: {
          companyId,
          shipmentId,
          uploadedById: req.user.id,

          type,

          filename: uploaded.filename, // stored name
          originalName: req.file.originalname, // original user name

          path: null, // S3 storage => no local path
          storage: "S3",
          s3Bucket: uploaded.bucket,
          s3Region: uploaded.region,
          s3Key: uploaded.key,

          mimeType: req.file.mimetype ?? null,
          size: req.file.size,

          version: nextVersion,
          visibleToClient: true,
        },
      });

      await prisma.documentRequest.updateMany({
        where: {
          shipmentId,
          type: doc.type,
          status: "PENDING",
        },
        data: {
          status: "FULFILLED",
          fulfilledByDocumentId: doc.id,
        },
      });
      // ✅ If all required docs are fulfilled, auto-advance shipment to CONFIRMED
      const pendingCount = await prisma.documentRequest.count({
        where: { shipmentId, status: "PENDING" },
      });

      if (pendingCount === 0) {
        await prisma.shipment.update({
         where: { id: shipmentId },
         data: { status: "CONFIRMED" },
        });

        await prisma.notification.create({
          data: {
            companyId: shipment.companyId, // use the same companyId you already have in this handler
            type: "MILESTONE_UPDATE",
            title: "All documents received",
            message: `All required documents have been uploaded. Shipment is now CONFIRMED.`,
            entityType: "SHIPMENT",
            entityId: shipmentId,
          },
        });
      }

      const { ip, userAgent } = getReqContext(req);

      await logAudit({
         action: AuditAction.UPLOAD,
         entity: AuditEntity.DOCUMENT,
         entityId: doc.id,
         message: "Document uploaded",
         userId: req.user?.id ?? null,
         companyId: companyId, // already validated above
         ...getReqContext(req),
         metadata: {
             parent: "SHIPMENT",
             parentId: shipmentId,
             type: doc.type,
             originalName: doc.originalName,
             version: doc.version,
             },
        });

      await notifyCompanyUsers({
         companyId,
         type: NotificationType.DOCUMENT_UPLOADED,
         title: `Document uploaded: ${doc.type}`,
         message: `Uploaded ${doc.originalName} to shipment ${shipmentId}`,
         entityType: "DOCUMENT",
         entityId: doc.id,
         roles: ["ADMIN", "INTERNAL_STAFF"],
        });

      // ✅ Email: document uploaded (to shipment owner)
      const shipmentForEmail = await prisma.shipment.findUnique({
          where: { id: shipmentId },
          select: {
             shipmentRef: true,
             owner: { select: { email: true } }, // ✅ correct relation
           },
       });

      const shipmentRef = shipmentForEmail?.shipmentRef || shipmentId;

      await emailDocumentUploaded({
         toCustomerEmail: shipmentForEmail?.owner?.email ?? null,
         shipmentRef,
         fileName: doc.originalName,
       });

      return res.status(201).json(doc);

    } catch (err) {
      console.error("Error in POST /shipments/:id/documents:", err);
      return res.status(500).json({ error: "Internal server error" });
    }
  }
);

/**
 * Upload documents to a quote request
 * POST /quotes/:id/documents
 * multipart/form-data:
 * - files: (multiple)
 * - type: DocumentType (applies to all files in this request)
 */
router.post(
  "/quotes/:id/documents",
  authMiddleware,
  quoteDocsUpload,
  async (req: AuthRequest, res) => {
    try {
      if (!req.user) return res.status(401).json({ error: "Unauthorized" });
      const userId = req.user.id;
      const quoteId = req.params.id;
      const companyId = req.user.companyId;
      if (!companyId) return res.status(400).json({ error: "User not linked to a company" });

      const type = String(req.body.type || "").trim().toUpperCase() as DocumentType;
      const allowedTypes = Object.values(DocumentType);

      const files = (req.files as Express.Multer.File[]) ?? [];
      if (!files.length) return res.status(400).json({ error: "No files uploaded (use files[])" });

      if (!type) return res.status(400).json({ error: "type is required" });
      if (!allowedTypes.includes(type)) {
        return res.status(400).json({
          error: `Invalid document type. Allowed: ${allowedTypes.join(", ")}`,
        });
      }

      const quote = await prisma.quoteRequest.findUnique({
        where: { id: quoteId },
        select: { id: true, companyId: true, requestedById: true, reference: true },
      });

      if (!quote) return res.status(404).json({ error: "Quote not found" });
      if (quote.companyId !== companyId) return res.status(403).json({ error: "Forbidden" });

      // Clients can upload only to their own quotes; staff/admin can upload to any quote in company
      const isStaff = req.user.role === "ADMIN" || req.user.role === "INTERNAL_STAFF";
      const isOwner = quote.requestedById === req.user.id;
      if (!isStaff && !isOwner) return res.status(403).json({ error: "Forbidden" });

      const created = await prisma.$transaction(async (tx) => {
        const docs: any[] = [];

        for (const file of files) {
          const uploaded = await uploadDocToS3({
            buffer: file.buffer,
            contentType: file.mimetype,
            originalName: file.originalname,
            companyId,
            quoteRequestId: quote.id,
          });

          const last = await tx.document.findFirst({
            where: { companyId, quoteRequestId: quote.id, type, deletedAt: null },
            orderBy: { version: "desc" },
            select: { version: true },
          });

          const doc = await tx.document.create({
            data: {
              companyId,
              quoteRequestId: quote.id,
              shipmentId: null,
              uploadedById: userId,
              type,
              filename: uploaded.filename,
              originalName: file.originalname,
              path: null,
              storage: "S3",
              s3Bucket: uploaded.bucket,
              s3Region: uploaded.region,
              s3Key: uploaded.key,
              mimeType: file.mimetype ?? null,
              size: file.size,
              version: (last?.version ?? 0) + 1,
              visibleToClient: true,
            },
          });

          const { ip, userAgent } = getReqContext(req);

          await logAudit({
              action: AuditAction.UPLOAD,
              entity: AuditEntity.DOCUMENT,
              entityId: doc.id,
              message: "Document uploaded",
              userId: req.user?.id ?? null,
              companyId: companyId,
              ...getReqContext(req),
              metadata: {
                 parent: "QUOTE",
                 parentId: quoteId,
                 type: doc.type,
                 originalName: doc.originalName,
                 version: doc.version,
                },
            });

          docs.push(doc);
        }

        return docs;
      });

      // Optional email to customer when staff uploads docs (keep simple)
      // await emailDocumentUploaded({ ... })

      return res.status(201).json({
        quoteId: quote.id,
        quoteRef: quote.reference,
        uploaded: created.length,
        documents: created,
      });
    } catch (err) {
      console.error("Error in POST /quotes/:id/documents:", err);
      return res.status(500).json({ error: "Internal server error" });
    }
  }
);

/**
 * List documents for a quote request
 * GET /quotes/:id/documents
 */
router.get("/quotes/:id/documents", authMiddleware, async (req: AuthRequest, res) => {
  try {
    if (!req.user) return res.status(401).json({ error: "Unauthorized" });

    const quoteId = req.params.id;
    const companyId = req.user.companyId;
    if (!companyId) return res.status(400).json({ error: "User not linked to a company" });

    const quote = await prisma.quoteRequest.findUnique({
      where: { id: quoteId },
      select: { id: true, companyId: true, requestedById: true },
    });

    if (!quote) return res.status(404).json({ error: "Quote not found" });
    if (quote.companyId !== companyId) return res.status(403).json({ error: "Forbidden" });

    const isStaff = req.user.role === "ADMIN" || req.user.role === "INTERNAL_STAFF";
    const isOwner = quote.requestedById === req.user.id;
    if (!isStaff && !isOwner) return res.status(403).json({ error: "Forbidden" });

    const docs = await prisma.document.findMany({
      where: {
        companyId,
        quoteRequestId: quote.id,
        deletedAt: null,
        ...(isClientRole(req.user.role) ? { visibleToClient: true } : {}),
      },
      orderBy: { createdAt: "desc" },
      include: {
        uploadedBy: { select: { id: true, fullName: true, email: true } },
      },
    });

    return res.json(docs);
  } catch (err) {
    console.error("Error in GET /quotes/:id/documents:", err);
    return res.status(500).json({ error: "Internal server error" });
  }
});



// 📂 List documents for a shipment
router.get("/shipments/:id/documents", authMiddleware, async (req: AuthRequest, res) => {
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

    if (shipment.companyId !== companyId) return res.status(403).json({ error: "Forbidden" });

    const docs = await prisma.document.findMany({
      where: {
        shipmentId: shipment.id,
        companyId,
        deletedAt: null,
        ...(isClientRole(req.user.role) ? { visibleToClient: true } : {}),
      },
      orderBy: { createdAt: "desc" },
      include: {
        uploadedBy: { select: { id: true, fullName: true, email: true } },
      },
    });

    return res.json(docs);
  } catch (err) {
    console.error("Error in GET /shipments/:id/documents:", err);
    return res.status(500).json({ error: "Internal server error" });
  }
});

// ⬇️ Secure download document (signed URL)
router.get("/documents/:id/download", authMiddleware, async (req: AuthRequest, res) => {
  try {
    if (!req.user) return res.status(401).json({ error: "Unauthorized" });

    const documentId = req.params.id;
    const companyId = req.user.companyId;
    if (!companyId) return res.status(400).json({ error: "User not linked to a company" });

    const doc = await prisma.document.findFirst({
      where: { id: documentId, companyId, deletedAt: null },
    });

    if (!doc) return res.status(404).json({ error: "Document not found" });

    if (isClientRole(req.user.role) && !doc.visibleToClient) {
      return res.status(403).json({ error: "Forbidden" });
    }

    if (doc.storage !== "S3" || !doc.s3Key) {
      return res.status(400).json({ error: "Document is not stored in S3" });
    }

    const url = await signDocDownloadUrl(doc.s3Key, 60);

    await logAudit({
     action: AuditAction.DOWNLOAD,
     entity: AuditEntity.DOCUMENT,
     entityId: doc.id,
     message: "Document download link generated",
     userId: req.user?.id,
     companyId: req.user?.companyId,
     ...getReqContext(req),
    });

    return res.json({ url });
  } catch (err) {
    console.error("Error in GET /documents/:id/download:", err);
    return res.status(500).json({ error: "Internal server error" });
  }
});

// 👁 Toggle document visibility (ADMIN)
router.patch(
  "/documents/:id",
  authMiddleware,
  requireRole("ADMIN"),
  async (req: AuthRequest, res) => {
    try {
      if (!req.user) return res.status(401).json({ error: "Unauthorized" });

      const documentId = req.params.id;
      const { visibleToClient } = req.body as { visibleToClient?: boolean };

      const doc = await prisma.document.findUnique({
        where: { id: documentId },
        select: {
          id: true,
          companyId: true,
          shipmentId: true,
          quoteRequestId: true,
          originalName: true,
          filename: true,
          visibleToClient: true,
          deletedAt: true,
        },
      });

      if (!doc || doc.deletedAt) {
        return res.status(404).json({ error: "Document not found" });
      }

      const wasVisible = doc.visibleToClient;

      const updated = await prisma.document.update({
        where: { id: documentId },
        data: {
          visibleToClient: typeof visibleToClient === "boolean" ? visibleToClient : undefined,
          version: { increment: 1 },
        },
      });

      await logAudit({
         action: AuditAction.UPDATE,
         entity: AuditEntity.DOCUMENT,
         entityId: updated.id,
         message: "Document updated",
         userId: req.user?.id,
         companyId: req.user?.companyId,
         ...getReqContext(req),
         metadata: { changes: req.body },
        });


      // ✅ If it just became visible, email the customer (shipment owner) if possible
      if (!wasVisible && updated.visibleToClient) {
        // 1) If document belongs to a shipment => email shipment owner
        if (doc.shipmentId) {
          const shipmentForEmail = await prisma.shipment.findUnique({
            where: { id: doc.shipmentId },
            select: {
              shipmentRef: true,
              owner: { select: { email: true } },
            },
          });

          const shipmentRef = shipmentForEmail?.shipmentRef || doc.shipmentId;

          await emailDocumentVisibilityChanged({
            toCustomerEmail: shipmentForEmail?.owner?.email ?? null,
            shipmentRef,
            documentName: doc.originalName ?? doc.filename,
          });
        }

        // 2) If document belongs to a quote => email quote requester
        if (doc.quoteRequestId) {
          const quoteForEmail = await prisma.quoteRequest.findUnique({
            where: { id: doc.quoteRequestId },
            select: {
              reference: true,
              requestedBy: { select: { email: true } },
            },
          });

          await emailDocumentVisibilityChanged({
            toCustomerEmail: quoteForEmail?.requestedBy?.email ?? null,
            shipmentRef: quoteForEmail?.reference || doc.quoteRequestId, // reuse field as "reference"
            documentName: doc.originalName ?? doc.filename,
          });
        }
      }

      await notifyCompanyUsers({
        companyId: doc.companyId,
        type: "DOCUMENT_VISIBILITY",
        title: `Document visibility changed`,
        message: `Document ${doc.id} visibility updated.`,
        entityType: "DOCUMENT",
        entityId: doc.id,
        roles: ["ADMIN", "INTERNAL_STAFF", "CORPORATE_CLIENT"],
      });

      return res.json(updated);
    } catch (err) {
      console.error("Error in PATCH /documents/:id:", err);
      return res.status(500).json({ error: "Internal server error" });
    }
  }
);


// 🗑️ Delete document (soft delete + remove from S3) (ADMIN)
router.delete("/documents/:id", authMiddleware, requireRole("ADMIN"), async (req: AuthRequest, res) => {
  try {
    if (!req.user) return res.status(401).json({ error: "Unauthorized" });

    const companyId = req.user.companyId;
    if (!companyId) return res.status(400).json({ error: "User not linked to a company" });

    const documentId = req.params.id;

    const doc = await prisma.document.findFirst({
      where: { id: documentId, companyId, deletedAt: null },
    });

    if (!doc) return res.status(404).json({ error: "Document not found" });

    await prisma.document.update({
      where: { id: documentId },
      data: { deletedAt: new Date(), version: { increment: 1 } },
    });

    await logAudit({
      action: AuditAction.DELETE,
      entity: AuditEntity.DOCUMENT,
      entityId: doc.id,
      message: "Document deleted",
      userId: req.user?.id,
      companyId: req.user?.companyId,
      ...getReqContext(req),
      metadata: {
         originalName: doc.originalName,
         s3Key: doc.s3Key,
        },
    });


    if (doc.storage === "S3" && doc.s3Key) {
      await deleteDocFromS3(doc.s3Key);
    }

    return res.json({ ok: true });
  } catch (err) {
    console.error("Error in DELETE /documents/:id:", err);
    return res.status(500).json({ error: "Internal server error" });
  }
});

export default router;
