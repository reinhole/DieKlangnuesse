const { chromium } = require('playwright');
const path = require('path');

(async () => {
  const browser = await chromium.launch();
  const page = await browser.newPage();
  const fileUrl = 'file://' + path.resolve(__dirname, 'index.html');
  await page.goto(fileUrl);
  await page.waitForTimeout(1000);
  await page.screenshot({ path: '/Users/olereinhold/.gemini/antigravity/brain/256f3641-895a-4374-a228-59bef92c01df/artifacts/screenshot.png' });
  await browser.close();
})();
