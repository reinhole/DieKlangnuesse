const { createCanvas, loadImage } = require('canvas');
const fs = require('fs');
const path = require('path');

async function dumpTrunkSlice() {
  const tilesetPath = path.join(__dirname, '../public/assets/sunnyland-woods/ENVIRONMENT/tileset.png');
  const outPath = path.join(__dirname, '../public/assets/sunnyland-woods/ENVIRONMENT/full-trunk-slice.png');
  
  if (!fs.existsSync(tilesetPath)) return;
  const tileset = await loadImage(tilesetPath);
  
  const trunkWidth = 96; // 6 tiles * 16px
  const trunkHeight = tileset.height;
  const sx = 15 * 16; // 240
  
  const canvas = createCanvas(trunkWidth, trunkHeight);
  const ctx = canvas.getContext('2d');
  
  ctx.drawImage(tileset, sx, 0, trunkWidth, trunkHeight, 0, 0, trunkWidth, trunkHeight);
  
  const buffer = canvas.toBuffer('image/png');
  fs.writeFileSync(outPath, buffer);
  console.log('Dumped full trunk slice to', outPath);
}

dumpTrunkSlice().catch(console.error);
