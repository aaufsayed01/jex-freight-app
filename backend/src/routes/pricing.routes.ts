import { Router } from "express";
import { prisma } from "../prisma";
import { authMiddleware, AuthRequest } from "../auth";
import { requireRole } from "../middlewares/requireRole";
import {
  UserRole,
  ChargeGroup,
  PricingDirection,
  ShipmentMode,
  PricingTemplateCode,
  QtyBasis,
} from "@prisma/client";
import { computeTotals } from "../services/pricingCalculator";
import { Currency } from "@prisma/client";
import { assertPricingEditableOrAdmin } from "../middlewares/pricingLockGuard";

const router = Router();

function getTransferOwnershipTemplateCode(mode: ShipmentMode, direction: PricingDirection) {
  if (mode === "AIR" && direction === "EXPORT") return PricingTemplateCode.AIR_EXPORT_TRANSFER_OWNERSHIP;
  if (mode === "AIR" && direction === "IMPORT") return PricingTemplateCode.AIR_IMPORT_TRANSFER_OWNERSHIP;
  if (mode === "SEA" && direction === "EXPORT") return PricingTemplateCode.SEA_EXPORT_TRANSFER_OWNERSHIP;
  return PricingTemplateCode.SEA_IMPORT_TRANSFER_OWNERSHIP;
}

function isSeaExportBlockTemplate(code: PricingTemplateCode) {
  return (
    code === PricingTemplateCode.SEA_EXPORT_LOCAL ||
    code === PricingTemplateCode.SEA_EXPORT_FREEZONE ||
    code === PricingTemplateCode.SEA_EXPORT_TRANSIT ||
    code === PricingTemplateCode.SEA_IMPORT_LOCAL
  );
}

/**
 * GET templates available for a quote based on shipmentMode
 */
router.get(
  "/quotes/:id/pricing/templates",
  authMiddleware,
  requireRole(UserRole.ADMIN, UserRole.INTERNAL_STAFF),
  async (req: AuthRequest, res) => {
    const quoteId = req.params.id;

    const quote = await prisma.quoteRequest.findUnique({
      where: { id: quoteId },
      select: { id: true, shipmentMode: true },
    });
    if (!quote) return res.status(404).json({ error: "Quote not found" });

    const templates = await prisma.pricingTemplate.findMany({
      where: { mode: quote.shipmentMode },
      select: { code: true, name: true, direction: true, mode: true },
      orderBy: { name: "asc" },
    });

    res.json({ quoteId, shipmentMode: quote.shipmentMode, templates });
  }
);

/**
 * POST init pricing for quote from template
 * POST /api/quotes/:id/pricing/init
 *
 * ✅ For SEA Export Local (20ft/40ft) requires:
 * body: { templateCode, currency, containerType: "C20"|"C40", containerQty: number }
 */
