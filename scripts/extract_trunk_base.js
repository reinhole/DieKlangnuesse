const { createCanvas, loadImage } = require('canvas');
const fs = require('fs');
const path = require('path');

async function extractBase(tilesetSubpath, outSubpath) {
  const tilesetPath = path.join(__dirname, '../public/assets', tilesetSubpath);
  const outPath = path.join(__dirname, '../public/assets', outSubpath);
  
  if (!fs.existsSync(tilesetPath)) return;
  const tileset = await loadImage(tilesetPath);
  
  const trunkWidth = 96;
  const sx = 15 * 16; // 240
  
  // The base/roots seem to be at row 18, 19, 20 (y = 288)
  const sy = 288;
  const height = 48;
  
  const canvas = createCanvas(trunkWidth, height);
  const ctx = canvas.getContext('2d');
  
  ctx.drawImage(tileset, sx, sy, trunkWidth, height, 0, 0, trunkWidth, height);
  
  const buffer = canvas.toBuffer('image/png');
  fs.writeFileSync(outPath, buffer);
  console.log('Generated trunk base successfully at', outPath);
}

async function main() {
  await extractBase('sunnyland-woods/ENVIRONMENT/tileset.png', 'sunnyland-woods/ENVIRONMENT/trunk-base.png');
  await extractBase('sunnyland-winter/tileset.png', 'sunnyland-winter/trunk-base.png');
}

main().catch(console.error);
