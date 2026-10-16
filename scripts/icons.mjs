// Renders the app icons from an inline SVG. Run: node scripts/icons.mjs
import sharp from "sharp";
import { writeFile } from "node:fs/promises";

const mark = (size, pad) => {
  const c = size / 2;
  const r = (size - pad * 2) * 0.3;
  const sw = r * 0.34;
  const circ = 2 * Math.PI * r;
  return `
  <circle cx="${c}" cy="${c}" r="${r}" fill="none" stroke="#ffffff" stroke-opacity="0.12" stroke-width="${sw}"/>
  <circle cx="${c}" cy="${c}" r="${r}" fill="none" stroke="#ff7a52" stroke-width="${sw}" stroke-linecap="round"
    stroke-dasharray="${circ * 0.72} ${circ}" transform="rotate(-90 ${c} ${c})"/>
  <circle cx="${c}" cy="${c}" r="${sw * 0.42}" fill="#f3f2ee"/>`;
};

const svg = (size, { rounded = true, pad = 0 } = {}) => `
<svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}" viewBox="0 0 ${size} ${size}">
  <defs>
    <linearGradient id="g" x1="0" y1="0" x2="0" y2="1">
      <stop offset="0" stop-color="#232226"/><stop offset="1" stop-color="#121214"/>
    </linearGradient>
  </defs>
  <rect width="${size}" height="${size}" rx="${rounded ? size * 0.225 : 0}" fill="url(#g)"/>
  ${mark(size, pad)}
</svg>`;

const out = async (file, size, opts) =>
  writeFile(file, await sharp(Buffer.from(svg(size, opts))).png().toBuffer());

await out("public/icon-192.png", 192, { rounded: false });
await out("public/icon-512.png", 512, { rounded: false });
await out("public/icon-maskable.png", 512, { rounded: false, pad: 70 });
await out("src/app/apple-icon.png", 180, { rounded: false });
await out("src/app/icon.png", 64, { rounded: true });
await writeFile("public/logo.svg", svg(128));
console.log("icons written");
