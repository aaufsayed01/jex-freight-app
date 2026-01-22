import { Router } from "express";
import { prisma } from "../prisma";
import { authMiddleware, AuthRequest } from "../auth";
import { CompanyRole, Currency, Language, NotificationPreferenceType } from "@prisma/client";

const router = Router();

/**
 * GET /api/me
 * Return current user + company + preferences
 */
router.get("/me", authMiddleware, async (req: AuthRequest, res) => {
  try {
    if (!req.user) return res.status(401).json({ error: "Unauthorized" });

    const user = await prisma.user.findUnique({
      where: { id: req.user.id },
      select: {
        id: true,
        email: true,
        fullName: true,
        phone: true,
        jobTitle: true,
        role: true,
        isActive: true,
        isEmailVerified: true,
        preferredCurrency: true,
        preferredLanguage: true,
        companyId: true,
        companyRole: true,
        company: {
          select: {
            id: true,
            name: true,
            type: true,
            country: true,
            city: true,
            state: true,
            addressLine1: true,
            addressLine2: true,
            postalCode: true,
            vatNumber: true,
            billingAddress: true,
            contactEmail: true,
            contactPhone: true,
          },
        },
      },
    });

    if (!user) return res.status(404).json({ error: "User not found" });
    return res.json(user);
  } catch (err: any) {
    return res.status(500).json({ error: err.message || "Server error" });
  }
});

/**
 * PATCH /api/me
 * Update user profile fields
 */
router.patch("/me", authMiddleware, async (req: AuthRequest, res) => {
  try {
    if (!req.user) return res.status(401).json({ error: "Unauthorized" });

    const { fullName, phone, jobTitle } = req.body as {
      fullName?: string;
      phone?: string;
      jobTitle?: string;
    };

    const updated = await prisma.user.update({
      where: { id: req.user.id },
      data: {
        ...(fullName !== undefined ? { fullName: String(fullName).trim() } : {}),
        ...(phone !== undefined ? { phone: String(phone).trim() } : {}),
        ...(jobTitle !== undefined ? { jobTitle: String(jobTitle).trim() } : {}),
      },
      select: {
        id: true,
        email: true,
        fullName: true,
        phone: true,
        jobTitle: true,
      },
    });

    return res.json(updated);
  } catch (err: any) {
    return res.status(500).json({ error: err.message || "Server error" });
  }
});

/**
 * PATCH /api/me/preferences
 * Update currency & language
 */
router.patch("/me/preferences", authMiddleware, async (req: AuthRequest, res) => {
  try {
    if (!req.user) return res.status(401).json({ error: "Unauthorized" });

    const { preferredCurrency, preferredLanguage } = req.body as {
      preferredCurrency?: Currency;
      preferredLanguage?: Language;
    };

    if (preferredCurrency && !Object.values(Currency).includes(preferredCurrency)) {
      return res.status(400).json({
        error: `Invalid currency. Allowed: ${Object.values(Currency).join(", ")}`,
      });
    }

    if (preferredLanguage && !Object.values(Language).includes(preferredLanguage)) {
      return res.status(400).json({
        error: `Invalid language. Allowed: ${Object.values(Language).join(", ")}`,
      });
    }

    const updated = await prisma.user.update({
      where: { id: req.user.id },
      data: {
        ...(preferredCurrency ? { preferredCurrency } : {}),
        ...(preferredLanguage ? { preferredLanguage } : {}),
      },
      select: {
        id: true,
        preferredCurrency: true,
        preferredLanguage: true,
      },
    });

    return res.json(updated);
  } catch (err: any) {
    return res.status(500).json({ error: err.message || "Server error" });
  }
});

/**
 * GET /api/me/notifications
 * List user's notification preference settings
 */
router.get("/me/notifications", authMiddleware, async (req: AuthRequest, res) => {
  try {
    if (!req.user) return res.status(401).json({ error: "Unauthorized" });

    const settings = await prisma.notificationSetting.findMany({
      where: { userId: req.user.id },
      orderBy: { type: "asc" },
    });

    return res.json(settings);
  } catch (err: any) {
    return res.status(500).json({ error: err.message || "Server error" });
  }
});

/**
 * PUT /api/me/notifications
 * Upsert preference settings
 * Body: { settings: Array<{ type, email?, inApp?, sms? }> }
 */
