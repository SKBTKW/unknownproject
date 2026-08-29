/* =============================================================
   scratch/test_offering_conditions.mjs
   追加カードのオファリング条件厳密判定テスト
   ============================================================= */

import { GameEngine, DeckManager, ConditionEvaluator } from '../game/src/app.js';

let passed = 0;
let total = 0;

function assert(condition, message) {
    total++;
    if (condition) {
        passed++;
        console.log(`  ✅ [PASS] ${message}`);
    } else {
        console.error(`  ❌ [FAIL] ${message}`);
        process.exit(1);
    }
}

console.log('====================================================');
console.log('🔍 追加カード オファリング条件 厳密テスト開始');
console.log('====================================================');

const engine = new GameEngine();
const deck = engine.deckManager;
const master = deck.getLandCardMaster();

function getCard(id) {
    const c = master.find(x => x.id === id);
    if (!c) throw new Error(`Card not found: ${id}`);
    return c;
}

// 1. CMD_RESETTLEMENT (移住: Stage 2, 平地 >= 6, 🔥 <= 12)
console.log('\n--- 1. CMD_RESETTLEMENT (移住) 検証 ---');
const cResettle = getCard('CMD_RESETTLEMENT');
engine.state.stage = 1;
engine.state.grid = Array(5).fill(null).map(() => Array(5).fill(null).map(() => ({ placed: false })));
engine.state.ember = 10;
assert(!deck.isCardEligible(cResettle, 1, 0), 'Stage 1 では移住が提示されないこと');

engine.state.stage = 2;
engine.state.ember = 15;
// 平地 3マス配置
for (let i = 0; i < 3; i++) engine.state.grid[0][i] = { placed: true, terrain: { terrainId: 'GL1_PLAINS' } };
assert(!deck.isCardEligible(cResettle, 2, 0), '平地3マス・🔥15 では移住が提示されないこと');

engine.state.ember = 10;
assert(!deck.isCardEligible(cResettle, 2, 0), '平地3マス (<6) では移住が提示されないこと');

// 平地 6マス配置
for (let i = 3; i < 6; i++) engine.state.grid[1][i - 3] = { placed: true, terrain: { terrainId: 'GL1_PLAINS' } };
engine.state.ember = 10;
assert(deck.isCardEligible(cResettle, 2, 0), 'Stage 2, 平地6マス, 🔥10 (<=12) で移住が提示されること');

// 2. CMD_GREAT_RAMPART_PROJECT (大防塁: Stage 3, 開放平地連結 >= 12, 試練まで <= 10T)
console.log('\n--- 2. CMD_GREAT_RAMPART_PROJECT (大防塁) 検証 ---');
const cRampart = getCard('CMD_GREAT_RAMPART_PROJECT');
engine.state.turn = 1;
engine.state.nextTrialTurn = 20; // 19T先
assert(!deck.isCardEligible(cRampart, 2, 0), 'Stage 2 では大防塁が提示されないこと');
assert(!deck.isCardEligible(cRampart, 3, 0), '試練まで19T (>10) では大防塁が提示されないこと');

engine.state.turn = 12;
engine.state.nextTrialTurn = 20; // 8T先 (<=10)
// まだ平地6マス
assert(!deck.isCardEligible(cRampart, 3, 0), '平地連結6マス (<12) では大防塁が提示されないこと');

// 平地 12マス連結
engine.state.grid = Array(7).fill(null).map(() => Array(7).fill(null).map(() => ({ placed: false })));
for (let c = 0; c < 6; c++) {
    engine.state.grid[0][c] = { placed: true, terrain: { terrainId: 'GL1_PLAINS' } };
    engine.state.grid[1][c] = { placed: true, terrain: { terrainId: 'GL1_PLAINS' } };
}
assert(deck.isCardEligible(cRampart, 3, 0), 'Stage 3, 平地12マス連結, 試練まで8T で大防塁が提示されること');

// 3. CMD_GUIDED_DEFENSE (誘導防衛: Stage 2, 丘陵または森林連結 >= 3)
console.log('\n--- 3. CMD_GUIDED_DEFENSE (誘導防衛) 検証 ---');
const cGuided = getCard('CMD_GUIDED_DEFENSE');
engine.state.grid = Array(7).fill(null).map(() => Array(7).fill(null).map(() => ({ placed: false })));
engine.state.grid[0][0] = { placed: true, terrain: { terrainId: 'E2_HILL' } };
engine.state.grid[0][1] = { placed: true, terrain: { terrainId: 'GL2_FOREST' } };
assert(!deck.isCardEligible(cGuided, 2, 0), '丘陵/森林連結2マス (<3) では誘導防衛が提示されないこと');

