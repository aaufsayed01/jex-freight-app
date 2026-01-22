export type DimUnit = "cm" | "in" | "mm" | "m";

export type PackageInput = {
  qty: number;
  length: number;
  width: number;
  height: number;
  unit: DimUnit; // cm/in/mm/m
};

const round2 = (n: number) => Math.round((n + Number.EPSILON) * 100) / 100;

function toCm(value: number, unit: DimUnit): number {
  if (!Number.isFinite(value) || value <= 0) return 0;

  switch (unit) {
    case "cm":
      return value;
    case "in":
      return value * 2.54;
    case "mm":
      return value / 10;
    case "m":
      return value * 100;
    default:
      return value;
  }
}

export function calcFromPackages(packages: PackageInput[]) {
  if (!Array.isArray(packages) || packages.length === 0) {
    return {
      totalPieces: 0,
      volumeCbm: null as number | null,
      chargeableWeightKg: null as number | null,
    };
  }

  let pieces = 0;
  let totalCbm = 0;
  let totalChargeable = 0;

  for (const p of packages) {
    const qty = Number(p?.qty ?? 0);
    const unit = (p?.unit ?? "cm") as DimUnit;

    if (!Number.isFinite(qty) || qty <= 0) continue;

    const L = toCm(Number(p.length), unit);
    const W = toCm(Number(p.width), unit);
    const H = toCm(Number(p.height), unit);

    if (![L, W, H].every((x) => Number.isFinite(x) && x > 0)) continue;

    pieces += qty;

    // CBM: cm³ -> m³
    totalCbm += (L * W * H * qty) / 1_000_000;

    // Chargeable kg: (cm³) / 6000
    totalChargeable += (L * W * H * qty) / 6000;
  }

  if (pieces === 0) {
    return { totalPieces: 0, volumeCbm: null, chargeableWeightKg: null };
  }

  return {
    totalPieces: pieces,
    volumeCbm: round2(totalCbm),
    chargeableWeightKg: round2(totalChargeable),
  };
}
