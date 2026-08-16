const { chromium } = require('playwright');
const path = require('path');

(async () => {
  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage();
  
  const htmlPath = 'file:///' + path.resolve(__dirname, '../game/index_v2.html').replace(/\\/g, '/');
  
  // 1回目ロード
  await page.goto(htmlPath);
  const sockets1 = await page.evaluate(() => {
    const state = window.state;
    const positions = [];
    for (let r = 0; r < 5; r++) {
      for (let c = 0; c < 5; c++) {
        if (state.grid[r][c].hasSocket) positions.push(`${r},${c}`);
      }
    }
    return positions;
  });

  // 2回目ロード (リロードでグリッド再生成)
  await page.reload();
  const sockets2 = await page.evaluate(() => {
    const state = window.state;
    const positions = [];
    for (let r = 0; r < 5; r++) {
      for (let c = 0; c < 5; c++) {
        if (state.grid[r][c].hasSocket) positions.push(`${r},${c}`);
      }
    }
    return positions;
  });

  console.log('Socket Positions Run 1:', sockets1);
  console.log('Socket Positions Run 2:', sockets2);
  
  await browser.close();

  const isCount3 = sockets1.length === 3 && sockets2.length === 3;
  // 本営(2,2)および周囲8マスが含まれないことを検証
  const isHQVic = (posStr) => {
    const [r, c] = posStr.split(',').map(Number);
    return Math.abs(r - 2) <= 1 && Math.abs(c - 2) <= 1;
  };
  const noHQVic1 = !sockets1.some(isHQVic);
  const noHQVic2 = !sockets2.some(isHQVic);

  if (isCount3 && noHQVic1 && noHQVic2) {
    console.log('TEST_PASS');
  } else {
    console.log('TEST_FAIL');
    process.exit(1);
  }
})();
