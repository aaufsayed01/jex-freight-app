import {
  ShipmentMode,
  PricingDirection,
  PricingTemplateCode,
  ChargeGroup,
  QtyBasis,
  PrismaClient,
} from "@prisma/client";

export async function seedPricingTemplates(prisma: PrismaClient) {
  await seedAirExportLocal(prisma);
  await seedAirExportFreezone(prisma);
  await seedAirExportTransit(prisma);
  await seedAirImportLocalClearance(prisma);
  await seedTransferOwnershipTemplates(prisma);
  await seedAirImportReExport(prisma);
  await seedSeaToAir(prisma);
  await seedSeaExportLocal(prisma);      // NEW single
  await seedSeaExportFreezone(prisma);
  await seedSeaExportTransit(prisma);
  await seedSeaExportLCL(prisma);
  await seedSeaImportLocal(prisma);
  await seedSeaImportLCL(prisma);

}

async function seedAirExportLocal(prisma: PrismaClient) {
  const code = PricingTemplateCode.AIR_EXPORT_LOCAL;

  const template = await prisma.pricingTemplate.upsert({
    where: { code },
    update: {
      name: "Local Air Export (General/DG)",
      mode: ShipmentMode.AIR,
      direction: PricingDirection.EXPORT,
    },
    create: {
      mode: ShipmentMode.AIR,
      direction: PricingDirection.EXPORT,
      code,
      name: "Local Air Export (General/DG)",
    },
  });

  const lines = [
    // MAIN (mandatory)
    { code: "AIRFREIGHT", label: "Airfreight", group: ChargeGroup.MAIN, qtyBasis: QtyBasis.KG_CHARGEABLE_MAX, order: 10, isDefault: true, isOptional: false },
    { code: "THC", label: "THC", group: ChargeGroup.MAIN, qtyBasis: QtyBasis.KG_ACTUAL, order: 20, isDefault: true, isOptional: false },

    // EXWORKS mandatory core (created on init)
    { code: "AWB", label: "AWB", group: ChargeGroup.EXWORKS, qtyBasis: QtyBasis.SHIPMENT, order: 110, isDefault: true, isOptional: false },
    { code: "DUE_CARRIER", label: "D/C (Due Carrier)", group: ChargeGroup.EXWORKS, qtyBasis: QtyBasis.SHIPMENT, order: 120, isDefault: true, isOptional: false },
    { code: "LABELLING", label: "Labelling", group: ChargeGroup.EXWORKS, qtyBasis: QtyBasis.PIECE, order: 130, isDefault: true, isOptional: false, isLabelling: true },
    { code: "CUSTOMS_BOE", label: "Customs BOE", group: ChargeGroup.EXWORKS, qtyBasis: QtyBasis.SHIPMENT, order: 140, isDefault: true, isOptional: false },
    { code: "HANDLING_SERVICES", label: "Handling & Services", group: ChargeGroup.EXWORKS, qtyBasis: QtyBasis.SHIPMENT, order: 150, isDefault: true, isOptional: false },
    { code: "TRANSPORTATION", label: "Transportation", group: ChargeGroup.EXWORKS, qtyBasis: QtyBasis.SHIPMENT, order: 160, isDefault: true, isOptional: false },

    // EXWORKS add-ons (select to add later)
    { code: "EXPORTER_CODE", label: "Exporter Code", group: ChargeGroup.EXWORKS, qtyBasis: QtyBasis.SHIPMENT, order: 210, isDefault: false, isOptional: true },
    { code: "DOCUMENTATION", label: "Documentation", group: ChargeGroup.EXWORKS, qtyBasis: QtyBasis.SHIPMENT, order: 220, isDefault: false, isOptional: true },
    { code: "SCREENING", label: "Screening", group: ChargeGroup.EXWORKS, qtyBasis: QtyBasis.SHIPMENT, order: 230, isDefault: false, isOptional: true },
    { code: "HAWB_FEES", label: "HAWB Fees", group: ChargeGroup.EXWORKS, qtyBasis: QtyBasis.SHIPMENT, order: 240, isDefault: false, isOptional: true },
    { code: "PACKING_CHARGES", label: "Packing Charges", group: ChargeGroup.EXWORKS, qtyBasis: QtyBasis.SHIPMENT, order: 250, isDefault: false, isOptional: true },
    { code: "AIRWAY_BILL_AMENDMENT", label: "Airway Bill Amendment", group: ChargeGroup.EXWORKS, qtyBasis: QtyBasis.SHIPMENT, order: 260, isDefault: false, isOptional: true },
    { code: "CUSTOMS_BOE_AMENDMENT", label: "Customs BOE Amendment", group: ChargeGroup.EXWORKS, qtyBasis: QtyBasis.SHIPMENT, order: 270, isDefault: false, isOptional: true },
    { code: "LABOUR_PORTER", label: "Labour & Porter Charges", group: ChargeGroup.EXWORKS, qtyBasis: QtyBasis.SHIPMENT, order: 280, isDefault: false, isOptional: true },
    { code: "FORKLIFT", label: "Forklift Charges", group: ChargeGroup.EXWORKS, qtyBasis: QtyBasis.SHIPMENT, order: 290, isDefault: false, isOptional: true },
    { code: "BOE_CANCELLATION", label: "BOE Cancellation Charges", group: ChargeGroup.EXWORKS, qtyBasis: QtyBasis.SHIPMENT, order: 300, isDefault: false, isOptional: true },
    { code: "ELI_DOCUMENTATION", label: "ELI Documentation", group: ChargeGroup.EXWORKS, qtyBasis: QtyBasis.SHIPMENT, order: 310, isDefault: false, isOptional: true },
    { code: "STORAGE", label: "Storage Charges", group: ChargeGroup.EXWORKS, qtyBasis: QtyBasis.SHIPMENT, order: 320, isDefault: false, isOptional: true },

    // Discounts/rounding (selectable)
    { code: "LESS_DISCOUNTS", label: "Less Discounts", group: ChargeGroup.EXWORKS, qtyBasis: QtyBasis.SHIPMENT, order: 330, isDefault: false, isOptional: true, isDiscount: true, canBeNegative: true },
    { code: "ROUND_OFF", label: "Round off", group: ChargeGroup.EXWORKS, qtyBasis: QtyBasis.SHIPMENT, order: 340, isDefault: false, isOptional: true, canBeNegative: true },

    // DG (selectable)
    { code: "DG_HANDLING", label: "DG Handling", group: ChargeGroup.EXWORKS, qtyBasis: QtyBasis.SHIPMENT, order: 410, isDefault: false, isOptional: true },
    { code: "DG_PACKING", label: "DG Packing Charges", group: ChargeGroup.EXWORKS, qtyBasis: QtyBasis.SHIPMENT, order: 420, isDefault: false, isOptional: true },
    { code: "DG_INSPECTION", label: "DG Inspection", group: ChargeGroup.EXWORKS, qtyBasis: QtyBasis.SHIPMENT, order: 430, isDefault: false, isOptional: true },
    { code: "SLI", label: "SLI", group: ChargeGroup.EXWORKS, qtyBasis: QtyBasis.SHIPMENT, order: 440, isDefault: false, isOptional: true },
  ].map((l) => ({
    ...l,
    templateId: template.id,
    isDefault: l.isDefault ?? false,
    isOptional: l.isOptional ?? true,
    isLabelling: l.isLabelling ?? false,
    isDiscount: l.isDiscount ?? false,
    canBeNegative: l.canBeNegative ?? false,
  }));

  for (const line of lines) {
    await prisma.pricingTemplateLine.upsert({
      where: { templateId_code: { templateId: template.id, code: line.code } },
      update: { ...line },
      create: { ...line },
    });
  }

  console.log("✅ Seeded AIR_EXPORT_LOCAL (defaults + selectable add-ons)");
}

async function seedAirExportFreezone(prisma: PrismaClient) {
  const code = PricingTemplateCode.AIR_EXPORT_FREEZONE;

  const template = await prisma.pricingTemplate.upsert({
    where: { code },
    update: {
      name: "Freezone Cargo",
      mode: ShipmentMode.AIR,
      direction: PricingDirection.EXPORT,
    },
    create: {
      mode: ShipmentMode.AIR,
      direction: PricingDirection.EXPORT,
      code,
      name: "Freezone Cargo",
    },
  });

  const lines = [
    // MAIN (mandatory)
    { code: "AIRFREIGHT", label: "Airfreight", group: ChargeGroup.MAIN, qtyBasis: QtyBasis.KG_CHARGEABLE_MAX, order: 10, isDefault: true, isOptional: false },
    { code: "THC", label: "THC", group: ChargeGroup.MAIN, qtyBasis: QtyBasis.KG_ACTUAL, order: 20, isDefault: true, isOptional: false },

    // EXWORKS mandatory core (created on init)
    { code: "AWB", label: "AWB", group: ChargeGroup.EXWORKS, qtyBasis: QtyBasis.SHIPMENT, order: 110, isDefault: true, isOptional: false },
    { code: "DUE_CARRIER", label: "D/C (Due Carrier)", group: ChargeGroup.EXWORKS, qtyBasis: QtyBasis.SHIPMENT, order: 120, isDefault: true, isOptional: false },
    { code: "LABELLING", label: "Labelling", group: ChargeGroup.EXWORKS, qtyBasis: QtyBasis.PIECE, order: 130, isDefault: true, isOptional: false, isLabelling: true },
    { code: "CUSTOMS_BOE", label: "Customs BOE", group: ChargeGroup.EXWORKS, qtyBasis: QtyBasis.SHIPMENT, order: 140, isDefault: true, isOptional: false },
    { code: "HANDLING_SERVICES", label: "Handling & Services", group: ChargeGroup.EXWORKS, qtyBasis: QtyBasis.SHIPMENT, order: 150, isDefault: true, isOptional: false },
    { code: "TRANSPORTATION", label: "Transportation", group: ChargeGroup.EXWORKS, qtyBasis: QtyBasis.SHIPMENT, order: 160, isDefault: true, isOptional: false },

    // FREEZONE-specific mandatory exworks
    { code: "EXIT_ENTRY_CHARGES", label: "Exit / Entry Charges", group: ChargeGroup.EXWORKS, qtyBasis: QtyBasis.SHIPMENT, order: 170, isDefault: true, isOptional: false },
    { code: "GATE_PASS_DPW", label: "Gate Pass DPW", group: ChargeGroup.EXWORKS, qtyBasis: QtyBasis.SHIPMENT, order: 180, isDefault: true, isOptional: false },
    { code: "CUSTOMS_INSPECTION", label: "Customs Inspection", group: ChargeGroup.EXWORKS, qtyBasis: QtyBasis.SHIPMENT, order: 190, isDefault: true, isOptional: false },

    // EXWORKS add-ons (select to add later)
    { code: "EXPORTER_CODE", label: "Exporter Code", group: ChargeGroup.EXWORKS, qtyBasis: QtyBasis.SHIPMENT, order: 210, isDefault: false, isOptional: true },
    { code: "DOCUMENTATION", label: "Documentation", group: ChargeGroup.EXWORKS, qtyBasis: QtyBasis.SHIPMENT, order: 220, isDefault: false, isOptional: true },
    { code: "SCREENING", label: "Screening", group: ChargeGroup.EXWORKS, qtyBasis: QtyBasis.SHIPMENT, order: 230, isDefault: false, isOptional: true },
    { code: "HAWB_FEES", label: "HAWB Fees", group: ChargeGroup.EXWORKS, qtyBasis: QtyBasis.SHIPMENT, order: 240, isDefault: false, isOptional: true },
    { code: "PACKING_CHARGES", label: "Packing Charges", group: ChargeGroup.EXWORKS, qtyBasis: QtyBasis.SHIPMENT, order: 250, isDefault: false, isOptional: true },
    { code: "AIRWAY_BILL_AMENDMENT", label: "Airway Bill Amendment", group: ChargeGroup.EXWORKS, qtyBasis: QtyBasis.SHIPMENT, order: 260, isDefault: false, isOptional: true },
    { code: "CUSTOMS_BOE_AMENDMENT", label: "Customs BOE Amendment", group: ChargeGroup.EXWORKS, qtyBasis: QtyBasis.SHIPMENT, order: 270, isDefault: false, isOptional: true },
    { code: "LABOUR_PORTER", label: "Labour & Porter Charges", group: ChargeGroup.EXWORKS, qtyBasis: QtyBasis.SHIPMENT, order: 280, isDefault: false, isOptional: true },
    { code: "FORKLIFT", label: "Forklift Charges", group: ChargeGroup.EXWORKS, qtyBasis: QtyBasis.SHIPMENT, order: 290, isDefault: false, isOptional: true },
    { code: "BOE_CANCELLATION", label: "BOE Cancellation Charges", group: ChargeGroup.EXWORKS, qtyBasis: QtyBasis.SHIPMENT, order: 300, isDefault: false, isOptional: true },
    { code: "ELI_DOCUMENTATION", label: "ELI Documentation", group: ChargeGroup.EXWORKS, qtyBasis: QtyBasis.SHIPMENT, order: 310, isDefault: false, isOptional: true },
    { code: "STORAGE", label: "Storage Charges", group: ChargeGroup.EXWORKS, qtyBasis: QtyBasis.SHIPMENT, order: 320, isDefault: false, isOptional: true },

    { code: "LESS_DISCOUNTS", label: "Less Discounts", group: ChargeGroup.EXWORKS, qtyBasis: QtyBasis.SHIPMENT, order: 330, isDefault: false, isOptional: true, isDiscount: true, canBeNegative: true },
    { code: "ROUND_OFF", label: "Round off", group: ChargeGroup.EXWORKS, qtyBasis: QtyBasis.SHIPMENT, order: 340, isDefault: false, isOptional: true, canBeNegative: true },

    { code: "DG_HANDLING", label: "DG Handling", group: ChargeGroup.EXWORKS, qtyBasis: QtyBasis.SHIPMENT, order: 410, isDefault: false, isOptional: true },
    { code: "DG_PACKING", label: "DG Packing Charges", group: ChargeGroup.EXWORKS, qtyBasis: QtyBasis.SHIPMENT, order: 420, isDefault: false, isOptional: true },
    { code: "DG_INSPECTION", label: "DG Inspection", group: ChargeGroup.EXWORKS, qtyBasis: QtyBasis.SHIPMENT, order: 430, isDefault: false, isOptional: true },
    { code: "SLI", label: "SLI", group: ChargeGroup.EXWORKS, qtyBasis: QtyBasis.SHIPMENT, order: 440, isDefault: false, isOptional: true },
  ].map((l) => ({
    ...l,
    templateId: template.id,
    isDefault: l.isDefault ?? false,
    isOptional: l.isOptional ?? true,
    isLabelling: l.isLabelling ?? false,
    isDiscount: l.isDiscount ?? false,
    canBeNegative: l.canBeNegative ?? false,
  }));

  for (const line of lines) {
    await prisma.pricingTemplateLine.upsert({
      where: { templateId_code: { templateId: template.id, code: line.code } },
      update: { ...line },
      create: { ...line },
    });
  }

  console.log("✅ Seeded AIR_EXPORT_FREEZONE (defaults + selectable add-ons)");
}

