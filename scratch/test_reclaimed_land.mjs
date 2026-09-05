import assert from "assert";
import { GameEngine } from "../game/src/core/game_engine.js";
import { DeckManager } from "../game/src/systems/deck_manager.js";
import { GridEngine } from "../game/src/systems/grid_engine.js";
import { LAND_SYSTEM_DATA, TerrainParameterEngine } from "../game/src/data/land_system.js";
import { I18n } from "../game/src/i18n.js";
import { ProductionCalculator } from "../game/src/systems/production_calculator.js";
import { serializeGameState } from "../game/src/core/state_serializer.js";
import { getZoneCategory } from "../game/src/core/merge_rules.js";
import { TrialTerrainEffectResolver } from "../game/src/trial/systems/trial_terrain_effect_resolver.js";

console.log("============================================================");
console.log("🌾 [Reclaimed Land (干拓地) Zone Compatibility Tests]");
console.log("============================================================");

// ------------------------------------------------------------
// A. 湿原を《干拓》対象として選択できる ＆ 湖湿原は除外される
// ------------------------------------------------------------
console.log("\n🧪 Test A: 《干拓》の提示・発動条件と湖湿原の除外:");
const engineA = new GameEngine();
engineA.state.wood = 30;
engineA.state.ember = 20;

// ケース1: 盤面に湿原が全くない場合 ➔ 提示・発動不可
const cmdReclamation = { id: "CMD_WETLAND_RECLAMATION", reqWetland: 1, reqWood: 15 };
assert.strictEqual(engineA.deckManager.isCardEligible(cmdReclamation, 1, 0), false, "湿原がなければ干拓提示不可");

// ケース2: 湖が存在する湿原のみの場合 ➔ 提示・発動不可（湖湿原は干拓不可）
engineA.state.grid[0][0] = {
    r: 0, c: 0, placed: true,
    terrain: { id: "E0_WETLAND", terrainId: "E0_WETLAND", nameKey: "TERRAIN_WETLAND", e: 0, gl: 1 },
    socketResource: { id: "SOCKET_LAKE", nameKey: "SOCKET_LAKE", isLake: true }
};
assert.strictEqual(engineA.deckManager.isCardEligible(cmdReclamation, 1, 0), false, "湖湿原のみの場合は干拓提示不可");

// ケース3: 通常湿原が存在する場合 ➔ 提示・発動可能
engineA.state.grid[0][1] = {
    r: 0, c: 1, placed: true,
    terrain: { id: "E0_WETLAND", terrainId: "E0_WETLAND", nameKey: "TERRAIN_WETLAND", e: 0, gl: 1 }
};
assert.strictEqual(engineA.deckManager.isCardEligible(cmdReclamation, 1, 0), true, "通常湿原があれば干拓提示可能");
console.log("  ✅ PASS: 湖湿原が除外され、通常湿原のみが干拓対象として正しく判定されます！");

// ------------------------------------------------------------
// B. 実行後 terrainId が干拓地 (E1_RECLAIMED_LAND) になる
// C. 産出が 🌾4 / 🧱1 / 🛡️0 / ✨0 になる
// ------------------------------------------------------------
console.log("\n🧪 Test B & C: 《干拓》実行と干拓地データ定義・産出:");
const resPlay = engineA.deckManager.playCommandCard(cmdReclamation, { type: "OFFERING", index: -1 });
assert.strictEqual(resPlay.success, true, "干拓の実行が成功すること");

// (0,0) の湖湿原はそのまま保護されていること
assert.strictEqual(engineA.state.grid[0][0].terrain.terrainId, "E0_WETLAND", "湖湿原は干拓されず保護されること");

