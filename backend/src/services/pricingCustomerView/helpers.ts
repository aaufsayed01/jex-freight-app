import { PricingTemplateCode } from "@prisma/client";

export function fmt(n: number) {
  return Number(n || 0).toFixed(2);
}

export function calcCompact(rate: number, qty: number, amount: number) {
  return `${fmt(rate)}×${fmt(qty)}=${fmt(amount)}`;
}

export function nonZero(x: { amount: number }) {
  return Number(x.amount ?? 0) !== 0;
}

export function toNum(v: any) {
  return Number(v ?? 0);
}

export function makeHiddenSet(hidden?: string[]) {
  return new Set((hidden ?? []).map((x) => String(x || "").trim()).filter(Boolean));
}

export function getThcCodesForAirTemplate(templateCode?: PricingTemplateCode | string) {
  const code = String(templateCode ?? "");

  // Transit templates show IN/OUT
  if (code === PricingTemplateCode.AIR_EXPORT_TRANSIT) {
    return { mode: "TRANSIT" as const, codes: ["THC_IN", "THC_OUT"] as const };
  }

  // Sea → Air and Import Re-Export show Import/Export
  if (code === PricingTemplateCode.SEA_TO_AIR || code === PricingTemplateCode.AIR_IMPORT_REEXPORT) {
    return { mode: "IMP_EXP" as const, codes: ["THC_IMPORT", "THC_EXPORT"] as const };
  }

  // Default air export/import/local/freezone: single THC
  return { mode: "SINGLE" as const, codes: ["THC"] as const };
}