const fs = require('fs');
const path = require('path');

(() => {
    const jsonPath = path.join(__dirname, '../game/src/data/land_cards.json');
    const master = JSON.parse(fs.readFileSync(jsonPath, 'utf8'));

    // Stage 1 eligible pool (minStage <= 1, reqH2 <= 0)
    const eligible = master.filter(c => (c.minStage || 1) <= 1 && (c.reqH2 || 0) <= 0);
    const totalW = eligible.reduce((acc, c) => acc + c.weight, 0);

    let deepForestWeight = 0;
    let desertWeight = 0;

    eligible.forEach(c => {
        if (c.terrainId === "GL3_DEEP_FOREST" || c.terrainId === "H2_DEEP_HILL") {
            deepForestWeight += c.weight;
        }
        if (c.terrainId === "GL0_DESERT" || c.terrainId === "H2_DESERT_HILL") {
            desertWeight += c.weight;
        }
    });

    const deepForestPct = (deepForestWeight / totalW) * 100;
    const desertPct = (desertWeight / totalW) * 100;

    // Run 10,000 Monte Carlo draws
    let deepForestDraws = 0;
    let desertDraws = 0;
    const iterations = 10000;

    for (let i = 0; i < iterations; i++) {
        let rand = Math.random() * totalW;
        let chosen = eligible[0];
        for (let c of eligible) {
            if (rand <= c.weight) {
                chosen = c;
                break;
            }
            rand -= c.weight;
        }
        if (chosen.terrainId === "GL3_DEEP_FOREST" || chosen.terrainId === "H2_DEEP_HILL") {
            deepForestDraws++;
        }
        if (chosen.terrainId === "GL0_DESERT" || chosen.terrainId === "H2_DESERT_HILL") {
            desertDraws++;
        }
    }

    const mcDeepForestPct = (deepForestDraws / iterations) * 100;
    const mcDesertPct = (desertDraws / iterations) * 100;

    console.log('=============================================================');
    console.log('CARD DRAW PROBABILITY SIMULATION (TARGET: 3.0% DEEP FOREST / 3.0% DESERT)');
    console.log('=============================================================');
    console.log(`- Stage 1 Total Weight: ${totalW.toFixed(2)}`);
    console.log(`- Deep Forest Theoretical Probability: ${deepForestPct.toFixed(2)}%`);
    console.log(`- Desert Theoretical Probability: ${desertPct.toFixed(2)}%`);
    console.log(`- 10,000 Draw Monte Carlo Deep Forest Rate: ${mcDeepForestPct.toFixed(2)}%`);
    console.log(`- 10,000 Draw Monte Carlo Desert Rate: ${mcDesertPct.toFixed(2)}%`);
    console.log(`- Deep Forest ~3% Verified: ${Math.abs(deepForestPct - 3.0) < 0.2}`);
    console.log(`- Desert ~3% Verified: ${Math.abs(desertPct - 3.0) < 0.2}`);
    console.log('-------------------------------------------------------------');
})();
