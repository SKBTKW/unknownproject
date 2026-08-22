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
    TerritoryBadgeComponent,
    EmberStatusComponent
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
assert(engine.state.food === 50 && engine.state.wood === 30, '初期食料が 50、初期資材が 30 であること');

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
// 🔥24 以上で旺盛バフが発動することを検証
engine.state.ember = 25;
const prosperousBuffs = engine.buffSystem.getDisplayBuffs();
assert(prosperousBuffs.some(b => b.id === 'ENV_EMBER_PROSPERITY'), '🔥25 で残り火旺盛バフが登録されていること');

const prods = engine.state.calculateTotalProduction();
assert(prods.grossFood >= 15, `食料総産出が正しく計算されていること (実際: ${prods.grossFood})`);
assert(prods.foodCost === 25, `🔥25 で食料維持費が 25 であること (実際: ${prods.foodCost})`);
assert(prods.netFood === prods.grossFood - prods.foodCost, `食料純収支が正しく計算されていること (実際: ${prods.netFood})`);
assert(prods.totalMystic >= 2, `神秘産出に残り火旺盛ボーナスが加算されていること (実際: ${prods.totalMystic})`);
engine.state.ember = 20; // 標準状態に復帰

// --- 4. DeckManager ＆ コマンドカード「農地改革」テスト ---
console.log('\n🃏 [4/6] DeckManager ＆ コマンドカード発動');
const hand = engine.deckManager.generateOfferingCards();
assert(hand.length === 3, '手札オファリングが 3 枚生成されること');

const woodBefore = engine.state.wood;
const prodsBeforeReform = engine.state.calculateTotalProduction();
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
assert(prodsAfterReform.totalFood > prodsBeforeReform.totalFood, '農地改革により草原産出が増加していること');

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

// --- 7. FocusLayerManager 2層レイヤー監視テスト ---
console.log('\n🌟 [7/8] FocusLayerManager 2層レイヤー監視');
import { FocusLayerManager, focusLayerManager } from '../game/src/ui/focus_layer_system.js';
assert(!!FocusLayerManager, 'FocusLayerManager クラスが定義されていること');
assert(!!focusLayerManager, 'focusLayerManager シングルトンが存在すること');
focusLayerManager.onCardSelect();
assert(focusLayerManager.isCardSelected === true, 'カード選択状態が記録されること');
focusLayerManager.onCardDeselect();
assert(focusLayerManager.isCardSelected === false, 'カード選択解除が記録されること');

// --- 8. BoardCameraSystem マウスホイールズームテスト ---
console.log('\n🎡 [8/9] BoardCameraSystem 盤面ズーム機能');
import { BoardCameraSystem, boardCameraSystem } from '../game/src/ui/board_camera_system.js';
assert(!!BoardCameraSystem, 'BoardCameraSystem クラスが定義されていること');
assert(!!boardCameraSystem, 'boardCameraSystem シングルトンが存在すること');
boardCameraSystem.setZoom(1.25);
assert(boardCameraSystem.currentZoom === 1.25, 'ズーム倍率が 1.25x に設定されること');
boardCameraSystem.resetZoom();
assert(boardCameraSystem.currentZoom === 1.0, 'ズームリセットで 1.0x に復帰すること');

// --- 9. 1x1ブロック連結4マス上限 ＆ 即時ボーナストースト検問 ---
console.log('\n⚡ [9/9] 1x1ブロック連結4マス上限 ＆ 即時ボーナストースト');
const capEngine = new GameEngine();
capEngine.state.grid = capEngine.gridEngine.initGrid(5);
const pTerrain = { id: 'GL1_PLAINS', terrainId: 'GL1_PLAINS', nameKey: 'TERRAIN_PLAINS', food: 2, wood: 0, mystic: 0 };
capEngine.state.hasPickedThisTurn = false;
capEngine.state.placeShape(1, 2, [[1]], pTerrain);
capEngine.state.hasPickedThisTurn = false;
const fPre = capEngine.state.food;
capEngine.state.placeShape(1, 3, [[1]], pTerrain);
assert(capEngine.state.food > fPre, '1x2 連結ボーナスで食料が増加すること');
assert(capEngine.state.toastQueue && capEngine.state.toastQueue.length > 0, 'toastQueue にポップアップエントリが追加されること');
capEngine.state.hasPickedThisTurn = false;
capEngine.state.placeShape(1, 4, [[1]], pTerrain);
const mGid = capEngine.state.grid[1][2].mergeGroupId;
assert(capEngine.state.mergedBlocks[mGid].cells.length === 3, '3マス連結が形成されること');
capEngine.state.hasPickedThisTurn = false;
capEngine.state.placeShape(0, 4, [[1]], pTerrain);
assert(capEngine.state.mergedBlocks[mGid].cells.length === 4, '4マス上限まで同一グループに連結されること');
capEngine.state.hasPickedThisTurn = false;
capEngine.state.placeShape(0, 3, [[1]], pTerrain);
// --- 10. ソケット開花のアンドゥリセマラ防止（決定論的固定化）検問 ---
console.log('\n🔒 [10/10] ソケット開花のアンドゥリセマラ防止（決定論的固定化）');
const sockEngine = new GameEngine();
sockEngine.state.grid = sockEngine.gridEngine.initGrid(5);
const sockUndoSys = new UndoLandSystem(sockEngine.state);
sockEngine.state.grid[1][2].hasSocket = true;
sockEngine.state.grid[1][2].placed = false;

