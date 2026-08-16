const { chromium } = require('playwright');
const path = require('path');

(async () => {
  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage();
  
  const consoleLogs = [];
  const pageErrors = [];

  page.on('response', resp => {
    if (resp.status() >= 400) {
      console.log(`[HTTP ${resp.status()}] ${resp.url()}`);
    }
  });

  const htmlPath = 'http://localhost:8080/index_v2.html';
  console.log('Navigating to:', htmlPath);
  await page.goto(htmlPath);

  await page.waitForSelector('.cell');

  const content = await page.content();
  console.log('PAGE CONTENT LENGTH:', content.length);
  console.log('PAGE TITLE:', await page.title());

  const evalResult = await page.evaluate(() => {
    return {
      hasState: !!window.state,
      hasDrawSys: !!window.drawSys,
      boardChildren: document.getElementById('gridBoard') ? document.getElementById('gridBoard').children.length : 0,
      cardRowChildren: document.getElementById('cardRow') ? document.getElementById('cardRow').children.length : 0,
      appTitleText: document.getElementById('lblAppTitle') ? document.getElementById('lblAppTitle').innerText : '',
      foodText: document.getElementById('lblFood') ? document.getElementById('lblFood').innerText : ''
    };
  });

  console.log('DEBUG EVAL RESULT:', evalResult);
  console.log('PAGE ERRORS:', pageErrors);
  console.log('CONSOLE LOGS:', consoleLogs);

  await browser.close();
})();
