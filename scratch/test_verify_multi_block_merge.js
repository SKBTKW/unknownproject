const { chromium } = require('playwright');
const path = require('path');

(async () => {
  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage();
  
  const htmlPath = 'file:///' + path.resolve(__dirname, '../game/index_v2.html').replace(/\\/g, '/');
  await page.goto(htmlPath);

  const res = await page.evaluate(() => {
    const state = window.state;
    const plains1x2 = { id: "CARD_PLAINS_1X2", terrainId: "GL1_PLAINS", nameKey: "TERRAIN_PLAINS", gl: 1, h: 1, food: 4, wood: 0, def: 0, mystic: 0, shape: [[1, 1]] };
    const plains1x1 = { id: "CARD_PLAINS_1X1", terrainId: "GL1_PLAINS", nameKey: "TERRAIN_PLAINS", gl: 1, h: 1, food: 4, wood: 0, def: 0, mystic: 0, shape: [[1]] };

    // 1. (1,2)-(1,3) に 1x2 平地を配置 (本営(2,2)の上隣)
    state.hasPickedThisTurn = false;
    const res1 = state.placeShape(1, 2, plains1x2.shape, plains1x2);
    // (0,2) に 1x1 平地を配置 (1,2 に隣接)
    state.hasPickedThisTurn = false;
    const res2 = state.placeShape(0, 2, plains1x1.shape, plains1x1);
    // (0,3) に 1x1 平地を配置 (0,2 および 1,3 に隣接)
    state.hasPickedThisTurn = false;
    const res3 = state.placeShape(0, 3, plains1x1.shape, plains1x1);

    // マージ状態の確認
    const c02 = state.grid[0][2];
    const c03 = state.grid[0][3];
    const c12 = state.grid[1][2];
    const c13 = state.grid[1][3];

    const isMerged = c02.merged && c03.merged && c12.merged && c13.merged;
    const sameGroupId = c02.mergeGroupId && (c02.mergeGroupId === c03.mergeGroupId) && (c02.mergeGroupId === c12.mergeGroupId) && (c02.mergeGroupId === c13.mergeGroupId);

    return {
      res1, res2, res3,
      isMerged,
      sameGroupId,
      groupId: c02.mergeGroupId,
      ember: state.ember
    };
  });

  console.log('Multi-block Merge & Shape Unification Verification:', res);
  await browser.close();

  if (res.isMerged && res.sameGroupId) {
    console.log('TEST_PASS');
  } else {
    console.log('TEST_FAIL');
    process.exit(1);
  }
})();
