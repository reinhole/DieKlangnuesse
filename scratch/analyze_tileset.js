const fs = require('fs');
const { PNG } = require('pngjs');

const data = fs.readFileSync('Sunny-land-woods-files/Assets/ENVIRONMENT/tileset.png');
const png = PNG.sync.read(data);

console.log(`tileset: ${png.width}x${png.height}`);
const cols = Math.floor(png.width / 16);
const rows = Math.floor(png.height / 16);

for (let r = 0; r < rows; r++) {
  let line = `R${r.toString().padStart(2, '0')}: `;
  for (let c = 0; c < cols; c++) {
    let hasAlpha = false;
    for (let y = 0; y < 16; y++) {
      for (let x = 0; x < 16; x++) {
        const idx = (png.width * (r * 16 + y) + (c * 16 + x)) << 2;
        if (png.data[idx + 3] > 10) {
          hasAlpha = true;
          break;
        }
      }
      if (hasAlpha) break;
    }
    line += hasAlpha ? 'X' : '.';
  }
  console.log(line);
}