async function seedAirExportTransit(prisma: PrismaClient) {
  const code = PricingTemplateCode.AIR_EXPORT_TRANSIT;

  const template = await prisma.pricingTemplate.upsert({
    where: { code },
    update: {
      name: "Transit Cargo",
      mode: ShipmentMode.AIR,
      direction: PricingDirection.EXPORT,
    },
    create: {
      mode: ShipmentMode.AIR,
      direction: PricingDirection.EXPORT,
      code,
      name: "Transit Cargo",
    },
  });

  const lines = [
    // MAIN (mandatory)
    { code: "AIRFREIGHT", label: "Airfreight", group: ChargeGroup.MAIN, qtyBasis: QtyBasis.KG_CHARGEABLE_MAX, order: 10, isDefault: true, isOptional: false },
    { code: "THC_IN", label: "THC IN", group: ChargeGroup.MAIN, qtyBasis: QtyBasis.KG_ACTUAL, order: 20, isDefault: true, isOptional: false },
    { code: "THC_OUT", label: "THC OUT", group: ChargeGroup.MAIN, qtyBasis: QtyBasis.KG_ACTUAL, order: 30, isDefault: true, isOptional: false },

    // EXWORKS mandatory core (created on init)
    { code: "AWB", label: "AWB", group: ChargeGroup.EXWORKS, qtyBasis: QtyBasis.SHIPMENT, order: 110, isDefault: true, isOptional: false },
    { code: "DUE_CARRIER", label: "D/C (Due Carrier)", group: ChargeGroup.EXWORKS, qtyBasis: QtyBasis.SHIPMENT, order: 120, isDefault: true, isOptional: false },
    { code: "LABELLING", label: "Labelling", group: ChargeGroup.EXWORKS, qtyBasis: QtyBasis.PIECE, order: 130, isDefault: true, isOptional: false, isLabelling: true },
    { code: "CUSTOMS_BOE", label: "Customs BOE", group: ChargeGroup.EXWORKS, qtyBasis: QtyBasis.SHIPMENT, order: 140, isDefault: true, isOptional: false },
    { code: "HANDLING_SERVICES", label: "Handling & Services", group: ChargeGroup.EXWORKS, qtyBasis: QtyBasis.SHIPMENT, order: 150, isDefault: true, isOptional: false },
    { code: "TRANSPORTATION", label: "Transportation", group: ChargeGroup.EXWORKS, qtyBasis: QtyBasis.SHIPMENT, order: 160, isDefault: true, isOptional: false },

    // EXWORKS add-ons (ops selects when needed)
    { code: "EXPORTER_CODE", label: "Exporter Code", group: ChargeGroup.EXWORKS, qtyBasis: QtyBasis.SHIPMENT, order: 210, isDefault: false, isOptional: true },
    { code: "DOCUMENTATION", label: "Documentation", group: ChargeGroup.EXWORKS, qtyBasis: QtyBasis.SHIPMENT, order: 220, isDefault: false, isOptional: true },
    { code: "SCREENING", label: "Screening", group: ChargeGroup.EXWORKS, qtyBasis: QtyBasis.SHIPMENT, order: 230, isDefault: false, isOptional: true },
    { code: "HAWB_FEES", label: "HAWB Fees", group: ChargeGroup.EXWORKS, qtyBasis: QtyBasis.SHIPMENT, order: 240, isDefault: false, isOptional: true },
    { code: "PACKING_CHARGES", label: "Packing Charges", group: ChargeGroup.EXWORKS, qtyBasis: QtyBasis.SHIPMENT, order: 250, isDefault: false, isOptional: true },
    { code: "AIRWAY_BILL_AMENDMENT", label: "Airway Bill Amendment", group: ChargeGroup.EXWORKS, qtyBasis: QtyBasis.SHIPMENT, order: 260, isDefault: false, isOptional: true },
    { code: "CUSTOMS_BOE_AMENDMENT", label: "Customs BOE Amendment", group: ChargeGroup.EXWORKS, qtyBasis: QtyBasis.SHIPMENT, order: 270, isDefault: false, isOptional: true },
    { code: "LABOUR_PORTER", label: "Labour & Porter Charges", group: ChargeGroup.EXWORKS, qtyBasis: QtyBasis.SHIPMENT, order: 280, isDefault: false, isOptional: true },
    { code: "FORKLIFT", label: "Forklift Charges", group: ChargeGroup.EXWORKS, qtyBasis: QtyBasis.SHIPMENT, order: 290, isDefault: false, isOptional: true },
    { code: "BOE_CANCELLATION", label: "BOE Cancellation Charges", group: ChargeGroup.EXWORKS, qtyBasis: QtyBasis.SHIPMENT, order: 300, isDefault: false, isOptional: true },
    { code: "DELIVERY_ORDER", label: "Delivery Order", group: ChargeGroup.EXWORKS, qtyBasis: QtyBasis.SHIPMENT, order: 305, isDefault: false, isOptional: true },
    { code: "ELI_DOCUMENTATION", label: "ELI Documentation", group: ChargeGroup.EXWORKS, qtyBasis: QtyBasis.SHIPMENT, order: 310, isDefault: false, isOptional: true },
    { code: "STORAGE", label: "Storage Charges", group: ChargeGroup.EXWORKS, qtyBasis: QtyBasis.SHIPMENT, order: 320, isDefault: false, isOptional: true },

    { code: "CUSTOMS_INSPECTION", label: "Customs Inspection", group: ChargeGroup.EXWORKS, qtyBasis: QtyBasis.SHIPMENT, order: 325, isDefault: false, isOptional: true },
    { code: "EXIT_ENTRY_CHARGES", label: "Exit / Entry Charges", group: ChargeGroup.EXWORKS, qtyBasis: QtyBasis.SHIPMENT, order: 326, isDefault: false, isOptional: true },
    { code: "DE_CONSOL", label: "De Consol", group: ChargeGroup.EXWORKS, qtyBasis: QtyBasis.SHIPMENT, order: 327, isDefault: false, isOptional: true },
    { code: "EDP", label: "EDP", group: ChargeGroup.EXWORKS, qtyBasis: QtyBasis.SHIPMENT, order: 328, isDefault: false, isOptional: true },

    // Discounts/rounding (selectable)
    { code: "LESS_DISCOUNTS", label: "Less Discounts", group: ChargeGroup.EXWORKS, qtyBasis: QtyBasis.SHIPMENT, order: 330, isDefault: false, isOptional: true, isDiscount: true, canBeNegative: true },
    { code: "ROUND_OFF", label: "Round off", group: ChargeGroup.EXWORKS, qtyBasis: QtyBasis.SHIPMENT, order: 340, isDefault: false, isOptional: true, canBeNegative: true },

    // DG (selectable)
    { code: "DG_HANDLING", label: "DG Handling", group: ChargeGroup.EXWORKS, qtyBasis: QtyBasis.SHIPMENT, order: 410, isDefault: false, isOptional: true },
    { code: "DG_PACKING", label: "DG Packing Charges", group: ChargeGroup.EXWORKS, qtyBasis: QtyBasis.SHIPMENT, order: 420, isDefault: false, isOptional: true },
    { code: "DG_INSPECTION", label: "DG Inspection", group: ChargeGroup.EXWORKS, qtyBasis: QtyBasis.SHIPMENT, order: 430, isDefault: false, isOptional: true },
    { code: "SLI", label: "SLI", group: ChargeGroup.EXWORKS, qtyBasis: QtyBasis.SHIPMENT, order: 440, isDefault: false, isOptional: true },
  ].map((l) => ({
    ...l,
    templateId: template.id,
    isDefault: l.isDefault ?? false,
    isOptional: l.isOptional ?? true,
    isLabelling: l.isLabelling ?? false,
    isDiscount: l.isDiscount ?? false,
    canBeNegative: l.canBeNegative ?? false,
  }));

  for (const line of lines) {
    await prisma.pricingTemplateLine.upsert({
      where: { templateId_code: { templateId: template.id, code: line.code } },
      update: { ...line },
      create: { ...line },
    });
  }

  console.log("✅ Seeded AIR_EXPORT_TRANSIT (defaults + selectable add-ons)");
}

