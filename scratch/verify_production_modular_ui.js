const { chromium } = require('playwright');

(async () => {
    const browser = await chromium.launch();
    const context = await browser.newContext({ ignoreHTTPSErrors: true });
    const page = await context.newPage({ viewport: { width: 1400, height: 900 } });

    const timeStamp = Date.now();
    await page.goto(`http://localhost:8080/index_v2.html?t=${timeStamp}`, { waitUntil: 'domcontentloaded' });

    // ユーザー様と同じ「バフ0件の初期状態」
    await page.evaluate(() => {
        window.BUFF_FEATURE_FLAGS = {
            enableEmberBuff: false,
            enableCardBuff: true,
            enableTrialBuff: true
        };
        if (window.BuffPanelComponent) {
            window.BuffPanelComponent.update([]); // バフ0件
        }
    });

    await page.waitForTimeout(600);

    const brainDir = 'C:/Users/mam07/.gemini/antigravity/brain/af6d4803-5dd7-4a55-87d7-472ecdecfde4';
    
    // 1. 通常時 (マウスが下部エリア外の盤面上にある状態)
    const pathNormal = `${brainDir}/normal_focus_${timeStamp}.png`;
    await page.screenshot({ path: pathNormal });
    console.log(`Captured normal focus state: ${pathNormal}`);

    // 2. 下部カードエリアにマウスが乗った時 (ボカシフォーカス発生状態)
    await page.hover('.bottom-card-container');
    await page.waitForTimeout(400); // アニメーション待ち

    const pathFocused = `${brainDir}/card_hover_focus_${timeStamp}.png`;
    await page.screenshot({ path: pathFocused });
    console.log(`Captured card hover focus state: ${pathFocused}`);

    await browser.close();
})();
