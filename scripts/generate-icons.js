/*
  Generate app icons from splash image by extracting white shapes (eyes) on transparent background.
  - Input priority: assets/images/splash.png -> assets/images/splash-icon.png
  - Output: assets/images/icon.png (iOS), assets/images/adaptive-icon.png (Android foreground)

  Usage:
    1) npm i -D sharp
    2) node scripts/generate-icons.js
*/

const fs = require('fs');
const path = require('path');
const Jimp = require('jimp');
// No external smart-crop: we'll compute a bounding box of white regions ourselves

async function ensureDir(filePath) {
  const dir = path.dirname(filePath);
  await fs.promises.mkdir(dir, { recursive: true }).catch(() => {});
}

async function main() {
  const projectRoot = process.cwd();
  const candidates = [
    path.join(projectRoot, 'assets', 'images', 'splash.png'),
    path.join(projectRoot, 'assets', 'images', 'splash-icon.png'),
  ];

  const sourcePath = candidates.find((p) => fs.existsSync(p));
  if (!sourcePath) {
    console.error('[icons] Source splash not found. Place splash.png in assets/images/.');
    process.exit(1);
  }

  const outputIcon = path.join(projectRoot, 'assets', 'images', 'icon.png');
  const outputAdaptive = path.join(projectRoot, 'assets', 'images', 'adaptive-icon.png');
  await ensureDir(outputIcon);
  await ensureDir(outputAdaptive);

  const base = await Jimp.read(sourcePath);
  const imgWidth = base.bitmap.width;
  const imgHeight = base.bitmap.height;

  const gray = base.clone().greyscale();
  // Build binary mask: near-white => 255 else 0
  const maskImg = gray.clone();
  maskImg.scan(0, 0, imgWidth, imgHeight, function (x, y, idx) {
    const v = this.bitmap.data[idx]; // R in grayscale
    const val = v >= 240 ? 255 : 0;
    this.bitmap.data[idx] = val;
    this.bitmap.data[idx + 1] = val;
    this.bitmap.data[idx + 2] = val;
  });

  // Scan a vertical window (exclude lower 37% to avoid white title text)
  const maxY = Math.floor(imgHeight * 0.63);
  let minX = imgWidth, minY = maxY, maxX = 0, maxYFound = 0;

  for (let y = 0; y < maxY; y++) {
    for (let x = 0; x < imgWidth; x++) {
      const idx = (y * imgWidth + x) * 4;
      const v = maskImg.bitmap.data[idx];
      if (v > 0) {
        if (x < minX) minX = x;
        if (y < minY) minY = y;
        if (x > maxX) maxX = x;
        if (y > maxYFound) maxYFound = y;
      }
    }
  }

  // Fallback to centered box if nothing found
  if (minX > maxX || minY > maxYFound) {
    const side = Math.floor(Math.min(imgWidth, imgHeight) * 0.5);
    const left = Math.floor((imgWidth - side) / 2);
    const top = Math.floor((imgHeight - side) / 2);
    minX = left; maxX = left + side; minY = top; maxYFound = top + side;
  }

  // Expand with padding and clamp
  const pad = Math.round(Math.min(imgWidth, imgHeight) * 0.04);
  const cropLeft = Math.max(0, minX - pad);
  const cropTop = Math.max(0, minY - pad);
  const cropWidth = Math.min(imgWidth - cropLeft, (maxX - minX) + pad * 2);
  const cropHeight = Math.min(imgHeight - cropTop, (maxYFound - minY) + pad * 2);

  const cropped = base.clone().crop(cropLeft, cropTop, cropWidth, cropHeight);
  const size = 1024;
  const canvas = new Jimp(size, size, 0x00000000);
  const scale = Math.min(size / cropWidth, size / cropHeight);
  const newW = Math.round(cropWidth * scale);
  const newH = Math.round(cropHeight * scale);
  const resized = cropped.clone().resize(newW, newH, Jimp.RESIZE_BILINEAR);
  const offsetX = Math.floor((size - newW) / 2);
  const offsetY = Math.floor((size - newH) / 2);
  canvas.composite(resized, offsetX, offsetY);

  // Regenerate mask on the canvas area
  const maskCanvas = canvas.clone().greyscale();
  maskCanvas.scan(0, 0, size, size, function (x, y, idx) {
    const v = this.bitmap.data[idx];
    const val = v >= 240 ? 255 : 0;
    this.bitmap.data[idx] = val;
    this.bitmap.data[idx + 1] = val;
    this.bitmap.data[idx + 2] = val;
    this.bitmap.data[idx + 3] = val; // use as alpha
  });

  // White fill base
  const white = new Jimp(size, size, 0xffffffff);
  white.mask(maskCanvas, 0, 0);

  await white.writeAsync(outputIcon);
  await white.writeAsync(outputAdaptive);

  console.log('[icons] Generated icon.png and adaptive-icon.png from', path.relative(projectRoot, sourcePath));
}

main().catch((err) => {
  console.error('[icons] Failed:', err);
  process.exit(1);
});


