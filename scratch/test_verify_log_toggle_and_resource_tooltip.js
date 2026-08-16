const { chromium } = require('playwright');
const path = require('path');

(async () => {
  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage();
  await page.setViewportSize({ width: 1280, height: 960 });

  const htmlPath = 'file:///' + path.resolve(__dirname, '../game/index_v2.html').replace(/\\/g, '/');
  await page.goto(htmlPath);
  await page.waitForSelector('#gridBoard');

  // 1. ログトグルテスト
  const logBtn = await page.$('#btnLogToggle');
  const initialDisplay = await page.evaluate(() => document.getElementById('logContent').style.display);

  await logBtn.click();
  const toggledDisplay = await page.evaluate(() => document.getElementById('logContent').style.display);

  await logBtn.click();
  const restoredDisplay = await page.evaluate(() => document.getElementById('logContent').style.display);

  // 2. リソースパネルホバー・クリックテスト
  const foodSpan = await page.$('#lblFood');
  if (foodSpan) {
    await foodSpan.hover();
  }

  const tooltipRes = await page.evaluate(() => {
    const tt = document.getElementById('tileTooltip');
    return {
      styleDisplay: tt ? tt.style.display : '',
      text: tt ? tt.innerText : ''
    };
  });

  console.log('Log Toggle & Resource Tooltip Verification:', {
    initialDisplay,
    toggledDisplay,
    restoredDisplay,
    tooltipRes
  });

  await browser.close();

  if (toggledDisplay === 'none' && tooltipRes.styleDisplay === 'block' && tooltipRes.text.includes('全産出:')) {
    console.log('TEST_PASS');
  } else {
    console.log('TEST_FAIL');
    process.exit(1);
  }
})();