engine.state.grid[0][2] = { placed: true, terrain: { terrainId: 'E2_HILL' } };
assert(deck.isCardEligible(cGuided, 2, 0), '丘陵/森林連結3マスで誘導防衛が提示されること');

// 4. CMD_HIGH_GROUND_FORMATION (高地布陣: Stage 1, 丘陵/山岳存在 ＆ 試練予告中)
console.log('\n--- 4. CMD_HIGH_GROUND_FORMATION (高地布陣) 検証 ---');
const cHighGround = getCard('CMD_HIGH_GROUND_FORMATION');
engine.state.grid = Array(5).fill(null).map(() => Array(5).fill(null).map(() => ({ placed: false })));
engine.state.turn = 5;
engine.state.nextTrialTurn = 20; // 15T先
assert(!deck.isCardEligible(cHighGround, 1, 0), '丘陵なし・試練遠い時、高地布陣が提示されないこと');

engine.state.grid[0][0] = { placed: true, terrain: { terrainId: 'E2_HILL' } };
assert(!deck.isCardEligible(cHighGround, 1, 0), '丘陵ありでも試練予告中でない時、高地布陣が提示されないこと');

engine.state.turn = 16; // 4T先 (<=5T: 試練予告中)
assert(deck.isCardEligible(cHighGround, 1, 0), '丘陵あり ＆ 試練予告中で高地布陣が提示されること');

// 5. CMD_CAVALRY_HOST (騎馬軍: Stage 2, 開放平地連結 >= 12 ＆ 🌾 >= 40)
console.log('\n--- 5. CMD_CAVALRY_HOST (騎馬軍) 検証 ---');
const cCavHost = getCard('CMD_CAVALRY_HOST');
engine.state.food = 30;
// 平地12マス連結
engine.state.grid = Array(7).fill(null).map(() => Array(7).fill(null).map(() => ({ placed: false })));
for (let c = 0; c < 6; c++) {
    engine.state.grid[0][c] = { placed: true, terrain: { terrainId: 'GL1_PLAINS' } };
    engine.state.grid[1][c] = { placed: true, terrain: { terrainId: 'GL1_PLAINS' } };
}
assert(!deck.isCardEligible(cCavHost, 2, 0), '平地12マスでも食料30 (<40) では騎馬軍が提示されないこと');

engine.state.food = 45;
assert(deck.isCardEligible(cCavHost, 2, 0), '平地12マス連結 ＆ 食料45 (>=40) で騎馬軍が提示されること');

// 6. CMD_REVELATION_CHOICE (天啓の選択: Stage 2, ✨ >= 15)
console.log('\n--- 6. CMD_REVELATION_CHOICE (天啓の選択) 検証 ---');
const cRev = getCard('CMD_REVELATION_CHOICE');
engine.state.mystic = 10;
assert(!deck.isCardEligible(cRev, 2, 0), '✨10 (<15) では天啓の選択が提示されないこと');
engine.state.mystic = 15;
assert(deck.isCardEligible(cRev, 2, 0), '✨15 で天啓の選択が提示されること');

// 7. CMD_TWO_FUTURES (二つの未来: Stage 3, ✨ >= 25)
console.log('\n--- 7. CMD_TWO_FUTURES (二つの未来) 検証 ---');
const cTwoFut = getCard('CMD_TWO_FUTURES');
engine.state.mystic = 30;
assert(!deck.isCardEligible(cTwoFut, 2, 0), 'Stage 2 では二つの未来が提示されないこと');
engine.state.mystic = 20;
assert(!deck.isCardEligible(cTwoFut, 3, 0), 'Stage 3 でも ✨20 (<25) では二つの未来が提示されないこと');
engine.state.mystic = 25;
assert(deck.isCardEligible(cTwoFut, 3, 0), 'Stage 3, ✨25 で二つの未来が提示されること');

// 8. CMD_PASTORAL_EXPANSION (放牧地の拡大: Stage 1, 家畜発見済み)
console.log('\n--- 8. CMD_PASTORAL_EXPANSION (放牧地の拡大) 検証 ---');
const cPastoral = getCard('CMD_PASTORAL_EXPANSION');
engine.state.grid = Array(5).fill(null).map(() => Array(5).fill(null).map(() => ({ placed: false })));
assert(!deck.isCardEligible(cPastoral, 1, 0), '家畜未発見時は放牧地の拡大が提示されないこと');

