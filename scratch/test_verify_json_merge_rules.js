const { chromium } = require('playwright');
const path = require('path');

(async () => {
  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage();
  
  const htmlPath = 'file:///' + path.resolve(__dirname, '../game/index_v2.html').replace(/\\/g, '/');
  await page.goto(htmlPath);

  const res = await page.evaluate(() => {
    const sysData = window.LAND_SYSTEM_DATA;
    const hasConnectionBonus = !!(sysData && sysData.connectionBonusRules && sysData.connectionBonusRules['2_TILES_CONNECTED']);
    const hasSingleBlockConfig = !!(sysData && sysData.mergeRules && sysData.mergeRules['H1_PLAINS'] && sysData.mergeRules['H1_PLAINS'].unifyIntoSingleBlock);

    return {
      hasConnectionBonus,
      hasSingleBlockConfig,
      plains2TileBonus: sysData.connectionBonusRules['2_TILES_CONNECTED']['GL1_PLAINS'],
      plainsMergeRule: sysData.mergeRules['H1_PLAINS']
    };
  });

  console.log('JSON Master Merge & Connection Rules Verification:', res);
  await browser.close();

  if (res.hasConnectionBonus && res.hasSingleBlockConfig && res.plains2TileBonus.instantYield.food === 5) {
    console.log('TEST_PASS');
  } else {
    console.log('TEST_FAIL');
    process.exit(1);
  }
})();
