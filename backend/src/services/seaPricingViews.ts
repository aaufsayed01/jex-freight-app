import { ChargeGroup, QtyBasis } from "@prisma/client";
import { toNumber } from "./pricingCalculator";

export function buildSeaCustomerSummary(pricing: any) {
  const blocks = pricing.blocks ?? [];
  const charges = pricing.charges ?? [];

  const byBlock: any[] = blocks.map((b: any) => {
    const bCharges = charges.filter((c: any) => c.blockId === b.id);

    const ocean = bCharges.find((c: any) => c.code === "OCEAN_FREIGHT");
    const thc = bCharges.find((c: any) => c.code === "THC");

    const exworksSell = bCharges
      .filter((c: any) => c.group === ChargeGroup.EXWORKS)
      .reduce((sum: number, c: any) => sum + toNumber(c.totalSell), 0);

    const total = toNumber(ocean?.totalSell) + toNumber(thc?.totalSell) + exworksSell;

    return {
      containerType: b.containerType, // C20 / C40
      containerQty: b.containerQty,
      oceanFreight: {
        sellRate: toNumber(ocean?.sellRate),
        qtyUsed: toNumber(ocean?.qty),
        amount: toNumber(ocean?.totalSell),
      },
      thc: {
        sellRate: toNumber(thc?.sellRate),
        qtyUsed: toNumber(thc?.qty),
        amount: toNumber(thc?.totalSell),
      },
      exworks: { amount: exworksSell },
      total,
    };
  });

  const grandTotal = byBlock.reduce((s, b) => s + toNumber(b.total), 0);

  return {
    currency: pricing.currency,
    blocks: byBlock,
    grandTotal,
  };
}