async function seedAirImportLocalClearance(prisma: PrismaClient) {
  const code = PricingTemplateCode.AIR_IMPORT_LOCAL_CLEARANCE;

  const template = await prisma.pricingTemplate.upsert({
    where: { code },
    update: {
      name: "Local Clearance Import",
      mode: ShipmentMode.AIR,
      direction: PricingDirection.IMPORT,
    },
    create: {
      mode: ShipmentMode.AIR,
      direction: PricingDirection.IMPORT,
      code,
      name: "Local Clearance Import",
    },
  });

  const lines = [
    // MAIN (Customer sees DO + THC + Clearance Delivery Charges)
    { code: "DO", label: "Delivery Order (DO)", group: ChargeGroup.MAIN, qtyBasis: QtyBasis.SHIPMENT, order: 10, isDefault: true, isOptional: false },

    // THC = same as exports (KG_ACTUAL)
    { code: "AIRFREIGHT", label: "Airfreight", group: ChargeGroup.MAIN, qtyBasis: QtyBasis.KG_CHARGEABLE_MAX, order: 10, isDefault: true, isOptional: true },
    { code: "THC", label: "THC", group: ChargeGroup.MAIN, qtyBasis: QtyBasis.KG_ACTUAL, order: 20, isDefault: true, isOptional: false },

    // CLEARANCE group (customer sees as one bundle total = sum of these)
    { code: "EDP", label: "EDP", group: ChargeGroup.CLEARANCE, qtyBasis: QtyBasis.SHIPMENT, order: 110, isDefault: true, isOptional: false },
    { code: "BOE", label: "BOE", group: ChargeGroup.CLEARANCE, qtyBasis: QtyBasis.SHIPMENT, order: 120, isDefault: true, isOptional: false },
    { code: "TRANSPORT", label: "Transport", group: ChargeGroup.CLEARANCE, qtyBasis: QtyBasis.SHIPMENT, order: 130, isDefault: true, isOptional: false },
    { code: "HANDLING_SERVICES", label: "Handling & Services", group: ChargeGroup.CLEARANCE, qtyBasis: QtyBasis.SHIPMENT, order: 140, isDefault: true, isOptional: false },
    { code: "LABOUR_PORTER", label: "Labour & Porter Charges", group: ChargeGroup.CLEARANCE, qtyBasis: QtyBasis.SHIPMENT, order: 150, isDefault: true, isOptional: false },
    { code: "FORKLIFT", label: "Forklift Charges", group: ChargeGroup.CLEARANCE, qtyBasis: QtyBasis.SHIPMENT, order: 160, isDefault: true, isOptional: false },
    { code: "THIRD_PARTY_LICENSE", label: "Third Party License", group: ChargeGroup.CLEARANCE, qtyBasis: QtyBasis.SHIPMENT, order: 170, isDefault: true, isOptional: false },
    { code: "DOCUMENTATION", label: "Documentation", group: ChargeGroup.CLEARANCE, qtyBasis: QtyBasis.SHIPMENT, order: 180, isDefault: true, isOptional: false },
    { code: "CUSTOMS_BOE", label: "Customs BOE", group: ChargeGroup.CLEARANCE, qtyBasis: QtyBasis.SHIPMENT, order: 190, isDefault: true, isOptional: false },
    { code: "DE_CONSOL", label: "De Consol", group: ChargeGroup.CLEARANCE, qtyBasis: QtyBasis.SHIPMENT, order: 200, isDefault: true, isOptional: false },
    { code: "VAT_INSPECTION", label: "VAT Inspection", group: ChargeGroup.CLEARANCE, qtyBasis: QtyBasis.SHIPMENT, order: 210, isDefault: true, isOptional: false },
    { code: "STORAGE", label: "Storage Charges", group: ChargeGroup.CLEARANCE, qtyBasis: QtyBasis.SHIPMENT, order: 220, isDefault: true, isOptional: false },

    // Discounts / rounding (negative allowed) — keep as default (always present)
    { code: "LESS_DISCOUNTS", label: "Less Discounts", group: ChargeGroup.CLEARANCE, qtyBasis: QtyBasis.SHIPMENT, order: 230, isDefault: true, isOptional: false, isDiscount: true, canBeNegative: true },
    { code: "ROUND_OFF", label: "Round Off", group: ChargeGroup.CLEARANCE, qtyBasis: QtyBasis.SHIPMENT, order: 240, isDefault: true, isOptional: false, canBeNegative: true },
  ].map((l) => ({
    ...l,
    templateId: template.id,
    isDefault: l.isDefault ?? false,
    isOptional: l.isOptional ?? true,
    isLabelling: (l as any).isLabelling ?? false,
    isDiscount: (l as any).isDiscount ?? false,
    canBeNegative: (l as any).canBeNegative ?? false,
  }));

  for (const line of lines) {
    await prisma.pricingTemplateLine.upsert({
      where: { templateId_code: { templateId: template.id, code: line.code } },
      update: { ...line },
      create: { ...line },
    });
  }

  console.log("✅ Seeded AIR_IMPORT_LOCAL_CLEARANCE (defaults)");
}

async function seedAirImportReExport(prisma: PrismaClient) {
  const code = PricingTemplateCode.AIR_IMPORT_REEXPORT;

  const template = await prisma.pricingTemplate.upsert({
    where: { code },
    update: {
      name: "Import for Re-Export (Air)",
      mode: ShipmentMode.AIR,
      direction: PricingDirection.IMPORT,
    },
    create: {
      mode: ShipmentMode.AIR,
      direction: PricingDirection.IMPORT,
      code,
      name: "Import for Re-Export (Air)",
    },
  });

  const lines = [
    // =========================
    // MAIN (customer lines)
    // =========================
    { code: "AIRFREIGHT",     label: "Air Freight",          group: ChargeGroup.MAIN, qtyBasis: QtyBasis.KG_CHARGEABLE_MAX, order: 10, isDefault: true, isOptional: false },
    { code: "THC_EXPORT", label: "THC Export", group: ChargeGroup.MAIN, qtyBasis: QtyBasis.KG_ACTUAL, order: 20, isDefault: true, isOptional: false },
    { code: "THC_IMPORT", label: "THC Import", group: ChargeGroup.MAIN, qtyBasis: QtyBasis.KG_ACTUAL, order: 30, isDefault: true, isOptional: false },
    { code: "DELIVERY_ORDER",label: "Delivery Order (DO)",  group: ChargeGroup.MAIN, qtyBasis: QtyBasis.SHIPMENT,         order: 40, isDefault: true, isOptional: false },

    // =========================
    // EXWORKS (bundle)
    // =========================
    { code: "EDP",                 label: "EDP",                             group: ChargeGroup.EXWORKS, qtyBasis: QtyBasis.SHIPMENT, order: 110, isDefault: true, isOptional: false },
    { code: "BOE",                 label: "BOE",                             group: ChargeGroup.EXWORKS, qtyBasis: QtyBasis.SHIPMENT, order: 120, isDefault: true, isOptional: false },
    { code: "TRANSPORT",           label: "Transport",                       group: ChargeGroup.EXWORKS, qtyBasis: QtyBasis.SHIPMENT, order: 130, isDefault: true, isOptional: false },
    { code: "HANDLING_SERVICES",   label: "Handling & Services",             group: ChargeGroup.EXWORKS, qtyBasis: QtyBasis.SHIPMENT, order: 140, isDefault: true, isOptional: false },
    { code: "LABOUR_PORTER",       label: "Labour & Porter Charges",         group: ChargeGroup.EXWORKS, qtyBasis: QtyBasis.SHIPMENT, order: 150, isDefault: true, isOptional: false },
    { code: "FORKLIFT",            label: "Forklift Charges",                group: ChargeGroup.EXWORKS, qtyBasis: QtyBasis.SHIPMENT, order: 160, isDefault: true, isOptional: false },
    { code: "THIRD_PARTY_LICENSE", label: "Third Party License",             group: ChargeGroup.EXWORKS, qtyBasis: QtyBasis.SHIPMENT, order: 170, isDefault: true, isOptional: false },
    { code: "DOCUMENTATION",       label: "Documentation",                   group: ChargeGroup.EXWORKS, qtyBasis: QtyBasis.SHIPMENT, order: 180, isDefault: true, isOptional: false },
    { code: "CUSTOMS_BOE",         label: "Customs BOE",                     group: ChargeGroup.EXWORKS, qtyBasis: QtyBasis.SHIPMENT, order: 190, isDefault: true, isOptional: false },
    { code: "CUSTOMS_INSPECTION",  label: "Customs Inspection",              group: ChargeGroup.EXWORKS, qtyBasis: QtyBasis.SHIPMENT, order: 200, isDefault: true, isOptional: false },
    { code: "DM_INSPECTION",       label: "DM Inspection",                   group: ChargeGroup.EXWORKS, qtyBasis: QtyBasis.SHIPMENT, order: 210, isDefault: true, isOptional: false },
    { code: "EXIT_ENTRY_CHARGES",  label: "Exit / Entry Charges",            group: ChargeGroup.EXWORKS, qtyBasis: QtyBasis.SHIPMENT, order: 220, isDefault: true, isOptional: false },
    { code: "VAT_INSPECTION",      label: "VAT Inspection",                  group: ChargeGroup.EXWORKS, qtyBasis: QtyBasis.SHIPMENT, order: 230, isDefault: true, isOptional: false },
    { code: "STORAGE",             label: "Storage Charges",                 group: ChargeGroup.EXWORKS, qtyBasis: QtyBasis.SHIPMENT, order: 240, isDefault: true, isOptional: false },

    { code: "AIRWAY_BILL_FEE",     label: "Airway Bill Fee",                 group: ChargeGroup.EXWORKS, qtyBasis: QtyBasis.SHIPMENT, order: 250, isDefault: true, isOptional: false },
    { code: "DUE_CARRIER",         label: "Due Carrier D/C",                 group: ChargeGroup.EXWORKS, qtyBasis: QtyBasis.SHIPMENT, order: 260, isDefault: true, isOptional: false },

    // Labelling rule same as exports (special calc)
    { code: "LABELLING",           label: "Labelling",                       group: ChargeGroup.EXWORKS, qtyBasis: QtyBasis.PIECE,    order: 270, isDefault: true, isOptional: false, isLabelling: true },

    { code: "SCREENING",           label: "Screening",                       group: ChargeGroup.EXWORKS, qtyBasis: QtyBasis.SHIPMENT, order: 280, isDefault: true, isOptional: false },
    { code: "EXPORT_CUSTOMS_BOE_INSPECTION", label: "Export Customs BOE & Inspection", group: ChargeGroup.EXWORKS, qtyBasis: QtyBasis.SHIPMENT, order: 290, isDefault: true, isOptional: false },
    { code: "PACKING_CHARGES",     label: "Packing Charges",                 group: ChargeGroup.EXWORKS, qtyBasis: QtyBasis.SHIPMENT, order: 300, isDefault: true, isOptional: false },

    // Selectable Discounts / Round Off
    { code: "LESS_DISCOUNTS", label: "Less Discounts", group: ChargeGroup.EXWORKS, qtyBasis: QtyBasis.SHIPMENT, order: 900, isDefault: false, isOptional: true, isDiscount: true, canBeNegative: true },
    { code: "ROUND_OFF",      label: "Round Off",      group: ChargeGroup.EXWORKS, qtyBasis: QtyBasis.SHIPMENT, order: 910, isDefault: false, isOptional: true, canBeNegative: true },
  ].map((l) => ({
    ...l,
    templateId: template.id,
    isDefault: l.isDefault ?? false,
    isOptional: l.isOptional ?? true,
    isLabelling: l.isLabelling ?? false,
    isDiscount: l.isDiscount ?? false,
    canBeNegative: l.canBeNegative ?? false,
  }));

  for (const line of lines) {
    await prisma.pricingTemplateLine.upsert({
      where: { templateId_code: { templateId: template.id, code: line.code } },
      update: { ...line },
      create: { ...line },
    });
  }

  console.log("✅ Seeded AIR_IMPORT_REEXPORT");
}

async function seedSeaToAir(prisma: PrismaClient) {
  const template = await prisma.pricingTemplate.upsert({
    where: { code: PricingTemplateCode.SEA_TO_AIR },
    update: {},
    create: {
      code: PricingTemplateCode.SEA_TO_AIR,
      name: "SEA to AIR",
      mode: ShipmentMode.AIR,
      direction: PricingDirection.IMPORT,
    },
  });

  const lines = [
    // =====================
    // MAIN (Customer visible blocks)
    // =====================
    { code: "DELIVERY_ORDER", label: "Delivery Order", group: ChargeGroup.MAIN },
    { code: "THC_IMPORT", label: "THC Import", group: ChargeGroup.MAIN, qtyBasis: QtyBasis.KG_ACTUAL },

    { code: "AIRFREIGHT", label: "Air Freight", group: ChargeGroup.MAIN, qtyBasis: QtyBasis.KG_CHARGEABLE_MAX },
    { code: "THC_EXPORT", label: "THC Export", group: ChargeGroup.MAIN, qtyBasis: QtyBasis.KG_ACTUAL },

    // =====================
    // IMPORT CLEARANCE (EXWORKS)
    // =====================
    { code: "SEA2AIR_IMP_CUSTOMS_BOE", label: "Import Customs BOE", group: ChargeGroup.EXWORKS },
    { code: "SEA2AIR_IMP_INSPECTION", label: "Import Customs Inspection", group: ChargeGroup.EXWORKS },
    { code: "SEA2AIR_IMP_TOKEN", label: "Token", group: ChargeGroup.EXWORKS },
    { code: "SEA2AIR_IMP_TLUC", label: "TLUC", group: ChargeGroup.EXWORKS },
    { code: "SEA2AIR_IMP_SEAL", label: "Seal Charge", group: ChargeGroup.EXWORKS },
    { code: "SEA2AIR_IMP_EXIT_ENTRY", label: "Exit Entry Charges", group: ChargeGroup.EXWORKS },
    { code: "SEA2AIR_IMP_TRANSPORT", label: "Transportation", group: ChargeGroup.EXWORKS },
    { code: "SEA2AIR_IMP_DPW_OFFLOAD", label: "DP World Off-Loading", group: ChargeGroup.EXWORKS },
    { code: "SEA2AIR_IMP_MECRC", label: "MECRC Charges", group: ChargeGroup.EXWORKS },
    { code: "SEA2AIR_IMP_DEMURRAGE", label: "Demurrage", group: ChargeGroup.EXWORKS },
    { code: "SEA2AIR_IMP_WAITING", label: "Waiting Charges", group: ChargeGroup.EXWORKS },

    // =====================
    // EXPORT CLEARANCE (EXWORKS)
    // =====================
    { code: "SEA2AIR_EXP_BOE", label: "Export Customs BOE", group: ChargeGroup.EXWORKS },
    { code: "SEA2AIR_EXP_INSPECTION", label: "Export Customs Inspection", group: ChargeGroup.EXWORKS },
    { code: "SEA2AIR_EXP_DOCUMENTATION", label: "Documentation", group: ChargeGroup.EXWORKS },
    { code: "SEA2AIR_EXP_HANDLING", label: "Handling & Services", group: ChargeGroup.EXWORKS },
    { code: "SEA2AIR_EXP_INSURANCE", label: "Insurance", group: ChargeGroup.EXWORKS },
    { code: "SEA2AIR_EXP_LABOUR", label: "Labour & Forklift", group: ChargeGroup.EXWORKS },
    { code: "SEA2AIR_EXP_AWB", label: "AWB", group: ChargeGroup.EXWORKS },
    { code: "SEA2AIR_EXP_SCREENING", label: "Screening", group: ChargeGroup.EXWORKS },
    { code: "SEA2AIR_EXP_PACKING", label: "Packing Charges", group: ChargeGroup.EXWORKS },
    { code: "SEA2AIR_EXP_DUE_CARRIER", label: "Due Carrier (D/C)", group: ChargeGroup.EXWORKS },
    { code: "SEA2AIR_EXP_LABELLING", label: "Labelling", group: ChargeGroup.EXWORKS, isLabelling: true },
  ];

  for (const [i, l] of lines.entries()) {
    await prisma.pricingTemplateLine.upsert({
      where: { templateId_code: { templateId: template.id, code: l.code } },
      update: {},
      create: {
        ...l,
        templateId: template.id,
        order: i * 10,
        isDefault: true,
        isOptional: false,
        qtyBasis: l.qtyBasis ?? QtyBasis.SHIPMENT,
        isLabelling: l.isLabelling ?? false,
        isDiscount: false,
        canBeNegative: false,
      },
    });
  }

  console.log("✅ Seeded SEA → AIR (using EXWORKS breakdown)");
}

