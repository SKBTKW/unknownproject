const { chromium } = require('playwright');
const path = require('path');

(async () => {
  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage();
  
  const htmlPath = 'file:///' + path.resolve(__dirname, '../game/index_v2.html').replace(/\\/g, '/');
  await page.goto(htmlPath);

  const res = await page.evaluate(() => {
    const state = window.state;
    
    // (1,2) は本営(2,2)の北隣＝本営周囲マスの1つ
    const isVic = state.isHQVicinity(1, 2);
    
    // (1,2) に 1x1 平地(food:4, wood:0, def:0, mystic:0)を配置
    const shape1x1 = [[1]];
    const terrain = { id: 'GL1_PLAINS', nameKey: 'TERRAIN_PLAINS', yields: { food: 4, wood: 0, defense: 0, mystic: 0 } };
    state.placeShape(1, 2, shape1x1, terrain);

    // 全体産出計算の検証
    const prod = state.calculateTotalProduction();
    
    // ツールチップ関数を手動実行し、innerHTML の内容を検証
    const dummyCellData = state.grid[1][2];
    const dummyEvent = { clientX: 100, clientY: 100 };
    window.showTileTooltip(dummyEvent, 1, 2, dummyCellData);
    
    const ttEl = document.getElementById("tileTooltip");
    const ttHtml = ttEl ? ttEl.innerHTML : "";

    return {
      isVic,
      totalFood: prod.totalFood, // 10(本営) + 4(平地) + 1(本営周囲ボーナス) = 15
      totalWood: prod.totalWood, // 10(本営) + 0 + 1(本営周囲ボーナス) = 11
      ttHtml
    };
  });

  console.log('HQ Vicinity & Tooltip Verification:', res);
  await browser.close();

  const passProd = (res.totalFood === 15 && res.totalWood === 11);
  const passTt = res.ttHtml.includes('🌾+5') && res.ttHtml.includes('(+1本営)');

  if (res.isVic && passProd && passTt) {
    console.log('TEST_PASS');
  } else {
    console.log('TEST_FAIL');
    process.exit(1);
  }
})();