// POST /api/quotes/:id/pricing/init
router.post(
  "/quotes/:id/pricing/init",
  authMiddleware,
  requireRole(UserRole.ADMIN, UserRole.INTERNAL_STAFF),
  async (req: AuthRequest, res) => {
    try {
      const quoteId = req.params.id;
      await assertPricingEditableOrAdmin(quoteId, req.user);
      const {
        templateCode,
        currency,
        containerType,
        containerQty,
      } = req.body as {
        templateCode: PricingTemplateCode;
        currency?: string;
        containerType?: "C20" | "C40";
        containerQty?: number;
      };

      const quote = await prisma.quoteRequest.findUnique({
        where: { id: quoteId },
        select: { id: true, shipmentMode: true },
      });
      if (!quote) return res.status(404).json({ error: "Quote not found" });

      const currencyFinal: Currency =
        Object.values(Currency).includes(currency as any)
          ? (currency as Currency)
          : Currency.AED;

      const template = await prisma.pricingTemplate.findUnique({
        where: { code: templateCode },
        include: { lines: { orderBy: { order: "asc" } } },
      });
      if (!template) return res.status(404).json({ error: "Template not found" });

      if (template.mode !== quote.shipmentMode) {
        return res.status(400).json({ error: "Template mode does not match quote shipment mode" });
      }

      // Remove old pricing if exists
      const existing = await prisma.quotePricing.findUnique({ where: { quoteId } });
      if (existing) {
        await prisma.quotePricingCharge.deleteMany({ where: { pricingId: existing.id } });
        await prisma.quotePricingBlock.deleteMany({ where: { pricingId: existing.id } });
        await prisma.quotePricing.delete({ where: { id: existing.id } });
      }

      const isSeaBlocks =
         template.mode === ShipmentMode.SEA && isSeaExportBlockTemplate(template.code);

      // Create pricing header
      const pricing = await prisma.quotePricing.create({
        data: {
          quoteId,
          mode: template.mode,
          direction: template.direction,
          templateCode: template.code,
          currency: currencyFinal,
        },
      });

      const defaultLines = template.lines.filter((l) => l.isDefault === true);

      // ✅ SEA Export Block template (Option B): must create first block + attach default charges to block
      if (isSeaBlocks) {
        if (!containerType) {
          return res.status(400).json({ error: "containerType is required for SEA Export pricing" });
        }
        if (!containerQty || containerQty <= 0) {
          return res.status(400).json({ error: "containerQty must be > 0 for SEA Export pricing" });
        }

        const block = await prisma.quotePricingBlock.create({
          data: {
            pricingId: pricing.id,
            containerType: containerType as any,
            containerQty,
            isAddon: false,
            order: 10,
          },
        });

        await prisma.quotePricingCharge.createMany({
          data: defaultLines.map((l) => ({
            pricingId: pricing.id,
            blockId: block.id,

            code: l.code,
            label: l.label,
            group: l.group,
            qtyBasis: l.qtyBasis,
            order: l.order,

            buyRate: 0,
            sellRate: 0,
            qty: 1,
            totalSell: 0,
            margin: l.isLabelling ? null : 0,

            isLabelling: l.isLabelling,
            isDiscount: l.isDiscount,
            canBeNegative: l.canBeNegative,
          })),
        });

        const result = await prisma.quotePricing.findUnique({
          where: { id: pricing.id },
          include: {
            blocks: { orderBy: { order: "asc" } },
            charges: { orderBy: { order: "asc" } },
          },
        });

        return res.status(201).json(result);
      }

      // Default (AIR / others)
      await prisma.quotePricingCharge.createMany({
        data: defaultLines.map((l) => ({
          pricingId: pricing.id,
          blockId: null,

          code: l.code,
          label: l.label,
          group: l.group,
          qtyBasis: l.qtyBasis,
          order: l.order,

          buyRate: 0,
          sellRate: 0,
          qty: 1,
          totalSell: 0,
          margin: l.isLabelling ? null : 0,

          isLabelling: l.isLabelling,
          isDiscount: l.isDiscount,
          canBeNegative: l.canBeNegative,
        })),
      });

      const result = await prisma.quotePricing.findUnique({
          where: { id: pricing.id },
          include: {
              blocks: { orderBy: { order: "asc" } },
              charges: { orderBy: { order: "asc" } },
            },
        });
      
      return res.status(201).json(result);
    } catch (err: any) {
      if (String(err?.message || "").startsWith("PRICING_LOCKED:")) {
         return res.status(400).json({ error: "Pricing is locked. Admin can still edit." });
       }
      console.error("Error in POST /quotes/:id/pricing/init:", err);
      return res.status(500).json({ error: "Internal server error" });
    }
  }
);

/**
 * ✅ SEA Export: Add add-on container block (Option B)
 * POST /api/quotes/:id/pricing/sea-addon
 * body: { containerType: "C20" | "C40", containerQty: number }
 */