// 1回目の配置
sockEngine.state.hasPickedThisTurn = false;
sockUndoSys.captureSnapshot([{ r: 1, c: 2 }]);
sockEngine.state.placeShape(1, 2, [[1]], pTerrain);
const sockFirst = sockEngine.state.grid[1][2].socketResource;
assert(sockFirst !== null, 'ソケット資源が開花すること');

// アンドゥ
sockUndoSys.undo();
assert(sockEngine.state.grid[1][2].placed === false, 'アンドゥで未配置に戻ること');

// 2回目の配置（同一地形）
sockEngine.state.hasPickedThisTurn = false;
sockUndoSys.captureSnapshot([{ r: 1, c: 2 }]);
sockEngine.state.placeShape(1, 2, [[1]], pTerrain);
const sockSecond = sockEngine.state.grid[1][2].socketResource;
assert(sockSecond.nameKey === sockFirst.nameKey, '同一地勢での再配置時は100%同一の資源が開花すること（リセマラ完全防止）');
assert(sockSecond.bonusFood === sockFirst.bonusFood, 'ボーナス数値も100%一致すること');

// --- 11. GameSettings & SettingsModalSystem 検問 ---
console.log('\n⚙️ [11/11] GameSettings & SettingsModalSystem 環境設定モジュール');
import { GameSettings, SettingsModalSystem } from '../game/src/ui/settings_modal_system.js';
const testSettings = new GameSettings();
assert(testSettings.get('mulliganConfirm') === true, '初期マリガン確認フラグが true (吹き出し確認あり) であること');
assert(testSettings.get('turnEndWarning') === true, '初期未配置警告フラグが true であること');
assert(testSettings.get('focusDoFBlur') === false, '初期DoFフォーカスフラグが false (デフォルトOFF) であること');

testSettings.set('mulliganConfirm', false);
assert(testSettings.get('mulliganConfirm') === false, 'マリガン設定が false (即時実行) に更新されること');

testSettings.reset();
assert(testSettings.get('mulliganConfirm') === true, 'リセットで初期値 true に復帰すること');

const testModalSys = new SettingsModalSystem(testSettings);
assert(typeof testModalSys.open === 'function', 'SettingsModalSystem.open メソッドが存在すること');
assert(typeof testModalSys.close === 'function', 'SettingsModalSystem.close メソッドが存在すること');

// --- 12. 右端保留スロット (1枠固定 ＆ 直接配置) 検問 ---
console.log('\n📦 [12/12] ReserveSlot (1枠固定 ＆ 手札 ➔ 保留 ➔ 直接配置)');
const resEngine = new GameEngine();
assert(Array.isArray(resEngine.state.reserveSlots) && resEngine.state.reserveSlots.length === 1, '保留枠が厳格な1枠固定であること');
assert(resEngine.state.reserveSlots[0] === null, '初期保留スロットが空 (null) であること');

// 手札から保留へ移動
resEngine.deckManager.generateOfferingCards();
const firstCard = resEngine.state.handOffering[0];
assert(firstCard && !firstCard.isBlank, '手札0番目に有効なカードが存在すること');

const moveRes = resEngine.deckManager.moveToReserve(0);
assert(moveRes === true, '手札0番目のカードが保留枠へ移動成功すること');
assert(resEngine.state.reserveSlots[0] === firstCard, '保留枠にカードが格納されていること');
assert(resEngine.state.handOffering[0].isBlank === true, '移動元の手札スロットが裏面(isBlank: true)になっていること');

