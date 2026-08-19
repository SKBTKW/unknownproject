const fs = require('fs');

const rawCards = JSON.parse(fs.readFileSync('game/src/data/land_cards.json', 'utf8'));

// Stage 1 で出現可能なカードの集計
// 初期（T1）で全条件クリア対象
const eligibleCards = rawCards.filter(c => (c.minStage || 1) <= 1);

function calculateDistribution(landCategoryMult = 1.0, landBiasMult = 1.0) {
    let totalWeight = 0;
    let landWeight = 0;
    let nonLandWeight = 0;

    let categoryBreakdown = {};

    for (let c of eligibleCards) {
        let baseW = c.weight || 0.1;
        let cat = c.category || "LAND";
        let dirMult = (cat === "LAND") ? landCategoryMult : 1.0;
        let biasMult = (cat === "LAND") ? landBiasMult : 1.0;

        let finalW = baseW * dirMult * biasMult;

        totalWeight += finalW;
        if (cat === "LAND") {
            landWeight += finalW;
        } else {
            nonLandWeight += finalW;
        }

        categoryBreakdown[cat] = (categoryBreakdown[cat] || 0) + finalW;
    }

    const pLandSingle = landWeight / totalWeight;
    // 3枠オファリングで非土地が3連続で出る確率の補集合 = 1 - (1 - pLand)^3
    const pAtLeastOneLand3Draws = 1 - Math.pow(1 - pLandSingle, 3);
    const expectedLandCardsInHand = pLandSingle * 3;

    return {
        landWeight,
        totalWeight,
        pLandSingle: (pLandSingle * 100).toFixed(1) + '%',
        pAtLeastOneLand3Draws: (pAtLeastOneLand3Draws * 100).toFixed(1) + '%',
        expectedLandCardsInHand: expectedLandCardsInHand.toFixed(2) + '枚',
        categoryProbabilities: Object.fromEntries(
            Object.entries(categoryBreakdown).map(([k, v]) => [k, ((v / totalWeight) * 100).toFixed(1) + '%'])
        )
    };
}

console.log("=============================================================");
console.log("🎴 開拓方針 ✕ 土地探索重視 ドロー確率・出現率 厳密試算シミュレーション");
console.log("=============================================================");

const normal = calculateDistribution(1.0, 1.0);
console.log("\n1. 【標準状態】（方針なし・バフなし）");
console.log(` - 1ドロー時の土地確率  : ${normal.pLandSingle}`);
console.log(` - 手札3枠中1枚以上の土地: ${normal.pAtLeastOneLand3Draws}`);
console.log(` - 手札3枠中の土地期待値: ${normal.expectedLandCardsInHand}`);
console.log(" - カテゴリ別内訳:", normal.categoryProbabilities);

const directiveOnly = calculateDistribution(3.0, 1.0);
console.log("\n2. 【開拓方針のみ発動】（🚩 LAND × 3.0倍）");
console.log(` - 1ドロー時の土地確率  : ${directiveOnly.pLandSingle}`);
console.log(` - 手札3枠中1枚以上の土地: ${directiveOnly.pAtLeastOneLand3Draws}`);
console.log(` - 手札3枠中の土地期待値: ${directiveOnly.expectedLandCardsInHand}`);
console.log(" - カテゴリ別内訳:", directiveOnly.categoryProbabilities);

const biasOnly = calculateDistribution(1.0, 2.0);
console.log("\n3. 【土地探索重視のみ発動】（📜 LAND × 2.0倍）");
console.log(` - 1ドロー時の土地確率  : ${biasOnly.pLandSingle}`);
console.log(` - 手札3枠中1枚以上の土地: ${biasOnly.pAtLeastOneLand3Draws}`);
console.log(` - 手札3枠中の土地期待値: ${biasOnly.expectedLandCardsInHand}`);
console.log(" - カテゴリ別内訳:", biasOnly.categoryProbabilities);

const combined = calculateDistribution(3.0, 2.0);
console.log("\n4. 【🔥 開拓方針 ✕ 土地探索重視 ダブル併用】（🚩📜 LAND × 6.0倍乗算）");
console.log(` - 1ドロー時の土地確率  : ${combined.pLandSingle}`);
console.log(` - 手札3枠中1枚以上の土地: ${combined.pAtLeastOneLand3Draws}`);
console.log(` - 手札3枠中の土地期待値: ${combined.expectedLandCardsInHand}`);
console.log(" - カテゴリ別内訳:", combined.categoryProbabilities);
console.log("=============================================================");