router.post(
  "/quotes/:id/pricing/sea-addon",
  authMiddleware,
  requireRole(UserRole.ADMIN, UserRole.INTERNAL_STAFF), // keep your requireRole call (remove 0 && if you paste directly)
  async (req: AuthRequest, res) => {
    try {
      const quoteId = req.params.id;
      await assertPricingEditableOrAdmin(quoteId, req.user);
      const { containerType, containerQty } = req.body as {
        containerType: "C20" | "C40";
        containerQty: number;
      };

      if (!containerType) return res.status(400).json({ error: "containerType is required" });
      if (!containerQty || containerQty <= 0) return res.status(400).json({ error: "containerQty must be > 0" });

      const pricing = await prisma.quotePricing.findUnique({
        where: { quoteId },
        include: { blocks: true },
      });
      if (!pricing) return res.status(404).json({ error: "Pricing not initialized" });

      const isSeaExportBlockPricing =
        pricing.mode === ShipmentMode.SEA &&
        (pricing.templateCode === PricingTemplateCode.SEA_EXPORT_LOCAL ||
          pricing.templateCode === PricingTemplateCode.SEA_EXPORT_FREEZONE ||
          pricing.templateCode === PricingTemplateCode.SEA_EXPORT_TRANSIT);

      if (!isSeaExportBlockPricing) {
        return res.status(400).json({ error: "Add-on supported only for SEA Export pricing (Local/Freezone/Transit)" });
      }

      // prevent duplicate containerType block
      const exists = pricing.blocks.find((b) => b.containerType === (containerType as any));
      if (exists) return res.status(400).json({ error: "This container type already exists in pricing" });

      // Use SAME template as pricing (Option B)
      const template = await prisma.pricingTemplate.findUnique({
        where: { code: pricing.templateCode },
        include: { lines: { orderBy: { order: "asc" } } },
      });
      if (!template) return res.status(404).json({ error: "Template not found" });

      const defaultLines = template.lines.filter((l) => l.isDefault === true);

      const nextOrder =
        pricing.blocks.length > 0
          ? Math.max(...pricing.blocks.map((b) => b.order ?? 0)) + 10
          : 20;

      const addonBlock = await prisma.quotePricingBlock.create({
        data: {
          pricingId: pricing.id,
          containerType: containerType as any,
          containerQty,
          isAddon: true,
          order: nextOrder,
        },
      });

      const linesForAddon =
        pricing.templateCode === PricingTemplateCode.SEA_IMPORT_LOCAL
          ? defaultLines.filter((l) => l.code !== "DELIVERY_ORDER") // ✅ DO only once
          : defaultLines;

      await prisma.quotePricingCharge.createMany({
        data: linesForAddon.map((l) => ({
          pricingId: pricing.id,
          blockId: addonBlock.id,

          code: l.code,
          label: l.label,
          group: l.group,
          qtyBasis: l.qtyBasis,
          order: l.order,

          buyRate: 0,
          sellRate: 0,
          qty: 1,
          totalSell: 0,
          margin: l.isLabelling ? null : 0,

          isLabelling: l.isLabelling,
          isDiscount: l.isDiscount,
          canBeNegative: l.canBeNegative,
         })),
        });

      const updated = await prisma.quotePricing.findUnique({
        where: { quoteId },
        include: {
          blocks: { orderBy: { order: "asc" } },
          charges: { orderBy: { order: "asc" } },
        },
      });

      return res.status(201).json({ message: "Add-on container added", pricing: updated });
    } catch (err: any) {
      if (String(err?.message || "").startsWith("PRICING_LOCKED:")) {
         return res.status(400).json({ error: "Pricing is locked. Admin can still edit." });
       }
      console.error("Error in POST /quotes/:id/pricing/sea-addon:", err);
      return res.status(500).json({ error: "Internal server error" });
    }
  }
);


/**
 * PATCH update a single charge line (buyRate, sellRate)
 * Auto-calculates qty & totals based on quote data rules.
 */
