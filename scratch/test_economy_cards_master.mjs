import { DeckManager, COMMAND_CARDS_MASTER } from '../game/src/systems/deck_manager.js';
import { I18n } from '../game/src/i18n.js';

globalThis.I18n = I18n;

console.log("============================================================");
console.log("🃏 Economic & Policy Cards Master Verification");
console.log("============================================================");

const mockState = {
    food: 50,
    wood: 100,
    ember: 20,
    mystic: 30,
    grid: Array(10).fill(null).map(() => Array(10).fill(null)),
    activeBuffs: [],
    addBuff: function(b) { this.activeBuffs.push(b); },
    addLog: function(l) {}
};

const dm = new DeckManager(mockState);
const allCmdCards = COMMAND_CARDS_MASTER;

console.log(`Total Command Cards in Master: ${allCmdCards.length}`);

const expected23 = [
    // Stage 1
    { id: "CMD_RATIONING", stage: 1, rarity: "C" },
    { id: "CMD_WETLAND_RECLAMATION", stage: 1, rarity: "UC" },
    { id: "CMD_LOGGING_CAMP", stage: 1, rarity: "C" },
    { id: "CMD_GRANARY", stage: 1, rarity: "UC" },
    { id: "CMD_AGRICULTURAL_REFORM", stage: 1, rarity: "R" },
    { id: "CMD_PASTORAL_FARM", stage: 1, rarity: "UC" },
    { id: "CMD_ABANDONED_SETTLEMENT", stage: 1, rarity: "UC" },
    { id: "CMD_EMERGENCY_LEVY", stage: 1, rarity: "C" },
    // Stage 2
    { id: "CMD_SAWMILL", stage: 2, rarity: "R" },
    { id: "CMD_QUARRY", stage: 2, rarity: "UC" },
    { id: "CMD_MINE", stage: 2, rarity: "R" },
    { id: "CMD_STABLE", stage: 2, rarity: "R" },
    { id: "CMD_LIME_KILN", stage: 2, rarity: "UC" },
    { id: "CMD_MARKET", stage: 2, rarity: "R" },
    { id: "CMD_DEPOT", stage: 2, rarity: "R" },
    { id: "CMD_IRRIGATION", stage: 2, rarity: "UC" },
    { id: "CMD_RESETTLEMENT", stage: 2, rarity: "R" },
    { id: "CMD_WORKSHOP", stage: 2, rarity: "R" },
    // Stage 3
    { id: "CMD_GRANARY_NETWORK", stage: 3, rarity: "UR" },
    { id: "CMD_INDUSTRIAL_ROAD", stage: 3, rarity: "R" },
    { id: "CMD_IRRIGATION_NETWORK", stage: 3, rarity: "UR" },
    { id: "CMD_INDUSTRIAL_CLUSTER", stage: 3, rarity: "UR" },
    { id: "CMD_GREAT_RAMPART_PROJECT", stage: 3, rarity: "UR" }
];

let passCount = 0;
let failCount = 0;

function assert(cond, msg) {
    if (cond) {
        console.log(`  ✅ [PASS] ${msg}`);
        passCount++;
    } else {
        console.error(`  ❌ [FAIL] ${msg}`);
        failCount++;
    }
}

console.log("\n--- 1. カードマスター登録 ＆ プロパティ検問 ---");
expected23.forEach(exp => {
    const card = allCmdCards.find(c => c.id === exp.id);
    assert(!!card, `Card ${exp.id} exists in COMMAND_CARDS_MASTER`);
    if (card) {
        assert(card.minStage === exp.stage, `${exp.id} minStage is ${exp.stage} (got: ${card.minStage})`);
        assert(card.rarity === exp.rarity, `${exp.id} rarity is ${exp.rarity} (got: ${card.rarity})`);
        assert(Array.isArray(card.tags) && card.tags.length > 0, `${exp.id} has tags: [${(card.tags || []).join(', ')}]`);
        
        const nameJa = I18n.t(card.nameKey, "ja");
        const nameEn = I18n.t(card.nameKey, "en");
        const descJa = I18n.t(card.descriptionKey, "ja");
        const descEn = I18n.t(card.descriptionKey, "en");
        assert(nameJa && nameJa !== card.nameKey, `${exp.id} JA name: '${nameJa}'`);
        assert(nameEn && nameEn !== card.nameKey, `${exp.id} EN name: '${nameEn}'`);
        assert(descJa && descJa !== card.descriptionKey, `${exp.id} JA desc exists`);
        assert(descEn && descEn !== card.descriptionKey, `${exp.id} EN desc exists`);
    }
});

console.log("\n--- 2. 発動ハンドラ (playCommandCard) 検問 ---");
const testCards = ["CMD_LOGGING_CAMP", "CMD_QUARRY", "CMD_RESETTLEMENT", "CMD_EMERGENCY_LEVY", "CMD_RATIONING"];
testCards.forEach(cId => {
    const cardObj = allCmdCards.find(c => c.id === cId);
    dm.playCommandCard(cardObj, -1, -1, null);
    assert(mockState.activeBuffs.some(b => b.id === cId), `playCommandCard(${cId}) added active buff`);
});

console.log("\n============================================================");
console.log(`📊 検問集計: ${passCount} PASS / ${failCount} FAIL`);
if (failCount > 0) {
    console.error("❌ 一部の検問が失敗しました。");
    process.exit(1);
} else {
    console.log("🎉 全経済・政策カード 23 枚のシステムデータ登録 100% 成功！");
}
