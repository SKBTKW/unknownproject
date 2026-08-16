const { chromium } = require('playwright');
const path = require('path');

(async () => {
  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage();
  await page.setViewportSize({ width: 1280, height: 960 });

  const htmlPath = 'file:///' + path.resolve(__dirname, '../game/index_v2.html').replace(/\\/g, '/');
  await page.goto(htmlPath);

  await page.waitForFunction('window.state !== undefined && window.state !== null');

  const res = await page.evaluate(() => {
    const state = window.state;
    const plains1x2 = { id: "CARD_PLAINS_1X2", terrainId: "GL1_PLAINS", nameKey: "TERRAIN_PLAINS", gl: 1, h: 1, food: 4, wood: 0, def: 0, mystic: 0, shape: [[1, 1]] };

    // 1x2 ブロック単体を本営(2,2)の隣 (1,2)-(1,3) に1つだけ配置
    state.hasPickedThisTurn = false;
    const initialFood = state.food;
    const initialWood = state.wood;

    state.placeShape(1, 2, plains1x2.shape, plains1x2);

    // ログおよびトーストキューをチェック
    const connectionLogs = state.gameLogs.filter(l => l.includes('連結成立'));
    const connectionToasts = state.toastQueue.filter(t => t.text.includes('連結ボーナス'));

    return {
      connectionLogCount: connectionLogs.length,
      connectionToastCount: connectionToasts.length,
      foodDiff: state.food - initialFood,
      woodDiff: state.wood - initialWood
    };
  });

  console.log('Single 1x2 Block Placement Connection Bonus Verification:', res);
  await browser.close();

  if (res.connectionLogCount === 0 && res.connectionToastCount === 0 && res.foodDiff === 0) {
    console.log('TEST_PASS');
  } else {
    console.log('TEST_FAIL');
    process.exit(1);
  }
})();