async function seedTransferOwnershipTemplates(prisma: PrismaClient) {
  await seedTransferOwnership(prisma, ShipmentMode.AIR, PricingDirection.EXPORT, PricingTemplateCode.AIR_EXPORT_TRANSFER_OWNERSHIP, "Transfer of Ownership (AIR Export)");
  await seedTransferOwnership(prisma, ShipmentMode.AIR, PricingDirection.IMPORT, PricingTemplateCode.AIR_IMPORT_TRANSFER_OWNERSHIP, "Transfer of Ownership (AIR Import)");
  await seedTransferOwnership(prisma, ShipmentMode.SEA, PricingDirection.EXPORT, PricingTemplateCode.SEA_EXPORT_TRANSFER_OWNERSHIP, "Transfer of Ownership (SEA Export)");
  await seedTransferOwnership(prisma, ShipmentMode.SEA, PricingDirection.IMPORT, PricingTemplateCode.SEA_IMPORT_TRANSFER_OWNERSHIP, "Transfer of Ownership (SEA Import)");

  console.log("✅ Seeded Transfer of Ownership templates (AIR/SEA Export/Import)");
}

async function seedTransferOwnership(
  prisma: PrismaClient,
  mode: ShipmentMode,
  direction: PricingDirection,
  code: PricingTemplateCode,
  name: string
) {
  const template = await prisma.pricingTemplate.upsert({
    where: { code },
    update: { mode, direction, name },
    create: { mode, direction, code, name },
  });

  const lines = [
    // ✅ Defaults (always created when TOO is attached)
    { code: "TOO_TRANSIT_IN", label: "Transit In", order: 10 },
    { code: "TOO_TRANSIT_OUT", label: "Transit Out", order: 20 },
    { code: "TOO_CUSTOMS_INSPECTION", label: "Customs Inspection", order: 30 },
    { code: "TOO_EXIT_ENTRY", label: "Exit / Entry Charges", order: 40 },
    { code: "TOO_DPW_GATE_PASS", label: "DP World Gate Pass", order: 50 },
    { code: "TOO_ADDITIONAL_DOCUMENTS", label: "Additional Documents", order: 60 },
    { code: "TOO_TRANSPORT", label: "Transport", order: 70 },
    { code: "TOO_CUSTOMS_BOE", label: "Customs BOE", order: 80 },
    { code: "TOO_OWNERSHIP_CHARGES", label: "Transfer of Ownership Charges", order: 90 },
    { code: "TOO_DOCUMENTATION", label: "Documentation", order: 100 },
    { code: "TOO_CUSTOMS_GATE_PASS", label: "Customs Gate Pass", order: 110 },
    { code: "TOO_CUSTOMS_SEAL", label: "Customs Seal", order: 120 },
    { code: "TOO_WAREHOUSE_STORAGE", label: "Warehouse Storage", order: 130 },
    { code: "TOO_STORAGE_CHARGES", label: "Storage Charges", order: 140 },

    // Optional (select to add later) — if you want these selectable instead of always present,
    // change isDefault:false and isOptional:true
    { code: "TOO_LESS_DISCOUNTS", label: "Less Discounts", order: 900, isDiscount: true, canBeNegative: true },
    { code: "TOO_ROUND_OFF", label: "Round Off", order: 910, canBeNegative: true },
  ].map((l) => ({
    templateId: template.id,
    code: l.code,
    label: l.label,
    group: ChargeGroup.TRANSFER_OWNERSHIP,
    qtyBasis: QtyBasis.SHIPMENT,
    order: l.order,

    // ✅ Always included when TOO is attached
    isDefault: true,
    isOptional: false,

    isLabelling: false,
    isDiscount: l.isDiscount ?? false,
    canBeNegative: l.canBeNegative ?? false,
  }));

  for (const line of lines) {
    await prisma.pricingTemplateLine.upsert({
      where: { templateId_code: { templateId: template.id, code: line.code } },
      update: { ...line },
      create: { ...line },
    });
  }
}

async function seedSeaExportLocal20ft(prisma: PrismaClient) {
  const code = PricingTemplateCode.SEA_EXPORT_LOCAL_20FT;

  const template = await prisma.pricingTemplate.upsert({
    where: { code },
    update: {
      name: "SEA Export - Local (20ft)",
      mode: ShipmentMode.SEA,
      direction: PricingDirection.EXPORT,
    },
    create: {
      mode: ShipmentMode.SEA,
      direction: PricingDirection.EXPORT,
      code,
      name: "SEA Export - Local (20ft)",
    },
  });

  const lines = seaLocalExportLines(template.id);

  for (const line of lines) {
    await prisma.pricingTemplateLine.upsert({
      where: { templateId_code: { templateId: template.id, code: line.code } },
      update: { ...line },
      create: { ...line },
    });
  }

  console.log("✅ Seeded SEA_EXPORT_LOCAL_20FT (defaults + selectable add-ons)");
}

async function seedSeaExportLocal40ft(prisma: PrismaClient) {
  const code = PricingTemplateCode.SEA_EXPORT_LOCAL_40FT;

  const template = await prisma.pricingTemplate.upsert({
    where: { code },
    update: {
      name: "SEA Export - Local (40ft)",
      mode: ShipmentMode.SEA,
      direction: PricingDirection.EXPORT,
    },
    create: {
      mode: ShipmentMode.SEA,
      direction: PricingDirection.EXPORT,
      code,
      name: "SEA Export - Local (40ft)",
    },
  });

  const lines = seaLocalExportLines(template.id);

  for (const line of lines) {
    await prisma.pricingTemplateLine.upsert({
      where: { templateId_code: { templateId: template.id, code: line.code } },
      update: { ...line },
      create: { ...line },
    });
  }

  console.log("✅ Seeded SEA_EXPORT_LOCAL_40FT (defaults + selectable add-ons)");
}

/**
 * Local Sea Export lines (shared for 20ft/40ft).
 * Customer default shows:
 *  - Ocean Freight (MAIN, CONTAINER)
 *  - THC (MAIN, CONTAINER)
 *  - Exworks = sum of rest (EXWORKS)
 */
function seaLocalExportLines(templateId: string) {
  const coreDefaults = [
    // MAIN (always)
    { code: "OCEAN_FREIGHT", label: "Ocean Freight", group: ChargeGroup.MAIN, qtyBasis: QtyBasis.CONTAINER, order: 10, isDefault: true, isOptional: false },
    { code: "THC",          label: "THC",          group: ChargeGroup.MAIN, qtyBasis: QtyBasis.CONTAINER, order: 20, isDefault: true, isOptional: false },

    // EXWORKS core (always created)
    { code: "CUSTOMS_BOE",        label: "Customs BOE",        group: ChargeGroup.EXWORKS, qtyBasis: QtyBasis.SHIPMENT, order: 110, isDefault: true, isOptional: false },
    { code: "BL",                label: "BL",                group: ChargeGroup.EXWORKS, qtyBasis: QtyBasis.SHIPMENT, order: 120, isDefault: true, isOptional: false },
    { code: "TOKEN_VGM",          label: "Token & VGM",        group: ChargeGroup.EXWORKS, qtyBasis: QtyBasis.SHIPMENT, order: 130, isDefault: true, isOptional: false },
    { code: "DOCUMENTATION",      label: "Documentation",      group: ChargeGroup.EXWORKS, qtyBasis: QtyBasis.SHIPMENT, order: 140, isDefault: true, isOptional: false },
    { code: "SEAL_CHARGE",        label: "Seal Charge",        group: ChargeGroup.EXWORKS, qtyBasis: QtyBasis.SHIPMENT, order: 150, isDefault: true, isOptional: false },
    { code: "TRANSPORTATION",     label: "Transportation",     group: ChargeGroup.EXWORKS, qtyBasis: QtyBasis.SHIPMENT, order: 160, isDefault: true, isOptional: false },
    { code: "HANDLING_SERVICE",   label: "Handling & Service", group: ChargeGroup.EXWORKS, qtyBasis: QtyBasis.SHIPMENT, order: 170, isDefault: true, isOptional: false },
  ];

  // Selectable add-ons (ops adds if needed)
  const addons = [
    { code: "BAF", label: "BAF", group: ChargeGroup.EXWORKS, qtyBasis: QtyBasis.SHIPMENT, order: 210 },
    { code: "CAF", label: "CAF", group: ChargeGroup.EXWORKS, qtyBasis: QtyBasis.SHIPMENT, order: 220 },
    { code: "BUNKER_ADJUSTMENT", label: "Bunker Adjustment", group: ChargeGroup.EXWORKS, qtyBasis: QtyBasis.SHIPMENT, order: 230 },
    { code: "WAR_RISK", label: "War Risk", group: ChargeGroup.EXWORKS, qtyBasis: QtyBasis.SHIPMENT, order: 240 },
    { code: "DPC", label: "DPC", group: ChargeGroup.EXWORKS, qtyBasis: QtyBasis.SHIPMENT, order: 250 },
    { code: "HS_CODE", label: "HS Code", group: ChargeGroup.EXWORKS, qtyBasis: QtyBasis.SHIPMENT, order: 260 },
    { code: "PORT_CHARGES", label: "Port Charges", group: ChargeGroup.EXWORKS, qtyBasis: QtyBasis.SHIPMENT, order: 270 },
    { code: "DEMURRAGE", label: "Demurrage", group: ChargeGroup.EXWORKS, qtyBasis: QtyBasis.SHIPMENT, order: 280 },
    { code: "SWB", label: "SWB Charges", group: ChargeGroup.EXWORKS, qtyBasis: QtyBasis.SHIPMENT, order: 290 },
    { code: "IMCO", label: "Imco Charges", group: ChargeGroup.EXWORKS, qtyBasis: QtyBasis.SHIPMENT, order: 300 },
    { code: "DG_LABEL", label: "DG Label Charges", group: ChargeGroup.EXWORKS, qtyBasis: QtyBasis.SHIPMENT, order: 310 },
    { code: "MISC", label: "Miscellaneous", group: ChargeGroup.EXWORKS, qtyBasis: QtyBasis.SHIPMENT, order: 320 },
    { code: "CONTAINER_SHIFTING", label: "Container Shifting Charges", group: ChargeGroup.EXWORKS, qtyBasis: QtyBasis.SHIPMENT, order: 330 },
    { code: "CROSS_STUFFING", label: "Cross Stuffing", group: ChargeGroup.EXWORKS, qtyBasis: QtyBasis.SHIPMENT, order: 340 },
    { code: "STUFFING", label: "Stuffing Charges", group: ChargeGroup.EXWORKS, qtyBasis: QtyBasis.SHIPMENT, order: 350 },

    { code: "TELEX_BILL", label: "Telex Bill", group: ChargeGroup.EXWORKS, qtyBasis: QtyBasis.SHIPMENT, order: 360 },
    { code: "INSURANCE", label: "Insurance", group: ChargeGroup.EXWORKS, qtyBasis: QtyBasis.SHIPMENT, order: 370 },
    { code: "LOAD_LASHING", label: "Load & Lashing Charges", group: ChargeGroup.EXWORKS, qtyBasis: QtyBasis.SHIPMENT, order: 380 },
    { code: "TOLL_CHARGES", label: "Toll Charges", group: ChargeGroup.EXWORKS, qtyBasis: QtyBasis.SHIPMENT, order: 390 },
    { code: "THIRD_PARTY_LICENSE", label: "Third Party License", group: ChargeGroup.EXWORKS, qtyBasis: QtyBasis.SHIPMENT, order: 400 },
    { code: "CANCELLATION", label: "Cancellation Charges", group: ChargeGroup.EXWORKS, qtyBasis: QtyBasis.SHIPMENT, order: 410 },
    { code: "PACKING", label: "Packing Charges", group: ChargeGroup.EXWORKS, qtyBasis: QtyBasis.SHIPMENT, order: 420 },
    { code: "PROFIT_SHARE", label: "Profit Share", group: ChargeGroup.EXWORKS, qtyBasis: QtyBasis.SHIPMENT, order: 430 },
    { code: "RTA", label: "RTA", group: ChargeGroup.EXWORKS, qtyBasis: QtyBasis.SHIPMENT, order: 440 },
    { code: "EXIT_ENTRY_VAT", label: "Exit Entry VAT", group: ChargeGroup.EXWORKS, qtyBasis: QtyBasis.SHIPMENT, order: 450 },

    // Discounts/rounding (selectable)
    { code: "LESS_DISCOUNTS", label: "Less Discounts", group: ChargeGroup.EXWORKS, qtyBasis: QtyBasis.SHIPMENT, order: 900, isDiscount: true, canBeNegative: true },
    { code: "ROUND_OFF", label: "Round Off", group: ChargeGroup.EXWORKS, qtyBasis: QtyBasis.SHIPMENT, order: 910, canBeNegative: true },
  ].map((l) => ({
    templateId,
    ...l,
    isDefault: false,
    isOptional: true,
    isLabelling: false,
    isDiscount: (l as any).isDiscount ?? false,
    canBeNegative: (l as any).canBeNegative ?? false,
  }));

  return [...coreDefaults, ...addons].map((l: any) => ({
    ...l,
    templateId,
    isDefault: l.isDefault ?? false,
    isOptional: l.isOptional ?? true,
    isLabelling: l.isLabelling ?? false,
    isDiscount: l.isDiscount ?? false,
    canBeNegative: l.canBeNegative ?? false,
  }));
}

