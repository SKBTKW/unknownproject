const { chromium } = require('playwright');
const path = require('path');

(async () => {
  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage();
  
  const htmlPath = 'file:///' + path.resolve(__dirname, '../game/index_v2.html').replace(/\\/g, '/');
  await page.goto(htmlPath);

  const res = await page.evaluate(() => {
    const state = window.state;
    // 1x2 形状カードの準備
    const shape1x2 = [[1, 1]];
    const terrain = { id: 'GL1_PLAINS', nameKey: 'TERRAIN_PLAINS', yields: { food: 4, wood: 0, defense: 0, mystic: 0 } };

    // 1. 本営 (2,2) に隣接しない (0,0) での 1x2 配置テスト -> 失敗すべき
    const checkInvalid = state.canPlaceShape(0, 0, shape1x2);
    
    // 2. 1x2 の先頭(0,1)は(2,2)に隣接しないが、2マス目(1,1)が本営(2,2)の北(1,2)の横で(1,2)と隣接... 
    // 本営 (2,2) の北隣 (1,2) に接する (1,1) での 1x2 (startR=1, startC=1) 配置 -> 成否判定
    const checkValid = state.canPlaceShape(1, 1, shape1x2);

    // 実際に (1,1) に 1x2 平地を配置
    const placeRes = state.placeShape(1, 1, shape1x2, terrain);

    // 産出計算の検証
    const prod = state.calculateTotalProduction();
    
    return {
      checkInvalidCan: checkInvalid.can,
      checkValidCan: checkValid.can,
      placeSuccess: placeRes.success,
      totalFood: prod.totalFood,
      totalWood: prod.totalWood
    };
  });

  console.log('Adjacency and Yield Verification:', res);
  
  await browser.close();

  if (!res.checkInvalidCan && res.checkValidCan && res.placeSuccess && res.totalFood > 10) {
    console.log('TEST_PASS');
  } else {
    console.log('TEST_FAIL');
    process.exit(1);
  }
})();
