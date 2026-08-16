const { chromium } = require('playwright');
const path = require('path');

(async () => {
  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage();
  
  const htmlPath = 'file:///' + path.resolve(__dirname, '../game/index_v2.html').replace(/\\/g, '/');
  await page.goto(htmlPath);

  const res = await page.evaluate(() => {
    const sysData = window.LAND_SYSTEM_DATA;
    const hasHeightConfig = !!(sysData && sysData.heightConfig && sysData.heightConfig.H1 && sysData.heightConfig.H2 && sysData.heightConfig.H3);

    const h1Style = sysData.heightConfig.H1;
    const h2Style = sysData.heightConfig.H2;
    const h3Style = sysData.heightConfig.H3;

    return {
      hasHeightConfig,
      h1Style,
      h2Style,
      h3Style
    };
  });

  console.log('JSON Height Config Verification:', res);
  await browser.close();

  const isValid = res.h1Style.elevationTransform === 'translateY(0px)' &&
                  res.h2Style.elevationTransform === 'translateY(-2px)' &&
                  res.h3Style.elevationTransform === 'translateY(-4px)';

  if (res.hasHeightConfig && isValid) {
    console.log('TEST_PASS');
  } else {
    console.log('TEST_FAIL');
    process.exit(1);
  }
})();