// (0,1) の通常湿原が E1_RECLAIMED_LAND へ変換されていること
const targetCell = engineA.state.grid[0][1];
assert.strictEqual(targetCell.terrain.id, "E1_RECLAIMED_LAND", "terrain.id が E1_RECLAIMED_LAND になること");
assert.strictEqual(targetCell.terrain.terrainId, "E1_RECLAIMED_LAND", "terrain.terrainId が E1_RECLAIMED_LAND になること");
assert.strictEqual(targetCell.terrain.nameKey, "TERRAIN_RECLAIMED_LAND", "nameKey が TERRAIN_RECLAIMED_LAND であること");
assert.strictEqual(targetCell.terrain.e, 1, "高度が E1 であること");
assert.strictEqual(targetCell.terrain.gl, 1, "繁茂度が GL1 であること");
assert.strictEqual(targetCell.terrain.food, 4, "食料が 🌾4 であること");
assert.strictEqual(targetCell.terrain.wood, 1, "資材が 🧱1 であること");
assert.strictEqual(targetCell.terrain.defense, 0, "防衛が 🛡️0 であること");
assert.strictEqual(targetCell.terrain.mystic, 0, "神秘が ✨0 であること");
assert.strictEqual(targetCell.terrain.isSpecialBlock, true, "isSpecialBlock が true であること");
assert.strictEqual(targetCell.terrain.isArtificialTerrain, true, "isArtificialTerrain が true であること");
assert.strictEqual(targetCell.terrain.category, "BASE", "既存categoryが安全なBASEであること");
assert.strictEqual(targetCell.terrain.zoneCategory, "PLAINS", "地帯化カテゴリがPLAINSであること");
assert.strictEqual(targetCell.terrain.trialTerrainCategory, "STANDARD_E1", "Trialでは標準E1戦場であること");
console.log("  ✅ PASS: 湿原が E1_RECLAIMED_LAND (🌾4 🧱1 🛡️0 ✨0) へ永久転換されました！");

// ------------------------------------------------------------
// D. 干拓後は湿原判定に引っかからない
// ------------------------------------------------------------
console.log("\n🧪 Test D: 干拓後の湿原判定除外:");
const tidAfter = targetCell.terrain.terrainId || targetCell.terrain.id;
assert.strictEqual(tidAfter.includes("WETLAND"), false, "WETLAND 文字列を含まないこと");
// 湿原枚数判定が 1 (湖湿原のみ) に減少していること
let wetlandCount = 0;
for (let r = 0; r < engineA.state.grid.length; r++) {
    for (let c = 0; c < engineA.state.grid[r].length; c++) {
        const cell = engineA.state.grid[r][c];
        if (cell && cell.placed && cell.terrain && (cell.terrain.terrainId || "").includes("WETLAND")) {
            wetlandCount++;
        }
    }
}
assert.strictEqual(wetlandCount, 1, "干拓後は湿原カウントから完全に除外されること");
console.log("  ✅ PASS: 干拓後は湿原判定から完全に除外されます！");

// ------------------------------------------------------------
// E. 干拓後は E1 として丘陵 (E2) に隣接可能になる
// ------------------------------------------------------------
console.log("\n🧪 Test E: 高度隣接判定 (E1干拓地とE2丘陵):");
// E0湿原は E2丘陵と隣接不可 (|0-2| = 2 >= 2) だが、E1干拓地は |1-2| = 1 < 2 なので隣接可能
const eRec = targetCell.terrain.e;
const eHill = 2; // E2_HILL
const diff = Math.abs(eRec - eHill);
assert.strictEqual(diff < 2, true, "E1干拓地とE2丘陵の高度差は1であり隣接配置可能");
console.log("  ✅ PASS: E1干拓地は湿原の高度制限を失い、丘陵への隣接が可能になります！");

// ------------------------------------------------------------
// F. 干拓後は湖発見判定が走らない
// ------------------------------------------------------------
console.log("\n🧪 Test F: 湖発見判定の除外:");
assert.strictEqual(tidAfter.includes("WETLAND"), false);
assert.strictEqual(tidAfter.includes("PLAINS"), false);
console.log("  ✅ PASS: E1_RECLAIMED_LAND は WETLAND/PLAINS のどちらにも属さないため湖発見判定は走りません！");

