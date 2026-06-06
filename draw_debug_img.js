const fs = require('fs');
const { createCanvas, loadImage } = require('canvas');
(async () => {
  const img = await loadImage('sunnyland winter forest files/ENVIRONMENT/props-sliced/branch-03.png');
  const canvas = createCanvas(img.width, img.height);
  const ctx = canvas.getContext('2d');
  ctx.drawImage(img, 0, 0);

  // draw the red line
  ctx.fillStyle = 'rgba(255, 0, 0, 0.5)';
  const boxes = [
    {x: 0,  w: 10, yOffset: -6},
    {x: 10, w: 10, yOffset: -3},
    {x: 20, w: 10, yOffset: -1},
    {x: 30, w: 40, yOffset: 0},
    {x: 70, w: 10, yOffset: 2},
    {x: 80, w: 10, yOffset: 4},
    {x: 90, w: 10, yOffset: 6}
  ];
  const topOffset = 22;
  boxes.forEach(b => {
    const y_img = topOffset - b.yOffset;
    ctx.fillRect(b.x, y_img, b.w, 2);
  });

  const buffer = canvas.toBuffer('image/png');
  fs.writeFileSync('/Users/olereinhold/.gemini/antigravity/brain/256f3641-895a-4374-a228-59bef92c01df/artifacts/debug_branch3.png', buffer);
})();
