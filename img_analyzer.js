const fs = require('fs');
const { PNG } = require('pngjs');

function analyze(filePath) {
  const data = fs.readFileSync(filePath);
  const png = PNG.sync.read(data);
  let minX = png.width, maxX = 0, minY = png.height, maxY = 0;
  for (let y = 0; y < png.height; y++) {
    for (let x = 0; x < png.width; x++) {
      const idx = (png.width * y + x) << 2;
      const alpha = png.data[idx + 3];
      if (alpha > 0) {
        if (x < minX) minX = x;
        if (x > maxX) maxX = x;
        if (y < minY) minY = y;
        if (y > maxY) maxY = y;
      }
    }
  }
  console.log(`${filePath}:`);
  console.log(`  width=${png.width}, height=${png.height}`);
  console.log(`  content bounds: minX=${minX}, maxX=${maxX}, minY=${minY}, maxY=${maxY}`);
  console.log(`  content size: w=${maxX - minX + 1}, h=${maxY - minY + 1}`);
}

analyze('Sunny-land-woods-files/Assets/ENVIRONMENT/props-sliced/branch-03.png');
analyze('Sunny-land-woods-files/Assets/ENVIRONMENT/props-sliced/branch-05.png');
