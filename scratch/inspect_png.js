const { chromium } = require('@playwright/test');
const path = require('path');

(async () => {
  const browser = await chromium.launch();
  const page = await browser.newPage();
  
  // Navigate to localhost:3000 where our server is running.
  await page.goto('http://localhost:3000');
  
  const results = await page.evaluate(async () => {
    const checkImage = async (url) => {
      return new Promise((resolve) => {
        const img = new Image();
        img.onload = () => {
          const canvas = document.createElement('canvas');
          canvas.width = img.width;
          canvas.height = img.height;
          const ctx = canvas.getContext('2d');
          ctx.drawImage(img, 0, 0);
          
          // Let's sample the top row of pixels
          const imgData = ctx.getImageData(0, 0, img.width, 1);
          let transparentCount = 0;
          let opaqueColors = [];
          for (let i = 0; i < imgData.data.length; i += 4) {
            const r = imgData.data[i];
            const g = imgData.data[i+1];
            const b = imgData.data[i+2];
            const a = imgData.data[i+3];
            if (a === 0) {
              transparentCount++;
            } else {
              opaqueColors.push(`rgba(${r},${g},${b},${a})`);
            }
          }
          resolve({
            width: img.width,
            height: img.height,
            transparentCount,
            totalPixels: img.width,
            opaqueColors: Array.from(new Set(opaqueColors)).slice(0, 5) // unique colors
          });
        };
        img.src = url;
      });
    };
    
    return {
      bgClouds: await checkImage('/Sunny-land-woods-files/Assets/ENVIRONMENT/bg-clouds.png'),
      bgMountains: await checkImage('/Sunny-land-woods-files/Assets/ENVIRONMENT/bg-mountains.png'),
      bgTrees: await checkImage('/Sunny-land-woods-files/Assets/ENVIRONMENT/bg-trees.png')
    };
  });
  
  console.log(JSON.stringify(results, null, 2));
  await browser.close();
})();
