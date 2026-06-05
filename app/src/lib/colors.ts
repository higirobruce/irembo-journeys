/* Tiny color utils — JS-computed shades (no CSS color-mix, per design notes). */
function hexToRgb(h: string): [number, number, number] {
  const n = parseInt(h.replace("#", ""), 16);
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
}
function rgbToHex(r: number, g: number, b: number): string {
  return "#" + [r, g, b].map((x) => Math.round(Math.max(0, Math.min(255, x))).toString(16).padStart(2, "0")).join("");
}
export function darken(hex: string, amt: number): string {
  const [r, g, b] = hexToRgb(hex);
  return rgbToHex(r * (1 - amt), g * (1 - amt), b * (1 - amt));
}
export function mixWhite(hex: string, amt: number): string {
  const [r, g, b] = hexToRgb(hex);
  return rgbToHex(r + (255 - r) * amt, g + (255 - g) * amt, b + (255 - b) * amt);
}
export function mixDark(hex: string, amt: number): string {
  const [r, g, b] = hexToRgb(hex);
  const [dr, dg, db] = [12, 17, 24];
  return rgbToHex(r + (dr - r) * amt, g + (dg - g) * amt, b + (db - b) * amt);
}
