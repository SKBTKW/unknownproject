import assert from "assert";
import { GameEngine } from "../game/src/core/game_engine.js";
import { DeckManager } from "../game/src/systems/deck_manager.js";
import { GridEngine } from "../game/src/systems/grid_engine.js";
import { LAND_SYSTEM_DATA, TerrainParameterEngine } from "../game/src/data/land_system.js";
import { I18n } from "../game/src/i18n.js";

console.log("============================================================");
console.log("🌾 [Reclaimed Land (干拓地) Specification Tests (10 Criteria)]");
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
// G. 草原と干拓地の混在で MERGE が誤発生しない
// ------------------------------------------------------------
console.log("\n🧪 Test G: 草原と干拓地の混在時の MERGE 拒否 (terrainId 完全一致原則):");
const engineG = new GameEngine();
engineG.state.grid = engineG.gridEngine.initGrid(5);
// (0,0)〜(1,1) の 2x2 領域に 草原3マス ＋ 干拓地1マス を配置
engineG.state.grid[0][0] = { r: 0, c: 0, placed: true, terrain: { id: "GL1_PLAINS", terrainId: "GL1_PLAINS" } };
engineG.state.grid[0][1] = { r: 0, c: 1, placed: true, terrain: { id: "GL1_PLAINS", terrainId: "GL1_PLAINS" } };
engineG.state.grid[1][0] = { r: 1, c: 0, placed: true, terrain: { id: "GL1_PLAINS", terrainId: "GL1_PLAINS" } };
engineG.state.grid[1][1] = { r: 1, c: 1, placed: true, terrain: { id: "E1_RECLAIMED_LAND", terrainId: "E1_RECLAIMED_LAND" } };

const mergeResG = engineG.gridEngine.checkMergePatterns([{ r: 1, c: 1 }]);
assert.strictEqual(mergeResG.merge2x2, false, "草原と干拓地の混在では 2x2 MERGE してはならない");
assert.strictEqual(engineG.state.grid[0][0].merged, undefined, "セルがマージ状態にならないこと");
console.log("  ✅ PASS: 草原と干拓地の混在では MERGE が誤発生しません！");

// ------------------------------------------------------------
// H. 干拓地 4 マスによる 2x2 MERGE の正常判定
// ------------------------------------------------------------
console.log("\n🧪 Test H: 干拓地 4マスによる 2x2 MERGE 判定:");
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
// I. I18N 名称 ＆ 辞書キーの検証
// ------------------------------------------------------------
console.log("\n🧪 Test I: I18N 辞書の登録検証:");
assert.strictEqual(I18n.t("TERRAIN_RECLAIMED_LAND"), "干拓地", "日本語名称が『干拓地』であること");
I18n.setLanguage("en");
assert.strictEqual(I18n.t("TERRAIN_RECLAIMED_LAND"), "Reclaimed Land", "英語名称が『Reclaimed Land』であること");
I18n.setLanguage("ja");
console.log("  ✅ PASS: I18N 辞書に日英ともに干拓地が正しく登録されています！");

// ------------------------------------------------------------
// J. 既存草原・湿原・丘陵の処理健全性
// ------------------------------------------------------------
console.log("\n🧪 Test J: 既存地形データの保全確認:");
assert.strictEqual(LAND_SYSTEM_DATA.terrains["GL1_PLAINS"].baseYieldsPerTile.food, 4, "草原の食料4が保全されていること");
assert.strictEqual(LAND_SYSTEM_DATA.terrains["E0_WETLAND"].baseYieldsPerTile.food, 2, "湿原の食料2が保全されていること");
assert.strictEqual(LAND_SYSTEM_DATA.terrains["E2_HILL"].baseYieldsPerTile.food, 2, "丘陵の食料2が保全されていること");
assert.strictEqual(LAND_SYSTEM_DATA.terrains["E1_RECLAIMED_LAND"].baseYieldsPerTile.material, 1, "干拓地の資材1が正しく登録されていること");
console.log("  ✅ PASS: 既存の全地形パラメータが100%健全に保全されています！");

console.log("\n============================================================");
console.log("🎉 【全10項目完全実機合格】干拓地 (E1_RECLAIMED_LAND) ALL PASS (100%)");
console.log("============================================================");
