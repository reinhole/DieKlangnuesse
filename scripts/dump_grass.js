const { createCanvas, loadImage } = require('canvas');
const fs = require('fs');
const path = require('path');

async function dumpGrass() {
  const tilesetPath = path.join(__dirname, '../public/assets/sunnyland-woods/ENVIRONMENT/tileset.png');
  const tileset = await loadImage(tilesetPath);
  
  // Dump the first 4 rows to see if there's grass
  const canvas = createCanvas(tileset.width, 64);
  const ctx = canvas.getContext('2d');
  
  ctx.drawImage(tileset, 0, 0, tileset.width, 64, 0, 0, tileset.width, 64);
  
  const buffer = canvas.toBuffer('image/png');
  fs.writeFileSync('public/assets/top_tiles.png', buffer);
  console.log('Done');
}

dumpGrass().catch(console.error);
