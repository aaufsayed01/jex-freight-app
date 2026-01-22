// src/index.ts
import dotenv from "dotenv";
dotenv.config();

import express, { Router, Request, Response, NextFunction } from "express";
import cors from "cors";
import bcrypt from "bcryptjs";
import path from "path";
import swaggerUi from "swagger-ui-express";

import { prisma } from "./prisma";
import { authMiddleware, AuthRequest, generateToken } from "./auth";
import { swaggerSpec } from "./swagger";

// Routers
import documentsRoutes from "./routes/documents.routes";
import trackingRoutes from "./routes/tracking.routes";
import notificationRoutes from "./routes/notifications.routes";
import { upload } from "./middlewares/upload";
import { uploadDocToS3 } from "./services/s3Docs.service";
import { DocumentType } from "@prisma/client";
import { logAudit, getReqContext } from "./services/audit.service";
import { AuditAction, AuditEntity } from "@prisma/client";
// Prisma enums
import {
  BookingStatus,
  QuoteStatus,
  ShipmentMode,
  ShipmentStatus,
} from "@prisma/client";

// Rate limit
import { registerLimiter, loginLimiter,resendLimiter } from "./middlewares/rateLimit";

// Email + verification helpers
import {
  emailBookingStatus,
  emailQuoteRequestReceived,
  emailShipmentCreated,
  emailQuoteSentToCustomer,
  emailQuoteDecisionToOps,
  emailQuoteDecisionToCustomer,
  emailBookingDraftCreated,
  emailVerifyAccount, // ✅ make sure this exists in notificationEmail.ts exports
} from "./services/notificationEmail";

import {
  createEmailVerification, // ✅ make sure this exists in services/emailVerification.ts exports
  hashToken,
} from "./services/emailVerification";

//function isClientRole(role: string) {
  //return role === "CORPORATE_CLIENT";
//}

import { requireRole } from "./middlewares/requireRole";
import auditRoutes from "./routes/audit.routes";
import profileRoutes from "./routes/profile.routes";
import documentRequestsRoutes from "./routes/documentRequests.routes";
import opsRoutes from "./routes/ops.routes";
import { calcFromPackages, PackageInput } from "./services/calcFromPackages";
import pricingRoutes from "./routes/pricing.routes";
import { PricingTemplateCode } from "@prisma/client";
import { UserRole } from "@prisma/client";
import { calcVolumeCbmFromPackages } from "./services/cbmCalculator";
import { buildCustomerPricingView } from "./services/pricingCustomerView";
import PDFDocument from "pdfkit";
import { BreakdownRequestStatus } from "@prisma/client";


const app = express();

// =====================
// MIDDLEWARES
// =====================
app.use(
  cors({
    origin: "http://localhost:3000",
    credentials: true,
    methods: ["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"],
    allowedHeaders: ["Content-Type", "Authorization"],
  })
);
// Handle preflight explicitly (helps with some setups)
app.options(/.*/, cors());

app.use(express.json());
const quoteDocsUpload = upload.array("files", 10);
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// =====================
// API ROUTER MOUNTS
// =====================
const api = Router();
api.use(auditRoutes);
app.use("/api", profileRoutes);
app.use("/api", documentRequestsRoutes);
app.use("/api", opsRoutes);
app.get("/api", (_req, res) => {
  res.json({ message: "API is running" });
});
app.use("/api", pricingRoutes);
api.use(documentsRoutes);
api.use(trackingRoutes);
api.use(notificationRoutes);

app.use("/api", api);

// Swagger
app.get("/api-docs.json", (_req, res) => res.json(swaggerSpec));
app.use("/api-docs", swaggerUi.serve, swaggerUi.setup(swaggerSpec));

// Static uploads (dev only)
if (process.env.NODE_ENV !== "production") {
  app.use("/uploads", express.static(path.resolve(process.env.UPLOAD_DIR || "uploads")));
}
function isStaffUser(user: { role: string } | null | undefined) {
  return user?.role === "ADMIN" || user?.role === "INTERNAL_STAFF";
}

/**
 * ✅ Block unverified users from creating quotes/bookings/shipments
 * Staff bypasses by default.
 */
async function requireVerifiedUser(req: AuthRequest, res: Response, next: NextFunction) {
  try {
    if (!req.user) return res.status(401).json({ error: "Unauthorized" });
    const staff = isStaffUser(req.user);
    if (staff) return next();

    const dbUser = await prisma.user.findUnique({
      where: { id: req.user.id },
      select: { isEmailVerified: true },
    });

    if (!dbUser) return res.status(401).json({ error: "Unauthorized" });

    if (!dbUser.isEmailVerified) {
      return res.status(403).json({
        error: "Email not verified. Please verify your email to continue.",
        code: "EMAIL_NOT_VERIFIED",
      });
    }

    return next();
  } catch (err) {
    console.error("requireVerifiedUser error:", err);
    return res.status(500).json({ error: "Internal server error" });
  }
}

// Health
app.get("/health", async (_req, res) => {
  try {
    await prisma.$queryRaw`SELECT 1`;
    res.json({ ok: true, status: "healthy", db: "connected" });
  } catch (err) {
    console.error(err);
    res.status(500).json({ ok: false, status: "unhealthy" });
  }
});

// =====================
// AUTH
// =====================
app.post("/auth/register", registerLimiter, async (req: Request, res: Response) => {
  try {
    const { email, password, fullName, phone, companyName, country, city } = req.body as {
      email: string;
      password: string;
      fullName: string;
      phone?: string;
      companyName: string;
      country?: string;
      city?: string;
    };

    if (!email || !password || !fullName || !companyName) {
      return res.status(400).json({
        error: "email, password, fullName, and companyName are required",
      });
    }

    // Password strength rule (outside transaction)
    const strong = /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d).{10,}$/;
    if (!strong.test(password)) {
      return res.status(400).json({
        error: "Password must be 10+ chars and include uppercase, lowercase, and a number",
      });
    }

    const existing = await prisma.user.findUnique({ where: { email } });
    if (existing) return res.status(409).json({ error: "User with this email already exists" });

    const hashed = await bcrypt.hash(password, 10);

    // Create company + user
    const result = await prisma.$transaction(async (tx) => {
      const company = await tx.company.create({
        data: {
          name: companyName,
          type: "CORPORATE_CLIENT",
          country: country ?? null,
          city: city ?? null,
        },
        select: { id: true, name: true, type: true },
      });

      const user = await tx.user.create({
        data: {
          email,
          passwordHash: hashed,
          fullName,
          phone: phone ?? null,
          role: "CORPORATE_CLIENT",
          companyId: company.id,
        },
        select: { id: true, email: true, fullName: true, role: true, companyId: true },
      });

      return { company, user };
    });

    // Create verification token + send email
    const rawToken = await createEmailVerification(result.user.id);
    const verifyUrl = `${process.env.APP_PUBLIC_URL}/auth/verify-email?token=${rawToken}`;

    await emailVerifyAccount({
      toCustomerEmail: result.user.email,
      verifyUrl,
    });

    // Return JWT (actions blocked until verified by requireVerifiedUser)
    const jwt = generateToken({
      userId: result.user.id,
    });

    return res.status(201).json({
      token: jwt,
      user: result.user,
      company: result.company,
    });
  } catch (err) {
    console.error("Error in /auth/register:", err);
    return res.status(500).json({ error: "Internal server error" });
  }
});

app.post("/auth/resend-verification", resendLimiter, async (req: Request, res: Response) => {
  try {
    const  email  = (req.body && req.body.email) ? String(req.body.email).trim() : "";

    if (!email) {
      return res.status(400).json({ error: "email is required" });
    }

    const user = await prisma.user.findUnique({
      where: { email },
      select: {
        id: true,
        email: true,
        fullName: true,
        isEmailVerified: true,
      },
    });

    // 🔒 Prevent account enumeration
    if (!user) {
      return res.json({ ok: true });
    }

    // Already verified → no action needed
    if (user.isEmailVerified) {
      return res.json({ ok: true });
    }

    // 🔁 Rotate verification token
    const rawToken = await createEmailVerification(user.id);

    const verifyUrl = `${process.env.APP_PUBLIC_URL}/auth/verify-email?token=${rawToken}`;

    await emailVerifyAccount({
      toCustomerEmail: user.email,
      verifyUrl,
    });

    return res.json({ ok: true });
  } catch (err) {
    console.error("Error in /auth/resend-verification:", err);
    return res.status(500).json({ error: "Internal server error" });
  }
});


