const { createCanvas, loadImage } = require('canvas');
const fs = require('fs');

async function resizeFloor() {
  const imgPath = 'public/assets/sunnyland-woods/ENVIRONMENT/floor.png';
  const winterPath = 'public/assets/sunnyland-winter/floor.png';
  const img = await loadImage(imgPath);
  
  // Resize from 1024x1024 down to 128x128 for chunky pixel art feel
  const size = 128;
  const canvas = createCanvas(size, size);
  const ctx = canvas.getContext('2d');
  ctx.imageSmoothingEnabled = false;
  ctx.drawImage(img, 0, 0, size, size);
  
  const buffer = canvas.toBuffer('image/png');
  fs.writeFileSync(imgPath, buffer);
  fs.writeFileSync(winterPath, buffer);
  console.log('Resized floor to ' + size + 'x' + size);
}

resizeFloor().catch(console.error);
