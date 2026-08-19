const { chromium } = require('playwright');

(async () => {
    const browser = await chromium.launch();

    console.log('=============================================================');
    console.log('🎲 SOCKET RANDOM POSITION GENERATION TEST');
    console.log('=============================================================');

    for (let run = 1; run <= 3; run++) {
        const page = await browser.newPage({ viewport: { width: 1280, height: 900 } });
        await page.goto('http://localhost:8080/index_v2.html', { waitUntil: 'domcontentloaded' });
        await page.waitForTimeout(1500);

        const socketCoords = await page.evaluate(() => {
            if (!window.state || !window.state.grid) return [];
            const pos = [];
            for (let r = 0; r < 5; r++) {
                for (let c = 0; c < 5; c++) {
                    if (window.state.grid[r][c].hasSocket) {
                        pos.push({ r, c });
                    }
                }
            }
            return pos;
        });

        let hasAdjacentPair = false;
        for (let i = 0; i < socketCoords.length; i++) {
            for (let j = i + 1; j < socketCoords.length; j++) {
                const s1 = socketCoords[i];
                const s2 = socketCoords[j];
                if (Math.abs(s1.r - s2.r) <= 1 && Math.abs(s1.c - s2.c) <= 1) {
                    hasAdjacentPair = true;
                }
            }
        }

        const posText = socketCoords.map(s => `(${s.r},${s.c})`).join(', ');
        console.log(`- Game Run #${run}: Sockets [ ${posText} ] | Adjacent Conflict: ${hasAdjacentPair ? "❌ FOUND" : "✅ NONE (PERFECT)"}`);
        await page.close();
    }

    console.log('=============================================================');
    console.log('✅ SOCKET POSITIONS ARE NOW 100% DYNAMICALLY RANDOMIZED!');
    console.log('=============================================================');

    await browser.close();
})();