app.get("/auth/verify-email", async (req: Request, res: Response) => {
  try {
    const token = String(req.query.token || "");
    if (!token) return res.status(400).json({ error: "token is required" });

    const tokenHash = hashToken(token);

    const row = await prisma.emailVerificationToken.findFirst({
      where: { tokenHash },
      include: { user: true },
    });

    if (!row) return res.status(400).json({ error: "Invalid token" });
    if (row.expiresAt.getTime() < Date.now()) return res.status(400).json({ error: "Token expired" });

    await prisma.$transaction(async (tx) => {
      await tx.user.update({
        where: { id: row.userId },
        data: { isEmailVerified: true, emailVerifiedAt: new Date() },
      });

      // if your schema uses userId unique, this is fine:
      await tx.emailVerificationToken.delete({
        where: { userId: row.userId },
      });
    });

    return res.json({ ok: true, message: "Email verified successfully" });
  } catch (err) {
    console.error("Error in verify-email:", err);
    return res.status(500).json({ error: "Internal server error" });
  }
});

app.post("/auth/login", loginLimiter, async (req: Request, res: Response) => {
  try {
    const { email, password } = req.body as { email: string; password: string };

    if (!email || !password) {
      return res.status(400).json({ error: "email and password are required" });
    }

    const user = await prisma.user.findUnique({ where: { email } });
    if (!user) return res.status(401).json({ error: "Invalid email or password" });

    const valid = await bcrypt.compare(password, user.passwordHash);
    if (!valid) return res.status(401).json({ error: "Invalid email or password" });

    const jwt = generateToken({
      userId: user.id,
    });

    await logAudit({
      action: AuditAction.LOGIN,
      entity: AuditEntity.AUTH,
      entityId: user.id,
      message: "User login",
      userId: user.id,
      companyId: user.companyId ?? null,
      ...getReqContext(req),
    });


    return res.json({
      token: jwt,
      user: {
        id: user.id,
        email: user.email,
        fullName: user.fullName,
        role: user.role,
        isEmailVerified: (user as any).isEmailVerified ?? undefined,
      },
    });
  } catch (err) {
    console.error("Error in /auth/login:", err);
    return res.status(500).json({ error: "Internal server error" });
  }
});

// TEMP admin route (optional)
app.post("/admin/create-client-user", authMiddleware, async (req: AuthRequest, res: Response) => {
  try {
    if (!req.user) return res.status(401).json({ error: "Unauthorized" });
    if (req.user.role !== "ADMIN") return res.status(403).json({ error: "Forbidden" });

    const { email, password, fullName, phone } = req.body as {
      email: string;
      password: string;
      fullName: string;
      phone?: string;
    };

    if (!email || !password || !fullName) {
      return res.status(400).json({ error: "email, password and fullName are required" });
    }

    const admin = await prisma.user.findUnique({
      where: { id: req.user.id },
      select: { id: true, companyId: true },
    });

    if (!admin?.companyId) {
      return res.status(400).json({ error: "Admin user is not linked to a company" });
    }

    const existing = await prisma.user.findUnique({ where: { email } });
    if (existing) return res.status(409).json({ error: "User with this email already exists" });

    const hashed = await bcrypt.hash(password, 10);

    const user = await prisma.user.create({
      data: {
        email,
        passwordHash: hashed,
        fullName,
        phone: phone ?? null,
        role: "CORPORATE_CLIENT",
        companyId: admin.companyId,
      },
      select: { id: true, email: true, fullName: true, role: true, companyId: true },
    });

    return res.status(201).json({ user });
  } catch (err) {
    console.error("Error in POST /admin/create-client-user:", err);
    return res.status(500).json({ error: "Internal server error" });
  }
});

// =====================
// USERS
// =====================
app.get("/me", authMiddleware, async (req: AuthRequest, res: Response) => {
  try {
    if (!req.user) return res.status(401).json({ error: "Unauthorized" });

    const user = await prisma.user.findUnique({
      where: { id: req.user.id },
      select: {
        id: true,
        email: true,
        fullName: true,
        role: true,
        phone: true,
        isEmailVerified: true,
        emailVerifiedAt: true,
        company: { select: { id: true, name: true, type: true } },
      },
    });

    if (!user) return res.status(404).json({ error: "User not found" });
    return res.json(user);
  } catch (err) {
    console.error("Error in /me:", err);
    return res.status(500).json({ error: "Internal server error" });
  }
});

// =====================
// QUOTES
// =====================

// Create quote (✅ blocked if unverified)
app.post(
  "/quotes",
  authMiddleware,
  requireVerifiedUser,
  requireRole("CORPORATE_CLIENT","ADMIN","INTERNAL_STAFF"),
  quoteDocsUpload,
  async (req: AuthRequest, res: Response) => {
    try {
      if (!req.user) return res.status(401).json({ error: "Unauthorized" });

      const {
        origin,
        destination,
        shipmentMode,
        commodity,
        weightKg,
        packages,
        pieces,
        isHazmat,
        isFragile,
        isTemperatureControlled,
        preferredTransitTime,
        serviceLevel,
        totalPrice,
        currency,
        validUntil,
        type, // 🆕 document type (applies to all uploaded files)
      } = req.body as any;

      let packagesArr: PackageInput[] = [];

      if (Array.isArray(req.body?.packages)) {
        packagesArr = req.body.packages as PackageInput[];
      } else if (typeof req.body?.packages === "string") {
        try {
          const parsed = JSON.parse(req.body.packages);
          if (!Array.isArray(parsed)) {
            return res.status(400).json({ error: "packages must be a JSON array" });
          }
          packagesArr = parsed as PackageInput[];
        } catch {
          return res.status(400).json({ error: "packages must be valid JSON array" });
        }
      }

      const requesterRole = req.user.role;
      const requesterCompanyId = req.user.companyId;

      const bodyCompanyId = (req.body?.companyId as string | undefined)?.trim();

      // Customers/agents must always use their own companyId
      // Staff/Admin can specify companyId to create quote for another company
      let targetCompanyId: string | null = requesterCompanyId ?? null;

     if (requesterRole === "ADMIN" || requesterRole === "INTERNAL_STAFF") {
       if (bodyCompanyId) targetCompanyId = bodyCompanyId;
     }

     if (!targetCompanyId) {
       return res.status(400).json({ error: "companyId is required" });
     }

     const targetCompany = await prisma.company.findUnique({
       where: { id: targetCompanyId },
       select: { id: true, type: true, name: true },
     });

     if (!targetCompany) {
       return res.status(404).json({ error: "Target company not found" });
     }

     // Optionally restrict to only external customer companies
     // (recommended so staff don’t accidentally create under INTERNAL)
     if (requesterRole === "ADMIN" || requesterRole === "INTERNAL_STAFF") {
       if (targetCompany.type !== "CORPORATE_CLIENT" && targetCompany.type !== "AGENT") {
         return res.status(400).json({ error: "Quotes can only be created for CORPORATE_CLIENT or AGENT companies" });
       }
      }

      // ✅ Compute CBM + chargeable weight from packages
      const { totalPieces, volumeCbm: computedCbm, chargeableWeightKg } =
        calcFromPackages(packagesArr);

      // ✅ If customer didn’t send pieces, auto-fill from packages qty sum
      const finalPieces =
        pieces != null ? Number(pieces) : totalPieces > 0 ? totalPieces : null;

      const user = await prisma.user.findUnique({
        where: { id: req.user.id },
        select: { id: true, companyId: true, fullName: true, email: true },
      });

      if (!user) return res.status(404).json({ error: "User not found" });
      const companyId = targetCompanyId; // ✅ docs + audit should use target company

      const files = (req.files as Express.Multer.File[]) ?? [];

      let docType: DocumentType = DocumentType.OTHER;
      let customType: string | null = null;

      if (files.length > 0) {
        const raw = String(req.body.type || "").trim();

        if (raw) {
         const normalized = raw.toUpperCase().replace(/\s+/g, "_"); // "Packing List" -> "PACKING_LIST"
         const allowed = new Set(Object.values(DocumentType));

         if (allowed.has(normalized as DocumentType)) {
           docType = normalized as DocumentType;
           customType = null;
         } else {
           docType = DocumentType.OTHER;
           customType = raw; // keep original user input
         }
       } else {
         // empty type allowed
         docType = DocumentType.OTHER;
         customType = null;
       }
     }
      
      if (files.length > 0 && !type) {
        return res.status(400).json({
          error: "type is required when uploading documents",
        });
      }

      const reference = `Q-${Date.now()}`;

      const toBool = (v: any) => {
       if (typeof v === "boolean") return v;
       if (typeof v === "string") {
         const s = v.trim().toLowerCase();
         if (s === "true") return true;
         if (s === "false") return false;
        }
        return false;
      };

      const toNumOrNull = (v: any) => {
        if (v === null || v === undefined || v === "") return null;
        const n = Number(v);
        return Number.isFinite(n) ? n : null;
      };

      const result = await prisma.$transaction(async (tx) => {
        // 1️⃣ Create quote
        const quote = await tx.quoteRequest.create({
          data: {
            reference,
            status: "PENDING",
            requestedById: user.id,
            companyId: targetCompanyId,
            origin,
            destination,
            shipmentMode,
            commodity: commodity ?? null,
            weightKg: toNumOrNull (weightKg),
            packagesJson: packagesArr.length ? packagesArr : undefined,
            volumeCbm: packagesArr.length
             ? computedCbm
             : (req.body?.volumeCbm != null ? Number(req.body.volumeCbm) : null),

            chargeableWeightKg: packagesArr.length
             ? chargeableWeightKg
             : (req.body?.chargeableWeightKg != null ? Number(req.body.chargeableWeightKg) : null), // ✅ computed
            pieces: finalPieces,                    // ✅ auto from packages if missing
            isHazmat: toBool(isHazmat),
            isFragile: toBool(isFragile),
            isTemperatureControlled: toBool(isTemperatureControlled),
            preferredTransitTime: preferredTransitTime ?? null,
            serviceLevel: serviceLevel ?? null,
            totalPrice: totalPrice ?? null,
            currency: currency ?? null,
            validUntil: validUntil ? new Date(validUntil) : null,
          },
          include: {
            company: { select: { id: true, name: true } },
            requestedBy: { select: { id: true, fullName: true, email: true } },
          },
        });

        // 2️⃣ Upload documents (if any)
        const documents = [];

        for (const file of files) {
          const uploaded = await uploadDocToS3({
            buffer: file.buffer,
            contentType: file.mimetype,
            originalName: file.originalname,
            companyId,
            quoteRequestId: quote.id,
          });

          const last = await tx.document.findFirst({
            where: {
              companyId,
              quoteRequestId: quote.id,
              type: docType!,
              deletedAt: null,
            },
            orderBy: { version: "desc" },
            select: { version: true },
          });

          const doc = await tx.document.create({
            data: {
              companyId,
              quoteRequestId: quote.id,
              uploadedById: user.id,
              filename: uploaded.filename,
              originalName: file.originalname,
              path: null,
              storage: "S3",
              s3Bucket: uploaded.bucket,
              s3Region: uploaded.region,
              s3Key: uploaded.key,
              mimeType: file.mimetype,
              size: file.size,
              version: (last?.version ?? 0) + 1,
              visibleToClient: true,
              customType,
              type: docType,
            },
          });

          documents.push(doc);
        }

        return { quote, documents };
      });

      const { ip, userAgent } = getReqContext(req);

      await logAudit({
       action: AuditAction.CREATE,
       entity: AuditEntity.QUOTE_REQUEST,
       entityId: result.quote.id,
       message: "Quote request created",
       userId: user.id,
       companyId,
       ip,
       userAgent,
       metadata: {
         reference: result.quote.reference,
         origin: result.quote.origin,
         destination: result.quote.destination,
         shipmentMode: String(result.quote.shipmentMode),
         docsUploaded: result.documents.length,
        },
      });


      await emailQuoteRequestReceived({
        quoteRef: result.quote.reference,
        companyName: result.quote.company?.name ?? null,
        origin: result.quote.origin,
        destination: result.quote.destination,
        shipmentMode: String(result.quote.shipmentMode),
      });

      return res.status(201).json(result);
    } catch (err) {
      console.error("Error in POST /quotes:", err);
      return res.status(500).json({ error: "Internal server error" });
    }
  }
);