async function seedSeaExportFreezone20ft(prisma: PrismaClient) {
  const code = PricingTemplateCode.SEA_EXPORT_FREEZONE_20FT;

  const template = await prisma.pricingTemplate.upsert({
    where: { code },
    update: {
      name: "Sea Freezone Export (20FT)",
      mode: ShipmentMode.SEA,
      direction: PricingDirection.EXPORT,
    },
    create: {
      mode: ShipmentMode.SEA,
      direction: PricingDirection.EXPORT,
      code,
      name: "Sea Freezone Export (20FT)",
    },
  });

  const lines = [
    // =========================
    // MAIN (Customer sees these)
    // =========================
    { code: "OCEAN_FREIGHT", label: "Ocean Freight", group: ChargeGroup.MAIN, qtyBasis: QtyBasis.CONTAINER, order: 10, isDefault: true, isOptional: false },
    { code: "THC",          label: "THC",          group: ChargeGroup.MAIN, qtyBasis: QtyBasis.CONTAINER, order: 20, isDefault: true, isOptional: false },

    // =========================
    // EXWORKS (included by default)
    // =========================
    { code: "CUSTOMS_BOE",        label: "Customs BOE",        group: ChargeGroup.EXWORKS, qtyBasis: QtyBasis.SHIPMENT, order: 110, isDefault: true, isOptional: false },
    { code: "BL",                 label: "BL",                 group: ChargeGroup.EXWORKS, qtyBasis: QtyBasis.SHIPMENT, order: 120, isDefault: true, isOptional: false },
    { code: "TOKEN_VGM",          label: "Token & VGM",         group: ChargeGroup.EXWORKS, qtyBasis: QtyBasis.SHIPMENT, order: 130, isDefault: true, isOptional: false },
    { code: "BAF",                label: "BAF",                group: ChargeGroup.EXWORKS, qtyBasis: QtyBasis.SHIPMENT, order: 140, isDefault: true, isOptional: false },
    { code: "CAF",                label: "CAF",                group: ChargeGroup.EXWORKS, qtyBasis: QtyBasis.SHIPMENT, order: 150, isDefault: true, isOptional: false },
    { code: "BUNKER_ADJUSTMENT",  label: "Bunker Adjustment",  group: ChargeGroup.EXWORKS, qtyBasis: QtyBasis.SHIPMENT, order: 160, isDefault: true, isOptional: false },
    { code: "WAR_RISK",           label: "War Risk",           group: ChargeGroup.EXWORKS, qtyBasis: QtyBasis.SHIPMENT, order: 170, isDefault: true, isOptional: false },
    { code: "DPC",                label: "DPC",                group: ChargeGroup.EXWORKS, qtyBasis: QtyBasis.SHIPMENT, order: 180, isDefault: true, isOptional: false },
    { code: "HS_CODE",            label: "HS Code",            group: ChargeGroup.EXWORKS, qtyBasis: QtyBasis.SHIPMENT, order: 190, isDefault: true, isOptional: false },
    { code: "DOCUMENTATION",      label: "Documentation",      group: ChargeGroup.EXWORKS, qtyBasis: QtyBasis.SHIPMENT, order: 200, isDefault: true, isOptional: false },
    { code: "SEAL_CHARGE",        label: "Seal Charge",        group: ChargeGroup.EXWORKS, qtyBasis: QtyBasis.SHIPMENT, order: 210, isDefault: true, isOptional: false },
    { code: "EXIT_ENTRY",         label: "Exit / Entry",       group: ChargeGroup.EXWORKS, qtyBasis: QtyBasis.SHIPMENT, order: 220, isDefault: true, isOptional: false },
    { code: "CUSTOM_INSPECTION",  label: "Custom Inspection",  group: ChargeGroup.EXWORKS, qtyBasis: QtyBasis.SHIPMENT, order: 230, isDefault: true, isOptional: false },
    { code: "TRANSPORTATION",     label: "Transportation",     group: ChargeGroup.EXWORKS, qtyBasis: QtyBasis.SHIPMENT, order: 240, isDefault: true, isOptional: false },
    { code: "VAT_INSPECTION",     label: "VAT Inspection",     group: ChargeGroup.EXWORKS, qtyBasis: QtyBasis.SHIPMENT, order: 250, isDefault: true, isOptional: false },
    { code: "HANDLING_SERVICE",   label: "Handling Service",   group: ChargeGroup.EXWORKS, qtyBasis: QtyBasis.SHIPMENT, order: 260, isDefault: true, isOptional: false },

    // =========================
    // Optional add-ons (ops selects if needed)
    // =========================
    { code: "PROFIT_SHARE",           label: "Profit Share",                group: ChargeGroup.EXWORKS, qtyBasis: QtyBasis.SHIPMENT, order: 310, isDefault: false, isOptional: true },
    { code: "TELEX_BILL",             label: "Telex Bill",                  group: ChargeGroup.EXWORKS, qtyBasis: QtyBasis.SHIPMENT, order: 320, isDefault: false, isOptional: true },
    { code: "INSURANCE",              label: "Insurance",                   group: ChargeGroup.EXWORKS, qtyBasis: QtyBasis.SHIPMENT, order: 330, isDefault: false, isOptional: true },
    { code: "PORT_STORAGE",           label: "Port Storage",                group: ChargeGroup.EXWORKS, qtyBasis: QtyBasis.SHIPMENT, order: 340, isDefault: false, isOptional: true },
    { code: "LOAD_LASHING",           label: "Load & Lashing Charges",      group: ChargeGroup.EXWORKS, qtyBasis: QtyBasis.SHIPMENT, order: 350, isDefault: false, isOptional: true },
    { code: "THIRD_PARTY_LICENSE",    label: "Third Party License",         group: ChargeGroup.EXWORKS, qtyBasis: QtyBasis.SHIPMENT, order: 360, isDefault: false, isOptional: true },
    { code: "CANCELLATION_CHARGES",   label: "Cancellation Charges",        group: ChargeGroup.EXWORKS, qtyBasis: QtyBasis.SHIPMENT, order: 370, isDefault: false, isOptional: true },
    { code: "PACKING_CHARGES",        label: "Packing Charges",             group: ChargeGroup.EXWORKS, qtyBasis: QtyBasis.SHIPMENT, order: 380, isDefault: false, isOptional: true },
    { code: "DEMURRAGE",              label: "Demurrage",                   group: ChargeGroup.EXWORKS, qtyBasis: QtyBasis.SHIPMENT, order: 390, isDefault: false, isOptional: true },
    { code: "CONTAINER_SHIFTING",     label: "Container Shifting Charges",  group: ChargeGroup.EXWORKS, qtyBasis: QtyBasis.SHIPMENT, order: 400, isDefault: false, isOptional: true },
    { code: "CROSS_STUFFING",         label: "Cross Stuffing",              group: ChargeGroup.EXWORKS, qtyBasis: QtyBasis.SHIPMENT, order: 410, isDefault: false, isOptional: true },
    { code: "STUFFING_CHARGES",       label: "Stuffing Charges",            group: ChargeGroup.EXWORKS, qtyBasis: QtyBasis.SHIPMENT, order: 420, isDefault: false, isOptional: true },
    { code: "SWB_CHARGES",            label: "SWB Charges",                 group: ChargeGroup.EXWORKS, qtyBasis: QtyBasis.SHIPMENT, order: 430, isDefault: false, isOptional: true },
    { code: "RTA",                    label: "RTA",                         group: ChargeGroup.EXWORKS, qtyBasis: QtyBasis.SHIPMENT, order: 440, isDefault: false, isOptional: true },
    { code: "MISCELLANEOUS",          label: "Miscellaneous",               group: ChargeGroup.EXWORKS, qtyBasis: QtyBasis.SHIPMENT, order: 450, isDefault: false, isOptional: true },

    // DG / IMCO optional
    { code: "DG_LABEL",               label: "DG Label",                    group: ChargeGroup.EXWORKS, qtyBasis: QtyBasis.SHIPMENT, order: 510, isDefault: false, isOptional: true },
    { code: "IMCO_CHARGES",           label: "IMCO Charges",                group: ChargeGroup.EXWORKS, qtyBasis: QtyBasis.SHIPMENT, order: 520, isDefault: false, isOptional: true },

    // Discounts / Round off (optional)
    { code: "LESS_DISCOUNTS",         label: "Less Discounts",              group: ChargeGroup.EXWORKS, qtyBasis: QtyBasis.SHIPMENT, order: 900, isDefault: false, isOptional: true, isDiscount: true, canBeNegative: true },
    { code: "ROUND_OFF",              label: "Round off",                   group: ChargeGroup.EXWORKS, qtyBasis: QtyBasis.SHIPMENT, order: 910, isDefault: false, isOptional: true, canBeNegative: true },
  ].map((l) => ({
    ...l,
    templateId: template.id,
    isDefault: l.isDefault ?? false,
    isOptional: l.isOptional ?? true,
    isLabelling: (l as any).isLabelling ?? false,
    isDiscount: (l as any).isDiscount ?? false,
    canBeNegative: (l as any).canBeNegative ?? false,
  }));

  for (const line of lines) {
    await prisma.pricingTemplateLine.upsert({
      where: { templateId_code: { templateId: template.id, code: line.code } },
      update: { ...line },
      create: { ...line },
    });
  }

  console.log("✅ Seeded SEA_EXPORT_FREEZONE_20FT (defaults + selectable add-ons)");
}

