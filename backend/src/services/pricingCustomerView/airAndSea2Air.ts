import {
  QuotePricing,
  QuotePricingCharge,
  QuotePricingBlock,
  ChargeGroup,
  PricingTemplateCode,
} from "@prisma/client";
import { fmt, makeHiddenSet, toNum, getThcCodesForAirTemplate } from "./helpers";

type Params = {
  pricingRow: (QuotePricing & { charges: QuotePricingCharge[]; blocks: QuotePricingBlock[] }) | null;
  canSeeBreakdown: boolean;
  currency: string;
  too: { total: number; summary?: any; lines: any[] };
  hiddenBreakdownCodes?: string[];
};

export function buildAirOrSea2AirView({
  pricingRow,
  canSeeBreakdown,
  currency,
  too,
  hiddenBreakdownCodes,
}: Params) {
  const hiddenSet = makeHiddenSet(hiddenBreakdownCodes);
  const isHidden = (code: string) => hiddenSet.has(String(code || "").trim());

  const charges = pricingRow?.charges ?? [];
  const templateCode = (pricingRow as any)?.templateCode as PricingTemplateCode | undefined;
  const thcConfig = getThcCodesForAirTemplate(templateCode);

  function perKgLine(charge: any | undefined) {
    if (!charge) return { amount: 0, calc: `0 ${currency}` };
    const rate = toNum(charge.sellRate);
    const qty = toNum(charge.qty);
    const amount = toNum(charge.totalSell);
    return {
      amount,
      calc: `${fmt(rate)} ${currency}/kg × ${fmt(qty)} kg = ${fmt(amount)}`,
    };
  }

  const airLine = perKgLine(charges.find((c) => c.code === "AIRFREIGHT"));

  // THC lines based on template
  let thcA = { amount: 0, calc: `0 ${currency}` };
  let thcB = { amount: 0, calc: `0 ${currency}` };

  if (thcConfig.mode === "SINGLE") {
    thcA = perKgLine(charges.find((c) => c.code === "THC"));
  }

  if (thcConfig.mode === "IMP_EXP") {
    thcA = perKgLine(charges.find((c) => c.code === "THC_IMPORT"));
    thcB = perKgLine(charges.find((c) => c.code === "THC_EXPORT"));
  }

  if (thcConfig.mode === "TRANSIT") {
    thcA = perKgLine(charges.find((c) => c.code === "THC_IN"));
    thcB = perKgLine(charges.find((c) => c.code === "THC_OUT"));
  }

  // Main total = air + all THC used
  const mainTotal = airLine.amount + thcA.amount + thcB.amount;

  const exworksCharges = charges.filter((c) => c.group === ChargeGroup.EXWORKS);
  const exworksTotal = exworksCharges.reduce((s, c) => s + toNum(c.totalSell), 0);

  const baseTotal = mainTotal + exworksTotal;
  const grandTotal = baseTotal + toNum(too.total);

  const pricingDefault: any = {
   airFreight: airLine,

   // Only expose the THC fields that match the template
   ...(thcConfig.mode === "SINGLE" ? { thc: thcA } : {}),
   ...(thcConfig.mode === "IMP_EXP" ? { thcImport: thcA, thcExport: thcB } : {}),
   ...(thcConfig.mode === "TRANSIT" ? { thcIn: thcA, thcOut: thcB } : {}),

   exworks: { amount: exworksTotal },
   transferOwnership: too.summary,
   total: { amount: baseTotal },
   grandTotal: { amount: grandTotal },
   exworksBreakdownIncluded: false as const,
  };

  if (!canSeeBreakdown) return pricingDefault;

  const importClearanceBreakdown: Record<string, number> = {};
  const exportClearanceBreakdown: Record<string, number> = {};

  for (const c of exworksCharges) {
    if (isHidden(c.code)) continue;
    const val = toNum(c.totalSell);
    if (val === 0) continue;

    if (c.code.startsWith("SEA2AIR_IMP_")) {
      importClearanceBreakdown[c.label] = (importClearanceBreakdown[c.label] ?? 0) + val;
    }
    if (c.code.startsWith("SEA2AIR_EXP_")) {
      exportClearanceBreakdown[c.label] = (exportClearanceBreakdown[c.label] ?? 0) + val;
    }
  }

  // clean zeros
  for (const k of Object.keys(importClearanceBreakdown)) if (importClearanceBreakdown[k] === 0) delete importClearanceBreakdown[k];
  for (const k of Object.keys(exportClearanceBreakdown)) if (exportClearanceBreakdown[k] === 0) delete exportClearanceBreakdown[k];

  return {
    ...pricingDefault,
    exworksBreakdownIncluded: true,
    transferOwnershipBreakdown: too.lines.length ? too.lines : undefined,
    importClearanceBreakdown,
    exportClearanceBreakdown,
  };
}

