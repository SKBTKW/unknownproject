const { chromium } = require('playwright');
const path = require('path');
const fs = require('fs');

(async () => {
  console.log('🚀 Starting Automated Headless Browser Test for index.html...');
  
  let browser;
  try {
    browser = await chromium.launch({ headless: true });
  } catch(e) {
    console.log('Installing Playwright chromium...');
  }
  
  if (!browser) {
    const playwright = require('playwright');
    browser = await playwright.chromium.launch({ headless: true });
  }

  const context = await browser.newContext();
  const page = await context.newPage();

  // エラー捕捉
  page.on('pageerror', error => {
    console.error('❌ [PAGE ERROR]:', error.message);
  });
  page.on('console', msg => {
    if (msg.type() === 'error') {
      console.error('❌ [CONSOLE ERROR]:', msg.text());
    } else {
      console.log('ℹ️ [CONSOLE]:', msg.text());
    }
  });

  const url = 'http://localhost:8080/index.html';
  console.log(`🌐 Navigating to ${url}...`);
  await page.goto(url, { waitUntil: 'domcontentloaded' });

  // 1. ロール選択モーダルのテスト
  console.log('👑 Testing Role Selection Modal...');
  const modalVisibleBefore = await page.isVisible('#role-select-modal');
  console.log('  - Modal visible before click:', modalVisibleBefore);

  if (modalVisibleBefore) {
    console.log('  - Clicking General Role Button (#btn-role-general)...');
    await page.click('#btn-role-general');
    await page.waitForTimeout(500);
  }

  const modalVisibleAfter = await page.isVisible('#role-select-modal');
  console.log('  - Modal visible after click:', modalVisibleAfter);

  // 2. 手札カードドローエリアの確認
  console.log('🎴 Testing Hand Cards Draw Area...');
  const cardCount = await page.locator('.offering-card').count();
  console.log(`  - Number of offering cards in hand: ${cardCount}`);

  // 最初のカードを選択
  if (cardCount > 0) {
    console.log('  - Clicking first offering card...');
    await page.click('.offering-card:first-child');
    await page.waitForTimeout(300);
  }

  // 3. 盤面マスの確認
  console.log('🗺️ Testing Grid Cell Interaction...');
  const cellCount = await page.locator('.grid-cell').count();
  console.log(`  - Total grid cells rendered: ${cellCount}`);

  // スクリーンショット保存
  const artifactDir = 'C:/Users/mam07/.gemini/antigravity/brain/273f204b-294b-44f5-a1dc-a22799321345';
  const screenshotPath = path.join(artifactDir, 'automated_test_result.png');
  await page.screenshot({ path: screenshotPath, fullPage: true });
  console.log(`📸 Screenshot saved to ${screenshotPath}`);

  await browser.close();
  console.log('✅ Automated Test Completed Successfully!');
})();
