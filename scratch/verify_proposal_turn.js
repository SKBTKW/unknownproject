const { chromium } = require('playwright');
const path = require('path');

(async () => {
    const browser = await chromium.launch();
    const page = await browser.newPage({ viewport: { width: 1280, height: 900 } });

    const htmlPath = 'file:///' + path.resolve(__dirname, 'proposal_turn_box_sandbox.html').replace(/\\/g, '/');
    await page.goto(htmlPath);
    await page.waitForTimeout(800);

    const shotPath = 'C:/Users/mam07/.gemini/antigravity/brain/af6d4803-5dd7-4a55-87d7-472ecdecfde4/proposal_turn_box_a_real.png';
    await page.screenshot({ path: shotPath });
    console.log(`- Proposal A Screenshot Captured: ${shotPath}`);

    await browser.close();
})();
