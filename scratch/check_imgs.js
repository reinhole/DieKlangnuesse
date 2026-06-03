const fs = require('fs');
const PNG = require('pngjs').PNG;
// we can't easily parse gif without a library, let's just see if they exist and are accessible.
console.log('Winter assets:');
const wDir = 'sunnyland winter forest files/ENVIRONMENT/';
console.log(fs.readdirSync(wDir));
console.log(fs.readdirSync(wDir + 'props-sliced'));
