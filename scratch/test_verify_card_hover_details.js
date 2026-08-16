const { chromium } = require('playwright');
const path = require('path');

(async () => {
  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage();
  await page.setViewportSize({ width: 1280, height: 960 });

  const htmlPath = 'file:///' + path.resolve(__dirname, '../game/index_v2.html').replace(/\\/g, '/');
  await page.goto(htmlPath);

  // オファリングカード1枚目のエレメントを取得してマウスオーバー
  const firstCard = await page.$('.subgroup-cards-row .card-frame-tcg');
  if (firstCard) {
    await firstCard.hover();
  }

  const res = await page.evaluate(() => {
    const tt = document.getElementById('tileTooltip');
    const isVisible = tt && tt.style.display === 'block';
    const text = tt ? tt.innerText : '';
    return {
      isVisible,
      text
    };
  });

  console.log('Card Hover Detail Verification:', res);
  await browser.close();

  if (res.isVisible && (res.text.includes('属性:') || res.text.includes('産出:'))) {
    console.log('TEST_PASS');
  } else {
    console.log('TEST_FAIL');
    process.exit(1);
  }
})();
