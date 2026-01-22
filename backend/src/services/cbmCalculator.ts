export function calcVolumeCbmFromPackages(packagesJson: any): number | null {
  // Expecting packagesJson like:
  // [{ lengthCm, widthCm, heightCm, qty }, ...]
  // or [{ lengthCm, widthCm, heightCm, pieces }, ...]
  if (!packagesJson) return null;
  const arr = Array.isArray(packagesJson) ? packagesJson : packagesJson?.packages;
  if (!Array.isArray(arr)) return null;

  let total = 0;

  for (const p of arr) {
    const l = Number(p.lengthCm ?? p.length ?? 0);
    const w = Number(p.widthCm ?? p.width ?? 0);
    const h = Number(p.heightCm ?? p.height ?? 0);
    const qty = Number(p.qty ?? p.quantity ?? p.pieces ?? 1);

    if (!l || !w || !h || !qty) continue;

    // cm³ -> m³
    total += (l * w * h * qty) / 1_000_000;
  }

  if (!isFinite(total) || total <= 0) return null;
  // keep 3 decimals
  return Math.round(total * 1000) / 1000;
}