async function seedSeaExportFreezone40ft(prisma: PrismaClient) {
  const code = PricingTemplateCode.SEA_EXPORT_FREEZONE_40FT;

  const template = await prisma.pricingTemplate.upsert({
    where: { code },
    update: {
      name: "Sea Freezone Export (40FT)",
      mode: ShipmentMode.SEA,
      direction: PricingDirection.EXPORT,
    },
    create: {
      mode: ShipmentMode.SEA,
      direction: PricingDirection.EXPORT,
      code,
      name: "Sea Freezone Export (40FT)",
    },
  });

  const lines = [
    { code: "OCEAN_FREIGHT", label: "Ocean Freight", group: ChargeGroup.MAIN, qtyBasis: QtyBasis.CONTAINER, order: 10, isDefault: true, isOptional: false },
    { code: "THC",          label: "THC",          group: ChargeGroup.MAIN, qtyBasis: QtyBasis.CONTAINER, order: 20, isDefault: true, isOptional: false },

    { code: "CUSTOMS_BOE",        label: "Customs BOE",        group: ChargeGroup.EXWORKS, qtyBasis: QtyBasis.SHIPMENT, order: 110, isDefault: true, isOptional: false },
    { code: "BL",                 label: "BL",                 group: ChargeGroup.EXWORKS, qtyBasis: QtyBasis.SHIPMENT, order: 120, isDefault: true, isOptional: false },
    { code: "TOKEN_VGM",          label: "Token & VGM",         group: ChargeGroup.EXWORKS, qtyBasis: QtyBasis.SHIPMENT, order: 130, isDefault: true, isOptional: false },
    { code: "BAF",                label: "BAF",                group: ChargeGroup.EXWORKS, qtyBasis: QtyBasis.SHIPMENT, order: 140, isDefault: true, isOptional: false },
    { code: "CAF",                label: "CAF",                group: ChargeGroup.EXWORKS, qtyBasis: QtyBasis.SHIPMENT, order: 150, isDefault: true, isOptional: false },
    { code: "BUNKER_ADJUSTMENT",  label: "Bunker Adjustment",  group: ChargeGroup.EXWORKS, qtyBasis: QtyBasis.SHIPMENT, order: 160, isDefault: true, isOptional: false },
    { code: "WAR_RISK",           label: "War Risk",           group: ChargeGroup.EXWORKS, qtyBasis: QtyBasis.SHIPMENT, order: 170, isDefault: true, isOptional: false },
    { code: "DPC",                label: "DPC",                group: ChargeGroup.EXWORKS, qtyBasis: QtyBasis.SHIPMENT, order: 180, isDefault: true, isOptional: false },
    { code: "HS_CODE",            label: "HS Code",            group: ChargeGroup.EXWORKS, qtyBasis: QtyBasis.SHIPMENT, order: 190, isDefault: true, isOptional: false },
    { code: "DOCUMENTATION",      label: "Documentation",      group: ChargeGroup.EXWORKS, qtyBasis: QtyBasis.SHIPMENT, order: 200, isDefault: true, isOptional: false },
    { code: "SEAL_CHARGE",        label: "Seal Charge",        group: ChargeGroup.EXWORKS, qtyBasis: QtyBasis.SHIPMENT, order: 210, isDefault: true, isOptional: false },
    { code: "EXIT_ENTRY",         label: "Exit / Entry",       group: ChargeGroup.EXWORKS, qtyBasis: QtyBasis.SHIPMENT, order: 220, isDefault: true, isOptional: false },
    { code: "CUSTOM_INSPECTION",  label: "Custom Inspection",  group: ChargeGroup.EXWORKS, qtyBasis: QtyBasis.SHIPMENT, order: 230, isDefault: true, isOptional: false },
    { code: "TRANSPORTATION",     label: "Transportation",     group: ChargeGroup.EXWORKS, qtyBasis: QtyBasis.SHIPMENT, order: 240, isDefault: true, isOptional: false },
    { code: "VAT_INSPECTION",     label: "VAT Inspection",     group: ChargeGroup.EXWORKS, qtyBasis: QtyBasis.SHIPMENT, order: 250, isDefault: true, isOptional: false },
    { code: "HANDLING_SERVICE",   label: "Handling Service",   group: ChargeGroup.EXWORKS, qtyBasis: QtyBasis.SHIPMENT, order: 260, isDefault: true, isOptional: false },

    { code: "PROFIT_SHARE",           label: "Profit Share",                group: ChargeGroup.EXWORKS, qtyBasis: QtyBasis.SHIPMENT, order: 310, isDefault: false, isOptional: true },
    { code: "TELEX_BILL",             label: "Telex Bill",                  group: ChargeGroup.EXWORKS, qtyBasis: QtyBasis.SHIPMENT, order: 320, isDefault: false, isOptional: true },
    { code: "INSURANCE",              label: "Insurance",                   group: ChargeGroup.EXWORKS, qtyBasis: QtyBasis.SHIPMENT, order: 330, isDefault: false, isOptional: true },
    { code: "PORT_STORAGE",           label: "Port Storage",                group: ChargeGroup.EXWORKS, qtyBasis: QtyBasis.SHIPMENT, order: 340, isDefault: false, isOptional: true },
    { code: "LOAD_LASHING",           label: "Load & Lashing Charges",      group: ChargeGroup.EXWORKS, qtyBasis: QtyBasis.SHIPMENT, order: 350, isDefault: false, isOptional: true },
    { code: "THIRD_PARTY_LICENSE",    label: "Third Party License",         group: ChargeGroup.EXWORKS, qtyBasis: QtyBasis.SHIPMENT, order: 360, isDefault: false, isOptional: true },
    { code: "CANCELLATION_CHARGES",   label: "Cancellation Charges",        group: ChargeGroup.EXWORKS, qtyBasis: QtyBasis.SHIPMENT, order: 370, isDefault: false, isOptional: true },
    { code: "PACKING_CHARGES",        label: "Packing Charges",             group: ChargeGroup.EXWORKS, qtyBasis: QtyBasis.SHIPMENT, order: 380, isDefault: false, isOptional: true },
    { code: "DEMURRAGE",              label: "Demurrage",                   group: ChargeGroup.EXWORKS, qtyBasis: QtyBasis.SHIPMENT, order: 390, isDefault: false, isOptional: true },
    { code: "CONTAINER_SHIFTING",     label: "Container Shifting Charges",  group: ChargeGroup.EXWORKS, qtyBasis: QtyBasis.SHIPMENT, order: 400, isDefault: false, isOptional: true },
    { code: "CROSS_STUFFING",         label: "Cross Stuffing",              group: ChargeGroup.EXWORKS, qtyBasis: QtyBasis.SHIPMENT, order: 410, isDefault: false, isOptional: true },
    { code: "STUFFING_CHARGES",       label: "Stuffing Charges",            group: ChargeGroup.EXWORKS, qtyBasis: QtyBasis.SHIPMENT, order: 420, isDefault: false, isOptional: true },
    { code: "SWB_CHARGES",            label: "SWB Charges",                 group: ChargeGroup.EXWORKS, qtyBasis: QtyBasis.SHIPMENT, order: 430, isDefault: false, isOptional: true },
    { code: "RTA",                    label: "RTA",                         group: ChargeGroup.EXWORKS, qtyBasis: QtyBasis.SHIPMENT, order: 440, isDefault: false, isOptional: true },
    { code: "MISCELLANEOUS",          label: "Miscellaneous",               group: ChargeGroup.EXWORKS, qtyBasis: QtyBasis.SHIPMENT, order: 450, isDefault: false, isOptional: true },

    { code: "DG_LABEL",               label: "DG Label",                    group: ChargeGroup.EXWORKS, qtyBasis: QtyBasis.SHIPMENT, order: 510, isDefault: false, isOptional: true },
    { code: "IMCO_CHARGES",           label: "IMCO Charges",                group: ChargeGroup.EXWORKS, qtyBasis: QtyBasis.SHIPMENT, order: 520, isDefault: false, isOptional: true },

    { code: "LESS_DISCOUNTS",         label: "Less Discounts",              group: ChargeGroup.EXWORKS, qtyBasis: QtyBasis.SHIPMENT, order: 900, isDefault: false, isOptional: true, isDiscount: true, canBeNegative: true },
    { code: "ROUND_OFF",              label: "Round off",                   group: ChargeGroup.EXWORKS, qtyBasis: QtyBasis.SHIPMENT, order: 910, isDefault: false, isOptional: true, canBeNegative: true },
  ].map((l) => ({
    ...l,
    templateId: template.id,
    isDefault: l.isDefault ?? false,
    isOptional: l.isOptional ?? true,
    isLabelling: (l as any).isLabelling ?? false,
    isDiscount: (l as any).isDiscount ?? false,
    canBeNegative: (l as any).canBeNegative ?? false,
  }));

  for (const line of lines) {
    await prisma.pricingTemplateLine.upsert({
      where: { templateId_code: { templateId: template.id, code: line.code } },
      update: { ...line },
      create: { ...line },
    });
  }

  console.log("✅ Seeded SEA_EXPORT_FREEZONE_40FT (defaults + selectable add-ons)");
}

async function seedSeaExportLocal(prisma: PrismaClient) {
  const code = PricingTemplateCode.SEA_EXPORT_LOCAL;

  const template = await prisma.pricingTemplate.upsert({
    where: { code },
    update: { name: "Local Sea Export", mode: ShipmentMode.SEA, direction: PricingDirection.EXPORT },
    create: { code, name: "Local Sea Export", mode: ShipmentMode.SEA, direction: PricingDirection.EXPORT },
  });

  const lines = [
    // MAIN (customer sees these)
    { code: "OCEAN_FREIGHT", label: "Ocean Freight", group: ChargeGroup.MAIN, qtyBasis: QtyBasis.CONTAINER, order: 10, isDefault: true, isOptional: false },
    { code: "THC",          label: "THC",          group: ChargeGroup.MAIN, qtyBasis: QtyBasis.CONTAINER, order: 20, isDefault: true, isOptional: false },

    // EXWORKS default bundle core (you can keep more defaults if you want)
    { code: "CUSTOMS_BOE", label: "Customs BOE", group: ChargeGroup.EXWORKS, qtyBasis: QtyBasis.SHIPMENT, order: 110, isDefault: true, isOptional: false },
    { code: "BL",          label: "BL",          group: ChargeGroup.EXWORKS, qtyBasis: QtyBasis.SHIPMENT, order: 120, isDefault: true, isOptional: false },
    { code: "TOKEN_VGM",   label: "Token & VGM", group: ChargeGroup.EXWORKS, qtyBasis: QtyBasis.SHIPMENT, order: 130, isDefault: true, isOptional: false },
    { code: "DOCUMENTATION", label: "Documentation", group: ChargeGroup.EXWORKS, qtyBasis: QtyBasis.SHIPMENT, order: 140, isDefault: true, isOptional: false },
    { code: "SEAL_CHARGE",   label: "Seal Charge",   group: ChargeGroup.EXWORKS, qtyBasis: QtyBasis.SHIPMENT, order: 150, isDefault: true, isOptional: false },
    { code: "TRANSPORTATION",label: "Transportation",group: ChargeGroup.EXWORKS, qtyBasis: QtyBasis.SHIPMENT, order: 160, isDefault: true, isOptional: false },
    { code: "HANDLING_SERVICE", label: "Handling & Service", group: ChargeGroup.EXWORKS, qtyBasis: QtyBasis.SHIPMENT, order: 170, isDefault: true, isOptional: false },

    // Optional add-ons (keep your long list here as optional)
    { code: "LESS_DISCOUNTS", label: "Less Discounts", group: ChargeGroup.EXWORKS, qtyBasis: QtyBasis.SHIPMENT, order: 900, isDefault: false, isOptional: true, isDiscount: true, canBeNegative: true },
    { code: "ROUND_OFF",      label: "Round off",      group: ChargeGroup.EXWORKS, qtyBasis: QtyBasis.SHIPMENT, order: 910, isDefault: false, isOptional: true, canBeNegative: true },
  ].map((l) => ({
    ...l,
    templateId: template.id,
    isDefault: l.isDefault ?? false,
    isOptional: l.isOptional ?? true,
    isLabelling: (l as any).isLabelling ?? false,
    isDiscount: (l as any).isDiscount ?? false,
    canBeNegative: (l as any).canBeNegative ?? false,
  }));

  for (const line of lines) {
    await prisma.pricingTemplateLine.upsert({
      where: { templateId_code: { templateId: template.id, code: line.code } },
      update: { ...line },
      create: { ...line },
    });
  }

  console.log("✅ Seeded SEA_EXPORT_LOCAL (single template)");
}

