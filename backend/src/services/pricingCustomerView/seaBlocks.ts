import { QuotePricing, QuotePricingCharge, QuotePricingBlock } from "@prisma/client";
import { calcCompact, makeHiddenSet, nonZero, toNum } from "./helpers";

type Params = {
  pricingRow: QuotePricing & { charges: QuotePricingCharge[]; blocks: QuotePricingBlock[] };
  canSeeBreakdown: boolean;
  currency: string;
  too: { total: number; summary?: any; lines: any[] };
  hiddenBreakdownCodes?: string[];
};

export function buildSeaLocalFreezoneBlocksView({
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

  const blockSummaries = blocks.map((b) => {
    const bCharges = charges.filter((c) => c.blockId === b.id);

    const ocean = bCharges.find((c) => c.code === "OCEAN_FREIGHT");
    const thc = bCharges.find((c) => c.code === "THC");

    const oceanRate = toNum(ocean?.sellRate);
    const oceanQty = toNum(ocean?.qty);
    const oceanTotal = toNum(ocean?.totalSell);

    const thcRate = toNum(thc?.sellRate);
    const thcQty = toNum(thc?.qty);
    const thcTotal = toNum(thc?.totalSell);

    const exworksTotal = bCharges
      .filter((c) => (c.group as any) === "EXWORKS")
      .reduce((s, c) => s + toNum(c.totalSell), 0);

    const total = oceanTotal + thcTotal + exworksTotal;

    // Breakdown lines (hide zero + hide codes)
    const allLines = bCharges
      .sort((a, b) => (a.order ?? 0) - (b.order ?? 0))
      .map((c) => ({
        label: c.label,
        code: c.code,
        group: c.group,
        amount: toNum(c.totalSell),
      }))
      .filter(nonZero)
      .filter((x) => !isHidden(x.code));

    return {
      blockId: b.id,
      containerType: b.containerType,
      containerQty: b.containerQty,
      isAddon: b.isAddon,
      oceanFreight: { sellRate: oceanRate, qtyUsed: oceanQty, amount: oceanTotal, calc: calcCompact(oceanRate, oceanQty, oceanTotal) },
      thc: { sellRate: thcRate, qtyUsed: thcQty, amount: thcTotal, calc: calcCompact(thcRate, thcQty, thcTotal) },
      exworks: { amount: exworksTotal },
      total: { amount: total },
      _lines: allLines,
    };
  });

  const blocksTotal = blockSummaries.reduce((s, b) => s + toNum(b.total.amount), 0);
  const grandTotal = blocksTotal + toNum(too.total);

  const pricingDefault = {
    mode: pricingRow.templateCode,
    currency,
    containers,
    blocks: blockSummaries.map((b) => ({
      blockId: b.blockId,
      containerType: b.containerType,
      containerQty: b.containerQty,
      isAddon: b.isAddon,
      oceanFreight: b.oceanFreight,
      thc: b.thc,
      exworks: b.exworks,
      total: b.total,
    })),
    transferOwnership: too.summary,
    grandTotal: { amount: grandTotal },
    exworksBreakdownIncluded: false as const,
  };

  if (!canSeeBreakdown) return pricingDefault;

  return {
    ...pricingDefault,
    exworksBreakdownIncluded: true,
    transferOwnershipBreakdown: too.lines.length ? too.lines : undefined,
    blocks: blockSummaries.map((b) => ({
      blockId: b.blockId,
      containerType: b.containerType,
      containerQty: b.containerQty,
      isAddon: b.isAddon,
      lines: b._lines,
      total: b.total,
    })),
  };
}

export function buildSeaTransitBlocksView({
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

  const blockSummaries = blocks.map((b) => {
    const bCharges = charges.filter((c) => c.blockId === b.id);

    const deliveryOrder = bCharges.find((c) => c.code === "DELIVERY_ORDER");
    const thcIn = bCharges.find((c) => c.code === "THC_IN");
    const ocean = bCharges.find((c) => c.code === "OCEAN_FREIGHT");
    const thcOut = bCharges.find((c) => c.code === "THC_OUT");

    const doRate = toNum(deliveryOrder?.sellRate);
    const doQty = toNum(deliveryOrder?.qty);
    const doAmt = toNum(deliveryOrder?.totalSell);

    const inRate = toNum(thcIn?.sellRate);
    const inQty = toNum(thcIn?.qty);
    const inAmt = toNum(thcIn?.totalSell);

    const oceanRate = toNum(ocean?.sellRate);
    const oceanQty = toNum(ocean?.qty);
    const oceanAmt = toNum(ocean?.totalSell);

    const outRate = toNum(thcOut?.sellRate);
    const outQty = toNum(thcOut?.qty);
    const outAmt = toNum(thcOut?.totalSell);

    const importTotal = doAmt + inAmt;
    const exportTotal = oceanAmt + outAmt;

    const exworksTotal = bCharges
      .filter((c) => (c.group as any) === "EXWORKS")
      .reduce((s, c) => s + toNum(c.totalSell), 0);

    const total = importTotal + exportTotal + exworksTotal;

    const allLines = bCharges
      .sort((a, b) => (a.order ?? 0) - (b.order ?? 0))
      .map((c) => ({
        label: c.label,
        code: c.code,
        group: c.group,
        amount: toNum(c.totalSell),
      }))
      .filter(nonZero)
      .filter((x) => !isHidden(x.code));

    return {
      blockId: b.id,
      containerType: b.containerType,
      containerQty: b.containerQty,
      isAddon: b.isAddon,
      import: {
        deliveryOrder: { sellRate: doRate, qtyUsed: doQty, amount: doAmt, calc: calcCompact(doRate, doQty, doAmt) },
        thcIn: { sellRate: inRate, qtyUsed: inQty, amount: inAmt, calc: calcCompact(inRate, inQty, inAmt) },
        total: { amount: importTotal },
      },
      export: {
        oceanFreight: { sellRate: oceanRate, qtyUsed: oceanQty, amount: oceanAmt, calc: calcCompact(oceanRate, oceanQty, oceanAmt) },
        thcOut: { sellRate: outRate, qtyUsed: outQty, amount: outAmt, calc: calcCompact(outRate, outQty, outAmt) },
        total: { amount: exportTotal },
      },
      exworks: { amount: exworksTotal },
      total: { amount: total },
      _lines: allLines,
    };
  });

  const blocksTotal = blockSummaries.reduce((s, b) => s + toNum(b.total.amount), 0);
  const grandTotal = blocksTotal + toNum(too.total);

  const pricingDefault = {
    mode: pricingRow.templateCode,
    currency,
    containers,
    blocks: blockSummaries.map((b) => ({
      blockId: b.blockId,
      containerType: b.containerType,
      containerQty: b.containerQty,
      isAddon: b.isAddon,
      import: b.import,
      export: b.export,
      exworks: b.exworks,
      total: b.total,
    })),
    transferOwnership: too.summary,
    grandTotal: { amount: grandTotal },
    exworksBreakdownIncluded: false as const,
  };

  if (!canSeeBreakdown) return pricingDefault;

  return {
    ...pricingDefault,
    exworksBreakdownIncluded: true,
    transferOwnershipBreakdown: too.lines.length ? too.lines : undefined,
    blocks: blockSummaries.map((b) => ({
      blockId: b.blockId,
      containerType: b.containerType,
      containerQty: b.containerQty,
      isAddon: b.isAddon,
      lines: b._lines,
      total: b.total,
    })),
  };
}
