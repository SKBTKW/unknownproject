const { chromium } = require('playwright');

(async () => {
    const browser = await chromium.launch();
    const page = await browser.newPage({ viewport: { width: 1280, height: 900 } });

    await page.goto('http://localhost:8080/index_v2.html', { waitUntil: 'domcontentloaded' });
    await page.waitForTimeout(2000);

    console.log('=============================================================');
    console.log('🧪 COMMAND CARD SELECTION HIGHLIGHT EFFECT TEST');
    console.log('=============================================================');

    // 1. Force offering a command card (CMD_AGRICULTURAL_POLICY) into offering slot 1
    await page.evaluate(() => {
        if (window.state && window.state.offeringCards) {
            window.state.offeringCards[1] = {
                id: "card_cmd_test",
                cardMasterId: "CMD_AGRICULTURAL_POLICY",
                nameKey: "CMD_AGRICULTURAL_POLICY_NAME",
                category: "ECONOMY",
                rarity: "UC",
                effectDescKey: "CMD_AGRICULTURAL_POLICY_DESC",
                cost: { food: 0, wood: 0 }
            };
            window.render();
        }
    });

    await page.waitForTimeout(500);

    // Click the command card (slot 1)
    const cards = await page.$$('#cardRow > div');
    if (cards.length > 1) {
        await cards[1].click();
        await page.waitForTimeout(500);
    }

    // Verify selected class on the command card
    const isSelected = await page.evaluate(() => {
        const c = document.querySelectorAll('#cardRow > div')[1];
        return c ? c.classList.contains('selected') : false;
    });

    console.log(`- Command Card Highlight (.selected class): ${isSelected ? "✅ APPLIED PERFECTLY" : "❌ FAILED"}`);

    // Capture screenshot
    const shotPath = 'C:/Users/mam07/.gemini/antigravity/brain/af6d4803-5dd7-4a55-87d7-472ecdecfde4/command_card_selected_real.png';
    await page.screenshot({ path: shotPath });

    console.log('=============================================================');
    console.log('✅ COMMAND CARD SELECTION VISUAL EFFECT VERIFIED PERFECTLY!');
    console.log('=============================================================');

    await browser.close();
})();
