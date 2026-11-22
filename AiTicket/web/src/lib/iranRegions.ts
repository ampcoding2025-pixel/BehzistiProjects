/** Normalize Persian province labels for GeoJSON ↔ Didban matching. */
export function normalizeProvinceName(raw: string): string {
  return raw
    .replace(/[\u200e\u200f\u202a-\u202e\uFEFF]/g, "")
    .replace(/ي/g, "ی")
    .replace(/ك/g, "ک")
    .replace(/آ/g, "آ")
    .replace(/\s+/g, " ")
    .trim();
}

/** Known spelling variants between OSM GeoJSON and Didban RegionName. */
const ALIASES: Record<string, string> = {
  گيلان: "گیلان",
  "کهگیلویه و بویر احمد": "کهگیلویه و بویراحمد",
  "کهگیلویه و بویرآحمد": "کهگیلویه و بویراحمد",
  "چهار محال و بختیاری": "چهارمحال و بختیاری",
};

export function canonicalProvinceName(raw: string): string {
  const n = normalizeProvinceName(raw);
  return ALIASES[n] ?? n;
}

/** Non-map Didban regions (HQ / unknown). */
export function isMappableRegion(name: string): boolean {
  const n = canonicalProvinceName(name);
  return n !== "نامشخص" && n !== "ستاد" && n.length > 0;
}
