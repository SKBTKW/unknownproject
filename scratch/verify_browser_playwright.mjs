import { chromium } from 'playwright';
import fs from 'fs';
import path from 'path';

(async () => {
    const browser = await chromium.launch({ headless: true });
    const context = await browser.newContext({ viewport: { width: 1440, height: 900 } });
    const page = await context.newPage();

    console.log('Navigating to http://localhost:8000/index.html...');
    await page.goto('http://localhost:8000/index.html', { waitUntil: 'networkidle' });

    await page.waitForSelector('#gridBoard');
    await page.waitForSelector('#cardRow');
    console.log('Page loaded.');

    // 2. 深い森（4種産出: 🌾1 🧱3 🛡️3 ✨1）を手札にセット
    await page.evaluate(() => {
        if (window.gameUI && window.gameUI.state) {
            window.gameUI.state.handOffering = [
                {
                    id: 'E2_DEEP_FOREST',
                    nameKey: 'E2_DEEP_FOREST',
                    name: '深い森',
                    category: 'LAND',
                    rarity: 'UNCOMMON',
                    cost: { food: 0, wood: 0, mystic: 0, ember: 0 },
                    yields: { food: 1, wood: 3, defense: 3, mystic: 1 },
                    effectDescriptionKey: 'E2_DEEP_FOREST_DESC',
                    effectKey: 'DEEP_FOREST_EFFECT'
                },
                {
                    id: 'GL1_PLAINS',
                    nameKey: 'GL1_PLAINS',
                    name: '草原',
                    category: 'LAND',
                    rarity: 'COMMON',
                    cost: { food: 0, wood: 0, mystic: 0, ember: 0 },
                    yields: { food: 2, wood: 0, defense: 0, mystic: 0 },
                    effectDescriptionKey: 'GL1_PLAINS_DESC',
                    effectKey: 'PLAINS_EFFECT'
                },
                {
                    id: 'CMD_BALLISTA_SET',
                    nameKey: 'CMD_BALLISTA_SET',
                    name: '迎撃用弩砲陣地',
                    category: 'COMMAND',
                    rarity: 'RARE',
                    cost: { food: 0, wood: 30, mystic: 0, ember: 0 },
                    effectDescriptionKey: 'CMD_BALLISTA_SET_DESC'
                }
            ];
            window.gameUI.render();
        }
    });

    await page.waitForTimeout(300);

    const yieldStripBox = await page.evaluate(() => {
        const strip = document.querySelector('.tcg-yield-strip');
        if (!strip) return null;
        const computed = window.getComputedStyle(strip);
        return {
            innerText: strip.innerText,
            whiteSpace: computed.whiteSpace,
            overflow: computed.overflow,
            offsetWidth: strip.offsetWidth,
            offsetHeight: strip.offsetHeight
        };
    });

    console.log('Deep Forest Yield Strip Check:', yieldStripBox);
    await page.screenshot({ path: 'scratch/screenshot_ja_standard.png' });
    console.log('Saved scratch/screenshot_ja_standard.png');

    // 英語切り替え
    await page.evaluate(() => {
        if (window.I18n) {
            window.I18n.setLanguage('en');
            window.gameUI.render();
        }
    });
    await page.waitForTimeout(300);
    await page.screenshot({ path: 'scratch/screenshot_en_standard.png' });
    console.log('Saved scratch/screenshot_en_standard.png');

    // 日本語戻し ＆ 縮小トグル
    await page.evaluate(() => {
        if (window.I18n) window.I18n.setLanguage('ja');
        if (window.toggleHandMinimalMode) window.toggleHandMinimalMode();
    });
    await page.waitForTimeout(300);
    await page.screenshot({ path: 'scratch/screenshot_ja_minimal.png' });
    console.log('Saved scratch/screenshot_ja_minimal.png');

    await browser.close();
    console.log('Playwright test completed successfully!');
})();
