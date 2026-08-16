const { chromium } = require('playwright');
const path = require('path');

(async () => {
    try {
        const browser = await chromium.launch();
        const page = await browser.newPage();
        const htmlPath = 'file:///' + path.resolve('./game/index_v2.html').replace(/\\/g, '/');

        await page.goto(htmlPath);
        await page.waitForTimeout(1000);

        const cardTitles = await page.locator('.tcg-title-pill').allInnerTexts();
        const cardRarities = await page.locator('.tcg-rarity-code').allInnerTexts();
        const yieldStrips = await page.locator('.tcg-yield-strip').allInnerTexts();

        console.log("Card Titles Rendered:", cardTitles);
        console.log("Card Rarities Rendered:", cardRarities);
        console.log("Yield Strips Rendered:", yieldStrips);

        const hasMountain = cardTitles.some(t => t.includes("山岳") || t.includes("Mountain"));
        const hasUnlocalized = cardTitles.some(t => t.includes("TERRAIN_"));

        console.log("Verification checks:");
        console.log(" - Has Mountain illegally at turn 1?:", hasMountain ? "FAIL ❌" : "PASS ✅ (No mountain drawn)");
        console.log(" - Has unlocalized TERRAIN_ text?:", hasUnlocalized ? "FAIL ❌" : "PASS ✅ (All localized)");

        await browser.close();
    } catch(e) {
        console.error("Verification error:", e);
    }
})();
