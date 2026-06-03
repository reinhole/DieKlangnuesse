const fs = require('fs');
const path = require('path');

const dir = path.join(__dirname, '..', 'Sunny-land-woods-files', 'Assets', 'ENVIRONMENT');
const files = ['bg-clouds.png', 'bg-mountains.png', 'bg-trees.png'];

files.forEach(file => {
  const filepath = path.join(dir, file);
  if (!fs.existsSync(filepath)) {
    console.log(`${file} does not exist`);
    return;
  }
  const buffer = fs.readFileSync(filepath);
  const width = buffer.readUInt32BE(16);
  const height = buffer.readUInt32BE(20);
  console.log(`${file}: ${width}x${height}`);
});