// List quotes
app.get("/quotes", authMiddleware, async (req: AuthRequest, res: Response) => {
  try {
    if (!req.user) return res.status(401).json({ error: "Unauthorized" });

    const authUser = req.user;
    let quotes: any[] = [];

    if (authUser.role === "ADMIN" || authUser.role === "INTERNAL_STAFF") {
      quotes = await prisma.quoteRequest.findMany({
        orderBy: { createdAt: "desc" },
        include: {
          company: { select: { id: true, name: true } },
          requestedBy: { select: { id: true, fullName: true, email: true } },
        },
      });
    } else {
      quotes = await prisma.quoteRequest.findMany({
        where: { requestedById: authUser.id },
        orderBy: { createdAt: "desc" },
        include: {
          company: { select: { id: true, name: true } },
          requestedBy: { select: { id: true, fullName: true, email: true } },
        },
      });
    }

    return res.json(quotes);
  } catch (err) {
    console.error("Error in GET /quotes:", err);
    return res.status(500).json({ error: "Internal server error" });
  }
});

app.get(
  "/companies",
  authMiddleware,
  requireVerifiedUser,
  requireRole("ADMIN", "INTERNAL_STAFF"),
  async (req: AuthRequest, res: Response) => {
    try {
      const search = String(req.query.search ?? "").trim();

      const companies = await prisma.company.findMany({
        where: {
          type: { in: ["CORPORATE_CLIENT", "AGENT"] },
          ...(search
            ? {
                OR: [
                  { name: { contains: search, mode: "insensitive" } },
                  { id: { contains: search, mode: "insensitive" } },
                ],
              }
            : {}),
        },
        select: {
          id: true,
          name: true,
          type: true,
        },
        orderBy: { name: "asc" },
        take: 20,
      });

      return res.json(companies);
    } catch (err) {
      console.error("Error in GET /companies:", err);
      return res.status(500).json({ error: "Internal server error" });
    }
  }
);

app.post(
  "/quotes/:id/send",
  authMiddleware,
  requireVerifiedUser,
  requireRole("ADMIN", "INTERNAL_STAFF"),
  async (req: AuthRequest, res: Response) => {
    try {
      if (!req.user) return res.status(401).json({ error: "Unauthorized" });

      const quoteId = req.params.id;

      const reason = String(req.body?.lockReason ?? "Sent to customer").trim() || "Sent to customer";

      // Load quote (for email + validation)
      const quote = await prisma.quoteRequest.findUnique({
        where: { id: quoteId },
        include: {
          requestedBy: { select: { id: true, email: true, fullName: true } },
          company: { select: { id: true, name: true } },
        },
      });
      if (!quote) return res.status(404).json({ error: "Quote not found" });

      // Must have pricing initialized
      const pricing = await prisma.quotePricing.findUnique({
        where: { quoteId },
        include: { charges: true, blocks: true },
      });
      if (!pricing) return res.status(400).json({ error: "Pricing not initialized" });

      // Compute total from charges
      const totalSell = pricing.charges.reduce((s, c) => s + Number(c.totalSell ?? 0), 0);

      // Snapshot JSON
      const snapshot = {
        mode: pricing.mode,
        direction: pricing.direction,
        templateCode: pricing.templateCode,
        currency: pricing.currency,
        blocks: pricing.blocks.map((b) => ({
          id: b.id,
          containerType: b.containerType,
          containerQty: b.containerQty,
          isAddon: b.isAddon,
          order: b.order,
        })),
        charges: pricing.charges.map((c) => ({
          code: c.code,
          label: c.label,
          group: c.group,
          qtyBasis: c.qtyBasis,
          qty: c.qty,
          buyRate: c.buyRate,
          sellRate: c.sellRate,
          totalSell: c.totalSell,
          margin: c.margin,
          blockId: c.blockId,
        })),
        totals: { totalSell },
        createdAt: new Date().toISOString(),
      };

      // Perform send updates atomically
      const updated = await prisma.$transaction(async (tx) => {
        const q = await tx.quoteRequest.update({
          where: { id: quoteId },
          data: {
            // snapshot
            pricingSnapshot: snapshot,
            pricingVersion: { increment: 1 },
            pricedAt: new Date(),
            pricedById: req.user!.id,

            // lock
            pricingLockedAt: new Date(),
            pricingLockedById: req.user!.id,
            pricingLockReason: reason,

            // totals
            totalPrice: totalSell,
            currency: String(pricing.currency),

            // status
            status: QuoteStatus.SENT,
          },
          include: {
            requestedBy: { select: { id: true, email: true, fullName: true } },
            company: { select: { id: true, name: true } },
          },
        });

        return q;
      });

      // Audit
      await logAudit({
        action: AuditAction.STATUS_CHANGE,
        entity: AuditEntity.QUOTE_REQUEST,
        entityId: updated.id,
        message: "Quote sent to customer (snapshot + lock)",
        userId: req.user.id,
        companyId: updated.companyId,
        ...getReqContext(req),
        metadata: {
          status: updated.status,
          pricingVersion: updated.pricingVersion,
          lockReason: reason,
          totalPrice: updated.totalPrice,
          currency: updated.currency,
        },
      });

      // Email customer (reuse your existing email)
      await emailQuoteSentToCustomer({
        toCustomerEmail: updated.requestedBy.email,
        quoteRef: updated.reference,
        origin: updated.origin,
        destination: updated.destination,
        totalPrice: updated.totalPrice ?? null,
        currency: updated.currency ?? null,
        validUntil: updated.validUntil ?? null,
      });

      return res.json({
        ok: true,
        message: "Quote sent (snapshot saved, pricing locked, status SENT, email sent)",
        quote: {
          id: updated.id,
          reference: updated.reference,
          status: updated.status,
          pricingVersion: updated.pricingVersion,
          totalPrice: updated.totalPrice,
          currency: updated.currency,
          pricingLockedAt: updated.pricingLockedAt,
          pricingLockReason: updated.pricingLockReason,
        },
      });
    } catch (err) {
      console.error("Error in POST /quotes/:id/send:", err);
      return res.status(500).json({ error: "Internal server error" });
    }
  }
);


