const fs = require('fs');

const rawCards = JSON.parse(fs.readFileSync('game/src/data/land_cards.json', 'utf8'));

// Stage 1（初期ドロープール）で有効なカードの集計
const stage1Cards = rawCards.filter(c => (c.minStage || 1) <= 1);

let stats = {};

for (let c of rawCards) {
    let cat = c.category || "LAND";
    if (!stats[cat]) {
        stats[cat] = {
            totalCards: 0,
            stage1Cards: 0,
            totalBaseWeight: 0,
            stage1BaseWeight: 0,
            cardDetails: []
        };
    }

    let w = c.weight || 0.1;
    stats[cat].totalCards++;
    stats[cat].totalBaseWeight += w;
    stats[cat].cardDetails.push({ nameKey: c.nameKey || c.id, weight: w, minStage: c.minStage || 1 });

    if ((c.minStage || 1) <= 1) {
        stats[cat].stage1Cards++;
        stats[cat].stage1BaseWeight += w;
    }
}

console.log("=============================================================");
console.log("🎴 全カードマスターのカテゴリ別ウェイト（Base Weight）集計結果");
console.log("=============================================================");

let overallWeight = rawCards.reduce((acc, c) => acc + (c.weight || 0.1), 0);
let stage1Weight = stage1Cards.reduce((acc, c) => acc + (c.weight || 0.1), 0);

console.log("\n【1. 全カードプール（全ステージ合計）】");
console.log(`- 全カード枚数: ${rawCards.length} 枚, 総ウェイト: ${overallWeight.toFixed(3)}`);
for (let cat in stats) {
    let share = ((stats[cat].totalBaseWeight / overallWeight) * 100).toFixed(1);
    console.log(`  * ${cat.padEnd(10)} : ${stats[cat].totalCards} 枚 | ウェイト計: ${stats[cat].totalBaseWeight.toFixed(3)} (${share}%)`);
}

console.log("\n【2. Stage 1（初期ゲーム開始時）のドロープール】");
console.log(`- 有効カード枚数: ${stage1Cards.length} 枚, 総ウェイト: ${stage1Weight.toFixed(3)}`);
for (let cat in stats) {
    let share = ((stats[cat].stage1BaseWeight / stage1Weight) * 100).toFixed(1);
    console.log(`  * ${cat.padEnd(10)} : ${stats[cat].stage1Cards} 枚 | ウェイト計: ${stats[cat].stage1BaseWeight.toFixed(3)} (${share}%)`);
}
console.log("=============================================================");