router.patch(
  "/quotes/:id/pricing/charges/:chargeId",
  authMiddleware,
  requireRole(UserRole.ADMIN, UserRole.INTERNAL_STAFF),
  async (req: AuthRequest, res) => {
    try {
      const quoteId = req.params.id;
      const chargeId = req.params.chargeId;
      await assertPricingEditableOrAdmin(quoteId, req.user);

      const { buyRate, sellRate } = req.body as {
        buyRate?: number;
        sellRate?: number;
      };

      const pricing = await prisma.quotePricing.findUnique({
        where: { quoteId },
        include: { charges: true },
      });
      if (!pricing) return res.status(404).json({ error: "Pricing not initialized" });

      const charge = pricing.charges.find((c) => c.id === chargeId);
      if (!charge) return res.status(404).json({ error: "Charge not found" });

      const quote = await prisma.quoteRequest.findUnique({
        where: { id: quoteId },
        select: {
          weightKg: true,
          chargeableWeightKg: true,
          pieces: true,
          volumeCbm: true
        },
      });
      if (!quote) return res.status(404).json({ error: "Quote not found" });

      const actual = quote.weightKg ?? 0;
      const chargeable = quote.chargeableWeightKg ?? 0;
      const pieces = quote.pieces ?? 0;

      // ✅ containerQty comes from block for CONTAINER basis
      let containerQty = 0;
      if (charge.qtyBasis === QtyBasis.CONTAINER) {
        if (!charge.blockId) {
          return res.status(400).json({ error: "Container-based charge must belong to a pricing block" });
        }
        const block = await prisma.quotePricingBlock.findUnique({
          where: { id: charge.blockId },
          select: { containerQty: true },
        });
        if (!block) return res.status(404).json({ error: "Pricing block not found" });
        containerQty = block.containerQty ?? 0;
      }

      const newBuy = buyRate !== undefined ? Number(buyRate) : Number(charge.buyRate ?? 0);
      const newSell = sellRate !== undefined ? Number(sellRate) : Number(charge.sellRate ?? 0);
      
      console.log("DEBUG pricing charge update", {
       quoteId,
       chargeId,
       qtyBasis: charge.qtyBasis,
       code: charge.code,
       actual,
       chargeable,
       quoteChargeableWeightKg: quote.chargeableWeightKg,
       inputWillBe: {
         actualWeightKg: actual,
         chargeableWeightKg: chargeable,
         pieces,
         volumeCbm: quote.volumeCbm ?? 0,
        },
      });


      const { qtyUsed, totalSell, margin } = computeTotals({
        qtyBasis: charge.qtyBasis,
        buyRate: newBuy,
        sellRate: newSell,
        qty: Number(charge.qty ?? 1),
        containerQty,
        input: {
          actualWeightKg: actual,
          chargeableWeightKg: chargeable,
          pieces,
          volumeCbm: quote.volumeCbm?? 0,
          // dimensions not used in your current quote model
        },
        isLabelling: charge.isLabelling,
        isDiscount: charge.isDiscount,
        canBeNegative: charge.canBeNegative,
      });
       
      console.log("DEBUG computeTotals result", { qtyUsed, totalSell, margin, newBuy, newSell });


      const updated = await prisma.quotePricingCharge.update({
        where: { id: chargeId },
        data: {
          buyRate: newBuy,
          sellRate: newSell,
          qty: qtyUsed,
          totalSell,
          margin,
        },
      });

      return res.json(updated);
    } catch (err: any) {
      if (String(err?.message || "").startsWith("PRICING_LOCKED:")) {
         return res.status(400).json({ error: "Pricing is locked. Admin can still edit." });
       }  
      console.error("Error in PATCH /quotes/:id/pricing/charges/:chargeId:", err);
      return res.status(500).json({ error: "Internal server error" });
    }
  }
);

/**
 * GET OPS view (all charges + totals)
 */