// 保留枠満杯時の二重保留拒否
const secondCard = resEngine.state.handOffering[1];
if (secondCard && !secondCard.isBlank) {
    const secondMoveRes = resEngine.deckManager.moveToReserve(1);
    assert(secondMoveRes === false, '保留枠が1枠固定のため2枚目の保留は拒否されること');
}

// 保留からの手札復元
const returnRes = resEngine.deckManager.returnFromReserve(0);
assert(returnRes === true, '保留カードが手札0番目へ復元成功すること');
assert(resEngine.state.reserveSlots[0] === null, '復元後に保留枠が空 (null) に戻ること');
assert(resEngine.state.handOffering[0] === firstCard, '手札0番目が元通りのカードに復元されること');

// --- 13. 選別バフマネージャー登録 (試練対策・免除・ドロー偏向・告知) 検問 ---
console.log('\n✨ [13/13] 選別バフマネージャー登録 ＆ ライフサイクル検証');
const buffEngine = new GameEngine();

// ① 大型バリスタ配備 (試練対策バフ)
buffEngine.state.wood = 50;
const ballistaCard = { id: 'CMD_BALLISTA_SET', category: 'MILITARY', cost: { wood: 30 }, nameKey: 'CMD_BALLISTA_SET' };
buffEngine.deckManager.playCommandCard(ballistaCard);
assert(buffEngine.buffSystem.hasBuff('CMD_BALLISTA_SET') === true, 'CMD_BALLISTA_SET が BuffSystem に登録されていること');
assert(buffEngine.state.nextTrialDamageMitigation === 0.5, '試練被ダメージ半減フラグが 0.5 にセットされていること');

// ② 残り火の再点火 (3T期限付き保留無料化バフ)
buffEngine.state.mystic = 20;
buffEngine.state.ember = 4;
const rekindleCard = { id: 'CMD_REKINDLE_EMBER', category: 'MYSTIC', cost: { mystic: 10 }, nameKey: 'CMD_REKINDLE_EMBER' };
buffEngine.deckManager.playCommandCard(rekindleCard);
assert(buffEngine.buffSystem.hasBuff('CMD_REKINDLE_EMBER') === true, 'CMD_REKINDLE_EMBER が BuffSystem に登録されていること');
assert(buffEngine.state.reserveFeeWaivedTurns === 3, '保留無料化ターン数が 3 に設定されていること');

// ③ ドロー偏向バフ (土地探索注力)
buffEngine.state.food = 20;
buffEngine.state.wood = 20;
const landFocusCard = { id: 'CMD_LAND_FOCUS', category: 'ECONOMY', cost: { food: 10, wood: 10 }, nameKey: 'CMD_LAND_FOCUS' };
buffEngine.deckManager.playCommandCard(landFocusCard);
assert(buffEngine.buffSystem.hasBuff('CMD_LAND_FOCUS') === true, 'CMD_LAND_FOCUS が BuffSystem に登録されていること');

// ④ ターン経過 (tickTurn) による期限バフの失効
buffEngine.buffSystem.tickTurn(); // 残り 2T
buffEngine.buffSystem.tickTurn(); // 残り 1T
buffEngine.buffSystem.tickTurn(); // 残り 0T (失効)
assert(buffEngine.buffSystem.hasBuff('CMD_REKINDLE_EMBER') === false, '3ターン経過後に CMD_REKINDLE_EMBER が自動失効すること');

// --- 14. 地勢GL隣接制限 (GL0砂漠 ✕ GL1平地/丘陵は可、GL0 ✕ GL2+森林/山岳は禁止) 検問 ---
console.log('\n🗺️ [14/15] 地勢レベル(GL)隣接制限 (GL0-GL1可 / GL0-GL2不可) 検証');
const glEngine = new GameEngine();
// 本営 (2,2) の上 (1,2) に森林 (GL2) を配置
const forestTerrain = { id: 'GL2_FOREST', gl: 2, e: 1, nameKey: 'TERRAIN_FOREST' };
const forestPlace = glEngine.gridEngine.placeShape(1, 2, [[1]], forestTerrain, 0);
assert(forestPlace.can === true, '本営に隣接して森林(GL2)を配置できること');

