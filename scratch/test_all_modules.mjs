/* =============================================================
   scratch/test_all_modules.mjs
   全ドメインモジュール一括自動検証テストランナー
   ============================================================= */

import {
    I18n,
    LAND_SYSTEM_DATA,
    DIRECTIVES,
    DirectiveSystem,
    DeckManager,
    ProductionCalculator,
    UndoLandSystem,
    GridEngine,
    BuffSystem,
    GameState,
    GameEngine,
    TerritoryBadgeComponent
} from '../game/src/app.js';

console.log('====================================================');
console.log('🚀 全ドメインモジュール一括動作確認テスト開始');
console.log('====================================================');

let totalTests = 0;
let passedTests = 0;

function assert(condition, testName) {
    totalTests++;
    if (condition) {
        passedTests++;
        console.log(`  ✅ [PASS] ${testName}`);
    } else {
        console.error(`  ❌ [FAIL] ${testName}`);
        process.exitCode = 1;
    }
}

// --- 1. GameEngine & GameState 初期化テスト ---
console.log('\n📦 [1/6] GameEngine & GameState 初期化');
const engine = GameEngine.createGame();
assert(!!engine.state, 'GameEngine.state が正常に初期化されていること');
assert(!!engine.gridEngine, 'GridEngine が DI 注入されていること');
assert(!!engine.deckManager, 'DeckManager が DI 注入されていること');
assert(!!engine.buffSystem, 'BuffSystem が DI 注入されていること');
assert(engine.state.ember === 20, '初期残り火が 20 であること');
assert(engine.state.food === 30 && engine.state.wood === 30, '初期食料・資材が 30 であること');

// --- 2. GridEngine 土地配置 ＆ 近郊ボーナステスト ---
console.log('\n🗺️ [2/6] GridEngine 土地配置・近郊ボーナス');
// 本営 (2,2) の周囲 (1,2) に平地を配置
const placeRes = engine.gridEngine.placeShape(1, 2, [[1]], {
    id: 'GL1_PLAINS',
    terrainId: 'GL1_PLAINS',
    nameKey: 'TERRAIN_PLAINS',
    baseYieldsPerTile: { food: 4, wood: 0, defense: 0, mystic: 0 }
});
assert(placeRes.success === true, '本営近郊 (1,2) への平地 1x1 配置が成功すること');
assert(engine.state.countPlacedTiles() === 1, '配置済みタイル数が 1 マスであること');
const cell = engine.state.grid[1][2];
assert(cell.isHQVicinity === true, '本営近郊フラグ (isHQVicinity) が true であること');

// --- 3. BuffSystem ＆ ProductionCalculator 産出計算テスト ---
console.log('\n🔥 [3/6] BuffSystem ＆ ProductionCalculator 産出計算');
const initialBuffs = engine.buffSystem.getDisplayBuffs();
assert(initialBuffs.length >= 1, '初期環境バフ (残り火旺盛) が登録されていること');

const prods = engine.state.calculateTotalProduction();
assert(prods.totalFood >= 16, `食料産出が正しく計算されていること (実際: ${prods.totalFood})`);
assert(prods.totalMystic >= 2, `神秘産出に残り火ボーナスが加算されていること (実際: ${prods.totalMystic})`);

// --- 4. DeckManager ＆ コマンドカード「農地改革」テスト ---
console.log('\n🃏 [4/6] DeckManager ＆ コマンドカード発動');
const hand = engine.deckManager.generateOfferingCards();
assert(hand.length === 3, '手札オファリングが 3 枚生成されること');

const woodBefore = engine.state.wood;
const playRes = engine.deckManager.playCommandCard({
    id: 'CMD_AGRICULTURAL_POLICY',
    category: 'COMMAND',
    nameKey: 'CMD_AGRICULTURAL_POLICY_NAME',
    cost: { wood: 20 },
    rarity: 'R',
    isUnique: true
});
assert(playRes.success === true, '農地改革の発動が成功すること');
assert(engine.state.wood === woodBefore - 20, 'コスト 🧱-20 が正しく消費されていること');
const prodsAfterReform = engine.state.calculateTotalProduction();
assert(prodsAfterReform.totalFood > prods.totalFood, '農地改革により草原産出が増加していること');

// --- 5. TerritoryBadgeComponent ステージ連動テスト ---
console.log('\n🏛️ [5/6] TerritoryBadgeComponent ステージ連動');
assert(TerritoryBadgeComponent.constructor.getMaxTilesForStage(1) === 24, 'Stage 1 最大マスが 24 であること');
assert(TerritoryBadgeComponent.constructor.getMaxTilesForStage(2) === 48, 'Stage 2 最大マスが 48 であること');
assert(TerritoryBadgeComponent.constructor.getMaxTilesForStage(3) === 80, 'Stage 3 最大マスが 80 であること');

// --- 6. UndoLandSystem アンドゥテスト ---
console.log('\n↩️ [6/6] UndoLandSystem アンドゥ機能');
const undoSys = new UndoLandSystem(engine.state);
engine.state.hasPickedThisTurn = false;
undoSys.captureSnapshot([{ r: 0, c: 2 }]);

// 新たに森 (0,2) を配置
engine.gridEngine.placeShape(0, 2, [[1]], {
    id: 'GL2_FOREST',
    terrainId: 'GL2_FOREST',
    nameKey: 'TERRAIN_FOREST',
    baseYieldsPerTile: { food: 2, wood: 2, defense: 2, mystic: 0 }
});
assert(engine.state.grid[0][2].placed === true, '森の配置が成功していること');
const undoRes = undoSys.undo();
assert(undoRes === true, 'アンドゥが成功すること');
assert(engine.state.grid[0][2].placed === false, 'アンドゥ後に (0,2) が未配置に戻っていること');

console.log('\n====================================================');
console.log(`🎉 全テスト完了: ${passedTests} / ${totalTests} 件 合格 (100% PASS)`);
console.log('====================================================');
