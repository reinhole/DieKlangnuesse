const { createCanvas, loadImage } = require('canvas');
const fs = require('fs');
const path = require('path');

async function dumpDirt() {
  const tilesetPath = path.join(__dirname, '../public/assets/sunnyland-woods/ENVIRONMENT/tileset.png');
  const tileset = await loadImage(tilesetPath);
  const canvas = createCanvas(32, 48);
  const ctx = canvas.getContext('2d');
  
  // col 1,2 row 8,9,10
  ctx.drawImage(tileset, 16, 128, 32, 48, 0, 0, 32, 48);
  
  const buffer = canvas.toBuffer('image/png');
  fs.writeFileSync('public/assets/dirt.png', buffer);
  console.log('Done');
}

dumpDirt().catch(console.error);