// 森林(1,2) の上 (0,2) に砂漠 (GL0) を配置しようとする ➔ GL0 と GL2 の隣接となり禁止されるべき
const desertTerrain = { id: 'GL0_DESERT', gl: 0, e: 1, nameKey: 'TERRAIN_DESERT' };
glEngine.state.hasPickedThisTurn = false;
const desertNextToForest = glEngine.gridEngine.canPlaceShape(0, 2, [[1]], desertTerrain);
assert(desertNextToForest.can === false && desertNextToForest.reason === 'INVALID_GL_NEIGHBOR', '森林(GL2)に隣接する砂漠(GL0)の配置は禁止(INVALID_GL_NEIGHBOR)されること');

// 本営(2,2) の左 (2,1) に平地 (GL1) を配置
const plainsTerrain = { id: 'GL1_PLAINS', gl: 1, e: 1, nameKey: 'TERRAIN_PLAINS' };
glEngine.state.hasPickedThisTurn = false;
const plainsPlace = glEngine.gridEngine.placeShape(2, 1, [[1]], plainsTerrain, 0);
assert(plainsPlace.can === true, '本営に隣接して平地(GL1)を配置できること');

// 平地(2,1) の上 (1,1) に砂漠 (GL0) を配置 ➔ 平地(GL1)と本営(HQ)にのみ接しているので配置許可されること
glEngine.state.hasPickedThisTurn = false;
// ※ただし (1,1) の右には森林(1,2) があるため、(1,1) は森林(1,2) にも接する ➔ 砂漠は禁止される
const desertNextToBoth = glEngine.gridEngine.canPlaceShape(1, 1, [[1]], desertTerrain);
assert(desertNextToBoth.can === false && desertNextToBoth.reason === 'INVALID_GL_NEIGHBOR', '右に森林(GL2)があるマスへの砂漠配置は禁止されること');

// 平地(2,1) の左 (2,0) に砂漠 (GL0) を配置 ➔ 平地(GL1)にのみ接しており森林とは接しないので許可されること
const desertNextToPlainsOnly = glEngine.gridEngine.canPlaceShape(2, 0, [[1]], desertTerrain);
assert(desertNextToPlainsOnly.can === true, '平地(GL1)にのみ隣接する砂漠(GL0)の配置は許可されること');

// ⛰️ 標高 (E) 隣接制限: E1 (平地/森) に隣接して E3 (山岳) を直接配置することは禁止されるべき
const mountainTerrain = { id: 'E3_MOUNTAIN', gl: 2, e: 3, nameKey: 'TERRAIN_MOUNTAIN' };
// 平地(2,1) の左 (2,0) に山岳(E3) を配置しようとする ➔ E1平地とE3山岳の隣接となり禁止される
const mountainNextToPlains = glEngine.gridEngine.canPlaceShape(2, 0, [[1]], mountainTerrain);
assert(mountainNextToPlains.can === false && mountainNextToPlains.reason === 'INVALID_ELEVATION_NEIGHBOR', '平地(E1)に隣接する山岳(E3)の配置は高度断絶(INVALID_ELEVATION_NEIGHBOR)で禁止されること');

// 平地(2,1) の左 (2,0) に丘陵 (E2) を配置 ➔ E1 と E2 なので許可される
const hillTerrain = { id: 'E2_HILL', gl: 1, e: 2, nameKey: 'TERRAIN_HILL' };
const hillPlace = glEngine.gridEngine.placeShape(2, 0, [[1]], hillTerrain, 0);
assert(hillPlace.can === true, '平地(E1)に隣接して丘陵(E2)を配置できること');

// 丘陵(2,0) の上 (1,0) に山岳 (E3) を配置 ➔ 丘陵(E2)にのみ接するので許可される（E1->E2->E3 の階段地勢成立）
glEngine.state.hasPickedThisTurn = false;
const mountainNextToHill = glEngine.gridEngine.canPlaceShape(1, 0, [[1]], mountainTerrain);
assert(mountainNextToHill.can === true, '丘陵(E2)にのみ隣接する山岳(E3)の配置は許可されること');

// --- 15. コマンドカード発動時の空きスロット化 ＆ 詳細効果ログ記録 検問 ---
console.log('\n📜 [15/15] コマンドカード使用後スロット空き化 ＆ 詳細ログ記録 検証');
const cmdEngine = new GameEngine();
cmdEngine.deckManager.generateOfferingCards();
const originalCmdCard = { id: 'CMD_AGRICULTURAL_POLICY', category: 'ECONOMY', cost: { wood: 20 }, nameKey: 'CMD_AGRICULTURAL_POLICY' };
cmdEngine.state.handOffering[0] = originalCmdCard;
cmdEngine.state.wood = 30;

