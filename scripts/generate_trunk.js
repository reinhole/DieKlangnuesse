const { createCanvas, loadImage } = require('canvas');
const fs = require('fs');
const path = require('path');

async function generateTrunk(tilesetSubpath, outSubpath) {
  const tilesetPath = path.join(__dirname, '../public/assets', tilesetSubpath);
  const outPath = path.join(__dirname, '../public/assets', outSubpath);
  
  if (!fs.existsSync(tilesetPath)) return;
  const tileset = await loadImage(tilesetPath);
  
  const segments = [32, 224, 96, 160];
  const segmentHeight = 48; // 3 tiles high, not 2!
  const trunkWidth = 96;
  const sx = 15 * 16; // 240
  
  const canvas = createCanvas(trunkWidth, segmentHeight * segments.length);
  const ctx = canvas.getContext('2d');
  
  for (let i = 0; i < segments.length; i++) {
    const sy = segments[i];
    const dy = i * segmentHeight;
    ctx.drawImage(tileset, sx, sy, trunkWidth, segmentHeight, 0, dy, trunkWidth, segmentHeight);
  }
  
  const buffer = canvas.toBuffer('image/png');
  fs.writeFileSync(outPath, buffer);
  console.log('Generated trunk successfully at', outPath);
}

async function main() {
  await generateTrunk('sunnyland-woods/ENVIRONMENT/tileset.png', 'sunnyland-woods/ENVIRONMENT/trunk-repeat.png');
  await generateTrunk('sunnyland-winter/tileset.png', 'sunnyland-winter/trunk-repeat.png');
}

main().catch(console.error);
