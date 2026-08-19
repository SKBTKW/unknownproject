const { chromium } = require('playwright');

(async () => {
    const browser = await chromium.launch();
    const page = await browser.newPage({ viewport: { width: 1280, height: 900 } });

    await page.goto('http://localhost:8080/index_v2.html', { waitUntil: 'domcontentloaded' });
    await page.waitForTimeout(1000);

    // 1. Initial State: Verify Header Badge
    const initialBadgeText = await page.evaluate(() => {
        const badge = document.getElementById("directiveHeaderBadge");
        return badge ? badge.innerText.replace(/\n/g, " ") : "";
    });

    console.log('=============================================================');
    console.log('FOUR DIRECTIVES SYSTEM INTEGRATION TEST');
    console.log(`- Initial Header Badge Text: "${initialBadgeText}"`);
    console.log('=============================================================');

    // Screenshot 1: Initial Header Badge Display
    const shot1Path = 'C:/Users/mam07/.gemini/antigravity/brain/af6d4803-5dd7-4a55-87d7-472ecdecfde4/directive_header_badge_real.png';
    await page.screenshot({ path: shot1Path });

    // 2. Click Directive Badge to Open Modal
    await page.click('#directiveHeaderBadge .directive-pill');
    await page.waitForTimeout(400);

    const isModalVisible = await page.evaluate(() => {
        const modal = document.getElementById("directiveModal");
        return modal && modal.style.display !== "none";
    });

    console.log(`- Directive Change Modal Opened via Badge Click: ${isModalVisible}`);

    // Screenshot 2: Directive Selection Modal
    const shot2Path = 'C:/Users/mam07/.gemini/antigravity/brain/af6d4803-5dd7-4a55-87d7-472ecdecfde4/directive_modal_open_real.png';
    await page.screenshot({ path: shot2Path });

    // 3. Select PRODUCTION (🌾 増産方針)
    await page.evaluate(() => {
        if (window.selectDirective) window.selectDirective('PRODUCTION');
    });
    await page.waitForTimeout(500);

    const newDirectiveText = await page.evaluate(() => {
        const badge = document.getElementById("directiveHeaderBadge");
        return badge ? badge.innerText.replace(/\n/g, " ") : "";
    });

    console.log(`- Updated Header Badge Text: "${newDirectiveText}"`);
    console.log('=============================================================');

    // Screenshot 3: Updated Directive Badge
    const shot3Path = 'C:/Users/mam07/.gemini/antigravity/brain/af6d4803-5dd7-4a55-87d7-472ecdecfde4/directive_updated_badge_real.png';
    await page.screenshot({ path: shot3Path });

    await browser.close();
})();