async function seedSeaExportFreezone(prisma: PrismaClient) {
  const code = PricingTemplateCode.SEA_EXPORT_FREEZONE;

  const template = await prisma.pricingTemplate.upsert({
    where: { code },
    update: { name: "Sea Freezone Export", mode: ShipmentMode.SEA, direction: PricingDirection.EXPORT },
    create: { code, name: "Sea Freezone Export", mode: ShipmentMode.SEA, direction: PricingDirection.EXPORT },
  });

  const lines = [
    // MAIN
    { code: "OCEAN_FREIGHT", label: "Ocean Freight", group: ChargeGroup.MAIN, qtyBasis: QtyBasis.CONTAINER, order: 10, isDefault: true, isOptional: false },
    { code: "THC",          label: "THC",          group: ChargeGroup.MAIN, qtyBasis: QtyBasis.CONTAINER, order: 20, isDefault: true, isOptional: false },

    // EXWORKS defaults specific to freezone (core)
    { code: "CUSTOMS_BOE",       label: "Customs BOE",       group: ChargeGroup.EXWORKS, qtyBasis: QtyBasis.SHIPMENT, order: 110, isDefault: true, isOptional: false },
    { code: "EXIT_ENTRY",        label: "Exit / Entry",      group: ChargeGroup.EXWORKS, qtyBasis: QtyBasis.SHIPMENT, order: 120, isDefault: true, isOptional: false },
    { code: "CUSTOM_INSPECTION", label: "Custom Inspection", group: ChargeGroup.EXWORKS, qtyBasis: QtyBasis.SHIPMENT, order: 130, isDefault: true, isOptional: false },
    { code: "TRANSPORTATION",    label: "Transportation",    group: ChargeGroup.EXWORKS, qtyBasis: QtyBasis.SHIPMENT, order: 140, isDefault: true, isOptional: false },
    { code: "VAT_INSPECTION",    label: "VAT Inspection",    group: ChargeGroup.EXWORKS, qtyBasis: QtyBasis.SHIPMENT, order: 150, isDefault: true, isOptional: false },
    { code: "HANDLING_SERVICE",  label: "Handling Service",  group: ChargeGroup.EXWORKS, qtyBasis: QtyBasis.SHIPMENT, order: 160, isDefault: true, isOptional: false },
    { code: "BL",                label: "BL",                group: ChargeGroup.EXWORKS, qtyBasis: QtyBasis.SHIPMENT, order: 170, isDefault: true, isOptional: false },
    { code: "TOKEN_VGM",         label: "Token & VGM",        group: ChargeGroup.EXWORKS, qtyBasis: QtyBasis.SHIPMENT, order: 180, isDefault: true, isOptional: false },
    { code: "DOCUMENTATION",     label: "Documentation",     group: ChargeGroup.EXWORKS, qtyBasis: QtyBasis.SHIPMENT, order: 190, isDefault: true, isOptional: false },
    { code: "SEAL_CHARGE",       label: "Seal Charge",       group: ChargeGroup.EXWORKS, qtyBasis: QtyBasis.SHIPMENT, order: 200, isDefault: true, isOptional: false },

    // Optional list continues...
    { code: "LESS_DISCOUNTS", label: "Less Discounts", group: ChargeGroup.EXWORKS, qtyBasis: QtyBasis.SHIPMENT, order: 900, isDefault: false, isOptional: true, isDiscount: true, canBeNegative: true },
    { code: "ROUND_OFF",      label: "Round off",      group: ChargeGroup.EXWORKS, qtyBasis: QtyBasis.SHIPMENT, order: 910, isDefault: false, isOptional: true, canBeNegative: true },
  ].map((l) => ({
    ...l,
    templateId: template.id,
    isDefault: l.isDefault ?? false,
    isOptional: l.isOptional ?? true,
    isLabelling: (l as any).isLabelling ?? false,
    isDiscount: (l as any).isDiscount ?? false,
    canBeNegative: (l as any).canBeNegative ?? false,
  }));

  for (const line of lines) {
    await prisma.pricingTemplateLine.upsert({
      where: { templateId_code: { templateId: template.id, code: line.code } },
      update: { ...line },
      create: { ...line },
    });
  }

  console.log("✅ Seeded SEA_EXPORT_FREEZONE (single template)");
}
async function seedSeaExportTransit(prisma: PrismaClient) {
  const code = PricingTemplateCode.SEA_EXPORT_TRANSIT;

  const template = await prisma.pricingTemplate.upsert({
    where: { code },
    update: {
      name: "Sea Transit Export",
      mode: ShipmentMode.SEA,
      direction: PricingDirection.EXPORT,
    },
    create: {
      code,
      name: "Sea Transit Export",
      mode: ShipmentMode.SEA,
      direction: PricingDirection.EXPORT,
    },
  });

  const lines = [
    // =========================
    // IMPORT section (customer sees)
    // =========================
    { code: "DELIVERY_ORDER", label: "Delivery Order", group: ChargeGroup.IMPORT_CLEARANCE, qtyBasis: QtyBasis.SHIPMENT, order: 10, isDefault: true, isOptional: false },
    { code: "THC_IN",         label: "THC IN",        group: ChargeGroup.IMPORT_CLEARANCE, qtyBasis: QtyBasis.CONTAINER, order: 20, isDefault: true, isOptional: false },

    // =========================
    // EXPORT section (customer sees)
    // =========================
    { code: "OCEAN_FREIGHT", label: "Ocean Freight", group: ChargeGroup.EXPORT_CLEARANCE, qtyBasis: QtyBasis.CONTAINER, order: 30, isDefault: true, isOptional: false },
    { code: "THC_OUT",       label: "THC OUT",      group: ChargeGroup.EXPORT_CLEARANCE, qtyBasis: QtyBasis.CONTAINER, order: 40, isDefault: true, isOptional: false },

    // =========================
    // EXWORKS bundle (rest fields) — default core
    // =========================
    { code: "CUSTOMS_BOE", label: "Customs BOE", group: ChargeGroup.EXWORKS, qtyBasis: QtyBasis.SHIPMENT, order: 110, isDefault: true, isOptional: false },
    { code: "BL",          label: "BL",          group: ChargeGroup.EXWORKS, qtyBasis: QtyBasis.SHIPMENT, order: 120, isDefault: true, isOptional: false },
    { code: "TOKEN_VGM",   label: "Token & VGM", group: ChargeGroup.EXWORKS, qtyBasis: QtyBasis.SHIPMENT, order: 130, isDefault: true, isOptional: false },

    { code: "BAF",         label: "BAF",         group: ChargeGroup.EXWORKS, qtyBasis: QtyBasis.SHIPMENT, order: 140, isDefault: true, isOptional: false },
    { code: "CAF",         label: "CAF",         group: ChargeGroup.EXWORKS, qtyBasis: QtyBasis.SHIPMENT, order: 150, isDefault: true, isOptional: false },
    { code: "BUNKER_ADJ",  label: "Bunker Adjustment", group: ChargeGroup.EXWORKS, qtyBasis: QtyBasis.SHIPMENT, order: 160, isDefault: true, isOptional: false },
    { code: "WAR_RISK",    label: "War Risk",    group: ChargeGroup.EXWORKS, qtyBasis: QtyBasis.SHIPMENT, order: 170, isDefault: true, isOptional: false },
    { code: "DPC",         label: "DPC",         group: ChargeGroup.EXWORKS, qtyBasis: QtyBasis.SHIPMENT, order: 180, isDefault: true, isOptional: false },

    { code: "HS_CODE",     label: "HS Code",     group: ChargeGroup.EXWORKS, qtyBasis: QtyBasis.SHIPMENT, order: 190, isDefault: true, isOptional: false },
    { code: "DOCUMENTATION", label: "Documentation", group: ChargeGroup.EXWORKS, qtyBasis: QtyBasis.SHIPMENT, order: 200, isDefault: true, isOptional: false },
    { code: "SEAL_CHARGE", label: "Seal Charge", group: ChargeGroup.EXWORKS, qtyBasis: QtyBasis.SHIPMENT, order: 210, isDefault: true, isOptional: false },

    { code: "EXIT_ENTRY",  label: "Exit / Entry", group: ChargeGroup.EXWORKS, qtyBasis: QtyBasis.SHIPMENT, order: 220, isDefault: true, isOptional: false },
    { code: "CUSTOM_INSPECTION", label: "Custom Inspection", group: ChargeGroup.EXWORKS, qtyBasis: QtyBasis.SHIPMENT, order: 230, isDefault: true, isOptional: false },
    { code: "TRANSPORTATION", label: "Transportation", group: ChargeGroup.EXWORKS, qtyBasis: QtyBasis.SHIPMENT, order: 240, isDefault: true, isOptional: false },
    { code: "HANDLING_SERVICE", label: "Handling Service", group: ChargeGroup.EXWORKS, qtyBasis: QtyBasis.SHIPMENT, order: 250, isDefault: true, isOptional: false },

    // Transit-specific items you listed
    { code: "CROSS_STUFFING", label: "Cross Stuffing", group: ChargeGroup.EXWORKS, qtyBasis: QtyBasis.SHIPMENT, order: 260, isDefault: true, isOptional: false },
    { code: "FUMIGATION", label: "Fumigation", group: ChargeGroup.EXWORKS, qtyBasis: QtyBasis.SHIPMENT, order: 270, isDefault: true, isOptional: false },
    { code: "LOAD_LASHING", label: "Load & Lashing Charges", group: ChargeGroup.EXWORKS, qtyBasis: QtyBasis.SHIPMENT, order: 280, isDefault: true, isOptional: false },
    { code: "PORT_STORAGE", label: "Port Storage", group: ChargeGroup.EXWORKS, qtyBasis: QtyBasis.SHIPMENT, order: 290, isDefault: true, isOptional: false },
    { code: "PHYTO_CERT", label: "Phyto Certification", group: ChargeGroup.EXWORKS, qtyBasis: QtyBasis.SHIPMENT, order: 300, isDefault: true, isOptional: false },
    { code: "MECRC", label: "MECRC Charges", group: ChargeGroup.EXWORKS, qtyBasis: QtyBasis.SHIPMENT, order: 310, isDefault: true, isOptional: false },
    { code: "DPW_OFFLOADING", label: "DP World Off-loading charges", group: ChargeGroup.EXWORKS, qtyBasis: QtyBasis.SHIPMENT, order: 320, isDefault: true, isOptional: false },
    { code: "TRANSPORT_WAITING", label: "Transportation waiting charges", group: ChargeGroup.EXWORKS, qtyBasis: QtyBasis.SHIPMENT, order: 330, isDefault: true, isOptional: false },
    { code: "TLUC", label: "TLUC", group: ChargeGroup.EXWORKS, qtyBasis: QtyBasis.SHIPMENT, order: 340, isDefault: true, isOptional: false },
    { code: "DEMURRAGE", label: "Demurrage", group: ChargeGroup.EXWORKS, qtyBasis: QtyBasis.SHIPMENT, order: 350, isDefault: true, isOptional: false },

    // Optional discounts / rounding (selectable)
    { code: "LESS_DISCOUNTS", label: "Less Discounts", group: ChargeGroup.EXWORKS, qtyBasis: QtyBasis.SHIPMENT, order: 900, isDefault: false, isOptional: true, isDiscount: true, canBeNegative: true },
    { code: "ROUND_OFF",      label: "Round off",      group: ChargeGroup.EXWORKS, qtyBasis: QtyBasis.SHIPMENT, order: 910, isDefault: false, isOptional: true, canBeNegative: true },
  ].map((l) => ({
    ...l,
    templateId: template.id,
    isDefault: l.isDefault ?? false,
    isOptional: l.isOptional ?? true,
    isLabelling: (l as any).isLabelling ?? false,
    isDiscount: (l as any).isDiscount ?? false,
    canBeNegative: (l as any).canBeNegative ?? false,
  }));

  for (const line of lines) {
    await prisma.pricingTemplateLine.upsert({
      where: { templateId_code: { templateId: template.id, code: line.code } },
      update: { ...line },
      create: { ...line },
    });
  }

  console.log("✅ Seeded SEA_EXPORT_TRANSIT (single template, blocks)");
}