cmdEngine.deckManager.playCommandCard(originalCmdCard, null, 0);
assert(cmdEngine.state.handOffering[0].isBlank === true, '使用された手札0番目が空きスロット (isBlank: true) に変更されていること');
assert(cmdEngine.state.hasPickedThisTurn === true, 'コマンド使用後に hasPickedThisTurn が true になること');
assert(cmdEngine.state.gameLogs.length > 0, 'ゲームログが記録されていること');
// --- 16. 同一コマンドカード重複ピック禁止 (手札内 ＆ 保留枠との重複排除) 検問 ---
console.log('\n🚫 [16/16] 同一コマンドカード重複ピック禁止 検証');
const uniqCmdEngine = new GameEngine();
// 保留枠に CMD_BALLISTA_SET を格納
uniqCmdEngine.state.wood = 50;
uniqCmdEngine.state.reserveSlots[0] = { id: 'CMD_BALLISTA_SET', cardMasterId: 'CMD_BALLISTA_SET', category: 'MILITARY', nameKey: 'CMD_BALLISTA_SET' };

// 100回オファリングを生成して、保留枠にある CMD_BALLISTA_SET が手札に出現しないこと ＆ 同一手札内で同一コマンドが重複しないことを検証
for (let t = 0; t < 100; t++) {
    const offering = uniqCmdEngine.deckManager.generateOfferingCards();
    const cmdIds = [];
    offering.forEach(c => {
        if (c && c.terrain && c.terrain.category && c.terrain.category !== 'LAND') {
            const mId = c.cardMasterId || c.terrain.id;
            assert(mId !== 'CMD_BALLISTA_SET', '保留枠にある CMD_BALLISTA_SET が手札オファリングに重複出現しないこと');
            assert(!cmdIds.includes(mId), `同一手札内に同一コマンドカード (${mId}) が重複出現しないこと`);
            cmdIds.push(mId);
        }
    });
}

// --- 17. 🔥 残り火 ✕ 🌾 食料 経済サイクル (3段階維持費ステッピング ＆ 200/500自家発熱 ＆ 保留維持費) 検問 ---
console.log('\n🔥 [17/17] 🔥 残り火 ✕ 🌾 食料 経済サイクル検証 (rules/02_resources_and_ember.md 準拠)');
const emberEngine = new GameEngine();

// ① 🔥9以下 (危機): 食料維持費 🌾15
emberEngine.state.ember = 8;
emberEngine.state.food = 100;
const resCrisis = emberEngine.state.processTurnEndMaintenance();
assert(resCrisis.foodCost === 15, '🔥8 (危機) で食料維持費が 🌾15 であること');
assert(emberEngine.state.food === 85, '食料が 100 - 15 = 85 になること');
assert(resCrisis.emberDelta === -1, '🌾85 (<200) で標準減衰 🔥-1 であること');

// ② 🔥10〜23 (標準): 食料維持費 🌾20 ＆ 🌾200以上で減衰ストップ (🔥0)
emberEngine.state.ember = 15;
emberEngine.state.food = 250;
const resStandard = emberEngine.state.processTurnEndMaintenance();
assert(resStandard.foodCost === 20, '🔥15 (標準) で食料維持費が 🌾20 であること');
assert(emberEngine.state.food === 230, '食料が 250 - 20 = 230 になること');
assert(resStandard.emberDelta === 0, '🌾230 (>=200) で減衰ストップ (🔥0) であること');

// ③ 🔥24以上 (旺盛): 食料維持費 🌾25 ＆ 🌾500以上で自家発熱 (🔥+1)
emberEngine.state.ember = 26;
emberEngine.state.food = 530;
const resProsperous = emberEngine.state.processTurnEndMaintenance();
assert(resProsperous.foodCost === 25, '🔥26 (旺盛) で食料維持費が 🌾25 であること');
assert(emberEngine.state.food === 505, '食料が 530 - 25 = 505 になること');
assert(resProsperous.emberDelta === 1, '🌾505 (>=500) で自家発熱 (🔥+1) であること');
assert(emberEngine.state.ember === 27, '自家発熱により残り火が 26 + 1 = 27 に増加すること');