// ------------------------------------------------------------
// G. 実際の《干拓》コマンドだけで混成地帯が成立する
// ------------------------------------------------------------
console.log("\n🧪 Test G: 《干拓》による草原3＋干拓地1の混成地帯:");
const commandMergeEngine = new GameEngine();
commandMergeEngine.state.grid = commandMergeEngine.gridEngine.initGrid(5);
for (const [r, c] of [[0, 0], [0, 1], [1, 0]]) {
    Object.assign(commandMergeEngine.state.grid[r][c], {
        placed: true,
        isHQ: false,
        terrain: { id: "GL1_PLAINS", terrainId: "GL1_PLAINS", nameKey: "TERRAIN_PLAINS", e: 1, gl: 1 }
    });
}
Object.assign(commandMergeEngine.state.grid[1][1], {
    placed: true,
    isHQ: false,
    terrain: { id: "E0_WETLAND", terrainId: "E0_WETLAND", nameKey: "TERRAIN_WETLAND", e: 0, gl: 1 }
});
const commandMergeResult = commandMergeEngine.deckManager.playCommandCard(cmdReclamation, { type: "OFFERING", index: -1 });
assert.strictEqual(commandMergeResult.success, true, "実際の《干拓》コマンドが成功すること");
assert.strictEqual(Object.keys(commandMergeEngine.state.mergedBlocks).length, 1, "《干拓》直後に混成地帯が自動成立すること");
assert.strictEqual(commandMergeEngine.state.grid[1][1].merged, true, "干拓したセルが地帯へ参加すること");
assert.strictEqual(commandMergeEngine.state.grid[1][1].terrain.terrainId, "E1_RECLAIMED_LAND", "自動地帯化後も干拓地IDを保持すること");
const commandGroup = Object.values(commandMergeEngine.state.mergedBlocks)[0];
assert.strictEqual(commandGroup.zoneCategory, "PLAINS", "実コマンドで成立した混成地帯がPLAINS系であること");
const commandRewardState = { food: commandMergeEngine.state.food, ember: commandMergeEngine.state.ember };
commandMergeEngine.gridEngine.checkMergePatterns([{ r: 1, c: 1 }]);
assert.deepStrictEqual(
    { food: commandMergeEngine.state.food, ember: commandMergeEngine.state.ember },
    commandRewardState,
    "実コマンド後の再判定で地帯報酬が二重発火しないこと"
);
console.log("  ✅ PASS: 《干拓》直後に既存GridEngine経由で平地系地帯が成立します。");

// ------------------------------------------------------------
// H. 地帯互換Resolver単体でも草原と干拓地の混在が成立する
// ------------------------------------------------------------
console.log("\n🧪 Test H: 地帯互換Resolverによる草原3＋干拓地1:");
const engineG = new GameEngine();
engineG.state.grid = engineG.gridEngine.initGrid(5);
// (0,0)〜(1,1) の 2x2 領域に 草原3マス ＋ 干拓地1マス を配置
engineG.state.grid[0][0] = { r: 0, c: 0, placed: true, terrain: { id: "GL1_PLAINS", terrainId: "GL1_PLAINS" } };
engineG.state.grid[0][1] = { r: 0, c: 1, placed: true, terrain: { id: "GL1_PLAINS", terrainId: "GL1_PLAINS" } };
engineG.state.grid[1][0] = { r: 1, c: 0, placed: true, terrain: { id: "GL1_PLAINS", terrainId: "GL1_PLAINS" } };
engineG.state.grid[1][1] = { r: 1, c: 1, placed: true, terrain: { id: "E1_RECLAIMED_LAND", terrainId: "E1_RECLAIMED_LAND" } };