engine.state.grid[0][0] = { placed: true, socketResource: { id: 'RES_COW', nameKey: 'RES_COW' } };
assert(deck.isCardEligible(cPastoral, 1, 0), '家畜(COW)発見済みで放牧地の拡大が提示されること');

// 9. CMD_LIME_CONSTRUCTION (石灰焼成: Stage 2, 石材 ＆ 木材発見済み)
console.log('\n--- 9. CMD_LIME_CONSTRUCTION (石灰焼成) 検証 ---');
const cLime = getCard('CMD_LIME_CONSTRUCTION');
engine.state.grid = Array(5).fill(null).map(() => Array(5).fill(null).map(() => ({ placed: false })));
assert(!deck.isCardEligible(cLime, 2, 0), '資源未発見時は石灰焼成が提示されないこと');

engine.state.grid[0][0] = { placed: true, socketResource: { id: 'RES_LIMESTONE', nameKey: 'RES_LIMESTONE' } };
assert(!deck.isCardEligible(cLime, 2, 0), '石灰岩のみ(木材未発見)では石灰焼成が提示されないこと');

engine.state.grid[0][1] = { placed: true, socketResource: { id: 'RES_OAK_WOOD', nameKey: 'RES_OAK_WOOD' } };
assert(deck.isCardEligible(cLime, 2, 0), '石灰岩 ＆ 木材の双方が発見済みで石灰焼成が提示されること');

// 10. CMD_CAVALRY_SCOUTS (騎馬斥候隊: Stage 1, 馬発見済み ＆ 開放平地 >= 6 ＆ 試練予告中)
console.log('\n--- 10. CMD_CAVALRY_SCOUTS (騎馬斥候隊) 検証 ---');
const cCavScout = getCard('CMD_CAVALRY_SCOUTS');
engine.state.grid = Array(5).fill(null).map(() => Array(5).fill(null).map(() => ({ placed: false })));
engine.state.turn = 16;
engine.state.nextTrialTurn = 20; // 試練予告中
assert(!deck.isCardEligible(cCavScout, 1, 0), '馬未発見時は騎馬斥候隊が提示されないこと');

engine.state.grid[0][0] = { placed: true, socketResource: { id: 'RES_HORSE', nameKey: 'RES_HORSE' } };
assert(!deck.isCardEligible(cCavScout, 1, 0), '平地0マス (<6) では騎馬斥候隊が提示されないこと');

// 平地 6マス配置
for (let c = 0; c < 5; c++) engine.state.grid[1][c] = { placed: true, terrain: { terrainId: 'GL1_PLAINS' } };
engine.state.grid[2][0] = { placed: true, terrain: { terrainId: 'GL1_PLAINS' } };
assert(deck.isCardEligible(cCavScout, 1, 0), '馬発見済み ＆ 平地6マス ＆ 試練予告中で騎馬斥候隊が提示されること');

// 11. CMD_LOCAL_IRON_ARMAMENT (在地鉄器武装: Stage 2, 鉄発見済み ＆ 試練まで <= 6T)
console.log('\n--- 11. CMD_LOCAL_IRON_ARMAMENT (在地鉄器武装) 検証 ---');
const cIronArm = getCard('CMD_LOCAL_IRON_ARMAMENT');
engine.state.grid = Array(5).fill(null).map(() => Array(5).fill(null).map(() => ({ placed: false })));
engine.state.turn = 10;
engine.state.nextTrialTurn = 20; // 10T先 (>6)
assert(!deck.isCardEligible(cIronArm, 2, 0), '鉄未発見時は在地鉄器武装が提示されないこと');

engine.state.grid[0][0] = { placed: true, socketResource: { id: 'RES_HEMATITE_IRON', nameKey: 'RES_HEMATITE_IRON' } };
assert(!deck.isCardEligible(cIronArm, 2, 0), '試練まで10T (>6) では在地鉄器武装が提示されないこと');

engine.state.turn = 15; // 5T先 (<=6)
assert(deck.isCardEligible(cIronArm, 2, 0), '鉄発見済み ＆ 試練まで5T (<=6) で在地鉄器武装が提示されること');