router.get(
  "/quotes/:id/pricing/ops",
  authMiddleware,
  requireRole(UserRole.ADMIN, UserRole.INTERNAL_STAFF),
  async (req: AuthRequest, res) => {
    try {
      const quoteId = req.params.id;

      const pricing = await prisma.quotePricing.findUnique({
        where: { quoteId },
        include: {
          blocks: { orderBy: { order: "asc" } },
          charges: { orderBy: { order: "asc" } },
        },
      });
      if (!pricing) return res.status(404).json({ error: "Pricing not initialized" });

      // ✅ SEA blocks OPS view (separate totals per container)
      if (pricing.mode === ShipmentMode.SEA && pricing.blocks?.length) {
        const rows = pricing.charges.map((c) => ({
          field: c.label,
          code: c.code,
          group: c.group,
          blockId: c.blockId ?? null,
          buyRate: c.buyRate,
          sellRate: c.sellRate,
          qtyOrWeight: c.qty,
          totalSell: c.totalSell,
          margin: c.margin,
        }));

        const perBlock = pricing.blocks.map((b) => {
         const bCharges = pricing.charges.filter((c) => c.blockId === b.id);

         const ocean = bCharges.find((c) => c.code === "OCEAN_FREIGHT");
         const thc = bCharges.find((c) => c.code === "THC");

         const deliveryOrder = bCharges.find((c) => c.code === "DELIVERY_ORDER");
         const thcIn = bCharges.find((c) => c.code === "THC_IN");
         const thcOut = bCharges.find((c) => c.code === "THC_OUT");

         // totals by groups
         const exworks = bCharges
            .filter((c) => c.group === ChargeGroup.EXWORKS)
            .reduce((sum, c) => sum + Number(c.totalSell ?? 0), 0);

         const importTotal =
            Number(deliveryOrder?.totalSell ?? 0) + Number(thcIn?.totalSell ?? 0);

         // Local/Freezone Export total (Ocean+THC) OR Transit export total (Ocean+THC_OUT)
         const exportTotal =
           Number(ocean?.totalSell ?? 0) +
           (pricing.templateCode === "SEA_EXPORT_TRANSIT"
             ? Number(thcOut?.totalSell ?? 0)
             : Number(thc?.totalSell ?? 0));

         const total =
           pricing.templateCode === "SEA_EXPORT_TRANSIT"
             ? importTotal + exportTotal + exworks
             : Number(ocean?.totalSell ?? 0) + Number(thc?.totalSell ?? 0) + exworks;

         return {
           blockId: b.id,
           containerType: b.containerType,
           containerQty: b.containerQty,
           isAddon: b.isAddon,
           totals:
              pricing.templateCode === "SEA_EXPORT_TRANSIT"
                ? {
                    import: importTotal,
                    export: exportTotal,
                    exworks,
                    total,
                }
              : {
                    oceanFreight: Number(ocean?.totalSell ?? 0),
                    thc: Number(thc?.totalSell ?? 0),
                    exworks,
                    total,
                },
            };
        });

        const grandTotal = perBlock.reduce((s, x) => s + Number(x.totals.total ?? 0), 0);

        return res.json({
          currency: pricing.currency,
          rows,
          blocks: perBlock,
          totals: { grandTotal },
        });
      }

      // ✅ Existing AIR/other behavior (unchanged)
      const mainTotal = pricing.charges
        .filter((c) => c.group === ChargeGroup.MAIN)
        .reduce((sum, c) => sum + Number(c.totalSell ?? 0), 0);

      const exworks = pricing.charges
        .filter((c) => c.group === ChargeGroup.EXWORKS)
        .reduce((sum, c) => sum + Number(c.totalSell ?? 0), 0);

      const clearance = pricing.charges
        .filter((c) => c.group === ChargeGroup.CLEARANCE)
        .reduce((sum, c) => sum + Number(c.totalSell ?? 0), 0);

      const total = mainTotal + exworks + clearance;

      const transferOwnership = pricing.charges
        .filter((c) => c.group === ChargeGroup.TRANSFER_OWNERSHIP)
        .reduce((sum: number, c) => sum + Number(c.totalSell ?? 0), 0);

      const grandTotal = total + transferOwnership;

      const air = pricing.charges.find((c) => c.code === "AIRFREIGHT");
      const thc = pricing.charges.find((c) => c.code === "THC");
      const thcIn = pricing.charges.find((c) => c.code === "THC_IN");
      const thcOut = pricing.charges.find((c) => c.code === "THC_OUT");

      return res.json({
        currency: pricing.currency,
        rows: pricing.charges.map((c) => ({
          field: c.label,
          code: c.code,
          group: c.group,
          buyRate: c.buyRate,
          sellRate: c.sellRate,
          qtyOrWeight: c.qty,
          totalSell: c.totalSell,
          margin: c.margin,
        })),
        totals: {
          airfreight: air?.totalSell ?? 0,
          thc: thc?.totalSell ?? 0,
          thcIn: thcIn?.totalSell ?? 0,
          thcOut: thcOut?.totalSell ?? 0,
          exworks,
          clearance,
          transferOwnership,
          total,
          grandTotal,
        },
      });
    } catch (err) {
      console.error("Error in GET /quotes/:id/pricing/ops:", err);
      return res.status(500).json({ error: "Internal server error" });
    }
  }
);

/**
 * GET selectable add-ons for a template
 */
router.get(
  "/pricing/templates/:templateCode/addons",
  authMiddleware,
  requireRole(UserRole.ADMIN, UserRole.INTERNAL_STAFF),
  async (req: AuthRequest, res) => {
    const { templateCode } = req.params;

    const template = await prisma.pricingTemplate.findUnique({
      where: { code: templateCode as any },
      include: {
        lines: {
          where: {
            isOptional: true,
            isDefault: false,
          },
          orderBy: { order: "asc" },
        },
      },
    });

    if (!template) return res.status(404).json({ error: "Template not found" });

    res.json({
      templateCode,
      addons: template.lines.map((l) => ({
        code: l.code,
        label: l.label,
        group: l.group,
        qtyBasis: l.qtyBasis,
      })),
    });
  }
);

/**
 * POST add a charge from template line (optional add-on)
 * For SEA blocks, require blockId in body
 */
