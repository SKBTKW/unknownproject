const { chromium } = require('playwright');
const path = require('path');
const fs = require('fs');

(async () => {
  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage();
  await page.setViewportSize({ width: 1280, height: 960 });
  
  const htmlPath = 'file:///' + path.resolve(__dirname, '../game/index_v2.html').replace(/\\/g, '/');
  await page.goto(htmlPath);

  const res = await page.evaluate(() => {
    const state = window.state;
    const plains1x2 = { id: "CARD_PLAINS_1X2", terrainId: "GL1_PLAINS", nameKey: "TERRAIN_PLAINS", gl: 1, h: 1, food: 4, wood: 0, def: 0, mystic: 0, shape: [[1, 1]] };
    const plains1x1 = { id: "CARD_PLAINS_1X1", terrainId: "GL1_PLAINS", nameKey: "TERRAIN_PLAINS", gl: 1, h: 1, food: 4, wood: 0, def: 0, mystic: 0, shape: [[1]] };

    // 配置・連結・マージ操作
    state.hasPickedThisTurn = false;
    state.placeShape(1, 2, plains1x2.shape, plains1x2);
    state.hasPickedThisTurn = false;
    state.placeShape(0, 2, plains1x1.shape, plains1x1);
    state.hasPickedThisTurn = false;
    state.placeShape(0, 3, plains1x1.shape, plains1x1);

    window.render();

    const logContainer = document.getElementById('logContent');
    const logEntries = Array.from(logContainer.children).map(c => c.innerText);

    return {
      logCount: logEntries.length,
      logEntries,
      hasMergeLog: logEntries.some(e => e.includes('マージ') || e.includes('2x2')),
      hasPlaceLog: logEntries.some(e => e.includes('配置') || e.includes('草原'))
    };
  });

  // スクリーンショットプレビューの更新
  const artifactDir = 'C:/Users/mam07/.gemini/antigravity/brain/af6d4803-5dd7-4a55-87d7-472ecdecfde4';
  if (!fs.existsSync(artifactDir)) {
    fs.mkdirSync(artifactDir, { recursive: true });
  }
  const screenshotPath = path.join(artifactDir, 'game_log_system_preview.png');
  await page.screenshot({ path: screenshotPath, fullPage: true });

  console.log('Log System Verification:', res);
  await browser.close();

  if (res.logCount > 0 && res.hasMergeLog && res.hasPlaceLog) {
    console.log('TEST_PASS');
  } else {
    console.log('TEST_FAIL');
    process.exit(1);
  }
})();