// 12. CMD_STONE_STRONGPOINT (石造陣地: Stage 2, 石材発見済み)
console.log('\n--- 12. CMD_STONE_STRONGPOINT (石造陣地) 検証 ---');
const cStonePoint = getCard('CMD_STONE_STRONGPOINT');
engine.state.grid = Array(5).fill(null).map(() => Array(5).fill(null).map(() => ({ placed: false })));
assert(!deck.isCardEligible(cStonePoint, 2, 0), '石材未発見時は石造陣地が提示されないこと');

engine.state.grid[0][0] = { placed: true, socketResource: { id: 'RES_GRANITE', nameKey: 'RES_GRANITE' } };
assert(deck.isCardEligible(cStonePoint, 2, 0), '花崗岩(石材)発見済みで石造陣地が提示されること');

// 13. CMD_LEYLINE_RESONANCE (地脈の共鳴: Stage 2, ✨産出資源 2種以上発見済み)
console.log('\n--- 13. CMD_LEYLINE_RESONANCE (地脈の共鳴) 検証 ---');
const cLeyline = getCard('CMD_LEYLINE_RESONANCE');
engine.state.grid = Array(5).fill(null).map(() => Array(5).fill(null).map(() => ({ placed: false })));
assert(!deck.isCardEligible(cLeyline, 2, 0), '資源未発見時は地脈の共鳴が提示されないこと');

engine.state.grid[0][0] = { placed: true, socketResource: { id: 'RES_GOLD_VEIN', nameKey: 'RES_GOLD_VEIN', bonusMystic: 2 } };
assert(!deck.isCardEligible(cLeyline, 2, 0), '神秘資源1種のみでは地脈の共鳴が提示されないこと');

engine.state.grid[0][1] = { placed: true, socketResource: { id: 'RES_GEM_CRYSTAL', nameKey: 'RES_GEM_CRYSTAL', bonusMystic: 3 } };
assert(deck.isCardEligible(cLeyline, 2, 0), '神秘資源2種発見済みで地脈の共鳴が提示されること');

// 14. CMD_VOICE_BENEATH_EARTH (大地の囁き: Stage 1, 異なる資源 2種以上発見済み)
console.log('\n--- 14. CMD_VOICE_BENEATH_EARTH (大地の囁き) 検証 ---');
const cVoice = getCard('CMD_VOICE_BENEATH_EARTH');
engine.state.grid = Array(5).fill(null).map(() => Array(5).fill(null).map(() => ({ placed: false })));
assert(!deck.isCardEligible(cVoice, 1, 0), '資源未発見時は大地の囁きが提示されないこと');

engine.state.grid[0][0] = { placed: true, socketResource: { id: 'RES_COW', nameKey: 'RES_COW' } };
assert(!deck.isCardEligible(cVoice, 1, 0), '1種類の資源のみでは大地の囁きが提示されないこと');

engine.state.grid[0][1] = { placed: true, socketResource: { id: 'RES_OAK_WOOD', nameKey: 'RES_OAK_WOOD' } };
assert(deck.isCardEligible(cVoice, 1, 0), '異なる資源2種発見済みで大地の囁きが提示されること');

// 15. CARD_WETLAND_1X1 (湿原: Stage 1, 初期開放)
console.log('\n--- 15. CARD_WETLAND_1X1 (湿原) 検証 ---');
const cWetland = getCard('CARD_WETLAND_1X1');
assert(cWetland && cWetland.rarity === 'C' && cWetland.yields.food === 2 && cWetland.yields.defense === 1, '湿原の産出が 🌾2, 🛡️1 であること');
assert(deck.isCardEligible(cWetland, 1, 0), 'Stage 1 で湿原が提示されること');

// 16. CMD_SINGLE_CLEARING (伐採: Stage 1, 森林 >= 1)
console.log('\n--- 16. CMD_SINGLE_CLEARING (伐採) 検証 ---');
const cClearing = getCard('CMD_SINGLE_CLEARING');
engine.state.grid = Array(5).fill(null).map(() => Array(5).fill(null).map(() => ({ placed: false })));
assert(!deck.isCardEligible(cClearing, 1, 0), '森林なし時は伐採が提示されないこと');
engine.state.grid[0][0] = { placed: true, terrain: { terrainId: 'GL2_FOREST' } };
assert(deck.isCardEligible(cClearing, 1, 0), '森林ありで伐採が提示されること');