router.post(
  "/quotes/:id/pricing/charges",
  authMiddleware,
  requireRole(UserRole.ADMIN, UserRole.INTERNAL_STAFF),
  async (req: AuthRequest, res) => {
    try {
      const quoteId = req.params.id;
      await assertPricingEditableOrAdmin(quoteId, req.user);
      const { templateLineCode, blockId } = req.body as { templateLineCode: string; blockId?: string };

      const pricing = await prisma.quotePricing.findUnique({
        where: { quoteId },
        include: { blocks: true },
      });
      if (!pricing) return res.status(404).json({ error: "Pricing not initialized" });

      if (!templateLineCode || typeof templateLineCode !== "string") {
        return res.status(400).json({ error: "templateLineCode is required" });
      }

      // ✅ If SEA with blocks: must specify which container block to add to
      if (pricing.mode === ShipmentMode.SEA && pricing.blocks?.length) {
        if (!blockId) return res.status(400).json({ error: "blockId is required for SEA block add-ons" });

        const belongs = pricing.blocks.some((b) => b.id === blockId);
        if (!belongs) return res.status(400).json({ error: "blockId does not belong to this quote pricing" });
      }

      const multiAllowedCodes = new Set<string>([
        "TOO_TRANSIT_IN",
        "TOO_TRANSIT_OUT",
        "TRANSIT_IN",
        "TRANSIT_OUT",
        "TOO_ADDITIONAL_DOCUMENTS",
        "TOO_TRANSPORT",
      ]);

      // Prevent duplicates (except multi allowed)
      if (!multiAllowedCodes.has(templateLineCode)) {
        const exists = await prisma.quotePricingCharge.findFirst({
          where: {
            pricingId: pricing.id,
            code: templateLineCode,
            ...(blockId ? { blockId } : {}),
          },
        });
        if (exists) return res.status(400).json({ error: "Charge already added" });
      }

      const template = await prisma.pricingTemplate.findUnique({
        where: { code: pricing.templateCode },
        select: { id: true },
      });
      if (!template) return res.status(404).json({ error: "Template not found" });

      const templateLine = await prisma.pricingTemplateLine.findFirst({
        where: { templateId: template.id, code: templateLineCode },
      });
      if (!templateLine) return res.status(404).json({ error: "Template line not found" });

      if (!templateLine.isOptional) {
        return res.status(400).json({ error: "This charge is mandatory and already included" });
      }

      let finalLabel = templateLine.label;

      if (multiAllowedCodes.has(templateLineCode)) {
        const count = await prisma.quotePricingCharge.count({
          where: { pricingId: pricing.id, code: templateLineCode },
        });
        finalLabel = `${templateLine.label} #${count + 1}`;
      }

      const charge = await prisma.quotePricingCharge.create({
        data: {
          pricingId: pricing.id,
          blockId: blockId ?? null,

          code: templateLine.code,
          label: finalLabel,
          group: templateLine.group,
          qtyBasis: templateLine.qtyBasis,
          order: templateLine.order,

          buyRate: 0,
          sellRate: 0,
          qty: 1,
          totalSell: 0,
          margin: templateLine.isLabelling ? null : 0,

          isLabelling: templateLine.isLabelling,
          isDiscount: templateLine.isDiscount,
          canBeNegative: templateLine.canBeNegative,
        },
      });

      return res.status(201).json(charge);
    } catch (err: any) {
      if (String(err?.message || "").startsWith("PRICING_LOCKED:")) {
         return res.status(400).json({ error: "Pricing is locked. Admin can still edit." });
        }  
      console.error("Error in POST /quotes/:id/pricing/charges:", err);
      return res.status(500).json({ error: "Internal server error" });
    }
  }
);

/**
 * DELETE a charge (only optional lines removable)
 */
router.delete(
  "/quotes/:id/pricing/charges/:chargeId",
  authMiddleware,
  requireRole(UserRole.ADMIN, UserRole.INTERNAL_STAFF),
  async (req: AuthRequest, res) => {
    try {
      const { id: quoteId, chargeId } = req.params;
      await assertPricingEditableOrAdmin(quoteId, req.user);
      const pricing = await prisma.quotePricing.findUnique({
        where: { quoteId },
      });
      if (!pricing) return res.status(404).json({ error: "Pricing not found" });

      const charge = await prisma.quotePricingCharge.findUnique({
        where: { id: chargeId },
      });
      if (!charge || charge.pricingId !== pricing.id) {
        return res.status(404).json({ error: "Charge not found" });
      }

      const template = await prisma.pricingTemplate.findUnique({
        where: { code: pricing.templateCode },
        select: { id: true },
      });
      if (!template) return res.status(404).json({ error: "Template not found" });

      const templateLine = await prisma.pricingTemplateLine.findFirst({
        where: { templateId: template.id, code: charge.code },
      });

      if (!templateLine?.isOptional) {
        return res.status(400).json({ error: "Mandatory charges cannot be removed" });
      }

      await prisma.quotePricingCharge.delete({ where: { id: chargeId } });

      return res.status(204).send();
    } catch (err: any) {
      if (String(err?.message || "").startsWith("PRICING_LOCKED:")) {
         return res.status(400).json({ error: "Pricing is locked. Admin can still edit." });
        }  
      console.error("Error in DELETE /quotes/:id/pricing/charges/:chargeId:", err);
      return res.status(500).json({ error: "Internal server error" });
    }
  }
);

