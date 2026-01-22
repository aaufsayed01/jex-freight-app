import { Router } from "express";
import { prisma } from "../prisma";
import { authMiddleware, AuthRequest } from "../auth";
import { requireEmailVerified } from "../middlewares/requireVerifiedUser";

const router = Router();

console.log("✅ notifications.routes.ts loaded");

router.get("/notifications-ping", (_req, res) => res.json({ ok: true }));


/**
 * GET /api/notifications?includeCompanyWide=true|false
 */
router.get("/notifications", authMiddleware,requireEmailVerified, async (req: AuthRequest, res) => {
  try {
    if (!req.user) return res.status(401).json({ error: "Unauthorized" });

    const companyId = req.user.companyId;
    if (!companyId) return res.status(400).json({ error: "User not linked to a company" });

    const includeCompanyWide = req.query.includeCompanyWide !== "false";

    const rows = await prisma.notification.findMany({
      where: {
        companyId,
        OR: [
          { userId: req.user.id },
          ...(includeCompanyWide ? [{ userId: null }] : []), // ✅ just null (no equals)
        ],
      },
      orderBy: { createdAt: "desc" },
      take: 100,
    });

    return res.json(rows);
  } catch (err) {
    console.error("Error in GET /notifications:", err);
    return res.status(500).json({ error: "Internal server error" });
  }
});

/**
 * PATCH /api/notifications/:id/read
 */
router.patch("/notifications/:id/read", authMiddleware,requireEmailVerified, async (req: AuthRequest, res) => {
  try {
    if (!req.user) return res.status(401).json({ error: "Unauthorized" });

    const companyId = req.user.companyId;
    if (!companyId) return res.status(400).json({ error: "User not linked to a company" });

    const id = req.params.id;

    const notif = await prisma.notification.findFirst({
      where: {
        id,
        companyId,
        OR: [{ userId: req.user.id }, { userId: null }], // ✅
      },
    });

    if (!notif) return res.status(404).json({ error: "Notification not found" });

    const updated = await prisma.notification.update({
      where: { id },
      data: { readAt: new Date() },
    });

    return res.json(updated);
  } catch (err) {
    console.error("Error in PATCH /notifications/:id/read:", err);
    return res.status(500).json({ error: "Internal server error" });
  }
});

/**
 * PATCH /api/notifications/read-all
 */
router.patch("/notifications/read-all", authMiddleware,requireEmailVerified, async (req: AuthRequest, res) => {
  try {
    if (!req.user) return res.status(401).json({ error: "Unauthorized" });

    const companyId = req.user.companyId;
    if (!companyId) return res.status(400).json({ error: "User not linked to a company" });

    const result = await prisma.notification.updateMany({
      where: {
        companyId,
        readAt: null,
        OR: [{ userId: req.user.id }, { userId: null }], // ✅
      },
      data: { readAt: new Date() },
    });

    return res.json({ ok: true, updated: result.count });
  } catch (err) {
    console.error("Error in PATCH /notifications/read-all:", err);
    return res.status(500).json({ error: "Internal server error" });
  }
});

router.get("/notifications/unread-count", authMiddleware,requireEmailVerified, async (req: AuthRequest, res) => {
  if (!req.user) return res.status(401).json({ error: "Unauthorized" });

  const companyId = req.user.companyId;
  if (!companyId) return res.status(400).json({ error: "User not linked to a company" });

  const includeCompanyWide = req.query.includeCompanyWide !== "false";

  const count = await prisma.notification.count({
    where: {
      companyId,
      readAt: null,
      OR: [
        { userId: req.user.id },
        ...(includeCompanyWide ? [{ userId: null }] : []),
      ],
    },
  });

  return res.json({ unread: count });
});


export default router;