// 17. CMD_WETLAND_RECLAMATION (干拓: Stage 1, 湿原 >= 1 & 🧱 >= 15)
console.log('\n--- 17. CMD_WETLAND_RECLAMATION (干拓) 検証 ---');
const cReclaim = getCard('CMD_WETLAND_RECLAMATION');
engine.state.grid = Array(5).fill(null).map(() => Array(5).fill(null).map(() => ({ placed: false })));
engine.state.wood = 20;
assert(!deck.isCardEligible(cReclaim, 1, 0), '湿原なし時は干拓が提示されないこと');
engine.state.grid[0][0] = { placed: true, terrain: { terrainId: 'E0_WETLAND' } };
engine.state.wood = 10;
assert(!deck.isCardEligible(cReclaim, 1, 0), '🧱10 (<15) では干拓が提示されないこと');
engine.state.wood = 15;
assert(deck.isCardEligible(cReclaim, 1, 0), '湿原あり ＆ 🧱15 で干拓が提示されること');

// 18. CMD_SYSTEMATIC_LOGGING (計画伐採: Stage 2, 森林 >= 2)
console.log('\n--- 18. CMD_SYSTEMATIC_LOGGING (計画伐採) 検証 ---');
const cLogging = getCard('CMD_SYSTEMATIC_LOGGING');
engine.state.grid = Array(5).fill(null).map(() => Array(5).fill(null).map(() => ({ placed: false })));
engine.state.grid[0][0] = { placed: true, terrain: { terrainId: 'GL2_FOREST' } };
assert(!deck.isCardEligible(cLogging, 2, 0), '森林1マス (<2) では計画伐採が提示されないこと');
engine.state.grid[0][1] = { placed: true, terrain: { terrainId: 'GL2_FOREST' } };
assert(deck.isCardEligible(cLogging, 2, 0), '森林2マスで計画伐採が提示されること');

// 19. CMD_ABANDONED_SETTLEMENT (領土探索: Stage 1, 空きマス >= 8)
console.log('\n--- 19. CMD_ABANDONED_SETTLEMENT (領土探索) 検証 ---');
const cExpedition = getCard('CMD_ABANDONED_SETTLEMENT');
engine.state.grid = Array(5).fill(null).map(() => Array(5).fill(null).map(() => ({ placed: true })));
assert(!deck.isCardEligible(cExpedition, 1, 0), '空きマス0では領土探索が提示されないこと');
for (let r = 0; r < 2; r++) {
    for (let c = 0; c < 5; c++) {
        engine.state.grid[r][c] = { placed: false };
    }
}
assert(deck.isCardEligible(cExpedition, 1, 0), '空きマス8以上で領土探索が提示されること');

// 20. CMD_MUD_OBSTACLE (泥濘陣地: Stage 1, 湿原/湖 >= 1 & 試練予告中)
console.log('\n--- 20. CMD_MUD_OBSTACLE (泥濘陣地) 検証 ---');
const cMud = getCard('CMD_MUD_OBSTACLE');
engine.state.grid = Array(5).fill(null).map(() => Array(5).fill(null).map(() => ({ placed: false })));
engine.state.turn = 16;
engine.state.nextTrialTurn = 20; // 試練予告中
assert(!deck.isCardEligible(cMud, 1, 0), '湿原なし時は泥濘陣地が提示されないこと');
engine.state.grid[0][0] = { placed: true, terrain: { terrainId: 'E0_WETLAND' } };
assert(deck.isCardEligible(cMud, 1, 0), '湿原あり ＆ 試練予告中で泥濘陣地が提示されること');

// 21. CMD_OUTPOST_SIGNAL (狼煙: Stage 2, 前哨塔または丘陵/山岳存在)
console.log('\n--- 21. CMD_OUTPOST_SIGNAL (狼煙) 検証 ---');
const cSignal = getCard('CMD_OUTPOST_SIGNAL');
engine.state.grid = Array(5).fill(null).map(() => Array(5).fill(null).map(() => ({ placed: false })));
engine.state.hasOutpost = false;
assert(!deck.isCardEligible(cSignal, 2, 0), '前哨塔・丘陵なし時は狼煙が提示されないこと');
engine.state.grid[0][0] = { placed: true, terrain: { terrainId: 'E2_HILL' } };
assert(deck.isCardEligible(cSignal, 2, 0), '丘陵存在で狼煙が提示されること');