// Quote by ID
app.get("/quotes/:id", authMiddleware, async (req: AuthRequest, res: Response) => {
  try {
    if (!req.user) return res.status(401).json({ error: "Unauthorized" });

    const { id } = req.params;

    const quote = await prisma.quoteRequest.findUnique({
      where: { id },
      include: {
        company: { select: { id: true, name: true } },
        requestedBy: { select: { id: true, fullName: true, email: true } },
        booking: true,
      },
    });

    if (!quote) return res.status(404).json({ error: "Quote not found" });

    const staff = isStaffUser(req.user);
    if (!staff && quote.requestedById !== req.user.id) {
      return res.status(403).json({ error: "Forbidden" });
    }

    const canSeeBreakdown =
      quote.exworksBreakdownStatus === "APPROVED" &&
      quote.showExworksBreakdown === true;
     
    const hiddenCodes = Array.isArray((quote as any).exworksBreakdownHiddenCodes)
      ? ((quote as any).exworksBreakdownHiddenCodes as string[])
      : [];
  
    const pricingRow = await prisma.quotePricing.findUnique({
      where: { quoteId: quote.id },
      include: {
        charges: { orderBy: { order: "asc" } },
        blocks: { orderBy: { order: "asc" } },
      },
    });

    const pricing = buildCustomerPricingView({
      pricingRow,
      canSeeBreakdown: true,
      currencyFallback: "AED",
      hiddenBreakdownCodes: hiddenCodes,
    });

    const charges = pricingRow?.charges ?? [];

    return res.json({
      quote,
      pricing,
      charges: staff ? charges : undefined,
    });
  } catch (err) {
    console.error("Error in GET /quotes/:id:", err);
    return res.status(500).json({ error: "Internal server error" });
  }
});

app.patch(
  "/quotes/:id/volume-cbm",
  authMiddleware,
  requireRole(UserRole.ADMIN, UserRole.INTERNAL_STAFF),
  async (req: AuthRequest, res: Response) => {
    try {
      if (!req.user) return res.status(401).json({ error: "Unauthorized" });

      const quoteId = req.params.id;
      const { volumeCbm, mode } = req.body as {
        volumeCbm?: number;
        mode?: "AUTO" | "MANUAL";
      };

      const quote = await prisma.quoteRequest.findUnique({
        where: { id: quoteId },
        select: { id: true, packagesJson: true, volumeCbm: true },
      });
      if (!quote) return res.status(404).json({ error: "Quote not found" });

      let nextCbm: number | null = null;

      if (mode === "AUTO") {
        nextCbm = calcVolumeCbmFromPackages(quote.packagesJson);
        if (nextCbm === null) {
          return res.status(400).json({ error: "Unable to auto-calculate volumeCbm from packagesJson" });
        }
      } else {
        if (volumeCbm === undefined || volumeCbm === null) {
          return res.status(400).json({ error: "volumeCbm is required for MANUAL" });
        }
        nextCbm = Number(volumeCbm);
        if (!isFinite(nextCbm) || nextCbm < 0) return res.status(400).json({ error: "volumeCbm must be a valid number >= 0" });
        nextCbm = Math.round(nextCbm * 1000) / 1000;
      }

      const updated = await prisma.quoteRequest.update({
        where: { id: quoteId },
        data: { volumeCbm: nextCbm },
        select: { id: true, volumeCbm: true },
      });

      return res.json({ quoteId, volumeCbm: updated.volumeCbm });
    } catch (err) {
      console.error("Error in PATCH /quotes/:id/volume-cbm:", err);
      return res.status(500).json({ error: "Internal server error" });
    }
  }
);

// Staff marks quote as SENT
app.patch("/quotes/:id/status", authMiddleware,requireVerifiedUser,requireRole("ADMIN","INTERNAL_STAFF"), async (req: AuthRequest, res: Response) => {
  try {
    if (!req.user) return res.status(401).json({ error: "Unauthorized" });

    const staff = isStaffUser(req.user);
    if (!staff) return res.status(403).json({ error: "Forbidden" });

    const quoteId = req.params.id;
    const { status } = req.body as { status: QuoteStatus };

    if (!status) return res.status(400).json({ error: "status is required" });
    if (status !== QuoteStatus.SENT) {
      return res.status(400).json({ error: "Only SENT is allowed in this route for now" });
    }

    const quote = await prisma.quoteRequest.findUnique({
      where: { id: quoteId },
      include: {
        requestedBy: { select: { email: true } },
        company: { select: { id: true, name: true } },
      },
    });

    if (!quote) return res.status(404).json({ error: "Quote not found" });

    if (quote.status === status) {
      return res.status(200).json({ ok: true, message: "Status unchanged", quote });
    }

    const updated = await prisma.quoteRequest.update({
      where: { id: quoteId },
      data: { status },
      include: {
        requestedBy: { select: { id: true, fullName: true, email: true } },
        company: { select: { id: true, name: true } },
      },
    });

    await logAudit({
      action: AuditAction.STATUS_CHANGE,
      entity: AuditEntity.QUOTE_REQUEST,
      entityId: updated.id,
      message: `Quote status changed to ${updated.status}`,
      userId: req.user.id,
      companyId: updated.companyId,
      ...getReqContext(req),
      metadata: { status: updated.status },
    });

    await emailQuoteSentToCustomer({
      toCustomerEmail: updated.requestedBy.email,
      quoteRef: updated.reference,
      origin: updated.origin,
      destination: updated.destination,
      totalPrice: updated.totalPrice ?? null,
      currency: updated.currency ?? null,
      validUntil: updated.validUntil ?? null,
    });

    return res.json(updated);
  } catch (err) {
    console.error("Error in PATCH /quotes/:id/status:", err);
    return res.status(500).json({ error: "Internal server error" });
  }
});