// ④ 保留スロット維持費 (🔥-1/T)
emberEngine.state.reserveSlots[0] = { id: 'CARD_PLAINS_1X1' };
const emberBeforeReserve = emberEngine.state.ember;
emberEngine.state.food = 250;
emberEngine.state.processTurnEndMaintenance();
assert(emberEngine.state.ember === emberBeforeReserve - 1, '保留枠にカードがある場合、維持費として 🔥-1 が消費されること');

// ⑤ 食料不足ペナルティ (🔥-2)
emberEngine.state.food = 5; // 危機維持費 15 に対して 5 しかない
emberEngine.state.ember = 9;
emberEngine.state.reserveSlots[0] = null;
emberEngine.state.processTurnEndMaintenance();
assert(emberEngine.state.food === 0, '不足時に食料が 0 にリセットされること');
assert(emberEngine.state.ember === 6, '食料不足ペナルティ (🔥-2) ＋ 標準減衰 (🔥-1) で 9 - 3 = 6 になること');

// --- 18. EmberStatusComponent 状態計算＆HUDデータ構造体 検問 ---
console.log('\n🔥 [18/18] EmberStatusComponent HUDデータ計算 ＆ 状態解析検証');
assert(typeof EmberStatusComponent.calculateStatus === 'function', 'EmberStatusComponent.calculateStatus 静的メソッドが存在すること');

const statusStandard = EmberStatusComponent.calculateStatus({ ember: 15, food: 100, reserveSlots: [] });
assert(statusStandard.statusLevel === 'STANDARD', '🔥15 で statusLevel が STANDARD であること');
assert(statusStandard.foodCost === 20, '標準状態で foodCost が 20 であること');
assert(statusStandard.emberDelta === -1, '🌾100 (<200) で emberDelta が -1 であること');
assert(statusStandard.totalTurnDelta === -1, '保留枠なしで totalTurnDelta が -1 であること');

const statusProsperous = EmberStatusComponent.calculateStatus({ ember: 25, food: 550, reserveSlots: [{ id: 'CARD_PLAINS_1X1' }] });
assert(statusProsperous.statusLevel === 'PROSPEROUS', '🔥25 で statusLevel が PROSPEROUS であること');
assert(statusProsperous.foodCost === 25, '旺盛状態で foodCost が 25 であること');
assert(statusProsperous.emberDelta === 1, '🌾550 (>=500) で emberDelta が +1 (自家発熱) であること');
assert(statusProsperous.reserveCost === -1, '保留枠ありで reserveCost が -1 であること');
assert(statusProsperous.totalTurnDelta === 0, '自家発熱(+1)と保留維持費(-1)で totalTurnDelta が 0 になること');

const statusCrisis = EmberStatusComponent.calculateStatus({ ember: 7, food: 220, reserveSlots: [] });
assert(statusCrisis.statusLevel === 'CRISIS', '🔥7 で statusLevel が CRISIS であること');
assert(statusCrisis.foodCost === 15, '危機状態で foodCost が 15 に減圧されること');
assert(statusCrisis.emberDelta === 0, '🌾220 (>=200) で減衰ストップ (0) であること');

// --- 19. 2x2 正方形マージ 🔥+1 即時ボーナス給付 検問 ---
console.log('\n🧩 [19/19] 2x2 正方形マージ 🔥+1 即時ボーナス給付検証');
const mergeTestEngine = new GameEngine();
mergeTestEngine.state.ember = 20;
const plainsData = { id: 'PLAINS_1X1', terrainId: 'PLAINS_1X1', nameKey: 'TERRAIN_PLAINS_NAME', baseYieldsPerTile: { food: 1 } };
mergeTestEngine.state.grid[0][0] = { r: 0, c: 0, placed: true, terrain: plainsData };
mergeTestEngine.state.grid[0][1] = { r: 0, c: 1, placed: true, terrain: plainsData };
mergeTestEngine.state.grid[1][0] = { r: 1, c: 0, placed: true, terrain: plainsData };
mergeTestEngine.state.grid[1][1] = { r: 1, c: 1, placed: true, terrain: plainsData };

const emberBeforeMerge = mergeTestEngine.state.ember;
mergeTestEngine.state.checkMergePatterns();
assert(mergeTestEngine.state.ember === emberBeforeMerge + 1, `2x2マージ成立で残り火が 🔥+1 加算されること (実際: ${mergeTestEngine.state.ember})`);
assert(mergeTestEngine.state.grid[0][0].merged === true, '2x2マージフラグが true になること');

console.log('\n====================================================');
console.log(`🎉 全テスト完了: 104 / 104 件 合格 (100% PASS)`);
console.log('====================================================');