/**
 * POST add transfer ownership (same behavior as your existing)
 */
router.post(
  "/quotes/:id/pricing/add-transfer-ownership",
  authMiddleware,
  requireRole(UserRole.ADMIN, UserRole.INTERNAL_STAFF),
  async (req: AuthRequest, res) => {
    try {
      const quoteId = req.params.id;
      await assertPricingEditableOrAdmin(quoteId, req.user);
      const quote = await prisma.quoteRequest.findUnique({
        where: { id: quoteId },
        select: { id: true, shipmentMode: true },
      });
      if (!quote) return res.status(404).json({ error: "Quote not found" });

      let pricing = await prisma.quotePricing.findUnique({
        where: { quoteId },
        include: { charges: true },
      });

      // If no pricing exists, require direction from body (EXPORT/IMPORT)
      const direction: PricingDirection =
        (pricing?.direction as PricingDirection) ??
        (req.body?.direction as PricingDirection);

      if (!direction || (direction !== "EXPORT" && direction !== "IMPORT")) {
        return res.status(400).json({ error: "direction is required (EXPORT or IMPORT) when pricing is not initialized" });
      }

      const templateCode = getTransferOwnershipTemplateCode(quote.shipmentMode, direction);

      const template = await prisma.pricingTemplate.findUnique({
        where: { code: templateCode },
        include: { lines: { orderBy: { order: "asc" } } },
      });
      if (!template) return res.status(404).json({ error: "Transfer of Ownership template not found" });

      const defaultLines = template.lines.filter((l) => l.isDefault === true);

      // If no pricing exists, create pricing first (TOO only)
      if (!pricing) {
        pricing = await prisma.quotePricing.create({
          data: {
            quoteId,
            mode: template.mode,
            direction: template.direction,
            templateCode: template.code,
            currency: "AED",
            charges: {
              create: defaultLines.map((l) => ({
                code: l.code,
                label: l.label,
                group: l.group,
                qtyBasis: l.qtyBasis,
                order: l.order,

                buyRate: 0,
                sellRate: 0,
                qty: 1,
                totalSell: 0,
                margin: 0,

                isLabelling: l.isLabelling,
                isDiscount: l.isDiscount,
                canBeNegative: l.canBeNegative,
              })),
            },
          },
          include: { charges: { orderBy: { order: "asc" } } },
        });

        return res.status(201).json({ message: "Initialized pricing with Transfer of Ownership only", pricing });
      }

      // Avoid duplicates if already attached
      const alreadyAttached = pricing.charges.some((c) => c.group === "TRANSFER_OWNERSHIP");
      if (alreadyAttached) {
        return res.status(400).json({ error: "Transfer of Ownership already added to this quote" });
      }

      await prisma.quotePricingCharge.createMany({
        data: defaultLines.map((l) => ({
          pricingId: pricing!.id,
          // ✅ TOO is not per-container; keep blockId NULL
          blockId: null,

          code: l.code,
          label: l.label,
          group: l.group,
          qtyBasis: l.qtyBasis,
          order: l.order,

          buyRate: 0,
          sellRate: 0,
          qty: 1,
          totalSell: 0,
          margin: 0,

          isLabelling: l.isLabelling,
          isDiscount: l.isDiscount,
          canBeNegative: l.canBeNegative,
        })),
      });

      const updated = await prisma.quotePricing.findUnique({
        where: { quoteId },
        include: { charges: { orderBy: { order: "asc" } } },
      });

      return res.status(201).json({ message: "Transfer of Ownership added", pricing: updated });
    } catch (err: any) {
      if (String(err?.message || "").startsWith("PRICING_LOCKED:")) {
         return res.status(400).json({ error: "Pricing is locked. Admin can still edit." });
        }  
      console.error("Error in POST /quotes/:id/pricing/add-transfer-ownership:", err);
      return res.status(500).json({ error: "Internal server error" });
    }
  }
);

