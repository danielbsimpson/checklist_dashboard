/**
 * Generates minimal valid PNG placeholder images for Expo build.
 * Run once: node make_assets.mjs
 * Outputs: assets/images/{icon,adaptive-icon,splash-icon,favicon}.png
 */
import { mkdirSync, writeFileSync } from "fs";
import { join, dirname } from "path";
import { fileURLToPath } from "url";

const __dirname = dirname(fileURLToPath(import.meta.url));

// Minimal 1x1 transparent PNG (bytes)
function solidPng(r, g, b, w = 1, h = 1) {
  // We'll create a real minimal PNG via raw deflate-less data
  // using a known-good tiny PNG in base64 for solid colour blocks
  // Instead, embed a fixed 8x8 solid-colour PNG per color
  return null; // handled below via base64
}

// 8x8 solid dark PNG (#151718) – base64 encoded
// Generated externally for exact bytes
const DARK_PNG_8x8_B64 =
  "iVBORw0KGgoAAAANSUhEUgAAAAgAAAAICAYAAADED76LAAAAAXNSR0IArs4c6QAAAARnQU5C" +
  "ggg=="; // placeholder — see below

// Use a proper 1x1 coloured PNG
// 1x1 #151718 png
const px = (r, g, b) => {
  // PNG header + IHDR + IDAT (1x1) + IEND — minimal valid PNG
  const crc32 = (buf) => {
    let crc = -1;
    const table = new Uint32Array(256);
    for (let i = 0; i < 256; i++) {
      let c = i;
      for (let j = 0; j < 8; j++) c = (c & 1) ? (0xedb88320 ^ (c >>> 1)) : (c >>> 1);
      table[i] = c;
    }
    for (const byte of buf) crc = table[(crc ^ byte) & 0xff] ^ (crc >>> 8);
    return (crc ^ -1) >>> 0;
  };

  const u32 = (n) => [(n >>> 24) & 0xff, (n >>> 16) & 0xff, (n >>> 8) & 0xff, n & 0xff];

  // IHDR chunk: 1x1 RGB 8-bit
  const ihdrData = [0,0,0,1, 0,0,0,1, 8, 2, 0, 0, 0];
  const ihdrCrc  = crc32([0x49,0x48,0x44,0x52, ...ihdrData]);

  // IDAT: zlib(deflate([filter_none, r, g, b]))
  // Minimal zlib: CM=8, CINFO=7, FCHECK, DEFLATE(no compression), ADLER32
  const raw   = [0, r, g, b]; // filter=0, then RGB
  const dlen  = raw.length;
  const deflate = [
    0x78, 0x01,          // zlib header
    0x01,                // DEFLATE: BFINAL=1, BTYPE=00 (no compression)
    dlen & 0xff, (dlen >>> 8) & 0xff,
    (~dlen) & 0xff, ((~dlen) >>> 8) & 0xff,
    ...raw,
    0, 0, 0, 0,          // Adler-32 placeholder (will be wrong but most decoders accept)
  ];
  // Proper Adler-32
  let s1 = 1, s2 = 0;
  for (const b of raw) { s1 = (s1 + b) % 65521; s2 = (s2 + s1) % 65521; }
  deflate[deflate.length - 4] = (s2 >>> 8) & 0xff;
  deflate[deflate.length - 3] = s2 & 0xff;
  deflate[deflate.length - 2] = (s1 >>> 8) & 0xff;
  deflate[deflate.length - 1] = s1 & 0xff;

  const idatCrc = crc32([0x49,0x44,0x41,0x54, ...deflate]);
  const iendCrc = crc32([0x49,0x45,0x4e,0x44]);

  return Buffer.from([
    0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, // PNG magic
    0,0,0,13, 0x49,0x48,0x44,0x52, ...ihdrData, ...u32(ihdrCrc),
    ...u32(deflate.length), 0x49,0x44,0x41,0x54, ...deflate, ...u32(idatCrc),
    0,0,0,0,  0x49,0x45,0x4e,0x44, ...u32(iendCrc),
  ]);
};

const dir = join(__dirname, "assets", "images");
mkdirSync(dir, { recursive: true });

const dark = px(0x15, 0x17, 0x18);
const blue = px(0x34, 0x98, 0xdb);

writeFileSync(join(dir, "icon.png"),          dark);
writeFileSync(join(dir, "adaptive-icon.png"), blue);
writeFileSync(join(dir, "splash-icon.png"),   blue);
writeFileSync(join(dir, "favicon.png"),       blue);

console.log("Assets created in assets/images/");
