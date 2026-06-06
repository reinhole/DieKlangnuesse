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

console.log("For branch type 3 (leafy):");
console.log(`b.top corresponds to Y_img = ${topOffset}`);
boxes.forEach(b => {
  // World Y goes UP. htop = b.top + b.yOffset.
  // toScreenY maps higher world Y to smaller screen Y.
  // So htop is drawn at: screenY - b.yOffset.
  // Image is drawn at: screenY - topOffset.
  // So Y_img = 0 is at screenY - topOffset.
  // The red line is at screenY - b.yOffset.
  // Distance from top of image (Y_img) to red line = (screenY - b.yOffset) - (screenY - topOffset) = topOffset - b.yOffset.
  const y_img_of_red_line = topOffset - b.yOffset;
  console.log(`x=${b.x} to ${b.x+b.w}: red line is at Y_img = ${y_img_of_red_line}`);
});
