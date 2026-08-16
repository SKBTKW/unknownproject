const { chromium } = require('playwright');
const path = require('path');

(async () => {
  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage();
  
  const htmlPath = 'file:///' + path.resolve(__dirname, '../game/index_v2.html').replace(/\\/g, '/');
  await page.goto(htmlPath);

  const res = await page.evaluate(() => {
    const state = window.state;
    const initialFood = state.food;
    const initialWood = state.wood;
    
    // 1x2 土地を配置
    const shape1x2 = [[1, 1]];
    const terrain = { id: 'GL1_PLAINS', nameKey: 'TERRAIN_PLAINS', yields: { food: 4, wood: 0, defense: 0, mystic: 0 } };
    state.placeShape(1, 1, shape1x2, terrain);

    const prods = state.calculateTotalProduction();
    
    // nextTurn() を呼び出してターンを進める
    window.nextTurn();

    const newFood = state.food;
    const newWood = state.wood;

    return {
      initialFood,
      initialWood,
      prodsFood: prods.totalFood,
      prodsWood: prods.totalWood,
      newFood,
      newWood,
      turn: state.turn
    };
  });

  console.log('Turn Yield Verification:', res);
  await browser.close();

  // initialFood (30) + prodsFood (18) - maintenance (20) = 28
  if (res.turn === 2 && res.newFood > res.initialFood - 20) {
    console.log('TEST_PASS');
  } else {
    console.log('TEST_FAIL');
    process.exit(1);
  }
})();
