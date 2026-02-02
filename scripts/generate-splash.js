/*
  Create assets/images/splash.png programmatically to match the provided design:
  - Bright green background (#1ED760)
  - Two white oval eyes with background-colored pupils
  - "eyeseeit" text below the eyes in white

  Usage:
    node scripts/generate-splash.js
*/

const fs = require('fs');
const path = require('path');
const Jimp = require('jimp');

async function ensureDir(filePath) {
  const dir = path.dirname(filePath);
  await fs.promises.mkdir(dir, { recursive: true }).catch(() => {});
}

async function main() {
  const projectRoot = process.cwd();
  const outPath = path.join(projectRoot, 'assets', 'images', 'splash.png');
  await ensureDir(outPath);

  // High-resolution canvas for crisp scaling (portrait)
  const width = 1242; // ~3x iPhone width
  const height = 2688; // ~3x iPhone height
  const bg = '#1ED760';

  // Eye geometry (relative to width/height)
  const eyeCxLeft = Math.round(width * 0.42);
  const eyeCxRight = Math.round(width * 0.58);
  const eyeCy = Math.round(height * 0.57);
  const eyeRx = Math.round(width * 0.095);
  const eyeRy = Math.round(width * 0.14);
  const pupilOffsetX = Math.round(eyeRx * 0.35);
  const pupilOffsetY = Math.round(eyeRy * 0.25);
  const pupilR = Math.round(eyeRx * 0.38);

  const textY = Math.round(height * 0.67);
  const fontSize = Math.round(width * 0.11);

  const svg = `<?xml version="1.0" encoding="UTF-8"?>
<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}" viewBox="0 0 ${width} ${height}">
  <rect width="100%" height="100%" fill="${bg}"/>
  <!-- Eyes -->
  <g>
    <ellipse cx="${eyeCxLeft}" cy="${eyeCy}" rx="${eyeRx}" ry="${eyeRy}" fill="#FFFFFF"/>
    <ellipse cx="${eyeCxRight}" cy="${eyeCy}" rx="${eyeRx}" ry="${eyeRy}" fill="#FFFFFF"/>
    <circle cx="${eyeCxLeft - pupilOffsetX}" cy="${eyeCy + pupilOffsetY}" r="${pupilR}" fill="${bg}"/>
    <circle cx="${eyeCxRight - pupilOffsetX}" cy="${eyeCy + pupilOffsetY}" r="${pupilR}" fill="${bg}"/>
  </g>
  <!-- Title -->
  <g transform="rotate(-6 ${Math.round(width/2)} ${textY})">
    <text x="50%" y="${textY}" text-anchor="middle" fill="#FFFFFF" font-size="${fontSize}" font-weight="600" font-family="-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif" letter-spacing="2">
      eyeseeit
    </text>
  </g>
</svg>`;

  const image = await Jimp.read(Buffer.from(svg));
  await image.writeAsync(outPath);
  console.log('[splash] Generated', path.relative(projectRoot, outPath));
}

main().catch((err) => {
  console.error('[splash] Failed:', err);
  process.exit(1);
});


