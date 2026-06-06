const fs = require('fs');
const { PNG } = require('pngjs');

function ascii(filePath) {
  if (!fs.existsSync(filePath)) return;
  const data = fs.readFileSync(filePath);
  const png = PNG.sync.read(data);
  console.log(`\n--- ${filePath} ---`);
  for (let y = 0; y < png.height; y += 2) {
    let row = '';
    for (let x = 0; x < png.width; x += 2) {
      const idx = (png.width * y + x) << 2;
      const a = png.data[idx + 3];
      row += a > 128 ? '#' : ' ';
    }
    console.log(row);
  }
}

ascii('Sunny-land-woods-files/Assets/ENVIRONMENT/props-sliced/branch-01.png');
ascii('Sunny-land-woods-files/Assets/ENVIRONMENT/props-sliced/branch-02.png');
ascii('Sunny-land-woods-files/Assets/ENVIRONMENT/props-sliced/branch-04.png');
