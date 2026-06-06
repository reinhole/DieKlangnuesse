const fs = require('fs');
const { PNG } = require('pngjs');

function checkTransparency(filename) {
  try {
    const data = fs.readFileSync(filename);
    const png = PNG.sync.read(data);
    let hasTransparent = false;
    let isSolidTopLine = true;
    for (let x = 0; x < png.width; x++) {
      const idx = (0 * png.width + x) << 2;
      if (png.data[idx+3] === 0) {
        isSolidTopLine = false;
      }
    }
    console.log(`${filename}: size ${png.width}x${png.height}, top line solid: ${isSolidTopLine}`);
  } catch (e) {
    console.log(`${filename}: error ${e.message}`);
  }
}

checkTransparency('Sunny-land-woods-files/Assets/ENVIRONMENT/bg-clouds.png');
checkTransparency('Sunny-land-woods-files/Assets/ENVIRONMENT/bg-mountains.png');
checkTransparency('Sunny-land-woods-files/Assets/ENVIRONMENT/bg-trees.png');
