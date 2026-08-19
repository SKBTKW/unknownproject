const fs = require('fs');

const rawCards = JSON.parse(fs.readFileSync('game/src/data/land_cards.json', 'utf8'));

const landCards = rawCards.filter(c => (c.category === "LAND" || !c.category) && (c.minStage || 1) <= 1);

let sizeGroups = {};

for (let c of landCards) {
    const shape = c.shape || [[1]];
    const rows = shape.length;
    const cols = shape[0].length;
    const sizeStr = `${Math.min(rows, cols)}x${Math.max(rows, cols)}`;

    if (!sizeGroups[sizeStr]) {
        sizeGroups[sizeStr] = { count: 0, totalWeight: 0, cards: [] };
    }

    const w = c.weight || 0.1;
    sizeGroups[sizeStr].count++;
    sizeGroups[sizeStr].totalWeight += w;
    sizeGroups[sizeStr].cards.push({ id: c.id, nameKey: c.nameKey, weight: w });
}

const totalLandWeight = landCards.reduce((acc, c) => acc + (c.weight || 0.1), 0);

console.log("=============================================================");
console.log("📐 土地カード (LAND) のブロックサイズ別現在のウェイト・シェア一覧");
console.log("=============================================================");
console.log(`- 有効土地カード種類数: ${landCards.length} 種類, 土地総ウェイト: ${totalLandWeight.toFixed(3)}`);

for (let size in sizeGroups) {
    const g = sizeGroups[size];
    const share = ((g.totalWeight / totalLandWeight) * 100).toFixed(1);
    console.log(`\n■ サイズ [${size}]: ${g.count} 種類 | ウェイト合計: ${g.totalWeight.toFixed(3)} (${share}%)`);
    g.cards.forEach(c => console.log(`   - ${c.id.padEnd(20)} : weight = ${c.weight}`));
}
console.log("=============================================================");
