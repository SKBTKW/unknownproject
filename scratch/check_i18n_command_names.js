const { chromium } = require('playwright');

(async () => {
    const browser = await chromium.launch();
    const page = await browser.newPage();

    await page.goto('http://localhost:8080/index_v2.html', { waitUntil: 'domcontentloaded' });
    await page.waitForSelector('#gridBoard .cell', { state: 'attached', timeout: 10000 });

    const cmdKeys = [
        { id: "CMD_AGRICULTURAL_POLICY", expectedName: "治水農具の大導入" },
        { id: "CMD_BLACK_MARKET", expectedName: "闇市場の一括売却" },
        { id: "CMD_IRON_RAMPART", expectedName: "鉄壁の防壁構築" },
        { id: "CMD_BALLISTA_SET", expectedName: "迎撃用弩砲陣地" },
        { id: "CMD_REKINDLE_EMBER", expectedName: "残り火の聖なる再燃" },
        { id: "CMD_TRANSMUTE_GOLDEN", expectedName: "黄金秘境への変容" },
        { id: "FAC_GREAT_WINDMILL", expectedName: "大風車工房の建設" },
        { id: "LGD_DESPERATE_PACT", expectedName: "決死の開拓大契約" },
        { id: "CMD_LAND_FOCUS", expectedName: "土地探索重視" },
        { id: "CMD_MILITARY_FOCUS", expectedName: "軍事重視" },
        { id: "CMD_MYSTIC_FOCUS", expectedName: "神秘重視" }
    ];

    const results = await page.evaluate((keys) => {
        const drawSys = new Step1DrawSystem(window.state);
        const master = drawSys.getLandCardMaster();

        return keys.map(k => {
            const cardObj = master.find(c => c.id === k.id);
            if (!cardObj) return { id: k.id, found: false };

            const resolvedName = window.I18n.t(cardObj.nameKey);
            return {
                id: k.id,
                nameKey: cardObj.nameKey,
                resolvedName: resolvedName,
                matched: resolvedName === k.expectedName
            };
        });
    }, cmdKeys);

    console.log('=============================================================');
    console.log('I18N COMMAND CARD NAME RESOLUTION REAL MEASUREMENT');
    console.log('=============================================================');
    let allPassed = true;
    results.forEach(r => {
        console.log(`- [${r.id}]: "${r.resolvedName}" (Matched Expected: ${r.matched})`);
        if (!r.matched) allPassed = false;
    });
    console.log(`- Command Card Name Resolution 100% SUCCESS: ${allPassed}`);
    console.log('-------------------------------------------------------------');

    await browser.close();
})();
