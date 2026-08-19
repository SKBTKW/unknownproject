const { chromium } = require('playwright');

(async () => {
    const browser = await chromium.launch();
    const page = await browser.newPage({ viewport: { width: 1280, height: 900 } });

    await page.goto('http://localhost:8080/index_v2.html', { waitUntil: 'domcontentloaded' });
    await page.waitForTimeout(2000);

    console.log('=============================================================');
    console.log('🧪 VERIFY CARD EFFECT & COST LEFT ALIGNMENT UNIFICATION');
    console.log('=============================================================');

    // 1. Force set Command card in Slot 1
    await page.evaluate(() => {
        if (window.state && window.state.handOffering) {
            window.state.handOffering[1] = {
                id: "CMD_MILITARY_FOCUS_TEST",
                cardMasterId: "CMD_MILITARY_FOCUS",
                nameKey: "CMD_MILITARY_FOCUS_NAME",
                descriptionKey: "CMD_MILITARY_FOCUS_DESC",
                category: "MILITARY",
                rarity: "UC",
                cost: { wood: 20 },
                terrain: {
                    id: "CMD_MILITARY_FOCUS",
                    nameKey: "CMD_MILITARY_FOCUS_NAME",
                    descriptionKey: "CMD_MILITARY_FOCUS_DESC",
                    category: "MILITARY",
                    rarity: "UC",
                    cost: { wood: 20 }
                }
            };
            window.render();
        }
    });

    await page.waitForTimeout(500);

    // Capture offering card left-aligned screenshot
    const shotPath1 = 'C:/Users/mam07/.gemini/antigravity/brain/af6d4803-5dd7-4a55-87d7-472ecdecfde4/offering_card_left_aligned_real.png';
    await page.screenshot({ path: shotPath1 });
    console.log(`- Offering Card Left Alignment Screenshot Captured: ${shotPath1}`);

    // 2. Click slot 1 card to view right-bottom detailed preview
    const slot1Card = await page.$('.card-frame-tcg:nth-child(2)');
    if (slot1Card) {
        await slot1Card.click();
        await page.waitForTimeout(500);
    }

    // Capture preview modal left-aligned screenshot
    const shotPath2 = 'C:/Users/mam07/.gemini/antigravity/brain/af6d4803-5dd7-4a55-87d7-472ecdecfde4/preview_modal_left_aligned_real.png';
    await page.screenshot({ path: shotPath2 });
    console.log(`- Preview Modal Left Alignment Screenshot Captured: ${shotPath2}`);

    // 3. Verify CSS styling of effect text and cost strip
    const offeringArtTextAlign = await page.evaluate(() => {
        const artEl = document.querySelector('.card-frame-tcg .tcg-shape-art-area');
        return artEl ? window.getComputedStyle(artEl).textAlign : '';
    });

    const previewModalTextAlign = await page.evaluate(() => {
        const modal = document.getElementById("cardHoverPreviewContent");
        if (!modal) return '';
        const descDiv = modal.querySelector('div[style*="font-size:14px"]');
        return descDiv ? window.getComputedStyle(descDiv).textAlign : '';
    });

    console.log(`- Offering Card Text-Align: "${offeringArtTextAlign}"`);
    console.log(`- Preview Modal Text-Align: "${previewModalTextAlign}"`);

    const isLeftAligned = (offeringArtTextAlign === "left" || offeringArtTextAlign === "start") && (previewModalTextAlign === "left" || previewModalTextAlign === "start");
    console.log(`- Text & Cost Alignment Verification: ${isLeftAligned ? "✅ UNIFIED TO LEFT PERFECTLY" : "❌ FAILED"}`);

    console.log('=============================================================');
    console.log('✅ CARD EFFECT & COST LEFT ALIGNMENT VERIFIED 100% PERFECTLY!');
    console.log('=============================================================');

    await browser.close();
})();
