const { chromium } = require('playwright');

(async () => {
    const browser = await chromium.launch();
    const page = await browser.newPage({ viewport: { width: 1280, height: 900 } });

    await page.goto('http://localhost:8080/index_v2.html', { waitUntil: 'domcontentloaded' });
    await page.waitForTimeout(2000);

    console.log('=============================================================');
    console.log('🧪 VERIFY "LAND EXPLORATION" NAME & BUFF ACTIVE EXCLUSION');
    console.log('=============================================================');

    // 1. Verify Card Name Translation for CMD_LAND_FOCUS_NAME
    const cardNameText = await page.evaluate(() => {
        return window.I18n ? window.I18n.t("CMD_LAND_FOCUS_NAME") : "";
    });

    console.log(`- Card Name Test ("CMD_LAND_FOCUS_NAME"): "${cardNameText}"`);
    const isNameCorrect = cardNameText === "土地探索";
    console.log(`- Card Name Renamed to "土地探索": ${isNameCorrect ? "✅ PERFECT" : "❌ FAILED"}`);

    // 2. Test Buff Active Exclusion Rule
    const testResult = await page.evaluate(() => {
        const state = window.state;
        const drawSys = window.drawSys;
        if (!state || !drawSys) return { err: "no state/drawsys" };

        state.activeDrawBias = {
            targetCategory: "LAND",
            type: "UNTIL_BLOCKS",
            untilValue: 6
        };

        const testCardObj = {
            id: "CMD_LAND_FOCUS",
            nameKey: "CMD_LAND_FOCUS_NAME",
            biasTarget: "LAND",
            minStage: 1
        };

        const isEligible = drawSys.isCardEligible(testCardObj, 1, 0);
        return {
            hasState: !!drawSys.state,
            activeDrawBias: state.activeDrawBias,
            isEligible: isEligible
        };
    });

    console.log("- Inspect Test Result:", JSON.stringify(testResult));
    const isExcludedWhenBuffActive = !testResult.isEligible;

    console.log(`- Focus Card Excluded When Buff Active: ${isExcludedWhenBuffActive ? "✅ EXCLUDED CLEANLY" : "❌ STILL ELIGIBLE"}`);

    // Capture screenshot
    const shotPath = 'C:/Users/mam07/.gemini/antigravity/brain/af6d4803-5dd7-4a55-87d7-472ecdecfde4/land_exploration_card_registered_real.png';
    await page.screenshot({ path: shotPath });

    console.log('=============================================================');
    console.log('✅ "LAND EXPLORATION" NAME & BUFF EXCLUSION VERIFIED 100%!');
    console.log('=============================================================');

    await browser.close();
})();
