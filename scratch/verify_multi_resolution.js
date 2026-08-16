const { chromium } = require('playwright');

(async () => {
    const browser = await chromium.launch();
    
    // 1. 1366 x 768 (小型ノートPC)
    const pageLaptop = await browser.newPage({ viewport: { width: 1366, height: 768 } });
    await pageLaptop.goto('http://localhost:8000/game/index_v2.html');
    await pageLaptop.screenshot({ path: 'C:/Users/mam07/.gemini/antigravity/brain/5b868ecb-a33a-4010-b890-6fc37fefffc7/scratch/debug_res_1366x768.png' });
    console.log("1366x768 captured!");

    // 2. 1920 x 1080 (標準フルHD)
    const pageFullHD = await browser.newPage({ viewport: { width: 1920, height: 1080 } });
    await pageFullHD.goto('http://localhost:8000/game/index_v2.html');
    await pageFullHD.screenshot({ path: 'C:/Users/mam07/.gemini/antigravity/brain/5b868ecb-a33a-4010-b890-6fc37fefffc7/scratch/debug_res_1920x1080.png' });
    console.log("1920x1080 captured!");

    // 3. 2560 x 1440 (WQHD/4K)
    const page4K = await browser.newPage({ viewport: { width: 2560, height: 1440 } });
    await page4K.goto('http://localhost:8000/game/index_v2.html');
    await page4K.screenshot({ path: 'C:/Users/mam07/.gemini/antigravity/brain/5b868ecb-a33a-4010-b890-6fc37fefffc7/scratch/debug_res_2560x1440.png' });
    console.log("2560x1440 captured!");

    await browser.close();
})();
