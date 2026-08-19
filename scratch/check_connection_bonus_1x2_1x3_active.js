const { chromium } = require('playwright');

(async () => {
    const browser = await chromium.launch();
    const page = await browser.newPage({ viewport: { width: 1280, height: 800 } });

    await page.goto('http://localhost:8080/index_v2.html', { waitUntil: 'domcontentloaded' });
    await page.waitForSelector('#gridBoard .cell', { state: 'attached', timeout: 10000 });

    // Step 1: Record initial food & wood
    const initialResources = await page.evaluate(() => ({
        food: window.state.food,
        wood: window.state.wood,
        mystic: window.state.mystic
    }));

    // Step 2: Place 1st Plains at B3 (2, 1) adjacent to HQ (2, 2)
    const step1Result = await page.evaluate(() => {
        const drawSys = new Step1DrawSystem(window.state);
        const master = drawSys.getLandCardMaster();
        const plains1x1 = master.find(c => c.id === "CARD_PLAINS_1X1");
        
        window.state.placeShape(2, 1, plains1x1.shape, plains1x1, 0);
        return {
            food: window.state.food,
            logs: [...(window.state.gameLogs || [])]
        };
    });

    // Step 3: Place 2nd Plains at A3 (2, 0) adjacent to B3 (2, 1) -> Triggers 1x2 Connection Bonus (🌾 +3)
    const step2Result = await page.evaluate(() => {
        const drawSys = new Step1DrawSystem(window.state);
        const master = drawSys.getLandCardMaster();
        const plains1x1 = master.find(c => c.id === "CARD_PLAINS_1X1");
        
        window.state.hasPickedThisTurn = false;
        window.state.placeShape(2, 0, plains1x1.shape, plains1x1, 0);
        return {
            food: window.state.food,
            logs: [...(window.state.gameLogs || [])]
        };
    });

    // Step 4: Place 3rd Plains at B2 (1, 1) adjacent to B3 (2, 1) -> Triggers 1x3 Connection Bonus (🌾 +6)
    const step3Result = await page.evaluate(() => {
        const drawSys = new Step1DrawSystem(window.state);
        const master = drawSys.getLandCardMaster();
        const plains1x1 = master.find(c => c.id === "CARD_PLAINS_1X1");
        
        window.state.hasPickedThisTurn = false;
        window.state.placeShape(1, 1, plains1x1.shape, plains1x1, 0);
        return {
            food: window.state.food,
            logs: [...(window.state.gameLogs || [])]
        };
    });

    console.log('=============================================================');
    console.log('1x2 & 1x3 CONNECTION IMMEDIATE BONUS REAL MEASUREMENT');
    console.log('=============================================================');
    console.log(`- Initial Food: ${initialResources.food}`);
    console.log(`- 1st Placement Food (No connection): ${step1Result.food}`);
    console.log(`- 2nd Placement Food (1x2 Bonus +3): ${step2Result.food} (Diff: +${step2Result.food - step1Result.food})`);
    console.log(`- 3rd Placement Food (1x3 Bonus +6): ${step3Result.food} (Diff: +${step3Result.food - step2Result.food})`);
    
    const logs1x2 = step2Result.logs.filter(l => l.includes('連結成立'));
    const logs1x3 = step3Result.logs.filter(l => l.includes('連結成立'));
    
    console.log('- 1x2 Connection Log:', logs1x2[logs1x2.length - 1]);
    console.log('- 1x3 Connection Log:', logs1x3[logs1x3.length - 1]);
    
    const is1x2Active = (step2Result.food - step1Result.food) === 3;
    const is1x3Active = (step3Result.food - step2Result.food) === 6;
    
    console.log(`- 1x2 Immediate Connection Bonus Active (Expected: true): ${is1x2Active}`);
    console.log(`- 1x3 Immediate Connection Bonus Active (Expected: true): ${is1x3Active}`);
    console.log(`- 1x2 & 1x3 Connection Bonus System 100% OPERATIONAL: ${is1x2Active && is1x3Active}`);
    console.log('-------------------------------------------------------------');

    await browser.close();
})();
