const fs = require('fs');
const { PNG } = require('pngjs');

const data = fs.readFileSync('Sunny-land-woods-files/Assets/ENVIRONMENT/tileset.png');
const png = PNG.sync.read(data);

const cols = Math.floor(png.width / 16);
const rows = Math.floor(png.height / 16);

for (let r = 0; r < rows; r++) {
  let line = `R${r.toString().padStart(2, '0')}: `;
  for (let c = 0; c < cols; c++) {
    let rSum = 0, gSum = 0, bSum = 0, count = 0;
    for (let y = 0; y < 16; y++) {
      for (let x = 0; x < 16; x++) {
        const idx = (png.width * (r * 16 + y) + (c * 16 + x)) << 2;
        if (png.data[idx + 3] > 10) {
          rSum += png.data[idx];
          gSum += png.data[idx + 1];
          bSum += png.data[idx + 2];
          count++;
        }
      }
    }
    if (count > 0) {
      const avgR = Math.floor(rSum / count);
      const avgG = Math.floor(gSum / count);
      const avgB = Math.floor(bSum / count);
      // Basic color classification
      let colorStr = " ";
      if (avgG > avgR && avgG > avgB && avgG > 100) colorStr = "G"; // Green
      else if (avgR > avgG && avgG > avgB && avgR > 100 && avgG > 50) colorStr = "B"; // Brown/Orange
      else if (avgB > avgR && avgB > avgG && avgB > 100) colorStr = "U"; // Blue
      else if (avgR > 200 && avgG > 200 && avgB > 200) colorStr = "W"; // White
      else if (avgR < 50 && avgG < 50 && avgB < 50) colorStr = "D"; // Dark
      else colorStr = "M"; // Mixed
      
      line += `[${colorStr}]`;
    } else {
      line += "   ";
    }
  }
  console.log(line);
}
