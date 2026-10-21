// Renders the app icons, favicons and logo files from one vector. Run: node scripts/icons.mjs
// The glyph is Hour Wing, the same path as LogoMark (src/components/ui/primitives.tsx): two clock hands
// at ten past ten folded into a bird. Blue on a near-black tile. No gradients.
import sharp from "sharp";
import { writeFile } from "node:fs/promises";

const INK = "#0B0C0F";
const BLUE = "#5B9DFF";
const WHITE = "#FFFFFF";

// Hour Wing in a 100-unit-wide box, 55.87 tall
const W = 100;
const H = 55.87;
const WING =
  "M0.33 10.23A1.55 1.55 0 0 1 2.05 7.82L30.49 17.64A6.32 6.32 0 0 1 33.33 19.62L45 33.96A0.42 0.42 0 0 0 45.64 33.99" +
  "L63.13 15.21A6.32 6.32 0 0 1 65.35 13.68L98.45 0.08A1.12 1.12 0 0 1 99.71 1.88L55.35 50.68A15.87 15.87 0 0 1 31.08 49.75Z";

/**
 * The glyph centred in a `size` square, `scale` of the width across.
 * It sits a little below centre, as drawn: the wings carry the weight up top.
 */
const glyph = (size, scale, color) => {
  const k = (size * scale) / W;
  const x = (size - W * k) / 2;
  const y = (size - H * k) / 2 + size * 0.013;
  return `<path transform="translate(${x.toFixed(2)} ${y.toFixed(2)}) scale(${k.toFixed(4)})" d="${WING}" fill="${color}"/>`;
};

const svg = (size, body) =>
  `<svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}" viewBox="0 0 ${size} ${size}">${body}</svg>\n`;

/** The app icon: blue wing on a near-black tile. Rounded for favicons and the logo file. */
const tile = (size, { rounded = false, scale = 0.78 } = {}) =>
  svg(size, `<rect width="${size}" height="${size}" rx="${rounded ? size * 0.225 : 0}" fill="${INK}"/>${glyph(size, scale, BLUE)}`);

/** The wing alone, for use on any background. */
const mark = (color) =>
  `<svg xmlns="http://www.w3.org/2000/svg" width="${W * 4}" height="${(H * 4).toFixed(0)}" viewBox="0 0 ${W} ${H}"><path d="${WING}" fill="${color}"/></svg>\n`;

const png = async (svgText) => sharp(Buffer.from(svgText)).png({ compressionLevel: 9 }).toBuffer();
const writePng = async (file, svgText) => writeFile(file, await png(svgText));

/** A .ico that wraps PNGs, which every browser since IE 11 reads. */
const ico = async (sizes) => {
  const images = await Promise.all(sizes.map((s) => png(tile(s, { rounded: true, scale: 0.84 }))));
  const head = Buffer.alloc(6 + 16 * images.length);
  head.writeUInt16LE(0, 0);
  head.writeUInt16LE(1, 2);
  head.writeUInt16LE(images.length, 4);
  let offset = head.length;
  images.forEach((img, i) => {
    const e = 6 + 16 * i;
    head.writeUInt8(sizes[i] % 256, e);
    head.writeUInt8(sizes[i] % 256, e + 1);
    head.writeUInt16LE(1, e + 4);
    head.writeUInt16LE(32, e + 6);
    head.writeUInt32LE(img.length, e + 8);
    head.writeUInt32LE(offset, e + 12);
    offset += img.length;
  });
  return Buffer.concat([head, ...images]);
};

// Full-bleed squares: launchers and iOS apply their own mask; offline.html rounds the corners itself.
await writePng("public/icon-192.png", tile(192));
await writePng("public/icon-512.png", tile(512));
// Maskable: the wing tips stay inside the 80% safe-zone circle.
await writePng("public/icon-maskable.png", tile(512, { scale: 0.6 }));
await writePng("src/app/apple-icon.png", tile(180));
// Favicons: rounded tile, wing a little wider so it reads at 16px.
await writeFile("src/app/icon.svg", tile(64, { rounded: true, scale: 0.84 }));
await writePng("src/app/icon.png", tile(64, { rounded: true, scale: 0.84 }));
await writeFile("src/app/favicon.ico", await ico([16, 32, 48]));
// Monochrome notification badge: Android uses the alpha only.
await writePng("public/badge.png", svg(96, glyph(96, 0.92, WHITE)));
// Logo files
await writeFile("public/logo.svg", tile(512, { rounded: true }));
await writeFile("public/logo-mark.svg", mark(BLUE));
await writeFile("public/logo-mark-white.svg", mark(WHITE));
await writeFile("public/logo-mark-ink.svg", mark(INK));
console.log("icons written");
