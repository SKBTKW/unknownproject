const { chromium } = require('playwright');
const path = require('path');
const fs = require('fs');

(async () => {
  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage();
  await page.setViewportSize({ width: 1280, height: 960 });

  const htmlPath = 'file:///' + path.resolve(__dirname, '../game/index_v2.html').replace(/\\/g, '/');
  await page.goto(htmlPath);

  await page.waitForSelector('.app-wrapper');

  // 📸 プレビュー画像の撮影タイミングを明瞭に示すタイムスタンプバッジを追加
  await page.evaluate(() => {
    const now = new Date();
    const timeStr = now.getFullYear() + '-' +
      String(now.getMonth() + 1).padStart(2, '0') + '-' +
      String(now.getDate()).padStart(2, '0') + ' ' +
      String(now.getHours()).padStart(2, '0') + ':' +
      String(now.getMinutes()).padStart(2, '0') + ':' +
      String(now.getSeconds()).padStart(2, '0');

    let stampEl = document.getElementById('captureTimestampBadge');
    if (!stampEl) {
      stampEl = document.createElement('div');
      stampEl.id = 'captureTimestampBadge';
      stampEl.style.cssText = 'position:fixed; bottom:12px; left:12px; background:rgba(231,76,60,0.95); color:#ffffff; font-size:14px; font-weight:bold; padding:6px 14px; border-radius:6px; z-index:999999; box-shadow:0 4px 12px rgba(0,0,0,0.8); border:2px solid #ffffff;';
      document.body.appendChild(stampEl);
    }
    stampEl.innerText = `📸 実用プレビュー撮影時刻: ${timeStr}`;
  });

  await page.waitForTimeout(300);

  const artifactDir = 'C:/Users/mam07/.gemini/antigravity/brain/af6d4803-5dd7-4a55-87d7-472ecdecfde4';
  if (!fs.existsSync(artifactDir)) {
    fs.mkdirSync(artifactDir, { recursive: true });
  }

  const screenshotPath = path.join(artifactDir, 'game_preview_latest.png');
  await page.screenshot({ path: screenshotPath, fullPage: true });

  console.log('Screenshot saved to:', screenshotPath);
  await browser.close();
  console.log('TEST_PASS');
})();
