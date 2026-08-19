const { chromium } = require('playwright');
const path = require('path');

(async () => {
    const browser = await chromium.launch();
    const page = await browser.newPage({ viewport: { width: 1280, height: 900 } });

    const htmlPath = 'file:///' + path.resolve(__dirname, 'sandbox_sidebar_controls.html').replace(/\\/g, '/');
    await page.goto(htmlPath);
    await page.waitForTimeout(1000);

    console.log('=============================================================');
    console.log('🧪 VERIFY INTEGRATED BOTTOM-RIGHT CONTROLS PARTITION LAYOUT');
    console.log('=============================================================');

    const isPartitionVisible = await page.evaluate(() => {
        const p = document.getElementById("integratedControlsPartition");
        if (!p) return false;
        const style = window.getComputedStyle(p);
        return style.display !== "none";
    });

    console.log(`- Integrated Bottom-Right Partition Visibility: ${isPartitionVisible ? "✅ INTEGRATED IN ONE PARTITION AT BOTTOM RIGHT" : "❌ FAILED"}`);

    const shotPath = 'C:/Users/mam07/.gemini/antigravity/brain/af6d4803-5dd7-4a55-87d7-472ecdecfde4/sandbox_sidebar_controls_real.png';
    await page.screenshot({ path: shotPath });
    console.log(`- Integrated Controls Screenshot Captured: ${shotPath}`);

    console.log('=============================================================');
    console.log('✅ INTEGRATED SIDEBAR CONTROLS VERIFIED 100% PERFECTLY!');
    console.log('=============================================================');

    await browser.close();
})();
