import { QtyBasis } from "@prisma/client";

export type QuoteWeightInput = {
  actualWeightKg: number;
  chargeableWeightKg?: number;
  lengthCm?: number;
  widthCm?: number;
  heightCm?: number;
  pieces?: number;
  volumeCbm?: number;
};

export function calcChargeableWeightKg(input: QuoteWeightInput): number {
  // 1) If packages already computed it, use it (most correct)
  if (Number.isFinite(input.chargeableWeightKg as number) && (input.chargeableWeightKg as number) > 0) {
    return Number(input.chargeableWeightKg);
  }

  // 2) If volumeCbm exists, convert to volumetric kg:
  // 1 cbm = 1,000,000 cm³
  // chargeable kg = cm³ / 6000 = cbm * 1,000,000 / 6000 = cbm * 166.6667
  if (Number.isFinite(input.volumeCbm as number) && (input.volumeCbm as number) > 0) {
    return Number(input.volumeCbm) * (1_000_000 / 6000);
  }

  // 3) If single dimensions exist, use them
  const { lengthCm, widthCm, heightCm } = input;
  if (lengthCm && widthCm && heightCm) {
    return (lengthCm * widthCm * heightCm) / 6000;
  }

  return 0;
}

export function airfreightWeightKg(input: QuoteWeightInput): number {
  const actual = Number(input.actualWeightKg ?? 0);

  // ✅ HARD PREFERENCE: if chargeableWeightKg is provided, use it directly
  const providedChargeable = Number((input as any).chargeableWeightKg ?? 0);
  if (Number.isFinite(providedChargeable) && providedChargeable > 0) {
    return Math.max(actual, providedChargeable);
  }

  // fallback to computed chargeable
  const cw = calcChargeableWeightKg(input);
  return Math.max(actual, Number(cw ?? 0));
}


export function thcWeightKg(input: QuoteWeightInput): number {
  return input.actualWeightKg ?? 0;
}

// Labelling rule:
// 1..100 pieces => 36 AED fixed
// >100 => pieces * 0.36
export function labellingSellTotal(pieces: number): number {
  if (!pieces || pieces <= 0) return 0;
  if (pieces <= 100) return 36;
  return pieces * 0.36;
}

export function toNumber(d: any): number {
  if (d === null || d === undefined) return 0;
  if (typeof d === "number") return d;
  if (typeof d === "string") return Number(d);
  if (typeof d?.toNumber === "function") return d.toNumber(); // Prisma Decimal
  return Number(d);
}

export function computeTotals(params: {
  qtyBasis: QtyBasis;
  buyRate: number;
  sellRate: number;
  qty: number; // stored qty (may be 1)
  input: QuoteWeightInput;

  // ✅ NEW for SEA container pricing
  containerQty?: number;

  isLabelling?: boolean;
  isDiscount?: boolean;
  canBeNegative?: boolean;
}): { qtyUsed: number; totalSell: number; margin: number | null } {
  const {
    qtyBasis,
    buyRate,
    sellRate,
    qty,
    input,
    containerQty,
    isLabelling,
    isDiscount,
  } = params;

  // Labelling special: margin = null, sell total uses rule
  if (isLabelling) {
    const pcs = input.pieces ?? 0;
    const total = labellingSellTotal(pcs);
    return { qtyUsed: pcs, totalSell: total, margin: null };
  }

  let qtyUsed = qty;

  if (qtyBasis === QtyBasis.CONTAINER) {
    qtyUsed = Number(containerQty ?? qty ?? 0);
  } else if (qtyBasis === QtyBasis.KG_CHARGEABLE_MAX) {
    qtyUsed = airfreightWeightKg(input);
  } else if (qtyBasis === QtyBasis.KG_ACTUAL) {
    qtyUsed = thcWeightKg(input);
  } else if (qtyBasis === QtyBasis.PIECE) {
    qtyUsed = input.pieces ?? qty;
  } else if (qtyBasis === QtyBasis.CBM) {
    qtyUsed = input.volumeCbm ?? 0;
  } else {
    qtyUsed = 1; // SHIPMENT / default
  }

  const totalSell = sellRate * qtyUsed;
  const margin = (sellRate - buyRate) * qtyUsed;

  // discounts can be negative sellRate (your UI style)
  return { qtyUsed, totalSell, margin };
}