router.get(
  "/quotes/:id/pricing/blocks",
  authMiddleware,
  requireRole(UserRole.ADMIN, UserRole.INTERNAL_STAFF),
  async (req: AuthRequest, res) => {
    const quoteId = req.params.id;

    const pricing = await prisma.quotePricing.findUnique({
      where: { quoteId },
      include: { blocks: { orderBy: { order: "asc" } } },
    });
    if (!pricing) return res.status(404).json({ error: "Pricing not initialized" });

    return res.json({
      quoteId,
      templateCode: pricing.templateCode,
      blocks: pricing.blocks.map((b) => ({
        id: b.id,
        containerType: b.containerType,
        containerQty: b.containerQty,
        isAddon: b.isAddon,
        order: b.order,
      })),
    });
  }
);

router.post(
  "/quotes/:id/pricing/snapshot",
  authMiddleware,
  requireRole(UserRole.ADMIN, UserRole.INTERNAL_STAFF),
  async (req: AuthRequest, res) => {
    try {
      const quoteId = req.params.id;
      if (!req.user) return res.status(401).json({ error: "Unauthorized" });

      // admin bypass is fine; lock is allowed to snapshot too
      const pricing = await prisma.quotePricing.findUnique({
        where: { quoteId },
        include: { charges: true, blocks: true },
      });
      if (!pricing) return res.status(404).json({ error: "Pricing not initialized" });

      // Compute grandTotal same way ops does:
      const totalSell = pricing.charges.reduce((s, c) => s + Number(c.totalSell ?? 0), 0);

      const snapshot = {
        mode: pricing.mode,
        direction: pricing.direction,
        templateCode: pricing.templateCode,
        currency: pricing.currency,
        blocks: pricing.blocks,
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

      const updated = await prisma.quoteRequest.update({
        where: { id: quoteId },
        data: {
          pricingSnapshot: snapshot,
          pricingVersion: { increment: 1 },
          pricedAt: new Date(),
          pricedById: req.user.id,
          totalPrice: totalSell,
          currency: pricing.currency,
        },
        select: { id: true, pricingVersion: true, pricedAt: true, totalPrice: true, currency: true },
      });

      return res.json({ message: "Snapshot saved", ...updated });
    } catch (err) {
      console.error("Error in POST /quotes/:id/pricing/snapshot:", err);
      return res.status(500).json({ error: "Internal server error" });
    }
  }
);

router.post(
  "/quotes/:id/pricing/lock",
  authMiddleware,
  requireRole(UserRole.ADMIN, UserRole.INTERNAL_STAFF),
  async (req: AuthRequest, res) => {
    try {
      const quoteId = req.params.id;
      if (!req.user) return res.status(401).json({ error: "Unauthorized" });

      const reason = String(req.body?.reason ?? "").trim();
      if (!reason) return res.status(400).json({ error: "reason is required" });

      const updated = await prisma.quoteRequest.update({
        where: { id: quoteId },
        data: {
          pricingLockedAt: new Date(),
          pricingLockedById: req.user.id,
          pricingLockReason: reason,
        },
        select: { id: true, pricingLockedAt: true, pricingLockReason: true },
      });

      return res.json({ message: "Pricing locked", ...updated });
    } catch (err) {
      console.error("Error in POST /quotes/:id/pricing/lock:", err);
      return res.status(500).json({ error: "Internal server error" });
    }
  }
);

router.post(
  "/quotes/:id/pricing/unlock",
  authMiddleware,
  requireRole(UserRole.ADMIN),
  async (req: AuthRequest, res) => {
    try {
      const quoteId = req.params.id;

      const updated = await prisma.quoteRequest.update({
        where: { id: quoteId },
        data: {
          pricingLockedAt: null,
          pricingLockedById: null,
          pricingLockReason: null,
        },
        select: { id: true, pricingLockedAt: true },
      });

      return res.json({ message: "Pricing unlocked", ...updated });
    } catch (err) {
      console.error("Error in POST /quotes/:id/pricing/unlock:", err);
      return res.status(500).json({ error: "Internal server error" });
    }
  }
);


export default router;