router.put("/me/notifications", authMiddleware, async (req: AuthRequest, res) => {
  try {
    if (!req.user) return res.status(401).json({ error: "Unauthorized" });

    const { settings } = req.body as {
      settings: Array<{
        type: NotificationPreferenceType;
        email?: boolean;
        inApp?: boolean;
        sms?: boolean;
      }>;
    };

    if (!Array.isArray(settings) || settings.length === 0) {
      return res.status(400).json({ error: "settings array is required" });
    }

    for (const s of settings) {
      if (!s?.type || !Object.values(NotificationPreferenceType).includes(s.type)) {
        return res.status(400).json({ error: `Invalid notification type: ${String(s?.type)}` });
      }
    }

    const results = await prisma.$transaction(
      settings.map((s) =>
        prisma.notificationSetting.upsert({
          where: { userId_type: { userId: req.user!.id, type: s.type } },
          create: {
            userId: req.user!.id,
            type: s.type,
            email: s.email ?? true,
            inApp: s.inApp ?? true,
            sms: s.sms ?? false,
          },
          update: {
            ...(s.email !== undefined ? { email: s.email } : {}),
            ...(s.inApp !== undefined ? { inApp: s.inApp } : {}),
            ...(s.sms !== undefined ? { sms: s.sms } : {}),
          },
        })
      )
    );

    return res.json(results);
  } catch (err: any) {
    return res.status(500).json({ error: err.message || "Server error" });
  }
});

/**
 * GET /api/company/me
 * Get current user's company profile
 */
router.get("/company/me", authMiddleware, async (req: AuthRequest, res) => {
  try {
    if (!req.user) return res.status(401).json({ error: "Unauthorized" });
    if (!req.user.companyId) return res.status(400).json({ error: "User not linked to a company" });

    const company = await prisma.company.findUnique({
      where: { id: req.user.companyId },
    });

    if (!company) return res.status(404).json({ error: "Company not found" });
    return res.json(company);
  } catch (err: any) {
    return res.status(500).json({ error: err.message || "Server error" });
  }
});

/**
 * PATCH /api/company/me
 * Update company profile (company admins only)
 */
router.patch("/company/me", authMiddleware, async (req: AuthRequest, res) => {
  try {
    if (!req.user) return res.status(401).json({ error: "Unauthorized" });
    if (!req.user.companyId) return res.status(400).json({ error: "User not linked to a company" });

    // ✅ Allow INTERNAL_STAFF / ADMIN, or companyRole ADMIN
    const isInternal = req.user.role === "ADMIN" || req.user.role === "INTERNAL_STAFF";
    const isCompanyAdmin = (req.user as any).companyRole === CompanyRole.ADMIN;

    if (!isInternal && !isCompanyAdmin) {
      return res.status(403).json({ error: "Forbidden (company admin required)" });
    }

    const {
      name,
      country,
      city,
      state,
      addressLine1,
      addressLine2,
      postalCode,
      vatNumber,
      billingAddress,
      contactEmail,
      contactPhone,
    } = req.body as any;

    const updated = await prisma.company.update({
      where: { id: req.user.companyId },
      data: {
        ...(name !== undefined ? { name: String(name).trim() } : {}),
        ...(country !== undefined ? { country: String(country).trim() } : {}),
        ...(city !== undefined ? { city: String(city).trim() } : {}),
        ...(state !== undefined ? { state: String(state).trim() } : {}),
        ...(addressLine1 !== undefined ? { addressLine1: String(addressLine1).trim() } : {}),
        ...(addressLine2 !== undefined ? { addressLine2: String(addressLine2).trim() } : {}),
        ...(postalCode !== undefined ? { postalCode: String(postalCode).trim() } : {}),
        ...(vatNumber !== undefined ? { vatNumber: String(vatNumber).trim() } : {}),
        ...(billingAddress !== undefined ? { billingAddress: String(billingAddress).trim() } : {}),
        ...(contactEmail !== undefined ? { contactEmail: String(contactEmail).trim() } : {}),
        ...(contactPhone !== undefined ? { contactPhone: String(contactPhone).trim() } : {}),
      },
    });

    return res.json(updated);
  } catch (err: any) {
    return res.status(500).json({ error: err.message || "Server error" });
  }
});

export default router;
