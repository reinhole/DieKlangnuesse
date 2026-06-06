const { chromium } = require('playwright');
const { exec } = require('child_process');

// Start simple server
const server = exec('npx http-server -p 8080');

setTimeout(async () => {
  try {
    const browser = await chromium.launch();
    const page = await browser.newPage();
    await page.goto('http://localhost:8080/index.html');
    await page.waitForTimeout(1500); // Wait for level gen and images
    await page.screenshot({ path: '/Users/olereinhold/.gemini/antigravity/brain/256f3641-895a-4374-a228-59bef92c01df/artifacts/real_screenshot.png' });
    await browser.close();
  } catch (e) {
    console.error(e);
  } finally {
    server.kill();
    process.exit(0);
  }
}, 2000); // Give server 2s to start
