import { QuotePricing, QuotePricingCharge, QuotePricingBlock } from "@prisma/client";
import { makeHiddenSet, nonZero, toNum } from "./helpers";

type Params = {
  pricingRow: QuotePricing & { charges: QuotePricingCharge[]; blocks: QuotePricingBlock[] };
  canSeeBreakdown: boolean;
  currency: string;
  too: { total: number; summary?: any; lines: any[] };
  hiddenBreakdownCodes?: string[];
};

export function buildSeaImportLocalView({
  pricingRow,
  canSeeBreakdown,
  currency,
  too,
  hiddenBreakdownCodes,
}: Params) {
  const hiddenSet = makeHiddenSet(hiddenBreakdownCodes);
  const isHidden = (code: string) => hiddenSet.has(String(code || "").trim());

  const charges = pricingRow.charges;
  const blocks = pricingRow.blocks;

  const containers = blocks.map((b) => ({
    containerType: b.containerType,
    containerQty: b.containerQty,
    isAddon: b.isAddon,
  }));

  const doCharge = charges.find((c) => c.code === "DELIVERY_ORDER");
  const doAmt = toNum(doCharge?.totalSell);

  const thcTotal = charges
    .filter((c) => c.code === "THC")
    .reduce((s, c) => s + toNum(c.totalSell), 0);

  const exworksLines = charges
    .filter((c) => (c.group as any) === "EXWORKS")
    .sort((a, b) => (a.order ?? 0) - (b.order ?? 0))
    .map((c) => ({ label: c.label, code: c.code, amount: toNum(c.totalSell) }))
    .filter(nonZero)
    .filter((x) => !isHidden(x.code));

  const exworksAmt = exworksLines.reduce((s, x) => s + x.amount, 0);
  const totalAmt = doAmt + thcTotal + exworksAmt;
  const grandTotal = totalAmt + toNum(too.total);

  const pricingDefault = {
    mode: pricingRow.templateCode,
    currency,
    containers,
    deliveryOrder: { amount: doAmt },
    thc: { amount: thcTotal },
    exworks: { amount: exworksAmt },
    transferOwnership: too.summary,
    total: { amount: totalAmt },
    grandTotal: { amount: grandTotal },
    exworksBreakdownIncluded: false as const,
  };

  if (!canSeeBreakdown) return pricingDefault;

  const thcLines = charges
    .filter((c) => c.code === "THC")
    .map((c) => ({ containerBlockId: c.blockId, code: c.code, amount: toNum(c.totalSell) }))
    .filter(nonZero)
    .filter((x) => !isHidden(x.code));

  return {
    ...pricingDefault,
    exworksBreakdownIncluded: true,
    transferOwnershipBreakdown: too.lines.length ? too.lines : undefined,
    breakdown: {
      deliveryOrder: { amount: doAmt },
      thcLines,
      exworksLines,
    },
  };
}

