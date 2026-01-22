import {
  Currency,
  QuoteChargeBasis,
  QuoteChargeCategory,
  QuoteChargeCode,
} from "@prisma/client";
import type { OpsLine } from "./airPricing";

export type QuoteChargeRow = {
  code: QuoteChargeCode;
  category: QuoteChargeCategory;
  label: string;
  basis: QuoteChargeBasis;
  qty: number;

  buyRate: number | null;
  sellRate: number | null;
  sellOnly: number | null;

  totalCost: number;
  totalSell: number;
  margin: number;

  currency: Currency;
};

export function mapOpsLinesToQuoteCharges(
  lines: OpsLine[],
  currency: Currency
): QuoteChargeRow[] {
  return lines.map((l) => {
    const category: QuoteChargeCategory =
      l.code === "AIR_FREIGHT"
        ? QuoteChargeCategory.AIR_FREIGHT
        : l.code === "THC"
        ? QuoteChargeCategory.THC
        : QuoteChargeCategory.EXWORKS;

    const basis: QuoteChargeBasis =
      l.basis === "WEIGHT"
        ? QuoteChargeBasis.WEIGHT
        : l.basis === "PIECE"
        ? QuoteChargeBasis.PIECE
        : QuoteChargeBasis.FLAT;

    // ✅ l.code must exactly match enum names in schema
    const code = l.code as QuoteChargeCode;

    return {
      code,
      category,
      label: l.label,
      basis,
      qty: l.qty,

      buyRate: l.buyRate ?? null,
      sellRate: l.sellRate ?? null,
      sellOnly: l.sellOnly ?? null,

      totalCost: l.totalCost,
      totalSell: l.totalSell,
      margin: l.margin,

      currency,
    };
  });
}

