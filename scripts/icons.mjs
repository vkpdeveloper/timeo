// Renders the app icons and logo from inline SVG. Run: node scripts/icons.mjs
// The glyph is LogoMark (src/components/ui/primitives.tsx) drawn light on a flat Sky tile:
// a ring three quarters closed from 12 o'clock, a faint track, and a centre dot. No gradients.
import sharp from "sharp";
import { writeFile } from "node:fs/promises";

const SKY = "#1F6FE5";
const LIGHT = "#FFFFFF";

// LogoMark geometry, in its own 32 x 32 box
const R = 11;
const STROKE = 4;
const DOT = 2.2;
const CIRC = 2 * Math.PI * R;

/** The mark in a 32-unit box, scaled so the box spans `scale` of the icon. */
const mark = (size, scale, { color = LIGHT, track = 0.24 } = {}) => {
  const box = size * scale;
  const k = box / 32;
  const o = (size - box) / 2;
  return `
  <g transform="translate(${o} ${o}) scale(${k})">
    ${track ? `<circle cx="16" cy="16" r="${R}" fill="none" stroke="${color}" stroke-opacity="${track}" stroke-width="${STROKE}"/>` : ""}
    <circle cx="16" cy="16" r="${R}" fill="none" stroke="${color}" stroke-width="${STROKE}" stroke-linecap="round"
      stroke-dasharray="${CIRC * 0.72} ${CIRC}" transform="rotate(-90 16 16)"/>
    <circle cx="16" cy="16" r="${DOT}" fill="${color}"/>
  </g>`;
};

/**
 * A Sky tile with the mark.
 * scale: how much of the tile the 32-unit LogoMark box covers. The ring's outer edge is 26/32 of that box,
 * so 0.62 gives a glyph about half the tile wide.
 */
const tile = (size, { rounded = false, scale = 0.62 } = {}) => `<svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}" viewBox="0 0 ${size} ${size}">
  <rect width="${size}" height="${size}" rx="${rounded ? size * 0.225 : 0}" fill="${SKY}"/>${mark(size, scale)}
</svg>
`;

/** Monochrome notification badge: white glyph on transparent, no track (Android uses the alpha only). */
const badge = (size) => `<svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}" viewBox="0 0 ${size} ${size}">${mark(size, 0.9, { track: 0 })}
</svg>
`;

const png = async (file, svg) => writeFile(file, await sharp(Buffer.from(svg)).png({ compressionLevel: 9 }).toBuffer());

// Full-bleed squares: launchers and iOS apply their own mask; offline.html rounds the corners itself.
await png("public/icon-192.png", tile(192));
await png("public/icon-512.png", tile(512));
// Maskable: the glyph's outer edge sits at 22% radius, well inside the 40% safe-zone circle.
await png("public/icon-maskable.png", tile(512, { scale: 0.54 }));
await png("src/app/apple-icon.png", tile(180));
// Favicon: rounded tile, glyph a little larger so it reads at 16px.
await png("src/app/icon.png", tile(64, { rounded: true, scale: 0.72 }));
await png("public/badge.png", badge(96));
await writeFile("public/logo.svg", tile(128, { rounded: true }));
console.log("icons written");