app.get("/quotes/:id/quote-pdf", authMiddleware, async (req: AuthRequest, res: Response) => {
  try {
    if (!req.user) return res.status(401).json({ error: "Unauthorized" });

    const quoteId = req.params.id;

    const quote = await prisma.quoteRequest.findUnique({
      where: { id: quoteId },
      include: {
        company: { select: { id: true, name: true } },
        requestedBy: { select: { id: true, fullName: true, email: true } },
      },
    });
    if (!quote) return res.status(404).json({ error: "Quote not found" });

    // permission: staff or owner
    const staff = isStaffUser(req.user);
    if (!staff && quote.requestedById !== req.user.id) {
      return res.status(403).json({ error: "Forbidden" });
    }

    // Prefer snapshot (what was sent). If none, fallback to live pricing row.
    let snapshot: any = quote.pricingSnapshot;

    if (!snapshot) {
      const pricingRow = await prisma.quotePricing.findUnique({
        where: { quoteId: quote.id },
        include: { charges: true, blocks: true },
      });
      if (!pricingRow) return res.status(400).json({ error: "No pricing snapshot and pricing not initialized" });

      const totalSell = pricingRow.charges.reduce((s, c) => s + Number(c.totalSell ?? 0), 0);

      snapshot = {
        mode: pricingRow.mode,
        direction: pricingRow.direction,
        templateCode: pricingRow.templateCode,
        currency: pricingRow.currency,
        blocks: pricingRow.blocks,
        charges: pricingRow.charges,
        totals: { totalSell },
        createdAt: new Date().toISOString(),
        note: "Generated from live pricing (no snapshot found)",
      };
    }

    // ===== PDF STREAM =====
    res.setHeader("Content-Type", "application/pdf");
    res.setHeader(
      "Content-Disposition",
      `inline; filename="${quote.reference || "quote"}-${quoteId}.pdf"`
    );

    const doc = new PDFDocument({ size: "A4", margin: 50 });
    doc.pipe(res);

    const currency = snapshot.currency || quote.currency || "AED";

    const money = (n: any) => {
      const x = Number(n ?? 0);
      return x.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 });
    };

    const nonZero = (n: any) => Math.abs(Number(n ?? 0)) > 1e-9;

    // Header
    doc.fontSize(18).text("JEX LOGISTICS – Quote", { align: "left" });
    doc.moveDown(0.4);
    doc.fontSize(10).fillColor("#555");

    doc.text(`Quote Ref: ${quote.reference || quote.id}`);
    doc.text(`Date: ${new Date().toISOString().slice(0, 10)}`);
    doc.text(`Company: ${quote.company?.name || "-"}`);
    doc.text(`Route: ${quote.origin} → ${quote.destination}`);
    doc.text(`Mode: ${String(quote.shipmentMode)}`);
    doc.text(`Currency: ${currency}`);
    doc.fillColor("#000");
    doc.moveDown(0.8);

    // Summary
    doc.fontSize(13).text("Pricing Summary");
    doc.moveDown(0.3);
    doc.fontSize(10);

    // If blocks exist: show per block summary (Ocean/THC/Exworks)
    const blocks = Array.isArray(snapshot.blocks) ? snapshot.blocks : [];
    const charges = Array.isArray(snapshot.charges) ? snapshot.charges : [];

    const totalSell = Number(snapshot?.totals?.totalSell ?? 0);

    const tooCharges = charges.filter((c: any) => c.group === "TRANSFER_OWNERSHIP");
    const tooTotal = tooCharges.reduce((s: number, c: any) => s + Number(c.totalSell ?? 0), 0);

    const grandTotal = totalSell; // snapshot total already includes everything if you saved it that way
    // If your snapshot totalSell does NOT include TOO, then use:
    // const grandTotal = (totalSell - tooTotal) + tooTotal;

    if (blocks.length) {
      for (const b of blocks) {
        doc.fontSize(11).text(`${b.containerType || "Container"} × ${b.containerQty || 0}${b.isAddon ? " (add-on)" : ""}`);
        doc.fontSize(10);

        const bCharges = charges.filter((c: any) => c.blockId === b.id);

        const ocean = bCharges.find((c: any) => c.code === "OCEAN_FREIGHT");
        const thc = bCharges.find((c: any) => c.code === "THC");
        const exworks = bCharges
          .filter((c: any) => c.group === "EXWORKS")
          .reduce((s: number, c: any) => s + Number(c.totalSell ?? 0), 0);

        if (ocean) doc.text(`• Ocean Freight: ${money(ocean.totalSell)}  (${money(ocean.sellRate)} × ${ocean.qty})`);
        if (thc) doc.text(`• THC: ${money(thc.totalSell)}  (${money(thc.sellRate)} × ${thc.qty})`);
        doc.text(`• Exworks: ${money(exworks)}`);
        doc.text(`Subtotal: ${money((Number(ocean?.totalSell ?? 0) + Number(thc?.totalSell ?? 0) + exworks))}`);
        doc.moveDown(0.4);
      }
    } else {
      // No blocks: generic summary
      // Try to show known main lines, else just show total
      const mainLines = charges.filter((c: any) => c.group === "MAIN");
      for (const c of mainLines) {
        if (!nonZero(c.totalSell)) continue;
        doc.text(`• ${c.label}: ${money(c.totalSell)}`);
      }
      const exworks = charges.filter((c: any) => c.group === "EXWORKS").reduce((s: number, c: any) => s + Number(c.totalSell ?? 0), 0);
      if (nonZero(exworks)) doc.text(`• Exworks: ${money(exworks)}`);
      doc.moveDown(0.4);
    }

    // Transfer Ownership (one line)
    if (nonZero(tooTotal)) {
      doc.fontSize(12).text("Transfer of Ownership");
      doc.fontSize(10).text(`${money(tooTotal)} ${currency}`);
      doc.moveDown(0.4);
    }

    // Grand total
    doc.moveDown(0.2);
    doc.fontSize(14).text(`Grand Total: ${currency} ${money(grandTotal)}`, { align: "right" });
    doc.moveDown(0.6);

    // Breakdown section (always include in PDF if snapshot includes it; or you can gate it)
    doc.addPage();
    doc.fontSize(13).text("Breakdown");
    doc.moveDown(0.3);
    doc.fontSize(10).fillColor("#000");

    const breakdownLines = charges
      .map((c: any) => ({
        label: c.label,
        code: c.code,
        group: c.group,
        amount: Number(c.totalSell ?? 0),
      }))
      .filter((x: any) => nonZero(x.amount))
      .sort((a: any, b: any) => (a.group || "").localeCompare(b.group || "") || (a.label || "").localeCompare(b.label || ""));

    for (const line of breakdownLines) {
      doc.text(`${line.label} — ${money(line.amount)} ${currency}`);
    }

    doc.end();
  } catch (err) {
    console.error("Error in GET /quotes/:id/quote-pdf:", err);
    return res.status(500).json({ error: "Internal server error" });
  }
});

// Client decides ACCEPT/REJECT
app.patch("/quotes/:id/decision", authMiddleware,requireVerifiedUser,requireRole("CORPORATE_CLIENT","ADMIN","INTERNAL_STAFF"), async (req: AuthRequest, res: Response) => {
  try {
    if (!req.user) return res.status(401).json({ error: "Unauthorized" });

    const quoteId = req.params.id;
    const { decision } = req.body as { decision: QuoteStatus };

    if (!decision) return res.status(400).json({ error: "decision is required" });

    const allowed: ReadonlySet<QuoteStatus> = new Set([QuoteStatus.ACCEPTED, QuoteStatus.REJECTED]);
    if (!allowed.has(decision)) {
      return res.status(400).json({ error: "decision must be ACCEPTED or REJECTED" });
    }

    const quote = await prisma.quoteRequest.findUnique({
      where: { id: quoteId },
      include: {
        requestedBy: { select: { id: true, email: true } },
        company: { select: { id: true, name: true } },
        booking: true,
      },
    });

    if (!quote) return res.status(404).json({ error: "Quote not found" });

    const staff = isStaffUser(req.user);
    const isOwner = quote.requestedById === req.user.id;

    if (!isOwner && !staff) return res.status(403).json({ error: "Forbidden" });
    if (!staff && quote.companyId !== req.user.companyId) {
      return res.status(403).json({ error: "Forbidden" });
    }

    if (quote.validUntil && quote.validUntil.getTime() < Date.now()) {
      return res.status(400).json({ error: "Quote is expired" });
    }

    if (quote.status === decision) {
      return res.status(200).json({ ok: true, message: "Status unchanged", quote });
    }

    const allowedFrom: ReadonlySet<QuoteStatus> = new Set([QuoteStatus.SENT, QuoteStatus.PENDING]);
    if (!allowedFrom.has(quote.status)) {
      return res.status(400).json({ error: `Cannot decide quote in status ${quote.status}` });
    }

    const result = await prisma.$transaction(async (tx) => {
      const updatedQuote = await tx.quoteRequest.update({
        where: { id: quoteId },
        data: { status: decision },
        include: {
          requestedBy: { select: { id: true, fullName: true, email: true } },
          company: { select: { id: true, name: true } },
          booking: true,
        },
      });

      let bookingDraft = updatedQuote.booking;

      if (decision === QuoteStatus.ACCEPTED && !bookingDraft) {
        bookingDraft = await tx.booking.create({
          data: {
            bookingRef: `B-${Date.now()}`,
            status: BookingStatus.DRAFT,
            quoteId: updatedQuote.id,
            companyId: updatedQuote.companyId,
            createdById: updatedQuote.requestedById,
          },
          include: { createdBy: { select: { email: true } } },
        });
      }
      return { updatedQuote, bookingDraft };
    });

    if (decision === QuoteStatus.ACCEPTED && result.bookingDraft) {
      await logAudit({
        action: AuditAction.CREATE,
        entity: AuditEntity.BOOKING,
        entityId: result.bookingDraft.id,
        message: "Booking draft created from accepted quote",
        userId: req.user.id,
        companyId: result.updatedQuote.companyId,
        ...getReqContext(req),
        metadata: { bookingRef: result.bookingDraft.bookingRef },
      });
    }

    await emailQuoteDecisionToOps({
      quoteRef: result.updatedQuote.reference,
      decision,
      customerEmail: result.updatedQuote.requestedBy.email,
      companyName: result.updatedQuote.company?.name ?? null,
      origin: result.updatedQuote.origin,
      destination: result.updatedQuote.destination,
    });

    await emailQuoteDecisionToCustomer({
      toCustomerEmail: result.updatedQuote.requestedBy.email,
      quoteRef: result.updatedQuote.reference,
      decision,
    });

    if (decision === QuoteStatus.ACCEPTED && result.bookingDraft) {
      await emailBookingDraftCreated({
        toCustomerEmail: result.updatedQuote.requestedBy.email,
        bookingRef: result.bookingDraft.bookingRef,
        quoteRef: result.updatedQuote.reference,
      });
    }

    return res.json({
      quote: result.updatedQuote,
      bookingDraft: result.bookingDraft,
    });
  } catch (err) {
    console.error("Error in PATCH /quotes/:id/decision:", err);
    return res.status(500).json({ error: "Internal server error" });
  }
});

