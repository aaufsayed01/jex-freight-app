import { QuotePricingCharge } from "@prisma/client";
import { makeHiddenSet, nonZero, toNum } from "./helpers";

export function buildTransferOwnershipInfo(
  charges: QuotePricingCharge[],
  hiddenBreakdownCodes?: string[]
) {
  const hiddenSet = makeHiddenSet(hiddenBreakdownCodes);
  const isHidden = (code: string) => hiddenSet.has(String(code || "").trim());

  const tooCharges = charges.filter((c) => (c.group as any) === "TRANSFER_OWNERSHIP");
  const tooTotal = tooCharges.reduce((s, c) => s + toNum(c.totalSell), 0);

  // Breakdown lines (hide zero + hide codes)
  const tooLines = tooCharges
    .sort((a, b) => (a.order ?? 0) - (b.order ?? 0))
    .map((c) => ({
      label: c.label,
      code: c.code,
      amount: toNum(c.totalSell),
    }))
    .filter(nonZero)
    .filter((x) => !isHidden(x.code));

  return {
    total: tooTotal,
    summary: tooTotal !== 0 ? { amount: tooTotal } : undefined,
    lines: tooLines,
  };
}
