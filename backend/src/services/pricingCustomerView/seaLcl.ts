import { QuotePricing, QuotePricingCharge, QuotePricingBlock } from "@prisma/client";
import { calcCompact, makeHiddenSet, nonZero, toNum } from "./helpers";

type Params = {
  pricingRow: QuotePricing & { charges: QuotePricingCharge[]; blocks: QuotePricingBlock[] };
  canSeeBreakdown: boolean;
  currency: string;
  too: { total: number; summary?: any; lines: any[] };
  hiddenBreakdownCodes?: string[];
};

export function buildSeaExportLclView({
  pricingRow,
  canSeeBreakdown,
  currency,
  too,
  hiddenBreakdownCodes,
}: Params) {
  const hiddenSet = makeHiddenSet(hiddenBreakdownCodes);
  const isHidden = (code: string) => hiddenSet.has(String(code || "").trim());

  const charges = pricingRow.charges;

  const ocean = charges.find((c) => c.code === "OCEAN_FREIGHT");
  const oceanRate = toNum(ocean?.sellRate);
  const oceanQty = toNum(ocean?.qty);
  const oceanAmt = toNum(ocean?.totalSell);

  const exworksCharges = charges.filter((c) => (c.group as any) === "EXWORKS");
  const exworksLines = exworksCharges
    .sort((a, b) => (a.order ?? 0) - (b.order ?? 0))
    .map((c) => ({ label: c.label, code: c.code, amount: toNum(c.totalSell) }))
    .filter(nonZero)
    .filter((x) => !isHidden(x.code));

  const exworksAmt = exworksLines.reduce((s, x) => s + x.amount, 0);
  const totalAmt = oceanAmt + exworksAmt;
  const grandTotal = totalAmt + toNum(too.total);

  const oceanLine = { amount: oceanAmt, calc: calcCompact(oceanRate, oceanQty, oceanAmt) };

  const pricingDefault = {
    mode: pricingRow.templateCode,
    currency,
    oceanFreight: oceanLine,
    exworks: { amount: exworksAmt },
    transferOwnership: too.summary,
    total: { amount: totalAmt },
    grandTotal: { amount: grandTotal },
    exworksBreakdownIncluded: false as const,
  };

  if (!canSeeBreakdown) return pricingDefault;

  return {
    ...pricingDefault,
    exworksBreakdownIncluded: true,
    transferOwnershipBreakdown: too.lines.length ? too.lines : undefined,
    oceanFreight: oceanLine,
    exworks: { amount: exworksAmt, lines: exworksLines },
  };
}

export function buildSeaImportLclView({
  pricingRow,
  canSeeBreakdown,
  currency,
  too,
  hiddenBreakdownCodes,
}: Params) {
  const hiddenSet = makeHiddenSet(hiddenBreakdownCodes);
  const isHidden = (code: string) => hiddenSet.has(String(code || "").trim());

  const charges = pricingRow.charges;

  const doLine = charges.find((c) => c.code === "DELIVERY_ORDER");
  const doAmt = toNum(doLine?.totalSell);

  const exworksCharges = charges.filter((c) => (c.group as any) === "EXWORKS");
  const exworksLines = exworksCharges
    .sort((a, b) => (a.order ?? 0) - (b.order ?? 0))
    .map((c) => ({
      label: c.label,
      code: c.code,
      amount: toNum(c.totalSell),
      calc:
        c.code === "LCL_CHARGES_CBM"
          ? calcCompact(toNum(c.sellRate), toNum(c.qty), toNum(c.totalSell))
          : undefined,
    }))
    .filter(nonZero)
    .filter((x) => !isHidden(x.code));

  const exworksAmt = exworksLines.reduce((s, x) => s + x.amount, 0);
  const totalAmt = doAmt + exworksAmt;
  const grandTotal = totalAmt + toNum(too.total);

  const pricingDefault = {
    mode: pricingRow.templateCode,
    currency,
    deliveryOrder: { amount: doAmt },
    exworks: { amount: exworksAmt },
    transferOwnership: too.summary,
    total: { amount: totalAmt },
    grandTotal: { amount: grandTotal },
    exworksBreakdownIncluded: false as const,
  };

  if (!canSeeBreakdown) return pricingDefault;

  return {
    ...pricingDefault,
    exworksBreakdownIncluded: true,
    transferOwnershipBreakdown: too.lines.length ? too.lines : undefined,
    breakdown: {
      deliveryOrder: { amount: doAmt },
      exworksLines,
    },
  };
}