app.get(
  "/quotes/:id/exworks-breakdown/preview",
  authMiddleware,
  requireRole("ADMIN", "INTERNAL_STAFF"),
  async (req: AuthRequest, res: Response) => {
    try {
      if (!req.user) return res.status(401).json({ error: "Unauthorized" });

      const quoteId = req.params.id;

      const quote = await prisma.quoteRequest.findUnique({
        where: { id: quoteId },
        include: {
          company: { select: { id: true, name: true } },
          requestedBy: { select: { id: true, fullName: true, email: true } },
        },
      });
      if (!quote) return res.status(404).json({ error: "Quote not found" });
       
      const hiddenCodes = Array.isArray((quote as any).exworksBreakdownHiddenCodes)
        ? ((quote as any).exworksBreakdownHiddenCodes as string[])
        : [];

      const pricingRow = await prisma.quotePricing.findUnique({
        where: { quoteId },
        include: {
          charges: { orderBy: { order: "asc" } },
          blocks: { orderBy: { order: "asc" } },
        },
      });
      if (!pricingRow) return res.status(404).json({ error: "Pricing not initialized" });

      // ✅ Force breakdown view for preview, regardless of approval status
      const pricingPreview = buildCustomerPricingView({
        pricingRow,
        canSeeBreakdown: true,
        currencyFallback: "AED",
        hiddenBreakdownCodes: hiddenCodes,
      });

      return res.json({
        quote: {
          id: quote.id,
          reference: quote.reference,
          origin: quote.origin,
          destination: quote.destination,
          shipmentMode: quote.shipmentMode,
          company: quote.company,
          requestedBy: quote.requestedBy,
          exworksBreakdownStatus: quote.exworksBreakdownStatus,
          showExworksBreakdown: quote.showExworksBreakdown,
        },
        pricingPreview,
        charges: pricingRow.charges, // admin sees raw
      });
    } catch (err) {
      console.error("Error in GET /quotes/:id/exworks-breakdown/preview:", err);
      return res.status(500).json({ error: "Internal server error" });
    }
  }
);

app.post(
  "/quotes/:id/exworks-breakdown/pending",
  authMiddleware,
  requireRole("ADMIN", "INTERNAL_STAFF"),
  async (req: AuthRequest, res: Response) => {
    try {
      if (!req.user) return res.status(401).json({ error: "Unauthorized" });

      const quoteId = req.params.id;

      const updated = await prisma.quoteRequest.update({
        where: { id: quoteId },
        data: {
          exworksBreakdownStatus: BreakdownRequestStatus.PENDING,
          exworksBreakdownRequestedAt: new Date(),
          showExworksBreakdown: false,
          exworksBreakdownReviewedAt: null,
          exworksBreakdownReviewedById: null,
          exworksBreakdownReviewNote: null,
        },
        select: {
          id: true,
          exworksBreakdownStatus: true,
          exworksBreakdownRequestedAt: true,
          showExworksBreakdown: true,
        },
      });

      return res.json({ ok: true, message: "Breakdown marked as PENDING", ...updated });
    } catch (err) {
      console.error("Error in POST /quotes/:id/exworks-breakdown/pending:", err);
      return res.status(500).json({ error: "Internal server error" });
    }
  }
);

app.post(
  "/quotes/:id/exworks-breakdown/approve",
  authMiddleware,
  requireRole("ADMIN", "INTERNAL_STAFF"),
  async (req: AuthRequest, res: Response) => {
    try {
      if (!req.user) return res.status(401).json({ error: "Unauthorized" });

      const quoteId = req.params.id;
      const note = req.body?.note ? String(req.body.note).trim() : null;

      const updated = await prisma.quoteRequest.update({
        where: { id: quoteId },
        data: {
          exworksBreakdownStatus: BreakdownRequestStatus.APPROVED,
          showExworksBreakdown: true,
          exworksBreakdownReviewedAt: new Date(),
          exworksBreakdownReviewedById: req.user.id,
          exworksBreakdownReviewNote: note,
        },
        select: {
          id: true,
          exworksBreakdownStatus: true,
          showExworksBreakdown: true,
          exworksBreakdownReviewedAt: true,
          exworksBreakdownReviewedById: true,
          exworksBreakdownReviewNote: true,
        },
      });

      return res.json({ ok: true, message: "Breakdown approved", ...updated });
    } catch (err) {
      console.error("Error in POST /quotes/:id/exworks-breakdown/approve:", err);
      return res.status(500).json({ error: "Internal server error" });
    }
  }
);

app.post(
  "/quotes/:id/exworks-breakdown/reject",
  authMiddleware,
  requireRole("ADMIN", "INTERNAL_STAFF"),
  async (req: AuthRequest, res: Response) => {
    try {
      if (!req.user) return res.status(401).json({ error: "Unauthorized" });

      const quoteId = req.params.id;
      const note = req.body?.note ? String(req.body.note).trim() : null;

      const updated = await prisma.quoteRequest.update({
        where: { id: quoteId },
        data: {
          exworksBreakdownStatus: BreakdownRequestStatus.REJECTED,
          showExworksBreakdown: false,
          exworksBreakdownReviewedAt: new Date(),
          exworksBreakdownReviewedById: req.user.id,
          exworksBreakdownReviewNote: note,
        },
        select: {
          id: true,
          exworksBreakdownStatus: true,
          showExworksBreakdown: true,
          exworksBreakdownReviewedAt: true,
          exworksBreakdownReviewedById: true,
          exworksBreakdownReviewNote: true,
        },
      });

      return res.json({ ok: true, message: "Breakdown rejected", ...updated });
    } catch (err) {
      console.error("Error in POST /quotes/:id/exworks-breakdown/reject:", err);
      return res.status(500).json({ error: "Internal server error" });
    }
  }
);

app.patch(
  "/quotes/:id/exworks-breakdown/hide-lines",
  authMiddleware,
  requireRole("ADMIN", "INTERNAL_STAFF"),
  async (req: AuthRequest, res: Response) => {
    try {
      if (!req.user) return res.status(401).json({ error: "Unauthorized" });

      const quoteId = req.params.id;
      const hiddenCodesRaw = req.body?.hiddenCodes;

      if (!Array.isArray(hiddenCodesRaw)) {
        return res.status(400).json({ error: "hiddenCodes must be an array of charge codes" });
      }

      // normalize, remove empties, unique
      const hiddenCodes = Array.from(
        new Set(
          hiddenCodesRaw
            .map((x: any) => String(x || "").trim())
            .filter((x: string) => x.length > 0)
        )
      );

      const updated = await prisma.quoteRequest.update({
        where: { id: quoteId },
        data: {
          exworksBreakdownHiddenCodes: hiddenCodes,
        },
        select: {
          id: true,
          exworksBreakdownHiddenCodes: true,
          exworksBreakdownStatus: true,
          showExworksBreakdown: true,
        },
      });

      return res.json({
        ok: true,
        message: "Hidden breakdown lines updated",
        quoteId: updated.id,
        hiddenCodes: updated.exworksBreakdownHiddenCodes ?? [],
      });
    } catch (err) {
      console.error("Error in PATCH /quotes/:id/exworks-breakdown/hide-lines:", err);
      return res.status(500).json({ error: "Internal server error" });
    }
  }
);


// =====================
// BOOKINGS
// =====================

// Create booking (✅ blocked if unverified)
app.post("/bookings", authMiddleware, requireVerifiedUser,requireRole("CORPORATE_CLIENT","ADMIN","INTERNAL_STAFF"), async (req: AuthRequest, res: Response) => {
  try {
    if (!req.user) return res.status(401).json({ error: "Unauthorized" });

    const { quoteId, incoterms, shipperName, consigneeName, notifyParty } = req.body as any;

    const user = await prisma.user.findUnique({
      where: { id: req.user.id },
      include: { company: true },
    });

    if (!user) return res.status(404).json({ error: "User not found" });
    if (!user.companyId) return res.status(400).json({ error: "User is not linked to a company" });

    if (quoteId) {
      const quote = await prisma.quoteRequest.findUnique({ where: { id: quoteId } });
      if (!quote) return res.status(404).json({ error: "Quote not found" });
      if (quote.companyId !== user.companyId) {
        return res.status(403).json({ error: "Quote does not belong to your company" });
      }

      const existing = await prisma.booking.findUnique({ where: { quoteId } });
      if (existing) {
        return res.status(409).json({
          error: "A booking already exists for this quote",
          bookingId: existing.id,
        });
      }
    }

    const bookingRef = `B-${Date.now()}`;

    const booking = await prisma.booking.create({
      data: {
        bookingRef,
        status: BookingStatus.DRAFT,
        companyId: user.companyId,
        createdById: user.id,
        quoteId: quoteId ?? null,
        incoterms: incoterms ?? null,
        shipperName: shipperName ?? null,
        consigneeName: consigneeName ?? null,
        notifyParty: notifyParty ?? null,
      },
      include: {
        company: { select: { id: true, name: true } },
        createdBy: { select: { id: true, fullName: true, email: true } },
        quote: {
          select: {
            id: true,
            reference: true,
            origin: true,
            destination: true,
            shipmentMode: true,
            status: true,
          },
        },
        shipment: true,
      },
    });

    await logAudit({
      action: AuditAction.CREATE,
      entity: AuditEntity.BOOKING,
      entityId: booking.id,
      message: "Booking created",
      userId: req.user.id,
      companyId: booking.companyId,
      ...getReqContext(req),
      metadata: { bookingRef: booking.bookingRef, quoteId: booking.quoteId },
    });


    return res.status(201).json(booking);
  } catch (err) {
    console.error("Error in POST /bookings:", err);
    return res.status(500).json({ error: "Internal server error" });
  }
});

