// Generates HomeBoard's PWA icons as PNG files with no image library: a cream house on the primary orange.
// Deterministic — the same bytes on every run — so the committed PNGs never churn.
import { mkdirSync, writeFileSync } from "node:fs";
import { deflateSync } from "node:zlib";

const PRIMARY = [0xc2, 0x41, 0x0c];
const CREAM = [0xff, 0xfb, 0xeb];

const CRC_TABLE = new Uint32Array(256);
for (let n = 0; n < 256; n++) {
  let c = n;
  for (let k = 0; k < 8; k++) {
    c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
  }
  CRC_TABLE[n] = c >>> 0;
}

function crc32(buffer) {
  let c = 0xffffffff;
  for (const byte of buffer) {
    c = CRC_TABLE[(c ^ byte) & 0xff] ^ (c >>> 8);
  }
  return (c ^ 0xffffffff) >>> 0;
}

function chunk(type, data) {
  const length = Buffer.alloc(4);
  length.writeUInt32BE(data.length);
  const typed = Buffer.concat([Buffer.from(type, "ascii"), data]);
  const crc = Buffer.alloc(4);
  crc.writeUInt32BE(crc32(typed));
  return Buffer.concat([length, typed, crc]);
}

// The house in a unit square: a roof triangle over a body with a door cut out.
function isHouse(u, v) {
  if (v >= 0.22 && v <= 0.5) {
    const half = ((v - 0.22) / 0.28) * 0.32;
    if (Math.abs(u - 0.5) <= half) {
      return true;
    }
  }
  if (v > 0.5 && v <= 0.78 && u >= 0.28 && u <= 0.72) {
    const door = u >= 0.44 && u <= 0.56 && v >= 0.6;
    return !door;
  }
  return false;
}

// scale < 1 shrinks the house toward the centre (maskable icons keep it inside the safe zone).
function png(size, scale) {
  const stride = size * 3 + 1;
  const raw = Buffer.alloc(stride * size);
  for (let y = 0; y < size; y++) {
    raw[y * stride] = 0;
    for (let x = 0; x < size; x++) {
      const u = 0.5 + ((x + 0.5) / size - 0.5) / scale;
      const v = 0.5 + ((y + 0.5) / size - 0.5) / scale;
      const [r, g, b] = isHouse(u, v) ? CREAM : PRIMARY;
      const offset = y * stride + 1 + x * 3;
      raw[offset] = r;
      raw[offset + 1] = g;
      raw[offset + 2] = b;
    }
  }
  const header = Buffer.alloc(13);
  header.writeUInt32BE(size, 0);
  header.writeUInt32BE(size, 4);
  header[8] = 8;
  header[9] = 2;
  const signature = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);
  return Buffer.concat([
    signature,
    chunk("IHDR", header),
    chunk("IDAT", deflateSync(raw)),
    chunk("IEND", Buffer.alloc(0)),
  ]);
}

const ICONS = [
  { file: "public/icons/icon-192.png", size: 192, scale: 1 },
  { file: "public/icons/icon-512.png", size: 512, scale: 1 },
  { file: "public/icons/icon-maskable-512.png", size: 512, scale: 0.78 },
  { file: "public/icons/apple-touch-icon.png", size: 180, scale: 1 },
];

mkdirSync("public/icons", { recursive: true });
for (const icon of ICONS) {
  writeFileSync(icon.file, png(icon.size, icon.scale));
  console.log(`icons: ${icon.file} (${icon.size}x${icon.size})`);
}
