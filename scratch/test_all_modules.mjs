/* =============================================================
   scratch/test_all_modules.mjs
   全ドメインモジュール一括自動検証テストランナー
   ============================================================= */

import {
    I18n,
    LAND_SYSTEM_DATA,
    TerrainParameterEngine,
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
    EmberStatusComponent,
    HqComponent,
    ConditionEvaluator,
    EffectResolver,
    ChronicleSystem,
    GlobalEventManager,
    GLOBAL_EVENTS_MASTER,
    EmberSystem
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
const initialBlockCount = engine.state.placedBlockCount || 0;
engine.gridEngine.placeShape(0, 2, [[1]], {
    id: 'GL2_FOREST',
    terrainId: 'GL2_FOREST',
    nameKey: 'TERRAIN_FOREST',
    baseYieldsPerTile: { food: 2, wood: 2, defense: 2, mystic: 0 }
});
assert(engine.state.grid[0][2].placed === true, '森の配置が成功していること');
assert(engine.state.placedBlockCount === initialBlockCount + 1, '配置後に placedBlockCount が +1 されること');
const undoRes = undoSys.undo();
assert(undoRes === true, 'アンドゥが成功すること');
assert(engine.state.grid[0][2].placed === false, 'アンドゥ後に (0,2) が未配置に戻っていること');
assert(engine.state.placedBlockCount === initialBlockCount, 'アンドゥ後に placedBlockCount が初期値に完全巻き戻し復帰すること');

// 保留枠から土地を配置 ➔ アンドゥで保留枠へ復帰するテスト
const mockReserveCard = {
    id: 'GL2_FOREST',
    category: 'LAND',
    terrain: { id: 'GL2_FOREST', nameKey: 'TERRAIN_FOREST' },
    currentShape: [[1]]
};
engine.state.reserveSlots[0] = mockReserveCard;
undoSys.captureSnapshot([{ r: 0, c: 2 }]);
engine.state.reserveSlots[0] = null; // プレイで保留枠から消費
engine.gridEngine.placeShape(0, 2, [[1]], mockReserveCard.terrain);
assert(engine.state.reserveSlots[0] === null, 'プレイ後に保留枠が空になっていること');
undoSys.undo();
assert(engine.state.reserveSlots[0] !== null, 'アンドゥ後にカードが保留枠へ復帰していること');
assert(engine.state.reserveSlots[0].id === 'GL2_FOREST', '保留枠に正しいカードが復元されていること');

// 手札満杯時の returnFromReserve 安全性テスト (カード消失防止)
engine.state.handOffering = [
    { id: 'C1', isBlank: false },
    { id: 'C2', isBlank: false },
    { id: 'C3', isBlank: false }
];
const returnFailRes = engine.deckManager.returnFromReserve(0);
assert(returnFailRes === false, '手札満杯時の保留解除は false を返すこと');
assert(engine.state.reserveSlots[0] !== null, '手札満杯時に保留カードが消失せず保護されること');

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
assert(boardCameraSystem.currentZoom === 1.0, 'ズームリセットで初期倍率 1.0x に復帰すること');

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

// ④ ターン経過 (tickTurn) による期限バフの失効 (次のターンから3ターンの完全サイクル)
buffEngine.buffSystem.tickTurn(); // 発動ターン終了: startsNextTurn 解除 (残り 3T 維持)
assert(buffEngine.buffSystem.hasBuff('CMD_REKINDLE_EMBER') === true, '発動ターン終了時も残り3Tを維持すること');
buffEngine.buffSystem.tickTurn(); // 次ターン終了: 残り 2T
buffEngine.buffSystem.tickTurn(); // 翌々ターン終了: 残り 1T
buffEngine.buffSystem.tickTurn(); // 満了ターン終了: 残り 0T (失効)
assert(buffEngine.buffSystem.hasBuff('CMD_REKINDLE_EMBER') === false, '次ターンから丸々3ターン経過後に CMD_REKINDLE_EMBER が自動失効すること');

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

// ⛰️ 本営周囲8マスへの山岳配置禁止ルール検証 (1,3 は本営 2,2 の北東近郊・未配置)
const mountainNearHQ = glEngine.gridEngine.canPlaceShape(1, 3, [[1]], mountainTerrain);
assert(mountainNearHQ.can === false && mountainNearHQ.reason === 'MOUNTAIN_NEAR_HQ_FORBIDDEN', '本営周囲8マスへの山岳配置は MOUNTAIN_NEAR_HQ_FORBIDDEN で禁止されること');

// ⛰️ 湿原(E0) に隣接して 山岳(E3) を配置しようとする ➔ WETLAND_MOUNTAIN_NEIGHBOR で禁止されること
const wetlandEngine = new GameEngine();
const wetlandTerrain = { id: 'E0_WETLAND', gl: 1, e: 0, nameKey: 'TERRAIN_WETLAND' };
wetlandEngine.gridEngine.placeShape(1, 2, [[1]], wetlandTerrain, 0); // 本営(2,2)の北隣に湿原を配置
wetlandEngine.state.hasPickedThisTurn = false;
const mtnNextToWetland = wetlandEngine.gridEngine.canPlaceShape(0, 2, [[1]], mountainTerrain); // (0,2) [非本営近郊] に山岳を配置試行
assert(mtnNextToWetland.can === false && mtnNextToWetland.reasons.includes('WETLAND_MOUNTAIN_NEIGHBOR'), '湿原(E0)に隣接する山岳(E3)の配置は WETLAND_MOUNTAIN_NEIGHBOR で禁止されること');

// 🔒 同属性 2×2 マージ直接面隣接禁止ルール検証 (ユーザー盤面図ケース: 7x7 Stage 2 盤面)
const mergeAdjEngine = new GameEngine();
mergeAdjEngine.gridEngine.expandGrid(7); // 7x7 盤面へ昇格 (本営は 3,3)
const pTerrainForMerge = { id: 'GL1_PLAINS', gl: 1, e: 1, nameKey: 'TERRAIN_PLAINS' };
// B4(3,1), C4(3,2), B5(4,1), C5(4,2) に 2x2 草原マージを構築
mergeAdjEngine.gridEngine.placeShape(3, 1, [[1, 1], [1, 1]], pTerrainForMerge, 0);
mergeAdjEngine.state.hasPickedThisTurn = false;
// B2(1,1), C2(1,2) に草原を配置
mergeAdjEngine.gridEngine.placeShape(1, 1, [[1, 1]], pTerrainForMerge, 0);
mergeAdjEngine.state.hasPickedThisTurn = false;

// B3(2,1) に草原を配置試行 ➔ 未マージ単体のため許可されること (can: true)
const b3Check = mergeAdjEngine.gridEngine.canPlaceShape(2, 1, [[1]], pTerrainForMerge);
assert(b3Check.can === true, '既存マージ北隣のB3への草原配置は未マージ単体のため許可されること');

// B3(2,1) に実際に草原を配置
mergeAdjEngine.gridEngine.placeShape(2, 1, [[1]], pTerrainForMerge, 0);
mergeAdjEngine.state.hasPickedThisTurn = false;

// C3(2,2) に草原を配置試行 ➔ 2BC+3BC で新2x2マージが成立し、南の既存2x2マージと面隣接するため禁止されること
const c3Check = mergeAdjEngine.gridEngine.canPlaceShape(2, 2, [[1]], pTerrainForMerge);
assert(c3Check.can === false && c3Check.reasons.includes('SAME_TERRAIN_MERGED_NEIGHBOR_FORBIDDEN'), 'C3への配置は同属性2x2マージ同士の面隣接(SAME_TERRAIN_MERGED_NEIGHBOR_FORBIDDEN)で禁止されること');

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

// --- 17. 🔥 残り火 ✕ 🗺️ 領土マス数 Stage連動 経済サイクル (3段階維持費 ＆ 領土減衰停止/自家発熱 ＆ 保留維持費) 検問 ---
console.log('\n🔥 [17/21] 🔥 残り火 ✕ 🗺️ 領土マス数 Stage連動 経済サイクル検証');
const emberEngine = new GameEngine();

// ① 🔥9以下 (危機): 食料維持費 🌾15
emberEngine.state.ember = 8;
emberEngine.state.food = 100;
emberEngine.state.processTurnEndMaintenance();
assert(emberEngine.state.food === 85, '🔥8 (危機) で食料維持費 🌾15 が引かれて 100 - 15 = 85 になること');

// ② Stage 1 で 8マス未満: 標準減衰 (🔥-1)
emberEngine.state.grid = Array(5).fill(null).map(() => Array(5).fill(null).map(() => ({ placed: false })));
// 3マス配置
emberEngine.state.grid[0][0].placed = true;
emberEngine.state.grid[0][1].placed = true;
emberEngine.state.grid[0][2].placed = true;
const emberBeforeDecay = emberEngine.state.ember;
emberEngine.state.food = 100;
emberEngine.state.processTurnEndMaintenance();
assert(emberEngine.state.ember === emberBeforeDecay - 1, '領土3マス (<8マス) で標準減衰 🔥-1 であること');

// ③ Stage 1 で 8マス以上: 減衰ストップ (🔥0)
for (let i = 0; i < 8; i++) {
    emberEngine.state.grid[Math.floor(i/5)][i%5].placed = true;
}
const emberBeforeStop = emberEngine.state.ember;
emberEngine.state.food = 100;
emberEngine.state.processTurnEndMaintenance();
assert(emberEngine.state.ember === emberBeforeStop, '領土8マス (>=8マス) で減衰ストップ (🔥0) であること');

// ④ Stage 1 で 20マス以上: 自家発熱 (🔥+1)
for (let i = 0; i < 20; i++) {
    emberEngine.state.grid[Math.floor(i/5)][i%5].placed = true;
}
const emberBeforeHeat = emberEngine.state.ember;
emberEngine.state.food = 100;
emberEngine.state.processTurnEndMaintenance();
assert(emberEngine.state.ember === emberBeforeHeat + 1, '領土20マス (>=20マス) で自家発熱 (🔥+1) であること');

// ⑤ 保留スロット維持費 (🔥-1/T)
emberEngine.state.reserveSlots[0] = { id: 'CARD_PLAINS_1X1' };
const emberBeforeReserve = emberEngine.state.ember;
emberEngine.state.food = 100;
emberEngine.state.processTurnEndMaintenance();
// 自家発熱(+1)と保留維持費(-1)で相殺 = 変化なし
assert(emberEngine.state.ember === emberBeforeReserve, '自家発熱(+1)と保留維持費(-1)で相殺されること');

// ⑥ 食料不足ペナルティ (🔥-1)
emberEngine.state.food = 5; // 危機維持費 15 に対して 5 しかない
emberEngine.state.ember = 9;
emberEngine.state.reserveSlots[0] = null;
emberEngine.state.grid = Array(5).fill(null).map(() => Array(5).fill(null).map(() => ({ placed: false }))); // 0マスで減衰-1
emberEngine.state.processTurnEndMaintenance();
assert(emberEngine.state.food === 0, '不足時に食料が 0 にリセットされること');
assert(emberEngine.state.ember === 7, '食料不足ペナルティ (🔥-1) ＋ 自然減衰 (🔥-1) で 9 - 2 = 7 になること');

// --- 18. EmberStatusComponent 状態計算＆HUDデータ構造体 検問 ---
console.log('\n🔥 [18/21] EmberStatusComponent HUDデータ計算 ＆ 状態解析検証');
assert(typeof EmberStatusComponent.calculateStatus === 'function', 'EmberStatusComponent.calculateStatus 静的メソッドが存在すること');

const mockStateStandard = {
    ember: 15,
    food: 100,
    reserveSlots: [],
    getTerritoryTileCount: () => 5,
    getStageEmberThresholds: () => ({ decayStop: 8, autoHeat: 20 })
};
const statusStandard = EmberStatusComponent.calculateStatus(mockStateStandard);
assert(statusStandard.statusLevel === 'STANDARD', '🔥15 で statusLevel が STANDARD であること');
assert(statusStandard.foodCost === 20, '標準状態で foodCost が 20 であること');
assert(statusStandard.emberDelta === -1, '領土5マス (<8) で emberDelta が -1 であること');
assert(statusStandard.totalTurnDelta === -1, '保留枠なしで totalTurnDelta が -1 であること');

const mockStateProsperous = {
    ember: 25,
    food: 550,
    reserveSlots: [{ id: 'CARD_PLAINS_1X1' }],
    getTerritoryTileCount: () => 22,
    getStageEmberThresholds: () => ({ decayStop: 8, autoHeat: 20 })
};
const statusProsperous = EmberStatusComponent.calculateStatus(mockStateProsperous);
assert(statusProsperous.statusLevel === 'PROSPEROUS', '🔥25 で statusLevel が PROSPEROUS であること');
assert(statusProsperous.foodCost === 25, '旺盛状態で foodCost が 25 であること');
assert(statusProsperous.emberDelta === 1, '領土22マス (>=20) で emberDelta が +1 (自家発熱) であること');
assert(statusProsperous.reserveCost === -1, '保留枠ありで reserveCost が -1 であること');
assert(statusProsperous.totalTurnDelta === 0, '自家発熱(+1)と保留維持費(-1)で totalTurnDelta が 0 になること');

// --- 19. 2x2 正方形マージ 🔥+2 (平地) / 🔥+1 (他地形) 即時ボーナス給付 検問 ---
console.log('\n🧩 [19/21] 2x2 正方形マージ 🔥+2(平地)/🔥+1 即時ボーナス給付検証');
const mergeTestEngine = new GameEngine();
mergeTestEngine.state.ember = 20;
const plainsData = { id: 'PLAINS_1X1', terrainId: 'PLAINS_1X1', nameKey: 'TERRAIN_PLAINS_NAME', baseYieldsPerTile: { food: 1 } };
mergeTestEngine.state.grid[0][0] = { r: 0, c: 0, placed: true, terrain: plainsData };
mergeTestEngine.state.grid[0][1] = { r: 0, c: 1, placed: true, terrain: plainsData };
mergeTestEngine.state.grid[1][0] = { r: 1, c: 0, placed: true, terrain: plainsData };
mergeTestEngine.state.grid[1][1] = { r: 1, c: 1, placed: true, terrain: plainsData };

const emberBeforeMerge = mergeTestEngine.state.ember;
mergeTestEngine.state.checkMergePatterns();
assert(mergeTestEngine.state.ember === emberBeforeMerge + 2, `平地2x2マージ成立で残り火が 🔥+2 加算されること (実際: ${mergeTestEngine.state.ember})`);
assert(mergeTestEngine.state.grid[0][0].merged === true, '2x2マージフラグが true になること');

// --- 20. 📈 配置ブロック数連動 土地配置コスト漸増 検問 ---
console.log('\n📈 [20/21] 配置ブロック数連動 土地配置コスト漸増 検証');
const progressiveEngine = new GameEngine();
progressiveEngine.state.placedBlockCount = 0;
assert(progressiveEngine.gridEngine.getPlacementEmberCost() === 0, '0ブロック配置時は コスト 🔥0 (無料) であること');

progressiveEngine.state.placedBlockCount = 5;
assert(progressiveEngine.gridEngine.getPlacementEmberCost() === 0, '5ブロック配置時は コスト 🔥0 (無料) であること');

progressiveEngine.state.placedBlockCount = 6;
assert(progressiveEngine.gridEngine.getPlacementEmberCost() === 1, '6ブロック配置時は コスト 🔥1 であること');

progressiveEngine.state.placedBlockCount = 15;
assert(progressiveEngine.gridEngine.getPlacementEmberCost() === 1, '15ブロック配置時は コスト 🔥1 であること');

progressiveEngine.state.placedBlockCount = 16;
assert(progressiveEngine.gridEngine.getPlacementEmberCost() === 2, '16ブロック配置時は コスト 🔥2 であること');

progressiveEngine.state.placedBlockCount = 31;
assert(progressiveEngine.gridEngine.getPlacementEmberCost() === 3, '31ブロック配置時は コスト 🔥3 であること');

// --- 21. 🧘 守備的・節約コマンドカード 4 種 検問 ---
console.log('\n🧘 [21/21] 守備的・節約コマンドカード 4 種 (残火の節約・節約配給・瞑想・警戒態勢) 検証');
const saveEngine = new GameEngine();

// ① CMD_CONSERVE_EMBER (残火の節約)
saveEngine.deckManager.playCommandCard({ id: 'CMD_CONSERVE_EMBER', category: 'COMMAND', cost: {} }, null, 0);
assert(saveEngine.state.emberConsumptionReducedTurns === 1, '残火の節約で emberConsumptionReducedTurns が 1 になること');

// ② CMD_RATIONING (節約配給)
const foodBeforeRation = saveEngine.state.food;
saveEngine.deckManager.playCommandCard({ id: 'CMD_RATIONING', category: 'COMMAND', cost: {} }, null, 0);
assert(saveEngine.state.foodCostHalvedTurns === 1, '節約配給で foodCostHalvedTurns が 1 になること');
assert(saveEngine.state.food === foodBeforeRation + 5, '節約配給で 🌾+5 獲得すること');

// ③ CMD_MEDITATION (静かなる瞑想)
const mysticBeforeMed = saveEngine.state.mystic;
saveEngine.deckManager.playCommandCard({ id: 'CMD_MEDITATION', category: 'COMMAND', cost: {} }, null, 0);
assert(saveEngine.state.mystic === mysticBeforeMed + 3, '静かなる瞑想で ✨+3 獲得すること');
assert(saveEngine.state.activeDrawBias && saveEngine.state.activeDrawBias.targetCategory === 'LAND', '静かなる瞑想で次ターン土地バイアスが付与されること');

// ④ CMD_VIGILANCE (警戒: コスト 🧱-15, 次のターンから2ターンの間 全🛡️獲得+3)
saveEngine.state.wood = 20;
const initialDef = saveEngine.state.calculateTotalDefense();
saveEngine.deckManager.playCommandCard({ id: 'CMD_VIGILANCE', category: 'COMMAND', cost: { wood: 15 } }, null, 0);
assert(saveEngine.state.wood === 5, '警戒で 🧱15 消費されて 20 - 15 = 5 になること');
assert(saveEngine.state.vigilanceTurns === 2, '警戒で vigilanceTurns が 2 になること');
assert(saveEngine.state.vigilanceStartsNextTurn === true, '警戒発動時は vigilanceStartsNextTurn が true であること');
assert(saveEngine.state.calculateTotalDefense() === initialDef, '警戒の発動ターン中は防衛力ボーナスが乗らないこと(次ターン開始待ち)');

// ターン終了処理で次ターン開始待ちが解除され、次ターンからボーナス適用
saveEngine.state.processTurnEndMaintenance();
assert(saveEngine.state.vigilanceStartsNextTurn === false, 'ターン終了後に vigilanceStartsNextTurn が false になること');
assert(saveEngine.state.vigilanceTurns === 2, '発動ターン終了時も vigilanceTurns が 2 を維持すること');
assert(saveEngine.state.calculateTotalDefense() === initialDef + 3, '次のターンから警戒により防衛力産出レートに +3 ボーナスが乗ること');
const gained = saveEngine.state.gainDefense(10, 'テスト獲得');
assert(gained === 13, '次ターンの警戒適用中に防衛力10獲得で +3 ボーナスが乗って 13 獲得できること');

// ⑤ CMD_GRAND_CULTIVATION (耕作計画: コスト 🧱-35, 次のターンから4ターンの間 平地産出 🌾+1/T)
saveEngine.state.wood = 50;
saveEngine.deckManager.playCommandCard({ id: 'CMD_GRAND_CULTIVATION', category: 'COMMAND', cost: { wood: 35 } }, null, 0);
assert(saveEngine.state.wood === 15, '耕作計画で 🧱35 消費されること');
assert(saveEngine.state.grandCultivationTurns === 4, '耕作計画で grandCultivationTurns が 4 になること');
assert(saveEngine.state.grandCultivationStartsNextTurn === true, '耕作計画発動時は grandCultivationStartsNextTurn が true であること');
assert(saveEngine.state.buffSystem.hasBuff('CMD_GRAND_CULTIVATION'), 'バフマネージャーに CMD_GRAND_CULTIVATION が登録されること');

// ⑥ CMD_EMERGENCY_LEVY (緊急徴発: コスト 🌾-20, 即座に 🧱+15, 次のターンの食料維持費 +5)
saveEngine.state.food = 30;
saveEngine.state.wood = 10;
saveEngine.deckManager.playCommandCard({ id: 'CMD_EMERGENCY_LEVY', category: 'COMMAND', cost: { food: 20 } }, null, 0);
assert(saveEngine.state.food === 10, '緊急徴発で 🌾20 消費されること');
assert(saveEngine.state.wood === 25, '緊急徴発で 🧱15 獲得されること');
assert(saveEngine.state.emergencyLevyTurns === 1, '緊急徴発で emergencyLevyTurns が 1 になること');
assert(saveEngine.state.emergencyLevyStartsNextTurn === true, '緊急徴発発動時は emergencyLevyStartsNextTurn が true であること');
assert(saveEngine.state.buffSystem.hasBuff('CMD_EMERGENCY_LEVY'), 'バフマネージャーに CMD_EMERGENCY_LEVY が登録されること');

// ⑦ CMD_MANIFEST_MIRACLE (顕現: コスト ✨-10, 次のターンから3ターンの間 補填レート緩和)
saveEngine.state.mystic = 20;
saveEngine.deckManager.playCommandCard({ id: 'CMD_MANIFEST_MIRACLE', category: 'COMMAND', cost: { mystic: 10 } }, null, 0);
assert(saveEngine.state.mystic === 10, '顕現で ✨10 消費されること');
assert(saveEngine.state.manifestMiracleTurns === 3, '顕現で manifestMiracleTurns が 3 になること');
assert(saveEngine.state.manifestMiracleStartsNextTurn === true, '顕現発動時は manifestMiracleStartsNextTurn が true であること');
assert(saveEngine.state.buffSystem.hasBuff('CMD_MANIFEST_MIRACLE'), 'バフマネージャーに CMD_MANIFEST_MIRACLE が登録されること');

// ⑧ CMD_FILL_THE_VOID (届かぬ資材を満たすもの: コスト 無料, 今ターンのみ補填可能)
saveEngine.deckManager.playCommandCard({ id: 'CMD_FILL_THE_VOID', category: 'COMMAND', cost: {} }, null, 0);
assert(saveEngine.state.fillTheVoidTurns === 1, '届かぬ資材を満たすもので fillTheVoidTurns が 1 になること');
assert(saveEngine.state.buffSystem.hasBuff('CMD_FILL_THE_VOID'), 'バフマネージャーに CMD_FILL_THE_VOID が登録されること');

// ⑨ CMD_SCORCHED_RETREAT (焦土退却: コスト 🌾-20, 3ターン土地産出低下)
saveEngine.state.food = 30;
saveEngine.deckManager.playCommandCard({ id: 'CMD_SCORCHED_RETREAT', category: 'COMMAND', cost: { food: 20 } }, null, 0);
assert(saveEngine.state.food === 10, '焦土退却で 🌾20 消費されること');
assert(saveEngine.state.scorchedRetreatTurns === 3, '焦土退却で scorchedRetreatTurns が 3 になること');
assert(saveEngine.state.buffSystem.hasBuff('CMD_SCORCHED_RETREAT'), 'バフマネージャーに CMD_SCORCHED_RETREAT が登録されること');

// ⑩ 条件達成型バフの自動解除検問 (CMD_LAND_FOCUS: 6ブロック達成で消滅 / CMD_MILITARY_FOCUS: 防衛力20達成で消滅)
const condEngine = new GameEngine();
condEngine.state.food = 100;
condEngine.state.wood = 100;
condEngine.state.defense = 0;
condEngine.deckManager.playCommandCard({ id: 'CMD_LAND_FOCUS', category: 'COMMAND', cost: { food: 10, wood: 10 } }, null, 0);
assert(condEngine.state.buffSystem.hasBuff('CMD_LAND_FOCUS'), '発動直後に CMD_LAND_FOCUS がバフ登録されていること');

// 盤面に 6 ブロック配置して自動解除を検証
for (let i = 0; i < 6; i++) {
    const r = Math.floor(i / 5);
    const c = i % 5;
    condEngine.state.grid[r][c] = { placed: true, terrain: { id: 'GL1_PLAINS' }, blockId: `block_${i}` };
}
condEngine.state.checkConditionalBuffs();
assert(!condEngine.state.buffSystem.hasBuff('CMD_LAND_FOCUS'), '盤面6ブロック達成で CMD_LAND_FOCUS が自動解除されること');
assert(condEngine.state.activeDrawBias === null, 'CMD_LAND_FOCUS 解除後に activeDrawBias が null になること');

// CMD_MILITARY_FOCUS の防衛力20達成による自動解除を検証
condEngine.deckManager.playCommandCard({ id: 'CMD_MILITARY_FOCUS', category: 'COMMAND', cost: { wood: 20 } }, null, 0);
assert(condEngine.state.buffSystem.hasBuff('CMD_MILITARY_FOCUS'), '発動直後に CMD_MILITARY_FOCUS がバフ登録されていること');
condEngine.state.defense = 25;
condEngine.state.checkConditionalBuffs();
assert(!condEngine.state.buffSystem.hasBuff('CMD_MILITARY_FOCUS'), '防衛力20達成で CMD_MILITARY_FOCUS が自動解除されること');
assert(condEngine.state.activeDrawBias === null, 'CMD_MILITARY_FOCUS 解除後に activeDrawBias が null になること');

// ====================================================
// 22. 🟨 丘陵（L字）＆ 🛡️ 山岳（凸字）異形マージ ＆ ★覚醒ソケット検証
// ====================================================
console.log('\n🟨 [22/22] 丘陵(L字) ＆ 山岳(凸字) 異形マージ ＆ ★覚醒ソケット検証');

// 1. 丘陵 L字マージテスト
const hillEngine = new GameEngine();
hillEngine.state.ember = 20;
hillEngine.state.food = 100;
hillEngine.state.wood = 100;
const hillData = { id: 'E2_HILL', terrainId: 'E2_HILL', nameKey: 'TERRAIN_HILL', yields: { food: 2, wood: 1, defense: 1 } };

// L字型 (0,0), (0,1), (0,2), (1,0) に丘陵を配置
hillEngine.state.grid[0][0] = { r: 0, c: 0, placed: true, terrain: hillData };
hillEngine.state.grid[0][1] = { r: 0, c: 1, placed: true, terrain: hillData };
hillEngine.state.grid[0][2] = { r: 0, c: 2, placed: true, terrain: hillData };
hillEngine.state.grid[1][0] = { r: 1, c: 0, placed: true, terrain: hillData };

const initialHillEmber = hillEngine.state.ember;
const initialHillFood = hillEngine.state.food;
const initialHillWood = hillEngine.state.wood;

// (1,0) を最後の配置マスとしてマージ判定を実行
hillEngine.state.checkMergePatterns([{ r: 1, c: 0 }]);

assert(hillEngine.state.ember === initialHillEmber + 1, '丘陵L字マージで 🔥+1 加算されること');
assert(hillEngine.state.food === initialHillFood + 4, '丘陵L字マージで 🌾+4 獲得すること');
assert(hillEngine.state.wood === initialHillWood + 6, '丘陵L字マージで 🧱+6 獲得すること');
assert(hillEngine.state.grid[1][0].socketResource && hillEngine.state.grid[1][0].socketResource.id === 'SOCKET_HIDDEN_DEPOSIT', '最後のマス(1,0)に★隠匿鉱床が覚醒すること');
assert(hillEngine.state.grid[1][0].socketResource.bonusMaterial === 2, '★隠匿鉱床で 🧱+2/T ボーナスが付くこと');
assert(hillEngine.state.grid[1][0].socketResource.bonusDefense === 1, '★隠匿鉱床で 🛡️+1/T ボーナスが付くこと');

// 2. 山岳 凸字マージテスト
const mtnEngine = new GameEngine();
mtnEngine.state.ember = 20;
mtnEngine.state.wood = 100;
mtnEngine.state.mystic = 50;
const mtnData = { id: 'E3_MOUNTAIN', terrainId: 'E3_MOUNTAIN', nameKey: 'TERRAIN_MOUNTAIN', yields: { wood: 2, defense: 2, mystic: 1 } };

// 凸字型 (0,1), (1,0), (1,1), (1,2) に山岳を配置
mtnEngine.state.grid[0][1] = { r: 0, c: 1, placed: true, terrain: mtnData };
mtnEngine.state.grid[1][0] = { r: 1, c: 0, placed: true, terrain: mtnData };
mtnEngine.state.grid[1][1] = { r: 1, c: 1, placed: true, terrain: mtnData };
mtnEngine.state.grid[1][2] = { r: 1, c: 2, placed: true, terrain: mtnData };

const initialMtnEmber = mtnEngine.state.ember;
const initialMtnWood = mtnEngine.state.wood;
const initialMtnMystic = mtnEngine.state.mystic;

// (0,1) を最後の配置マスとしてマージ判定を実行
mtnEngine.state.checkMergePatterns([{ r: 0, c: 1 }]);

assert(mtnEngine.state.ember === initialMtnEmber + 1, '山岳凸字マージで 🔥+1 加算されること');
assert(mtnEngine.state.wood === initialMtnWood + 8, '山岳凸字マージで 🧱+8 獲得すること');
assert(mtnEngine.state.mystic === initialMtnMystic + 4, '山岳凸字マージで ✨+4 獲得すること');
assert(mtnEngine.state.grid[0][1].socketResource && mtnEngine.state.grid[0][1].socketResource.id === 'SOCKET_SUMMIT_FORTRESS', '最後のマス(0,1)に★主峰砦が覚醒すること');
assert(mtnEngine.state.grid[0][1].socketResource.bonusDefense === 3, '★主峰砦で 🛡️+3/T ボーナスが付くこと');
assert(mtnEngine.state.grid[0][1].socketResource.bonusMystic === 2, '★主峰砦で ✨+2/T ボーナスが付くこと');

// 3. 🌊 湖 (Lake) 周囲8マスの灌漑バフ (+50% 食料産出ブースト) 検証
const lakeEngine = new GameEngine();
lakeEngine.state.ember = 20;
// (0,0) に湖ソケットを開花
lakeEngine.state.grid[0][0] = { r: 0, c: 0, placed: true, terrain: { id: 'GL1_PLAINS', nameKey: 'TERRAIN_PLAINS', food: 4, wood: 0, defense: 0, mystic: 0 }, socketResource: { id: 'SOCKET_LAKE', nameKey: 'SOCKET_LAKE', bonusFood: 2 } };
// (0,1) に隣接平地（食料4）を配置 ➔ 灌漑バフで +2 (50%) 獲得
lakeEngine.state.grid[0][1] = { r: 0, c: 1, placed: true, terrain: { id: 'GL1_PLAINS', nameKey: 'TERRAIN_PLAINS', food: 4, wood: 0, defense: 0, mystic: 0 } };

const lakeProds = lakeEngine.state.calculateTotalProduction();
// 本営10 + 平地(4+4) + 湖ソケット2 + 灌漑バフ2(4*0.5) = 22, 維持費20 ➔ net +2
assert(lakeProds.foodLakeIrrigation === 2, '湖の隣接平地(食料4)に灌漑バフ +2 (50%) が加算されること');
assert(lakeProds.grossFood === 22, '食料総産出(gross)に湖の灌漑バフが含まれること');

// 🌴 オアシス (Oasis) 周囲8マスの灌漑バフ検証
const oasisEngine = new GameEngine();
oasisEngine.state.ember = 20;
oasisEngine.state.grid[0][0] = { r: 0, c: 0, placed: true, terrain: { id: 'GL0_DESERT', nameKey: 'TERRAIN_DESERT', food: 0, wood: 0, defense: 0, mystic: 2 }, socketResource: { id: 'SOCKET_OASIS', nameKey: 'SOCKET_OASIS', bonusFood: 1 } };
oasisEngine.state.grid[0][1] = { r: 0, c: 1, placed: true, terrain: { id: 'GL1_PLAINS', nameKey: 'TERRAIN_PLAINS', food: 4, wood: 0, defense: 0, mystic: 0 } };
const oasisProds = oasisEngine.state.calculateTotalProduction();
assert(oasisProds.foodLakeIrrigation === 2, 'オアシスの隣接平地(食料4)に灌漑バフ +2 (50%) が加算されること');
assert(oasisProds.grossFood === 17, '食料総産出(gross)にオアシスの灌漑バフが含まれること');

console.log('\n🌟 [23/23] 新規登録バフ 8 種 (人口移住令・大防塁・前哨塔・誘導防衛・高地布陣・騎馬軍・天啓・二つの未来) 検証');

const newBuffEngine = new GameEngine();
newBuffEngine.state.food = 500;
newBuffEngine.state.wood = 500;
newBuffEngine.state.mystic = 500;
newBuffEngine.state.ember = 20;

// 1. 人口移住令 (CMD_RESETTLEMENT)
const resRes = newBuffEngine.deckManager.playCommandCard({ id: 'CMD_RESETTLEMENT', category: 'COMMAND', cost: { food: 15, wood: 10 } });
assert(resRes.success === true, '人口移住令が正常に発動すること');
assert(newBuffEngine.state.buffSystem.hasBuff('CMD_RESETTLEMENT'), 'バフマネージャーに CMD_RESETTLEMENT が登録されること');
assert(newBuffEngine.state.resettlementFoodBonus === 2, '人口移住令で食料ボーナス +2 が設定されること');

// 2. 特別プロジェクト：大防塁 (CMD_GREAT_RAMPART_PROJECT)
const rampRes = newBuffEngine.deckManager.playCommandCard({ id: 'CMD_GREAT_RAMPART_PROJECT', category: 'COMMAND', cost: { wood: 45 } });
assert(rampRes.success === true, '大防塁が正常に発動すること');
assert(newBuffEngine.state.buffSystem.hasBuff('CMD_GREAT_RAMPART_PROJECT'), 'バフマネージャーに CMD_GREAT_RAMPART_PROJECT が登録されること');
assert(newBuffEngine.state.greatRampartTurns === 4, '大防塁の継続ターンが 4 になること');

// 3. 前哨塔 (CMD_OUTPOST)
const outRes = newBuffEngine.deckManager.playCommandCard({ id: 'CMD_OUTPOST', category: 'COMMAND', cost: { wood: 25 } });
assert(outRes.success === true, '前哨塔が正常に発動すること');
assert(newBuffEngine.state.buffSystem.hasBuff('CMD_OUTPOST'), 'バフマネージャーに CMD_OUTPOST が登録されること');
assert(newBuffEngine.state.hasOutpost === true, '前哨塔フラグが true になること');

// 4. 誘導防衛 (CMD_GUIDED_DEFENSE)
const gdRes = newBuffEngine.deckManager.playCommandCard({ id: 'CMD_GUIDED_DEFENSE', category: 'COMMAND', cost: { wood: 20 } });
assert(gdRes.success === true, '誘導防衛が正常に発動すること');
assert(newBuffEngine.state.buffSystem.hasBuff('CMD_GUIDED_DEFENSE'), 'バフマネージャーに CMD_GUIDED_DEFENSE が登録されること');
assert(newBuffEngine.state.guidedDefenseActive === true, '誘導防衛フラグが true になること');

// 5. 高地布陣 (CMD_HIGH_GROUND_FORMATION)
const hgRes = newBuffEngine.deckManager.playCommandCard({ id: 'CMD_HIGH_GROUND_FORMATION', category: 'COMMAND', cost: { wood: 10 } });
assert(hgRes.success === true, '高地布陣が正常に発動すること');
assert(newBuffEngine.state.buffSystem.hasBuff('CMD_HIGH_GROUND_FORMATION'), 'バフマネージャーに CMD_HIGH_GROUND_FORMATION が登録されること');
assert(newBuffEngine.state.highGroundFormationActive === true, '高地布陣フラグが true になること');

// 6. 騎馬軍編成 (CMD_CAVALRY_HOST)
const cavRes = newBuffEngine.deckManager.playCommandCard({ id: 'CMD_CAVALRY_HOST', category: 'COMMAND', cost: { food: 30, wood: 20 } });
assert(cavRes.success === true, '騎馬軍編成が正常に発動すること');
assert(newBuffEngine.state.buffSystem.hasBuff('CMD_CAVALRY_HOST'), 'バフマネージャーに CMD_CAVALRY_HOST が登録されること');
assert(newBuffEngine.state.cavalryHostActive === true, '騎馬軍フラグが true になること');

// 7. 天啓の選択 (CMD_REVELATION_CHOICE)
const revRes = newBuffEngine.deckManager.playCommandCard({ id: 'CMD_REVELATION_CHOICE', category: 'COMMAND', cost: { mystic: 15 } });
assert(revRes.success === true, '天啓の選択が正常に発動すること');
assert(newBuffEngine.state.buffSystem.hasBuff('CMD_REVELATION_CHOICE'), 'バフマネージャーに CMD_REVELATION_CHOICE が登録されること');
assert(newBuffEngine.state.revelationChoiceTurns === 1, '天啓の選択持続ターンが 1 になること');

// 8. 二つの未来 (CMD_TWO_FUTURES)
const tfRes = newBuffEngine.deckManager.playCommandCard({ id: 'CMD_TWO_FUTURES', category: 'COMMAND', cost: { mystic: 20 } });
assert(tfRes.success === true, '二つの未来が正常に発動すること');
assert(newBuffEngine.state.buffSystem.hasBuff('CMD_TWO_FUTURES'), 'バフマネージャーに CMD_TWO_FUTURES が登録されること');
assert(newBuffEngine.state.twoFuturesTurns === 1, '二つの未来持続ターンが 1 になること');

// 9. 放牧地の拡大 (CMD_PASTORAL_EXPANSION)
const pasRes = newBuffEngine.deckManager.playCommandCard({ id: 'CMD_PASTORAL_EXPANSION', category: 'COMMAND', cost: { wood: 10 } });
assert(pasRes.success === true, '放牧地の拡大が正常に発動すること');
assert(newBuffEngine.state.buffSystem.hasBuff('CMD_PASTORAL_EXPANSION'), 'バフマネージャーに CMD_PASTORAL_EXPANSION が登録されること');
assert(newBuffEngine.state.pastoralExpansionActive === true, '放牧地の拡大フラグが true になること');

// 10. 石灰焼成 (CMD_LIME_CONSTRUCTION)
const limeRes = newBuffEngine.deckManager.playCommandCard({ id: 'CMD_LIME_CONSTRUCTION', category: 'COMMAND', cost: { food: 10 } });
assert(limeRes.success === true, '石灰焼成が正常に発動すること');
assert(newBuffEngine.state.buffSystem.hasBuff('CMD_LIME_CONSTRUCTION'), 'バフマネージャーに CMD_LIME_CONSTRUCTION が登録されること');
assert(newBuffEngine.state.limeConstructionActive === true, '石灰焼成フラグが true になること');

// 11. 騎馬斥候隊 (CMD_CAVALRY_SCOUTS)
const scoutRes = newBuffEngine.deckManager.playCommandCard({ id: 'CMD_CAVALRY_SCOUTS', category: 'COMMAND', cost: { food: 10 } });
assert(scoutRes.success === true, '騎馬斥候隊が正常に発動すること');
assert(newBuffEngine.state.buffSystem.hasBuff('CMD_CAVALRY_SCOUTS'), 'バフマネージャーに CMD_CAVALRY_SCOUTS が登録されること');
assert(newBuffEngine.state.cavalryScoutsActive === true, '騎馬斥候隊フラグが true になること');

// 12. 在地鉄器武装 (CMD_LOCAL_IRON_ARMAMENT)
const ironRes = newBuffEngine.deckManager.playCommandCard({ id: 'CMD_LOCAL_IRON_ARMAMENT', category: 'COMMAND', cost: { wood: 15 } });
assert(ironRes.success === true, '在地鉄器武装が正常に発動すること');
assert(newBuffEngine.state.buffSystem.hasBuff('CMD_LOCAL_IRON_ARMAMENT'), 'バフマネージャーに CMD_LOCAL_IRON_ARMAMENT が登録されること');
assert(newBuffEngine.state.localIronArmamentActive === true, '在地鉄器武装フラグが true になること');

// 13. 石造陣地 (CMD_STONE_STRONGPOINT)
const stoneRes = newBuffEngine.deckManager.playCommandCard({ id: 'CMD_STONE_STRONGPOINT', category: 'COMMAND', cost: { wood: 20 } });
assert(stoneRes.success === true, '石造陣地が正常に発動すること');
assert(newBuffEngine.state.buffSystem.hasBuff('CMD_STONE_STRONGPOINT'), 'バフマネージャーに CMD_STONE_STRONGPOINT が登録されること');
assert(newBuffEngine.state.stoneStrongpointActive === true, '石造陣地フラグが true になること');

// 14. 地脈の共鳴 (CMD_LEYLINE_RESONANCE)
const leyRes = newBuffEngine.deckManager.playCommandCard({ id: 'CMD_LEYLINE_RESONANCE', category: 'COMMAND', cost: { mystic: 8 } });
assert(leyRes.success === true, '地脈の共鳴が正常に発動すること');
assert(newBuffEngine.state.buffSystem.hasBuff('CMD_LEYLINE_RESONANCE'), 'バフマネージャーに CMD_LEYLINE_RESONANCE が登録されること');
assert(newBuffEngine.state.leylineResonanceActive === true, '地脈の共鳴フラグが true になること');

// 15. 大地の囁き (CMD_VOICE_BENEATH_EARTH)
const voiceRes = newBuffEngine.deckManager.playCommandCard({ id: 'CMD_VOICE_BENEATH_EARTH', category: 'COMMAND', cost: { mystic: 5 } });
assert(voiceRes.success === true, '大地の囁きが正常に発動すること');
assert(newBuffEngine.state.buffSystem.hasBuff('CMD_VOICE_BENEATH_EARTH'), 'バフマネージャーに CMD_VOICE_BENEATH_EARTH が登録されること');
assert(newBuffEngine.state.voiceBeneathEarthTurns === 1, '大地の囁き持続ターンが 1 になること');

console.log('\n🌍 [24/24] ConditionEvaluator ＆ EffectResolver ＆ ChronicleSystem ＆ GlobalEvent (寒波テストケース) 検証');

// 1. ConditionEvaluator テスト
const testContext = {
    state: {
        turn: 5,
        nextTrialTurn: 20,
        food: 100,
        stage: { id: 1 },
        grid: [
            [{ placed: true, terrain: { terrainId: 'GL1_PLAINS' } }, { placed: true, terrain: { terrainId: 'GL1_PLAINS' } }],
            [{ placed: true, terrain: { terrainId: 'GL1_PLAINS' } }, { placed: true, terrain: { terrainId: 'GL1_PLAINS' } }]
        ]
    }
};
assert(ConditionEvaluator.evaluate({ type: 'TERRAIN_COUNT_AT_LEAST', terrain: 'PLAINS', value: 4 }, testContext) === true, '平地4マス条件がtrueと判定されること');
assert(ConditionEvaluator.evaluate({ type: 'TERRAIN_COUNT_AT_LEAST', terrain: 'PLAINS', value: 5 }, testContext) === false, '平地5マス条件がfalseと判定されること');
assert(ConditionEvaluator.evaluate({ type: 'RESOURCE_AT_LEAST', resource: 'food', value: 80 }, testContext) === true, '食料80以上条件がtrueと判定されること');
assert(ConditionEvaluator.evaluate({ type: 'TRIAL_DISTANCE_ABOVE', value: 5 }, testContext) === true, '試練まで残り15ターン(>5)がtrueと判定されること');

// 2. ChronicleSystem 3層重要度テスト
const chron = new ChronicleSystem();
chron.record({ turn: 1, type: 'MERGE', id: 'MERGE_1', importance: 'MINOR' });
chron.record({ turn: 5, type: 'GLOBAL_EVENT', id: 'EVENT_COLD_WAVE', importance: 'MAJOR' });
chron.record({ turn: 20, type: 'TRIAL', id: 'TRIAL_1', importance: 'HISTORIC' });

assert(chron.getAllEvents().length === 3, '全年代記イベントが3件記録されていること');
assert(chron.getChronicle('MAJOR').length === 2, 'MAJOR以上でフィルタした年表が2件(MAJOR, HISTORIC)であること');
assert(chron.getChronicle('HISTORIC').length === 1, 'HISTORICでフィルタした年表が1件(第1試練)であること');

// 3. 実戦テストケース: 寒波 (EVENT_COLD_WAVE) ライフサイクル検証
const eventEngine = new GameEngine();
eventEngine.state.ember = 15; // 標準状態 (倍率 1.0x, 維持費 20)
// 平地4マスを配置 (0,0), (0,1), (1,0), (1,1) (各マス食料4 ➔ 計16, (1,1)は本営近郊+1)
for (let r = 0; r < 2; r++) {
    for (let c = 0; c < 2; c++) {
        eventEngine.state.grid[r][c] = { r, c, placed: true, terrain: { id: 'GL1_PLAINS', nameKey: 'TERRAIN_PLAINS', food: 4 } };
    }
}

// 通常時の産出: 本営10 + 平地16 + 近郊1 = 27, 維持費20 ➔ net +7
const normalProds = eventEngine.state.calculateTotalProduction();
assert(normalProds.grossFood === 27, '寒波発動前の平地食料総産出が27であること');

// 寒波を手動トリガー
const coldWaveInst = eventEngine.globalEventManager.triggerEvent('EVENT_COLD_WAVE');
assert(coldWaveInst !== null, '寒波イベントが正常に発動すること');
assert(eventEngine.state.activeGlobalEvents.length === 1, 'アクティブイベントに寒波が登録されること');
assert(eventEngine.state.buffSystem.hasBuff('EVENT_COLD_WAVE'), 'BuffSystemに寒波の表示用Proxyが登録されること');

// 寒波中の産出: 平地食料 16 * 0.75 = 12 ➔ 本営10 + 平地12 + 近郊1 = 23, 維持費20 ➔ net +3
const coldProds = eventEngine.state.calculateTotalProduction();
assert(coldProds.grossFood === 23, '寒波中の平地食料産出が-25%され総産出が23になること');

// 3ターン経過させて寒波の自然失効を検証
eventEngine.globalEventManager.tickTurn(); // 3 -> 2
assert(eventEngine.state.activeGlobalEvents[0].remainingTurns === 2, '1ターン経過で残り2Tになること');
eventEngine.globalEventManager.tickTurn(); // 2 -> 1
assert(eventEngine.state.activeGlobalEvents[0].remainingTurns === 1, '2ターン経過で残り1Tになること');
eventEngine.globalEventManager.tickTurn(); // 1 -> 0 (失効)
assert(eventEngine.state.activeGlobalEvents.length === 0, '3ターン経過で寒波が自然失効すること');
assert(!eventEngine.state.buffSystem.hasBuff('EVENT_COLD_WAVE'), '失効後にBuffSystemの表示用Proxyが自動除去されること');

// 失効後の産出復帰: 本営10 + 平地16 + 近郊1 = 27
const restoredProds = eventEngine.state.calculateTotalProduction();
assert(restoredProds.grossFood === 27, '寒波失効後に平地食料産出が通常値(27)に完全復帰すること');

// 年表記録の検証
const eventChron = eventEngine.state.chronicleSystem.getChronicle('MAJOR');
assert(eventChron.some(e => e.id === 'EVENT_COLD_WAVE'), '年代記に寒波イベントがMAJOR重要度で記録されていること');

// --- 7. HqComponent 本営モジュールテスト ---
console.log('\n🏰 [7/8] HqComponent 本営専用モジュール');
const hqComp = new HqComponent({ state: engine.state });
assert(typeof hqComp.renderCell === 'function', 'HqComponent.renderCell メソッドが存在すること');
assert(typeof hqComp.updateEmberValue === 'function', 'HqComponent.updateEmberValue メソッドが存在すること');
assert(typeof hqComp.showDeltaPopup === 'function', 'HqComponent.showDeltaPopup メソッドが存在すること');
assert(typeof hqComp.checkAndTriggerDeltaPopup === 'function', 'HqComponent.checkAndTriggerDeltaPopup メソッドが存在すること');

// --- 8. 否定・肯定条件（reqNoHillOrMountainAroundHQ）4パターン厳密テスト ---
console.log('\n⛰️ [8/8] 否定・肯定条件（reqNoHillOrMountainAroundHQ）4パターン厳密テスト');
const testCardNoHM = { id: 'TEST_NO_HM', reqNoHillOrMountainAroundHQ: true, minStage: 1 };

// ケース 1: 丘陵・山岳 0個 ➔ true
const testEngine1 = GameEngine.createGame();
assert(testEngine1.deckManager.isCardEligible(testCardNoHM, 1, 0) === true, 'ケース1: 本営周囲に丘陵・山岳0個の時、reqNoHillOrMountainAroundHQ が true (合致) であること');

// ケース 2: 丘陵 1個 ➔ false
const testEngine2 = GameEngine.createGame();
testEngine2.state.grid[1][2] = { r: 1, c: 2, placed: true, terrain: { id: 'E2_HILL', nameKey: 'TERRAIN_HILL' } };
assert(testEngine2.deckManager.isCardEligible(testCardNoHM, 1, 0) === false, 'ケース2: 本営周囲に丘陵1個の時、reqNoHillOrMountainAroundHQ が false (除外) であること');

// ケース 3: 山岳 1個 ➔ false
const testEngine3 = GameEngine.createGame();
testEngine3.state.grid[2][3] = { r: 2, c: 3, placed: true, terrain: { id: 'E3_MOUNTAIN', nameKey: 'TERRAIN_MOUNTAIN' } };
assert(testEngine3.deckManager.isCardEligible(testCardNoHM, 1, 0) === false, 'ケース3: 本営周囲に山岳1個の時、reqNoHillOrMountainAroundHQ が false (除外) であること');

// ケース 4: 丘陵 + 山岳 ➔ false
const testEngine4 = GameEngine.createGame();
testEngine4.state.grid[1][2] = { r: 1, c: 2, placed: true, terrain: { id: 'E2_HILL', nameKey: 'TERRAIN_HILL' } };
testEngine4.state.grid[3][2] = { r: 3, c: 2, placed: true, terrain: { id: 'E3_MOUNTAIN', nameKey: 'TERRAIN_MOUNTAIN' } };
assert(testEngine4.deckManager.isCardEligible(testCardNoHM, 1, 0) === false, 'ケース4: 本営周囲に丘陵+山岳の時、reqNoHillOrMountainAroundHQ が false (除外) であること');

// 肯定条件 reqHillOrMountainAroundHQ の検証
const testCardHasHM = { id: 'TEST_HAS_HM', reqHillOrMountainAroundHQ: true, minStage: 1 };
assert(testEngine1.deckManager.isCardEligible(testCardHasHM, 1, 0) === false, '肯定条件: 丘陵・山岳0個の時、reqHillOrMountainAroundHQ が false であること');
assert(testEngine2.deckManager.isCardEligible(testCardHasHM, 1, 0) === true, '肯定条件: 丘陵1個の時、reqHillOrMountainAroundHQ が true であること');
assert(testEngine3.deckManager.isCardEligible(testCardHasHM, 1, 0) === true, '肯定条件: 山岳1個の時、reqHillOrMountainAroundHQ が true であること');

// --- 9. Stage 2 盤面拡大（7x7）＆ 4大処理テスト ---
console.log('\n🗺️ [9/9] Stage 2 盤面拡大（7x7）＆ 4大処理');
const stageEngine = GameEngine.createGame();

// Stage 2 へ拡大実行
stageEngine.state.stage = { id: 2, name: 'Stage 2', size: 7, maxTiles: 48 };
stageEngine.gridEngine.expandGrid(7);

// 1. グリッドサイズが 7x7
assert(stageEngine.state.grid.length === 7, '盤面行数が 7 であること');
assert(stageEngine.state.grid[0].length === 7, '盤面列数が 7 であること');

// 2. 本営産出が 1.4倍 (14/14/14/2)
const stageProds = stageEngine.state.calculateTotalProduction();
const stageDef = stageEngine.state.calculateTotalDefense();
assert(stageEngine.state.grid[3][3].terrain.food === 14, '本営食料基礎産出が 14 (1.4倍) であること');
assert(stageEngine.state.grid[3][3].terrain.wood === 14, '本営資材基礎産出が 14 (1.4倍) であること');
assert(stageEngine.state.grid[3][3].terrain.defense === 14, '本営防衛基礎産出が 14 (1.4倍) であること');
assert(stageEngine.state.grid[3][3].terrain.mystic === 2, '本営神秘基礎産出が 2 (1.4倍切上) であること');
assert(stageProds.grossFood === 14, 'Stage 2 初期食料総産出が 14 であること');
assert(stageProds.totalWood === 14, 'Stage 2 初期資材総産出が 14 であること');
assert(stageDef === 14, 'Stage 2 初期防衛力が 14 であること');
assert(stageProds.totalMystic === 2, 'Stage 2 初期神秘産出が 2 であること');

// 3. 資源ソケットが +4 個追加（計 7 個）
let totalSockets = 0;
for (let r = 0; r < 7; r++) {
    for (let c = 0; c < 7; c++) {
        if (stageEngine.state.grid[r][c].hasSocket) totalSockets++;
    }
}
assert(totalSockets === 7, `ソケットが既存3個+追加4個の計7個配置されていること (実際: ${totalSockets})`);

// 4. 支配地バッジの分母が 48 になり、支配率が再計算されること
TerritoryBadgeComponent.update(12, stageEngine.state);
assert(TerritoryBadgeComponent.maxCount === 48, '支配地バッジの最大マス数が 48 であること');

// --- 10. E × GL 2変数合成モデル完全検証 ---
console.log('\n📐 [10/10] E × GL 2変数合成モデル (TerrainParameterEngine) 検証');
const yWetland = TerrainParameterEngine.getYields(0, 1);
assert(yWetland.food === 2 && yWetland.material === 0 && yWetland.defense === 1 && yWetland.mystic === 0, 'E0+GL1 湿原の産出が [2, 0, 1, 0] であること');

const yDesert = TerrainParameterEngine.getYields(1, 0);
assert(yDesert.food === 0 && yDesert.material === 0 && yDesert.defense === 0 && yDesert.mystic === 2, 'E1+GL0 砂漠の産出が [0, 0, 0, 2] であること');

const yPlains = TerrainParameterEngine.getYields(1, 1);
assert(yPlains.food === 4 && yPlains.material === 0 && yPlains.defense === 0 && yPlains.mystic === 0, 'E1+GL1 草原の産出が [4, 0, 0, 0] であること');

const yForest = TerrainParameterEngine.getYields(1, 2);
assert(yForest.food === 2 && yForest.material === 2 && yForest.defense === 2 && yForest.mystic === 0, 'E1+GL2 森の産出が [2, 2, 2, 0] であること');

const yDeepForest = TerrainParameterEngine.getYields(1, 3);
assert(yDeepForest.food === 1 && yDeepForest.material === 3 && yDeepForest.defense === 3 && yDeepForest.mystic === 1, 'E1+GL3 深い森の産出が [1, 3, 3, 1] であること');

const yBadlands = TerrainParameterEngine.getYields(2, 0);
assert(yBadlands.food === 0 && yBadlands.material === 1 && yBadlands.defense === 1 && yBadlands.mystic === 2, 'E2+GL0 荒野の産出が [0, 1, 1, 2] であること');

const yHills = TerrainParameterEngine.getYields(2, 1);
assert(yHills.food === 2 && yHills.material === 1 && yHills.defense === 1 && yHills.mystic === 0, 'E2+GL1 丘陵の産出が [2, 1, 1, 0] であること');

const yWoodedHills = TerrainParameterEngine.getYields(2, 2);
assert(yWoodedHills.food === 1 && yWoodedHills.material === 4 && yWoodedHills.defense === 4 && yWoodedHills.mystic === 0, 'E2+GL2 森丘陵の産出が [1, 4, 4, 0] であること');

const yDeepHills = TerrainParameterEngine.getYields(2, 3);
assert(yDeepHills.food === 1 && yDeepHills.material === 5 && yDeepHills.defense === 6 && yDeepHills.mystic === 1, 'E2+GL3 森林丘陵の産出が [1, 5, 6, 1] であること');

const yMountain = TerrainParameterEngine.getYields(3, 0);
assert(yMountain.food === 0 && yMountain.material === 3 && yMountain.defense === 5 && yMountain.mystic === 1, 'E3 山岳の産出が [0, 3, 5, 1] であること');

// --- 11. EmberSystem 残り火統合モジュール ＆ 3大パラダイム検証 ---
console.log('\n🔥 [11/11] EmberSystem 3大パラダイム (即時回復・恒常回復・最大値上昇) 検証');
const eSysEngine = new GameEngine();
assert(eSysEngine.emberSystem !== null && eSysEngine.emberSystem !== undefined, 'GameEngine に emberSystem が DI 注入されていること');
assert(eSysEngine.state.emberSystem === eSysEngine.emberSystem, 'state.emberSystem が engine.emberSystem と双方向リンクしていること');
assert(eSysEngine.emberSystem.current === 20, '初期残り火が 20 であること');
assert(eSysEngine.emberSystem.max === 20, '初期最大上限値が 20 であること');

// ① コスト消費 ＆ 即時回復 (recoverInstant) 上限クランプ検証
eSysEngine.emberSystem.consume(5);
assert(eSysEngine.emberSystem.current === 15, 'consume(5) で残り火が 15 になること');
assert(eSysEngine.state.ember === 15, 'state.ember も 15 に同期されること');

const healed1 = eSysEngine.emberSystem.recoverInstant(3);
assert(healed1 === 3 && eSysEngine.emberSystem.current === 18, 'recoverInstant(3) で 18 に回復し、戻り値が 3 であること');

const healed2 = eSysEngine.emberSystem.recoverInstant(5);
assert(healed2 === 2 && eSysEngine.emberSystem.current === 20, '上限 20 を超える回復はクランプされ、実回復量 2 が返ること');

// ② 恒常回復 (registerPassiveRegen) 検証
eSysEngine.emberSystem.registerPassiveRegen('SANCTUARY', 2);
eSysEngine.emberSystem.registerPassiveRegen('RELIC', 1);
assert(eSysEngine.emberSystem.getPassiveRegenTotal() === 3, '恒常回復の合算値が +3 であること');
eSysEngine.emberSystem.unregisterPassiveRegen('RELIC');
assert(eSysEngine.emberSystem.getPassiveRegenTotal() === 2, '解除後に恒常回復合算値が +2 になること');

// ③ 最大値上昇 (expandMaxCapacity) 検証
const newMax = eSysEngine.emberSystem.expandMaxCapacity(5);
assert(newMax === 25 && eSysEngine.emberSystem.max === 25, 'expandMaxCapacity(5) で最大上限が 25 に拡張されること');
assert(eSysEngine.state.maxEmber === 25, 'state.maxEmber も 25 に同期されること');

const healedOver = eSysEngine.emberSystem.recoverInstant(10);
assert(healedOver === 5 && eSysEngine.emberSystem.current === 25, '拡張された上限 25 まで即時回復できること');

// 📊 ステータス判定 ＆ 食料維持費ステッピング検証
assert(eSysEngine.emberSystem.getStatus() === 'PROSPEROUS', '25 でステータスが PROSPEROUS (旺盛) であること');
assert(eSysEngine.emberSystem.getFoodMaintenanceCost() === 25, 'PROSPEROUS で食料維持費が 25 であること');

eSysEngine.emberSystem.current = 15;
assert(eSysEngine.emberSystem.getStatus() === 'STANDARD', '15 でステータスが STANDARD (標準) であること');
assert(eSysEngine.emberSystem.getFoodMaintenanceCost() === 20, 'STANDARD で食料維持費が 20 であること');

eSysEngine.emberSystem.current = 8;
assert(eSysEngine.emberSystem.getStatus() === 'CRISIS', '8 でステータスが CRISIS (危機) であること');
assert(eSysEngine.emberSystem.getFoodMaintenanceCost() === 15, 'CRISIS で食料維持費が 15 に減圧されること');

// 🧮 calculateTurnBalance 検証
const balance = eSysEngine.emberSystem.calculateTurnBalance();
assert(balance.ember === 8 && balance.maxEmber === 25, 'calculateTurnBalance で現在値と最大値が正しく返ること');
assert(balance.statusLevel === 'CRISIS', 'calculateTurnBalance でステータスレベルが正しく返ること');
assert(balance.foodCost === 15, 'calculateTurnBalance で食料維持費が正しく返ること');

console.log('\n====================================================');
console.log(`🎉 全テスト完了: ${passedTests} / ${totalTests} 件 合格 (100% PASS)`);
console.log('====================================================');

if (passedTests === totalTests && totalTests > 0) {
    process.exit(0);
} else {
    process.exit(1);
}