// List bookings
app.get("/bookings", authMiddleware,requireVerifiedUser, async (req: AuthRequest, res: Response) => {
  try {
    if (!req.user) return res.status(401).json({ error: "Unauthorized" });

    const authUser = req.user;
    let bookings: any[] = [];

   const staff = isStaffUser(req.user);
    if (staff) {

      bookings = await prisma.booking.findMany({
        orderBy: { createdAt: "desc" },
        include: {
          company: { select: { id: true, name: true } },
          createdBy: { select: { id: true, fullName: true, email: true } },
          quote: { select: { id: true, reference: true, origin: true, destination: true, shipmentMode: true } },
          shipment: true,
        },
      });
    } else {
      const user = await prisma.user.findUnique({ where: { id: authUser.id } });
      if (!user || !user.companyId) return res.status(400).json({ error: "User not linked to a company" });

      bookings = await prisma.booking.findMany({
        where: { companyId: user.companyId },
        orderBy: { createdAt: "desc" },
        include: {
          company: { select: { id: true, name: true } },
          createdBy: { select: { id: true, fullName: true, email: true } },
          quote: { select: { id: true, reference: true, origin: true, destination: true, shipmentMode: true } },
          shipment: true,
        },
      });
    }

    return res.json(bookings);
  } catch (err) {
    console.error("Error in GET /bookings:", err);
    return res.status(500).json({ error: "Internal server error" });
  }
});

// Booking by ID
app.get("/bookings/:id", authMiddleware, async (req: AuthRequest, res: Response) => {
  try {
    if (!req.user) return res.status(401).json({ error: "Unauthorized" });

    const { id } = req.params;

    const booking = await prisma.booking.findUnique({
      where: { id },
      include: {
        company: { select: { id: true, name: true } },
        createdBy: { select: { id: true, fullName: true, email: true } },
        quote: { select: { id: true, reference: true, origin: true, destination: true, shipmentMode: true, status: true } },
        shipment: true,
      },
    });

    if (!booking) return res.status(404).json({ error: "Booking not found" });

    const staff = isStaffUser(req.user);

    if (!staff) {
      const user = await prisma.user.findUnique({ where: { id: req.user.id } });
      if (!user || !user.companyId || user.companyId !== booking.companyId) {
        return res.status(403).json({ error: "Forbidden" });
      }
    }

    return res.json(booking);
  } catch (err) {
    console.error("Error in GET /bookings/:id:", err);
    return res.status(500).json({ error: "Internal server error" });
  }
});

// Staff updates booking status + auto-create shipment when CONFIRMED
app.patch("/bookings/:id/status", authMiddleware,requireVerifiedUser,requireRole("ADMIN","INTERNAL_STAFF"), async (req: AuthRequest, res: Response) => {
  try {
    if (!req.user) {
     return res.status(401).json({ error: "Unauthorized" });
    }
    const userId = req.user.id; // ✅ TS-safe from here onward
 
    const bookingId = req.params.id;
    const { status } = req.body as { status: BookingStatus };

    if (!status) return res.status(400).json({ error: "status is required" });

    const allowed: ReadonlySet<BookingStatus> = new Set([BookingStatus.CONFIRMED, BookingStatus.CANCELLED]);
    if (!allowed.has(status)) {
      return res.status(400).json({ error: "Only CONFIRMED or CANCELLED allowed" });
    }

    const booking = await prisma.booking.findUnique({
      where: { id: bookingId },
      include: {
        createdBy: { select: { id: true, email: true } },
        quote: { select: { id: true, origin: true, destination: true, shipmentMode: true } },
        shipment: {
          select: { id: true, shipmentRef: true, origin: true, destination: true, status: true, mode: true, bookingId: true },
        },
      },
    });

    if (!booking) return res.status(404).json({ error: "Booking not found" });

    if (status === BookingStatus.CONFIRMED && booking.status !== BookingStatus.DRAFT) {
      return res.status(400).json({ error: "Only DRAFT bookings can be confirmed" });
    }

    if (booking.status === status) {
      return res.status(200).json({ ok: true, message: "Status unchanged", booking });
    }

    const result = await prisma.$transaction(async (tx) => {
      const bookingUpdated = await tx.booking.update({
        where: { id: bookingId },
        data: { status },
        include: {
          company: { select: { id: true, name: true } },
          createdBy: { select: { id: true, fullName: true, email: true } },
          quote: { select: { id: true, reference: true, origin: true, destination: true, shipmentMode: true } },
          shipment: { select: { id: true, shipmentRef: true, origin: true, destination: true, status: true, mode: true, bookingId: true } },
        },
      });

      if (status === BookingStatus.CONFIRMED) {
        const quoteId = bookingUpdated.quote?.id; // from include
        if (!quoteId) {
         throw new Error("Booking has no linked quote. Cannot lock pricing.");
        }

        await tx.quoteRequest.update({
         where: { id: quoteId },
         data: {
           pricingLockedAt: new Date(),
           pricingLockedById: userId,
           pricingLockReason: "Booking confirmed",
          },
        });
      }

      let createdShipment = bookingUpdated.shipment;

      if (status === BookingStatus.CONFIRMED && !createdShipment) {
        const origin = bookingUpdated.quote?.origin ?? "TBD";
        const destination = bookingUpdated.quote?.destination ?? "TBD";
        const mode = bookingUpdated.quote?.shipmentMode ?? ShipmentMode.OTHER;

        createdShipment = await tx.shipment.create({
          data: {
            shipmentRef: `S-${Date.now()}`,
            mode,
            status: ShipmentStatus.BOOKED,
            companyId: bookingUpdated.companyId,
            ownerId: bookingUpdated.createdById,
            bookingId: bookingUpdated.id,
            origin,
            destination,
          },
          select: { id: true, shipmentRef: true, origin: true, destination: true, status: true, mode: true, bookingId: true },
        });
      }

      return { bookingUpdated, createdShipment };
    });

    if (status === BookingStatus.CONFIRMED && result.createdShipment) {
     await logAudit({
       action: AuditAction.CREATE,
       entity: AuditEntity.SHIPMENT,
       entityId: result.createdShipment.id,
       message: "Shipment created from confirmed booking",
       userId: req.user.id,
       companyId: result.bookingUpdated.companyId,
       ...getReqContext(req),
       metadata: { shipmentRef: result.createdShipment.shipmentRef },
      });
    }

    await emailBookingStatus({
      toCustomerEmail: result.bookingUpdated.createdBy.email,
      bookingRef: result.bookingUpdated.bookingRef,
      status: result.bookingUpdated.status,
    });

    if (status === BookingStatus.CONFIRMED && result.createdShipment) {
      await emailShipmentCreated({
        toCustomerEmail: result.bookingUpdated.createdBy.email,
        shipmentRef: result.createdShipment.shipmentRef,
        origin: result.createdShipment.origin,
        destination: result.createdShipment.destination,
      });
    }

    return res.json({
      booking: result.bookingUpdated,
      shipment: result.createdShipment,
    });
  } catch (err) {
    console.error("Error in PATCH /bookings/:id/status:", err);
    return res.status(500).json({ error: "Internal server error" });
  }
});

// =====================
// SHIPMENTS
// =====================

