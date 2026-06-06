const fs = require('fs');
const { PNG } = require('pngjs');

const data = fs.readFileSync('Sunny-land-woods-files/Assets/ENVIRONMENT/bg-clouds.png');
const png = PNG.sync.read(data);
const idx1 = 0;
const idx2 = ((png.height - 1) * png.width) << 2;
console.log(`Top-left pixel: #${png.data[idx1].toString(16).padStart(2,'0')}${png.data[idx1+1].toString(16).padStart(2,'0')}${png.data[idx1+2].toString(16).padStart(2,'0')}`);
console.log(`Bottom-left pixel: #${png.data[idx2].toString(16).padStart(2,'0')}${png.data[idx2+1].toString(16).padStart(2,'0')}${png.data[idx2+2].toString(16).padStart(2,'0')}`);
