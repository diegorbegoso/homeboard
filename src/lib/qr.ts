import { create } from "qrcode";

/** SVG path (one unit per module) and side length of a QR code for `text`. */
export function qrPath(text: string): { d: string; size: number } {
  const { modules } = create(text, { errorCorrectionLevel: "M" });
  const size = modules.size;
  let d = "";
  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      if (modules.get(x, y)) d += `M${x} ${y}h1v1h-1z`;
    }
  }
  return { d, size };
}