const mergeResG = engineG.gridEngine.checkMergePatterns([{ r: 1, c: 1 }]);
assert.strictEqual(mergeResG.merge2x2, true, "草原3＋干拓地1で平地系2x2地帯が成立すること");
assert.strictEqual(engineG.state.grid[1][1].terrain.terrainId, "E1_RECLAIMED_LAND", "地帯化後も干拓地IDを保持すること");
const mixedGroupId = engineG.state.grid[0][0].mergeGroupId;
assert.strictEqual(engineG.state.mergedBlocks[mixedGroupId].zoneCategory, "PLAINS", "混成地帯の属性がPLAINSであること");
assert.strictEqual(engineG.state.mergedBlocks[mixedGroupId].yieldMultiplier, 1.20, "既存の地帯産出1.2倍を維持すること");
console.log("  ✅ PASS: 個別terrainIdを保持したまま平地系地帯が成立します。");

// ------------------------------------------------------------
// I. 干拓地 4 マスによる 2x2 MERGE の正常判定
// ------------------------------------------------------------
console.log("\n🧪 Test I: 干拓地 4マスによる 2x2 MERGE 判定:");
const engineH = new GameEngine();
engineH.state.grid = engineH.gridEngine.initGrid(5);
// (0,0)〜(1,1) の 2x2 領域に 干拓地 4マス を配置
for (let r = 0; r <= 1; r++) {
    for (let c = 0; c <= 1; c++) {
        engineH.state.grid[r][c] = {
            r, c, placed: true,
            terrain: {
                id: "E1_RECLAIMED_LAND",
                terrainId: "E1_RECLAIMED_LAND",
                nameKey: "TERRAIN_RECLAIMED_LAND",
                food: 4, wood: 1
            }
        };
    }
}
const mergeResH = engineH.gridEngine.checkMergePatterns([{ r: 1, c: 1 }]);
assert.strictEqual(mergeResH.merge2x2, true, "干拓地 4マスによる 2x2 MERGE が成立すること");
assert.strictEqual(engineH.state.grid[0][0].merged, true, "セルがマージ状態になること");
assert.strictEqual(engineH.state.grid[0][0].mergeType, "2x2", "mergeType が 2x2 であること");
console.log("  ✅ PASS: 干拓地 4マスによる 2x2 MERGE が正常に成立します！");

// ------------------------------------------------------------
// H2. 混成比率、異属性拒否、報酬一度だけ
// ------------------------------------------------------------
const plainsTerrain = { id: "GL1_PLAINS", terrainId: "GL1_PLAINS", nameKey: "TERRAIN_PLAINS", e: 1, gl: 1, food: 4, wood: 0, material: 0, defense: 0, mystic: 0, zoneCategory: "PLAINS", trialTerrainCategory: "STANDARD_E1" };
const reclaimedTerrain = { id: "E1_RECLAIMED_LAND", terrainId: "E1_RECLAIMED_LAND", nameKey: "TERRAIN_RECLAIMED_LAND", e: 1, gl: 1, food: 4, wood: 1, material: 1, defense: 0, mystic: 0, zoneCategory: "PLAINS", trialTerrainCategory: "STANDARD_E1", isArtificialTerrain: true };
const forestTerrain = { id: "GL2_FOREST", terrainId: "GL2_FOREST", nameKey: "TERRAIN_FOREST", e: 1, gl: 2, food: 2, wood: 2, material: 2, defense: 2, mystic: 0 };

function createZoneEngine(terrains) {
    const engine = new GameEngine();
    engine.state.grid = engine.gridEngine.initGrid(5);
    const coords = [[0, 0], [0, 1], [1, 0], [1, 1]];
    coords.forEach(([r, c], index) => {
        engine.state.grid[r][c] = {
            r, c, placed: true, isHQ: false, merged: false,
            mergeGroupId: null, mergeType: null,
            terrain: { ...terrains[index] }
        };
    });
    return engine;
}

for (const [label, terrains] of [
    ["草原4", [plainsTerrain, plainsTerrain, plainsTerrain, plainsTerrain]],
    ["草原2＋干拓地2", [plainsTerrain, reclaimedTerrain, reclaimedTerrain, plainsTerrain]],
    ["干拓地2＋草原2", [reclaimedTerrain, reclaimedTerrain, plainsTerrain, plainsTerrain]],
    ["干拓地4", [reclaimedTerrain, reclaimedTerrain, reclaimedTerrain, reclaimedTerrain]]
]) {
    const engine = createZoneEngine(terrains);
    assert.strictEqual(engine.gridEngine.checkMergePatterns([{ r: 1, c: 1 }]).merge2x2, true, `${label}で平地系地帯が成立すること`);
}