async function seedSeaExportLCL(prisma: PrismaClient) {
  const code = PricingTemplateCode.SEA_EXPORT_LCL;

  const template = await prisma.pricingTemplate.upsert({
    where: { code },
    update: {
      name: "Sea Export – LCL",
      mode: ShipmentMode.SEA,
      direction: PricingDirection.EXPORT,
    },
    create: {
      code,
      name: "Sea Export – LCL",
      mode: ShipmentMode.SEA,
      direction: PricingDirection.EXPORT,
    },
  });

  const lines = [
    // MAIN (customer sees)
    { code: "OCEAN_FREIGHT", label: "Ocean Freight", group: ChargeGroup.MAIN, qtyBasis: QtyBasis.CBM, order: 10, isDefault: true, isOptional: false },

    // EXWORKS (bundle)
    { code: "BL", label: "BL", group: ChargeGroup.EXWORKS, qtyBasis: QtyBasis.SHIPMENT, order: 110, isDefault: true, isOptional: false },
    { code: "CUSTOMS_BOE", label: "Customs BOE", group: ChargeGroup.EXWORKS, qtyBasis: QtyBasis.SHIPMENT, order: 120, isDefault: true, isOptional: false },
    { code: "DP_WORLD_CHARGES", label: "DP World Charges", group: ChargeGroup.EXWORKS, qtyBasis: QtyBasis.SHIPMENT, order: 130, isDefault: true, isOptional: false },
    { code: "TRANSPORT", label: "Transport", group: ChargeGroup.EXWORKS, qtyBasis: QtyBasis.SHIPMENT, order: 140, isDefault: true, isOptional: false },
    { code: "WASHING_CHARGES", label: "Washing charges", group: ChargeGroup.EXWORKS, qtyBasis: QtyBasis.SHIPMENT, order: 150, isDefault: true, isOptional: false },
    { code: "HS_CODE", label: "HS Code", group: ChargeGroup.EXWORKS, qtyBasis: QtyBasis.SHIPMENT, order: 160, isDefault: true, isOptional: false },
    { code: "HANDLING_SERVICES", label: "Handling & Services", group: ChargeGroup.EXWORKS, qtyBasis: QtyBasis.SHIPMENT, order: 170, isDefault: true, isOptional: false },
    { code: "INSPECTION", label: "Inspection", group: ChargeGroup.EXWORKS, qtyBasis: QtyBasis.SHIPMENT, order: 180, isDefault: true, isOptional: false },
    { code: "EXIT_ENTRY", label: "Exit Entry", group: ChargeGroup.EXWORKS, qtyBasis: QtyBasis.SHIPMENT, order: 190, isDefault: true, isOptional: false },
    { code: "CUSTOMS_DUTY", label: "Customs duty", group: ChargeGroup.EXWORKS, qtyBasis: QtyBasis.SHIPMENT, order: 200, isDefault: true, isOptional: false },
    { code: "THIRD_PARTY_LICENSE", label: "Third Party License", group: ChargeGroup.EXWORKS, qtyBasis: QtyBasis.SHIPMENT, order: 210, isDefault: true, isOptional: false },
    { code: "EXPORT_HANDLING", label: "Export Handling", group: ChargeGroup.EXWORKS, qtyBasis: QtyBasis.SHIPMENT, order: 220, isDefault: true, isOptional: false },
    { code: "LABOUR_PORTER", label: "Labor & Porter Charges", group: ChargeGroup.EXWORKS, qtyBasis: QtyBasis.SHIPMENT, order: 230, isDefault: true, isOptional: false },
    { code: "PACKING_CHARGES", label: "Packing Charges", group: ChargeGroup.EXWORKS, qtyBasis: QtyBasis.SHIPMENT, order: 240, isDefault: true, isOptional: false },
    { code: "MISCELLANEOUS", label: "Miscellaneous", group: ChargeGroup.EXWORKS, qtyBasis: QtyBasis.SHIPMENT, order: 250, isDefault: true, isOptional: false },

    { code: "LESS_DISCOUNTS", label: "Less Discounts", group: ChargeGroup.EXWORKS, qtyBasis: QtyBasis.SHIPMENT, order: 900, isDefault: true, isOptional: false, isDiscount: true, canBeNegative: true },
    { code: "ROUND_OFF", label: "Round off", group: ChargeGroup.EXWORKS, qtyBasis: QtyBasis.SHIPMENT, order: 910, isDefault: true, isOptional: false, canBeNegative: true },
  ].map((l) => ({
    ...l,
    templateId: template.id,
    isDefault: l.isDefault ?? false,
    isOptional: l.isOptional ?? true,
    isLabelling: false,
    isDiscount: (l as any).isDiscount ?? false,
    canBeNegative: (l as any).canBeNegative ?? false,
  }));

  for (const line of lines) {
    await prisma.pricingTemplateLine.upsert({
      where: { templateId_code: { templateId: template.id, code: line.code } },
      update: { ...line },
      create: { ...line },
    });
  }

  console.log("✅ Seeded SEA_EXPORT_LCL (upsert)");
}


async function seedSeaImportLocal(prisma: PrismaClient) {
  const code = PricingTemplateCode.SEA_IMPORT_LOCAL;

  const template = await prisma.pricingTemplate.upsert({
    where: { code },
    update: {
      name: "Sea Local Import",
      mode: ShipmentMode.SEA,
      direction: PricingDirection.IMPORT,
    },
    create: {
      code,
      name: "Sea Local Import",
      mode: ShipmentMode.SEA,
      direction: PricingDirection.IMPORT,
    },
  });

  const lines = [
    // =====================
    // MAIN (customer sees)
    // =====================
    { code: "DELIVERY_ORDER", label: "Delivery Order (DO)", group: ChargeGroup.MAIN, qtyBasis: QtyBasis.SHIPMENT, order: 10, isDefault: true, isOptional: false },
    { code: "THC",            label: "THC",                group: ChargeGroup.MAIN, qtyBasis: QtyBasis.CONTAINER, order: 20, isDefault: true, isOptional: false },

    // =====================
    // EXWORKS (bundle)
    // =====================
    { code: "TOKEN",              label: "Token",               group: ChargeGroup.EXWORKS, qtyBasis: QtyBasis.SHIPMENT, order: 110, isDefault: true, isOptional: false },
    { code: "TLUC",               label: "TLUC",                group: ChargeGroup.EXWORKS, qtyBasis: QtyBasis.SHIPMENT, order: 120, isDefault: true, isOptional: false },
    { code: "CUSTOMS_BOE",         label: "Customs BOE",         group: ChargeGroup.EXWORKS, qtyBasis: QtyBasis.SHIPMENT, order: 130, isDefault: true, isOptional: false },
    { code: "CUSTOMS_INSPECTION",  label: "Customs Inspection",  group: ChargeGroup.EXWORKS, qtyBasis: QtyBasis.SHIPMENT, order: 140, isDefault: true, isOptional: false },
    { code: "HS_CODE",             label: "HS Code",             group: ChargeGroup.EXWORKS, qtyBasis: QtyBasis.SHIPMENT, order: 150, isDefault: true, isOptional: false },
    { code: "DPC",                 label: "DPC",                 group: ChargeGroup.EXWORKS, qtyBasis: QtyBasis.SHIPMENT, order: 160, isDefault: true, isOptional: false },
    { code: "TRANSPORTATION",      label: "Transportation",      group: ChargeGroup.EXWORKS, qtyBasis: QtyBasis.SHIPMENT, order: 170, isDefault: true, isOptional: false },
    { code: "HANDLING_SERVICE",    label: "Handling Service",    group: ChargeGroup.EXWORKS, qtyBasis: QtyBasis.SHIPMENT, order: 180, isDefault: true, isOptional: false },
    { code: "BILL_OF_EXCHANGE",    label: "Bill of Exchange",    group: ChargeGroup.EXWORKS, qtyBasis: QtyBasis.SHIPMENT, order: 190, isDefault: true, isOptional: false },
    { code: "MECRC_CHARGES",       label: "Mecrc Charges",       group: ChargeGroup.EXWORKS, qtyBasis: QtyBasis.SHIPMENT, order: 200, isDefault: true, isOptional: false },
    { code: "VAT_INSPECTION",      label: "VAT Inspection",      group: ChargeGroup.EXWORKS, qtyBasis: QtyBasis.SHIPMENT, order: 210, isDefault: true, isOptional: false },
    { code: "DEMURRAGE",           label: "Demurrage",           group: ChargeGroup.EXWORKS, qtyBasis: QtyBasis.SHIPMENT, order: 220, isDefault: true, isOptional: false },
    { code: "PORT_STORAGE",        label: "Port Storage",        group: ChargeGroup.EXWORKS, qtyBasis: QtyBasis.SHIPMENT, order: 230, isDefault: true, isOptional: false },
    { code: "MISCELLANEOUS",       label: "Miscellaneous",       group: ChargeGroup.EXWORKS, qtyBasis: QtyBasis.SHIPMENT, order: 240, isDefault: true, isOptional: false },

    // Round off (allow negative)
    { code: "ROUND_OFF",           label: "Round off",           group: ChargeGroup.EXWORKS, qtyBasis: QtyBasis.SHIPMENT, order: 900, isDefault: true, isOptional: false, canBeNegative: true },
  ].map((l) => ({
    ...l,
    templateId: template.id,
    isDefault: l.isDefault ?? false,
    isOptional: l.isOptional ?? true,
    isLabelling: false,
    isDiscount: false,
    canBeNegative: (l as any).canBeNegative ?? false,
  }));

  for (const line of lines) {
    await prisma.pricingTemplateLine.upsert({
      where: { templateId_code: { templateId: template.id, code: line.code } },
      update: { ...line },
      create: { ...line },
    });
  }

  console.log("✅ Seeded SEA_IMPORT_LOCAL");
}
async function seedSeaImportLCL(prisma: PrismaClient) {
  const code = PricingTemplateCode.SEA_IMPORT_LCL;

  const template = await prisma.pricingTemplate.upsert({
    where: { code },
    update: {
      name: "Sea Import – LCL",
      mode: ShipmentMode.SEA,
      direction: PricingDirection.IMPORT,
    },
    create: {
      code,
      name: "Sea Import – LCL",
      mode: ShipmentMode.SEA,
      direction: PricingDirection.IMPORT,
    },
  });

  const lines = [
    // =====================
    // MAIN (customer sees DO)
    // =====================
    {
      code: "DELIVERY_ORDER",
      label: "Delivery Order (DO)",
      group: ChargeGroup.MAIN,
      qtyBasis: QtyBasis.SHIPMENT,
      order: 10,
      isDefault: true,
      isOptional: false,
    },

    // =====================
    // EXWORKS (bundle)
    // =====================
    { code: "DOCUMENTATION",        label: "Documentation",         group: ChargeGroup.EXWORKS, qtyBasis: QtyBasis.SHIPMENT, order: 110, isDefault: true, isOptional: false },
    { code: "CONTAINER_WASHING",    label: "Container washing",     group: ChargeGroup.EXWORKS, qtyBasis: QtyBasis.SHIPMENT, order: 120, isDefault: true, isOptional: false },
    { code: "PORT_HANDLING",        label: "Port Handling",         group: ChargeGroup.EXWORKS, qtyBasis: QtyBasis.SHIPMENT, order: 130, isDefault: true, isOptional: false },
    { code: "CARGO_TRANSFER_FEE",   label: "Cargo transfer fee",    group: ChargeGroup.EXWORKS, qtyBasis: QtyBasis.SHIPMENT, order: 140, isDefault: true, isOptional: false },
    { code: "WASHING_CHARGES",      label: "Washing charges",       group: ChargeGroup.EXWORKS, qtyBasis: QtyBasis.SHIPMENT, order: 150, isDefault: true, isOptional: false },
    { code: "HS_CODE",              label: "HS Code",               group: ChargeGroup.EXWORKS, qtyBasis: QtyBasis.SHIPMENT, order: 160, isDefault: true, isOptional: false },
    { code: "WAREHOUSING_CHARGES",  label: "Warehousing charges",   group: ChargeGroup.EXWORKS, qtyBasis: QtyBasis.SHIPMENT, order: 170, isDefault: true, isOptional: false },

    // ✅ CBM based line
    { code: "LCL_CHARGES_CBM",      label: "LCL Charges per CBM",   group: ChargeGroup.EXWORKS, qtyBasis: QtyBasis.CBM,      order: 180, isDefault: true, isOptional: false },

    { code: "HANDLING_SERVICES",    label: "Handling & Services",   group: ChargeGroup.EXWORKS, qtyBasis: QtyBasis.SHIPMENT, order: 190, isDefault: true, isOptional: false },
    { code: "CUSTOMS_BOE",          label: "Customs BOE",           group: ChargeGroup.EXWORKS, qtyBasis: QtyBasis.SHIPMENT, order: 200, isDefault: true, isOptional: false },
    { code: "TRANSPORT",            label: "Transport",             group: ChargeGroup.EXWORKS, qtyBasis: QtyBasis.SHIPMENT, order: 210, isDefault: true, isOptional: false },
    { code: "THIRD_PARTY_LICENSE",  label: "Third Party License",   group: ChargeGroup.EXWORKS, qtyBasis: QtyBasis.SHIPMENT, order: 220, isDefault: true, isOptional: false },
    { code: "DUTY",                 label: "Duty",                  group: ChargeGroup.EXWORKS, qtyBasis: QtyBasis.SHIPMENT, order: 230, isDefault: true, isOptional: false },
    { code: "VAT",                  label: "VAT",                   group: ChargeGroup.EXWORKS, qtyBasis: QtyBasis.SHIPMENT, order: 240, isDefault: true, isOptional: false },
    { code: "MISCELLANEOUS",        label: "Miscellaneous",         group: ChargeGroup.EXWORKS, qtyBasis: QtyBasis.SHIPMENT, order: 250, isDefault: true, isOptional: false },

    // discounts/rounding (allow negative)
    { code: "LESS_DISCOUNTS",       label: "Less Discounts",        group: ChargeGroup.EXWORKS, qtyBasis: QtyBasis.SHIPMENT, order: 900, isDefault: true, isOptional: false, isDiscount: true, canBeNegative: true },
    { code: "ROUND_OFF",            label: "Round off",             group: ChargeGroup.EXWORKS, qtyBasis: QtyBasis.SHIPMENT, order: 910, isDefault: true, isOptional: false, canBeNegative: true },
  ].map((l) => ({
    ...l,
    templateId: template.id,
    isDefault: l.isDefault ?? true,
    isOptional: l.isOptional ?? false,
    isLabelling: false,
    isDiscount: (l as any).isDiscount ?? false,
    canBeNegative: (l as any).canBeNegative ?? false,
  }));

  for (const line of lines) {
    await prisma.pricingTemplateLine.upsert({
      where: { templateId_code: { templateId: template.id, code: line.code } },
      update: { ...line },
      create: { ...line },
    });
  }

  console.log("✅ Seeded SEA_IMPORT_LCL (upsert)");
}
