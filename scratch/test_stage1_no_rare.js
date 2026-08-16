const { chromium } = require('playwright');
const path = require('path');

(async () => {
  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage();
  
  const htmlPath = 'file:///' + path.resolve(__dirname, '../game/index_v2.html').replace(/\\/g, '/');
  await page.goto(htmlPath);

  const res = await page.evaluate(() => {
    const drawSys = window.drawSys;
    const state = window.state;

    let hasIllegalRare = false;

    // 100回のオファリング再生成（計300枚ドロー）で Stage 1 で R や UR が提示されないか検証
    for (let iter = 0; iter < 100; iter++) {
      drawSys.generateOfferingCards();
      const offering = state.handOffering;
      for (const card of offering) {
        if (!card || card.isBlank) continue;
        const rarity = card.terrain ? card.terrain.rarity : 'C';
        if (rarity === 'R' || rarity === 'UR' || rarity === 'r' || rarity === 'ur' || rarity === 'l' || rarity === 'L') {
          hasIllegalRare = true;
          break;
        }
      }
      if (hasIllegalRare) break;
    }

    return {
      hasIllegalRare
    };
  });

  console.log('Stage 1 R/UR Prohibition Check:', res);
  await browser.close();

  if (!res.hasIllegalRare) {
    console.log('TEST_PASS');
  } else {
    console.log('TEST_FAIL');
    process.exit(1);
  }
})();
