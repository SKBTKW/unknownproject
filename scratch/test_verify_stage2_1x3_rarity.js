const fs = require('fs');
const path = require('path');

(() => {
    const jsonPath = path.join(__dirname, '../game/src/data/land_cards.json');
    const master = JSON.parse(fs.readFileSync(jsonPath, 'utf8'));

    // Stage 1 eligible pool
    const stage1Eligible = master.filter(c => (c.minStage || 1) <= 1 && (c.reqH2 || 0) <= 0);
    const stage1TotalW = stage1Eligible.reduce((acc, c) => acc + c.weight, 0);

    // Stage 2 eligible pool (assuming H2 hills < 3, so mountains excluded)
    const stage2Eligible = master.filter(c => (c.minStage || 1) <= 2 && (c.reqH2 || 0) <= 0);
    const stage2TotalW = stage2Eligible.reduce((acc, c) => acc + c.weight, 0);

    // 1x3 cards in Stage 2
    const cards1x3 = stage2Eligible.filter(c => c.id.includes('1X3'));
    const totalW1x3 = cards1x3.reduce((acc, c) => acc + c.weight, 0);
    const pct1x3 = (totalW1x3 / stage2TotalW) * 100;

    // 10,000 Monte Carlo Simulation for Stage 2
    let count1x3 = 0;
    const iterations = 10000;
    for (let i = 0; i < iterations; i++) {
        let rand = Math.random() * stage2TotalW;
        let chosen = stage2Eligible[0];
        for (let c of stage2Eligible) {
            if (rand <= c.weight) {
                chosen = c;
                break;
            }
            rand -= c.weight;
        }
        if (chosen.id.includes('1X3')) {
            count1x3++;
        }
    }
    const mcPct1x3 = (count1x3 / iterations) * 100;

    console.log('=============================================================');
    console.log('STAGE 2 CARD DRAW PROBABILITY SIMULATION (1X3 ALL R RARITY)');
    console.log('=============================================================');
    console.log(`- Stage 1 Total Weight: ${stage1TotalW.toFixed(2)}`);
    console.log(`- Stage 2 Total Weight: ${stage2TotalW.toFixed(2)}`);
    console.log(`- Total Weight of 1x3 Cards in Stage 2: ${totalW1x3.toFixed(2)}`);
    console.log(`- Theoretical 1x3 Combine Draw Rate in Stage 2: ${pct1x3.toFixed(2)}%`);
    console.log(`- 10,000 Draw Monte Carlo 1x3 Rate: ${mcPct1x3.toFixed(2)}%`);
    console.log(`- All 1x3 Cards Rarity = 'R': ${cards1x3.every(c => c.rarity === 'R')}`);
    console.log(`- 1x3 Rate ~8% Verified: ${Math.abs(pct1x3 - 8.0) < 0.5}`);
    console.log('-------------------------------------------------------------');
})();