// Create shipment manually (✅ blocked if unverified) — optional if you already auto-create from booking confirm
app.post("/shipments", authMiddleware, requireVerifiedUser,requireRole("ADMIN","INTERNAL_STAFF"), async (req: AuthRequest, res: Response) => {
  try {
    if (!req.user) return res.status(401).json({ error: "Unauthorized" });

    const { bookingId, mode, origin, destination, eta, etd, containerNumber, awbNumber, bolNumber, currentLocation } =
      req.body as any;

    if (!bookingId || !mode || !origin || !destination) {
      return res.status(400).json({ error: "bookingId, mode, origin and destination are required" });
    }

    const user = await prisma.user.findUnique({
      where: { id: req.user.id },
      select: { id: true, role: true, companyId: true },
    });
    if (!user) return res.status(401).json({ error: "Unauthorized" });

    const booking = await prisma.booking.findUnique({
      where: { id: bookingId },
      select: { id: true, companyId: true, createdById: true },
    });
    if (!booking) return res.status(404).json({ error: "Booking not found" });

    // ✅ Staff can operate across customer companies (typical ops workflow)
    const staff = isStaffUser(user);

    // ✅ If you ever allow clients here later, enforce company match
    if (!staff) {
      if (!user.companyId) return res.status(400).json({ error: "User not linked to a company" });
      if (booking.companyId !== user.companyId) {
        return res.status(403).json({ error: "Booking does not belong to your company" });
      }
    }

    const existingShipment = await prisma.shipment.findUnique({ where: { bookingId } });
    if (existingShipment) return res.status(400).json({ error: "Shipment already exists for this booking" });

    const shipmentRef = `S-${Date.now()}`;

    const shipment = await prisma.shipment.create({
      data: {
        shipmentRef,
        mode,
        status: ShipmentStatus.BOOKED,
        companyId:booking.companyId,
        ownerId: booking.createdById,
        bookingId: booking.id,
        origin,
        destination,
        eta: eta ? new Date(eta) : null,
        etd: etd ? new Date(etd) : null,
        containerNumber: containerNumber ?? null,
        awbNumber: awbNumber ?? null,
        bolNumber: bolNumber ?? null,
        currentLocation: currentLocation ?? null,
      },
      include: {
        company: { select: { id: true, name: true } },
        owner: { select: { id: true, fullName: true, email: true } },
        booking: { select: { id: true, bookingRef: true, status: true } },
        trackingEvents: true,
      },
    });

    await logAudit({
     action: AuditAction.CREATE,
     entity: AuditEntity.SHIPMENT,
     entityId: shipment.id,
     message: "Shipment created",
     userId: req.user.id,
     companyId: shipment.companyId,
     ...getReqContext(req),
     metadata: { shipmentRef: shipment.shipmentRef, bookingId: shipment.bookingId },
    });


    await emailShipmentCreated({
      toCustomerEmail: shipment.owner.email,
      shipmentRef: shipment.shipmentRef,
      origin: shipment.origin,
      destination: shipment.destination,
    });

    return res.status(201).json(shipment);
  } catch (err) {
    console.error("Error in POST /shipments:", err);
    return res.status(500).json({ error: "Internal server error" });
  }
});

// List shipments
app.get("/shipments", authMiddleware, async (req: AuthRequest, res: Response) => {
  try {
    if (!req.user) return res.status(401).json({ error: "Unauthorized" });

    const authUser = req.user;
    let shipments: any[] = [];

   const staff = isStaffUser(req.user);
    if (staff) {

      shipments = await prisma.shipment.findMany({
        orderBy: { createdAt: "desc" },
        include: {
          company: { select: { id: true, name: true } },
          owner: { select: { id: true, fullName: true, email: true } },
          booking: { select: { id: true, bookingRef: true, status: true } },
        },
      });
    } else {
      const user = await prisma.user.findUnique({ where: { id: authUser.id } });
      if (!user || !user.companyId) return res.status(400).json({ error: "User not linked to a company" });

      shipments = await prisma.shipment.findMany({
        where: { companyId: user.companyId },
        orderBy: { createdAt: "desc" },
        include: {
          company: { select: { id: true, name: true } },
          owner: { select: { id: true, fullName: true, email: true } },
          booking: { select: { id: true, bookingRef: true, status: true } },
        },
      });
    }

    return res.json(shipments);
  } catch (err) {
    console.error("Error in GET /shipments:", err);
    return res.status(500).json({ error: "Internal server error" });
  }
});

// Shipment by ID
app.get("/shipments/:id", authMiddleware, async (req: AuthRequest, res: Response) => {
  try {
    if (!req.user) return res.status(401).json({ error: "Unauthorized" });

    const { id } = req.params;

    const shipment = await prisma.shipment.findUnique({
      where: { id },
      include: {
        company: { select: { id: true, name: true } },
        owner: { select: { id: true, fullName: true, email: true } },
        booking: { select: { id: true, bookingRef: true, status: true } },
        trackingEvents: { orderBy: { eventTime: "desc" } },
      },
    });

    if (!shipment) return res.status(404).json({ error: "Shipment not found" });

   const staff = isStaffUser(req.user);
    if (!staff) {

      const user = await prisma.user.findUnique({ where: { id: req.user.id } });
      if (!user || !user.companyId || user.companyId !== shipment.companyId) {
        return res.status(403).json({ error: "Forbidden" });
      }
    }

    return res.json(shipment);
  } catch (err) {
    console.error("Error in GET /shipments/:id:", err);
    return res.status(500).json({ error: "Internal server error" });
  }
});

// Add tracking event
app.post("/shipments/:id/events", authMiddleware,requireVerifiedUser,requireRole("ADMIN","INTERNAL_STAFF"), async (req: AuthRequest, res: Response) => {
  try {
    if (!req.user) return res.status(401).json({ error: "Unauthorized" });

    const { id } = req.params;
    const { status, description, location, eventTime } = req.body as any;

    if (!status) return res.status(400).json({ error: "status is required" });

    const shipment = await prisma.shipment.findUnique({ where: { id } });
    if (!shipment) return res.status(404).json({ error: "Shipment not found" });
    //const staff = isStaffUser(req.user);
    //if (!staff && shipment.companyId !== req.user.companyId) {
    // return res.status(403).json({ error: "Forbidden" });
    //}

    const trackingEvent = await prisma.trackingEvent.create({
      data: {
        shipmentId: shipment.id,
        status,
        description: description ?? null,
        location: location ?? null,
        eventTime: eventTime ? new Date(eventTime) : undefined,
      },
    });

    await prisma.shipment.update({
      where: { id: shipment.id },
      data: { status, currentLocation: location ?? shipment.currentLocation },
    });

    await logAudit({
      action: AuditAction.CREATE,
      entity: AuditEntity.SHIPMENT,
      entityId: shipment.id,
      message: "Tracking event created",
      userId: req.user.id,
      companyId: shipment.companyId,
      ...getReqContext(req),
      metadata: {
        trackingEventId: trackingEvent.id,
        status,
        location: location ?? null,
        eventTime: eventTime ?? null,
        description: description ?? null,
      },
    });


    return res.status(201).json(trackingEvent);
  } catch (err) {
    console.error("Error in POST /shipments/:id/events:", err);
    return res.status(500).json({ error: "Internal server error" });
  }
});

// =====================
// DEV: LIST USERS
// =====================
app.get("/users", async (_req: Request, res: Response) => {
  try {
    const users = await prisma.user.findMany({
      select: { id: true, email: true, fullName: true, role: true, isEmailVerified: true },
    });
    return res.json(users);
  } catch (err) {
    console.error("Error fetching users", err);
    return res.status(500).json({ error: "Failed to fetch users" });
  }
});

// =====================
// GLOBAL ERROR HANDLER
// =====================
app.use((err: any, _req: Request, res: Response, _next: NextFunction) => {
  if (err?.code === "LIMIT_FILE_SIZE") return res.status(400).json({ error: "File too large" });
  if (err?.message === "Unsupported file type") return res.status(400).json({ error: "Unsupported file type" });

  return res.status(err?.status || 500).json({
    error: err?.message || "Internal server error",
  });
});

// =====================
// ROUTE LISTING
// =====================
function listRoutes(app: any) {
  const router = app.router || app._router;
  const stack = router?.stack;

  console.log("🧭 ROUTES:");
  if (!stack) {
    console.log("  (no router stack found)");
    return;
  }

  const routes: string[] = [];

  const walk = (layers: any[], prefix = "") => {
    for (const layer of layers) {
      if (layer.route?.path) {
        const methods = Object.keys(layer.route.methods)
          .filter((m) => layer.route.methods[m])
          .map((m) => m.toUpperCase())
          .join(", ");
        routes.push(`${methods.padEnd(14)} ${prefix}${layer.route.path}`);
        continue;
      }

      if (layer.name === "router" && layer.handle?.stack) {
        const mount = layer.regexp?.source
          ?.replace("^\\/", "/")
          ?.replace("\\/?(?=\\/|$)", "")
          ?.replace("\\/\\?", "/")
          ?.replace("\\/", "/")
          ?.replace(/\(\?:\(\[\^\\\/]\+\?\)\)/g, ":param")
          ?.replace(/\^\//g, "/")
          ?.replace(/\$$/g, "")
          ?.replace(/\\\//g, "/");

        const nextPrefix = mount && mount !== "/" ? `${prefix}${mount}` : prefix;
        walk(layer.handle.stack, nextPrefix);
      }
    }
  };

  walk(stack, "");
  if (!routes.length) console.log("  (no routes detected)");
  else routes.forEach((r) => console.log(" ", r));
}

listRoutes(app);

console.log("✅ Mounted notification routes at /api");
console.log("✅ Mounted tracking routes at /api");

const PORT = process.env.PORT || 3001;
app.listen(PORT, () => {
  console.log(`🚀 Server running on http://localhost:${PORT}`);
});