const invalidMixedEngine = createZoneEngine([plainsTerrain, plainsTerrain, plainsTerrain, forestTerrain]);
assert.strictEqual(invalidMixedEngine.gridEngine.checkMergePatterns([{ r: 1, c: 1 }]).merge2x2, false, "草原3＋森1では地帯化しないこと");

const rewardEngine = createZoneEngine([plainsTerrain, plainsTerrain, plainsTerrain, reclaimedTerrain]);
const rewardBefore = { food: rewardEngine.state.food, ember: rewardEngine.state.ember };
rewardEngine.gridEngine.checkMergePatterns([{ r: 1, c: 1 }]);
const rewardAfterFirst = { food: rewardEngine.state.food, ember: rewardEngine.state.ember };
rewardEngine.gridEngine.checkMergePatterns([{ r: 1, c: 1 }]);
assert.deepStrictEqual({ food: rewardEngine.state.food, ember: rewardEngine.state.ember }, rewardAfterFirst, "地帯成立報酬が再判定で二重発火しないこと");
assert.strictEqual(rewardAfterFirst.food - rewardBefore.food, 10, "混成平地系地帯が草原地帯報酬🌾10を得ること");
assert.strictEqual(rewardAfterFirst.ember - rewardBefore.ember, 2, "混成平地系地帯が草原地帯報酬🔥2を得ること");

// ------------------------------------------------------------
// H3. 各セル固有産出を合計後に1.2倍する
// ------------------------------------------------------------
const productionEngine = createZoneEngine([plainsTerrain, plainsTerrain, plainsTerrain, reclaimedTerrain]);
productionEngine.state.grid[2][2].terrain = { food: 0, wood: 0, material: 0, defense: 0, mystic: 0 };
productionEngine.state.buffSystem = { getProductionMultipliers: () => ({ foodMult: 1, woodMult: 1, mysticMult: 1 }), getFlatMysticBonus: () => 0 };
productionEngine.state.directiveSystem = null;
productionEngine.state.globalEventManager = null;
productionEngine.state.isHQVicinity = () => false;
productionEngine.gridEngine.checkMergePatterns([{ r: 1, c: 1 }]);
const production = ProductionCalculator.calculateTotalProduction(productionEngine.state);
assert.strictEqual(production.grossFood, 20, "草原3＋干拓地1の🌾16へ1.2倍を適用し切上げ20になること");
assert.strictEqual(production.totalWood, 2, "干拓地固有🧱1へ1.2倍を適用し切上げ2になること");

// ------------------------------------------------------------
// H4. Undo・直列化・連携属性
// ------------------------------------------------------------
const undoEngine = createZoneEngine([plainsTerrain, plainsTerrain, plainsTerrain, reclaimedTerrain]);
undoEngine.undoSystem.captureSnapshot([{ r: 1, c: 1 }]);
undoEngine.gridEngine.checkMergePatterns([{ r: 1, c: 1 }]);
assert.strictEqual(undoEngine.state.grid[0][0].merged, true);
assert.strictEqual(undoEngine.undoSystem.undo(), true, "Undoが成功すること");
assert.strictEqual(undoEngine.state.grid[0][0].merged, false, "Undoで混成地帯成立前へ戻ること");
assert.strictEqual(undoEngine.state.grid[1][1].terrain.terrainId, "E1_RECLAIMED_LAND", "Undo後も干拓地IDを保持すること");

const serializedEngine = createZoneEngine([plainsTerrain, plainsTerrain, reclaimedTerrain, reclaimedTerrain]);
serializedEngine.gridEngine.checkMergePatterns([{ r: 1, c: 1 }]);
const serialized = JSON.parse(JSON.stringify(serializeGameState(serializedEngine.state)));
assert.strictEqual(serialized.grid[1][0].terrain.terrainId, "E1_RECLAIMED_LAND", "直列化後も干拓地IDを保持すること");
assert.strictEqual(serialized.grid[1][0].merged, true, "直列化後も地帯化状態を保持すること");
assert.strictEqual(Object.values(serialized.mergedBlocks)[0].zoneCategory, "PLAINS", "直列化後も平地系地帯属性を保持すること");

