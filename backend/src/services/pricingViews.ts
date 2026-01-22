import { ChargeGroup } from "@prisma/client";
import { toNumber } from "./pricingCalculator";

export function buildCustomerSummary(pricing: any) {
  const charges = pricing.charges;

  const air = charges.find((c: any) => c.code === "AIRFREIGHT");
  const thc = charges.find((c: any) => c.code === "THC");

  const exworksSell = charges
    .filter((c: any) => c.group === ChargeGroup.EXWORKS)
    .reduce((sum: number, c: any) => sum + toNumber(c.totalSell), 0);

  const total = toNumber(air?.totalSell) + toNumber(thc?.totalSell) + exworksSell;

  return {
    currency: pricing.currency,
    airfreight: {
      sellRate: toNumber(air?.sellRate),
      qtyUsed: toNumber(air?.qty),
      amount: toNumber(air?.totalSell),
      // frontend can render: `${sellRate} AED/kg × ${qtyUsed} = ${amount}`
    },
    thc: {
      sellRate: toNumber(thc?.sellRate),
      qtyUsed: toNumber(thc?.qty),
      amount: toNumber(thc?.totalSell),
    },
    exworks: { amount: exworksSell },
    total,
  };
}

export function buildCustomerBreakup(pricing: any) {
  const charges = pricing.charges;

  const air = charges.find((c: any) => c.code === "AIRFREIGHT");
  const thc = charges.find((c: any) => c.code === "THC");

  const exLines = charges
    .filter((c: any) => c.group === ChargeGroup.EXWORKS)
    .sort((a: any, b: any) => (a.order ?? 0) - (b.order ?? 0))
    .map((c: any) => ({
      label: c.label,
      code: c.code,
      amount: toNumber(c.totalSell),
    }));

  const exworksSell = exLines.reduce((sum: number, x: {amount: number}) => sum + x.amount, 0);
  const total = toNumber(air?.totalSell) + toNumber(thc?.totalSell) + exworksSell;

  return {
    currency: pricing.currency,
    airfreight: { amount: toNumber(air?.totalSell) },
    thc: { amount: toNumber(thc?.totalSell) },
    exworks: { lines: exLines, amount: exworksSell },
    total,
  };
}
