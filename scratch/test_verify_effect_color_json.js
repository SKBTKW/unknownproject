const { chromium } = require('playwright');
const path = require('path');

(async () => {
  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage();
  
  const htmlPath = 'file:///' + path.resolve(__dirname, '../game/index_v2.html').replace(/\\/g, '/');
  await page.goto(htmlPath);

  const res = await page.evaluate(() => {
    const sysData = window.LAND_SYSTEM_DATA;
    const hasEffectConfig = !!(sysData && sysData.effectConfig && sysData.effectConfig.mergeToast);
    
    const gl1Color = sysData.terrains.GL1_PLAINS.colorConfig;
    const gl2Color = sysData.terrains.GL2_FOREST.colorConfig;
    const gl3Color = sysData.terrains.GL3_DEEP_FOREST.colorConfig;

    return {
      hasEffectConfig,
      gl1Color,
      gl2Color,
      gl3Color,
      mergeToastTemplate: sysData.effectConfig.mergeToast.toastTemplate
    };
  });

  console.log('JSON Effect & Color Patterns Verification:', res);
  await browser.close();

  const isGradientValid = res.gl1Color.bgColor === '#eef5b2' && res.gl2Color.bgColor === '#2ecc71' && res.gl3Color.bgColor === '#145a32';

  if (res.hasEffectConfig && isGradientValid) {
    console.log('TEST_PASS');
  } else {
    console.log('TEST_FAIL');
    process.exit(1);
  }
})();