// 22. CMD_SCOUT_ENEMY (敵情偵察: Stage 2, 試練予告中)
console.log('\n--- 22. CMD_SCOUT_ENEMY (敵情偵察) 検証 ---');
const cScoutEnemy = getCard('CMD_SCOUT_ENEMY');
engine.state.turn = 10;
engine.state.nextTrialTurn = 20; // 予告中ではない
assert(!deck.isCardEligible(cScoutEnemy, 2, 0), '試練予告中でない時は敵情偵察が提示されないこと');
engine.state.turn = 16; // 残り4T (試練予告中)
assert(deck.isCardEligible(cScoutEnemy, 2, 0), '試練予告中で敵情偵察が提示されること');

// 23. CMD_OMEN_DREAM (予兆: Stage 1, 試練まで <= 10T)
console.log('\n--- 23. CMD_OMEN_DREAM (予兆) 検証 ---');
const cOmen = getCard('CMD_OMEN_DREAM');
engine.state.turn = 5;
engine.state.nextTrialTurn = 20; // 15T先 (>10)
assert(!deck.isCardEligible(cOmen, 1, 0), '試練まで15T (>10) では予兆が提示されないこと');
engine.state.turn = 12; // 8T先 (<=10)
assert(deck.isCardEligible(cOmen, 1, 0), '試練まで8T (<=10) で予兆が提示されること');

// 24. CMD_REKINDLE_EMBER (再燃: Stage 1, ✨ >= 10 & 🔥 <= 5)
console.log('\n--- 24. CMD_REKINDLE_EMBER (再燃) 検証 ---');
const cRekindle = getCard('CMD_REKINDLE_EMBER');
engine.state.mystic = 5;
engine.state.ember = 4;
assert(!deck.isCardEligible(cRekindle, 1, 0), '✨5 (<10) では再燃が提示されないこと');
engine.state.mystic = 10;
engine.state.ember = 10;
assert(!deck.isCardEligible(cRekindle, 1, 0), '🔥10 (>5) では再燃が提示されないこと');
engine.state.ember = 4;
assert(deck.isCardEligible(cRekindle, 1, 0), '✨10 ＆ 🔥4 で再燃が提示されること');

// 25. CMD_TRANSMUTE_GOLDEN (秘境: Stage 2, ✨ >= 20 & 未マージ砂漠/山岳存在)
console.log('\n--- 25. CMD_TRANSMUTE_GOLDEN (秘境) 検証 ---');
const cTransmute = getCard('CMD_TRANSMUTE_GOLDEN');
engine.state.grid = Array(5).fill(null).map(() => Array(5).fill(null).map(() => ({ placed: false })));
engine.state.mystic = 25;
assert(!deck.isCardEligible(cTransmute, 2, 0), '砂漠/山岳なし時は秘境が提示されないこと');
engine.state.grid[0][0] = { placed: true, terrain: { terrainId: 'GL0_DESERT' }, merged: false };
assert(deck.isCardEligible(cTransmute, 2, 0), '未マージ砂漠あり ＆ ✨25 で秘境が提示されること');

// 26. generateOfferingCards による実オファリング枠への選出テスト
console.log('\n--- 26. generateOfferingCards 実機選出テスト ---');
// Stage 2 で条件を満たす状態を作り、複数回抽選で追加カードが手札オファリングに現れることを確認
engine.state.stage = 2;
engine.state.mystic = 20;
engine.state.food = 50;
engine.state.ember = 10;
// 平地 6マス
for (let c = 0; c < 6; c++) engine.state.grid[0][c] = { placed: true, terrain: { terrainId: 'GL1_PLAINS' } };

let generatedCommandCard = false;
for (let attempt = 0; attempt < 50; attempt++) {
    deck.generateOfferingCards();
    const offering = engine.state.handOffering;
    assert(offering && offering.length === 3, 'オファリングが3枚生成されること');
    for (const card of offering) {
        const masterCard = card ? (card.terrain || master.find(m => m.id === card.cardMasterId)) : null;
        if (masterCard && (masterCard.category === 'COMMAND' || masterCard.id.startsWith('CMD_'))) {
            generatedCommandCard = true;
            assert(deck.isCardEligible(masterCard, 2, 0), `オファリングされたコマンドカード ${masterCard.id} が適格条件を満たしていること`);
        }
    }
}
assert(generatedCommandCard, 'オファリング抽選でコマンドカードが実機選出されること');

console.log('\n====================================================');
console.log(`🎉 全検証完了: ${passed} / ${total} 件 合格 (100% PASS)`);
console.log('====================================================');