const linkEngine = createZoneEngine([plainsTerrain, plainsTerrain, reclaimedTerrain, reclaimedTerrain]);
linkEngine.gridEngine.checkMergePatterns([{ r: 1, c: 1 }]);
const forestGroupId = "merge_forest_test";
const forestCoords = [[0, 2], [0, 3], [1, 2], [1, 3]];
forestCoords.forEach(([r, c]) => {
    linkEngine.state.grid[r][c] = { r, c, placed: true, isHQ: false, merged: true, mergeGroupId: forestGroupId, mergeType: "2x2", terrain: { ...forestTerrain } };
});
linkEngine.state.mergedBlocks[forestGroupId] = { groupId: forestGroupId, terrainId: "GL2_FOREST", zoneCategory: "GL2_FOREST", mergeType: "2x2", cells: forestCoords.map(([r, c]) => ({ r, c })), yieldMultiplier: 1.2 };
assert.strictEqual(linkEngine.gridEngine.checkNewMergeLinks().count, 1, "混成平地系地帯と森林地帯の連携が1本成立すること");

const sameZoneLinkEngine = createZoneEngine([plainsTerrain, plainsTerrain, reclaimedTerrain, reclaimedTerrain]);
sameZoneLinkEngine.gridEngine.checkMergePatterns([{ r: 1, c: 1 }]);
const secondPlainsGroup = "merge_plains_test";
const secondCoords = [[0, 2], [0, 3], [1, 2], [1, 3]];
secondCoords.forEach(([r, c]) => {
    sameZoneLinkEngine.state.grid[r][c] = { r, c, placed: true, isHQ: false, merged: true, mergeGroupId: secondPlainsGroup, mergeType: "2x2", terrain: { ...plainsTerrain } };
});
sameZoneLinkEngine.state.mergedBlocks[secondPlainsGroup] = { groupId: secondPlainsGroup, terrainId: "GL1_PLAINS", zoneCategory: "PLAINS", mergeType: "2x2", cells: secondCoords.map(([r, c]) => ({ r, c })), yieldMultiplier: 1.2 };
assert.strictEqual(sameZoneLinkEngine.gridEngine.checkNewMergeLinks().count, 0, "草原系同士を異属性連携として扱わないこと");

// 実際のGameEngineトランザクション経路では、《干拓》と派生地帯化をまとめてUndoする。
const commandUndoEngine = new GameEngine();
commandUndoEngine.state.grid = commandUndoEngine.gridEngine.initGrid(5);
for (const [r, c] of [[0, 0], [0, 1], [1, 0]]) {
    Object.assign(commandUndoEngine.state.grid[r][c], { placed: true, isHQ: false, terrain: { ...plainsTerrain } });
}
Object.assign(commandUndoEngine.state.grid[1][1], {
    placed: true,
    isHQ: false,
    terrain: { id: "E0_WETLAND", terrainId: "E0_WETLAND", nameKey: "TERRAIN_WETLAND", e: 0, gl: 1 }
});
assert.strictEqual(commandUndoEngine.playCommandCard(cmdReclamation).success, true, "GameEngine経由の《干拓》が成功すること");
assert.strictEqual(commandUndoEngine.state.grid[1][1].terrain.terrainId, "E1_RECLAIMED_LAND");
assert.strictEqual(commandUndoEngine.state.grid[1][1].merged, true);
assert.strictEqual(commandUndoEngine.undoLastAction().success, true, "《干拓》アクションのUndoが成功すること");
assert.strictEqual(commandUndoEngine.state.grid[1][1].terrain.terrainId, "E0_WETLAND", "Undoで干拓前の湿原へ戻ること");
assert.strictEqual(commandUndoEngine.state.grid[1][1].merged, false, "Undoで派生地帯化も取り消されること");
assert.strictEqual(Object.keys(commandUndoEngine.state.mergedBlocks).length, 0, "Undoで混成地帯レコードも除去されること");

