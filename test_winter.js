const fs = require('fs');
const { PNG } = require('pngjs');

function ascii(filePath) {
  if (!fs.existsSync(filePath)) {
    console.log("File not found:", filePath);
    return;
  }
  // gif is not supported by pngjs directly if it's a gif!
  console.log("Found file:", filePath);
}

ascii('Sunny-land-woods-files/Assets/ENVIRONMENT/winter/props-sliced/branche-left.gif');
ascii('Sunny-land-woods-files/Assets/ENVIRONMENT/winter/props-sliced/branche-right.gif');