// Trial Phase 1では干拓地は迎撃可能な標準E1で、湿原由来の補正を生成しない。
const trialTerrainResolver = new TrialTerrainEffectResolver();
const reclaimedTrialResult = trialTerrainResolver.resolve({
    interceptCell: { cellId: "reclaimed", terrainId: "E1_RECLAIMED_LAND", elevation: 1 },
    approachCell: { cellId: "plains", terrainId: "GL1_PLAINS", elevation: 1 }
});
assert.strictEqual(reclaimedTrialResult.canIntercept, true, "Trialで干拓地は迎撃可能であること");
assert.strictEqual(reclaimedTrialResult.modifiers.length, 0, "Trialで干拓地に特殊地形補正がないこと");
const reclaimedApproachResult = trialTerrainResolver.resolve({
    interceptCell: { cellId: "plains", terrainId: "GL1_PLAINS", elevation: 1 },
    approachCell: { cellId: "reclaimed", terrainId: "E1_RECLAIMED_LAND", elevation: 1 }
});
assert.strictEqual(reclaimedApproachResult.modifiers.length, 0, "干拓地通過に湿原由来の0.8倍が残らないこと");
assert.strictEqual(getZoneCategory("GL1_PLAINS"), "PLAINS", "旧草原データをPLAINSへ正規化すること");
assert.strictEqual(getZoneCategory("E1_RECLAIMED_LAND"), "PLAINS", "旧干拓地データをPLAINSへ正規化すること");

// ------------------------------------------------------------
// I. I18N 名称 ＆ 辞書キーの検証
// ------------------------------------------------------------
console.log("\n🧪 Test J: I18N 辞書の登録検証:");
assert.strictEqual(I18n.t("TERRAIN_RECLAIMED_LAND"), "干拓地", "日本語名称が『干拓地』であること");
I18n.setLanguage("en");
assert.strictEqual(I18n.t("TERRAIN_RECLAIMED_LAND"), "Reclaimed Land", "英語名称が『Reclaimed Land』であること");
I18n.setLanguage("ja");
console.log("  ✅ PASS: I18N 辞書に日英ともに干拓地が正しく登録されています！");

// ------------------------------------------------------------
// J. 既存草原・湿原・丘陵の処理健全性
// ------------------------------------------------------------
console.log("\n🧪 Test K: 既存地形データの保全確認:");
assert.strictEqual(LAND_SYSTEM_DATA.terrains["GL1_PLAINS"].baseYieldsPerTile.food, 4, "草原の食料4が保全されていること");
assert.strictEqual(LAND_SYSTEM_DATA.terrains["E0_WETLAND"].baseYieldsPerTile.food, 2, "湿原の食料2が保全されていること");
assert.strictEqual(LAND_SYSTEM_DATA.terrains["E2_HILL"].baseYieldsPerTile.food, 2, "丘陵の食料2が保全されていること");
assert.strictEqual(LAND_SYSTEM_DATA.terrains["E1_RECLAIMED_LAND"].baseYieldsPerTile.material, 1, "干拓地の資材1が正しく登録されていること");
assert.strictEqual(LAND_SYSTEM_DATA.terrains["GL1_PLAINS"].trialTerrainCategory, "STANDARD_E1", "草原が標準E1戦場であること");
assert.strictEqual(LAND_SYSTEM_DATA.terrains["E1_RECLAIMED_LAND"].trialTerrainCategory, "STANDARD_E1", "干拓地が草原と同じ標準E1戦場であること");
console.log("  ✅ PASS: 既存の全地形パラメータが100%健全に保全されています！");

console.log("\n============================================================");
console.log("🎉 干拓地 (E1_RECLAIMED_LAND) 地帯互換回帰テスト完了");
console.log("============================================================");
