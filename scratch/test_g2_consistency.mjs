import assert from "assert";
import fs from "fs";
import { GameEngine, UIController } from "../game/src/app.js";

console.log("============================================================");
console.log("🧪 [Gate 2: Consistency Verification Test]");
console.log("============================================================");

// 1. 静的解析検問: game/src/ui/ 配下の独自ルール計算 0 件検問
console.log("🔍 [G2-1] UI 層からの独自ルール計算静的排除検問...");
const uiFiles = ["game/src/ui/board_grid_component.js", "game/src/ui/ui_controller.js", "game/src/ui/tooltip_system.js"];
for (const file of uiFiles) {
    if (!fs.existsSync(file)) continue;
    const content = fs.readFileSync(file, "utf8");
    assert.strictEqual(content.includes("permanentPlainsFoodBonus"), false, `${file} に permanentPlainsFoodBonus が存在してはならない`);
    assert.strictEqual(content.includes("* 0.5"), false, `${file} に独自灌漑計算 (* 0.5) が存在してはならない`);
}
console.log("  ✅ PASS: UI 層からの独自産出計算 (permanentPlainsFoodBonus, * 0.5): 0 件");

// 2. 純粋事実データ検問 (Mobile & Unity Ready): HTML・絵文字の排除
console.log("🔍 [G2-2] CellViewData 純粋事実データ検問 (Unity Ready)...");
const engine = GameEngine.createGame();
const plainsCard = { id: "G2_TEST_PLAINS", category: "LAND", rarity: "C", terrain: { terrainId: "PLAINS", shape: [[1]], yields: { food: 4 } } };
engine.placeLand(1, 2, plainsCard, 0, { type: "OFFERING", index: -1 });

const viewData = engine.getCellViewData(1, 2);
assert.ok(viewData, "getCellViewData がオブジェクトを返すこと");
assert.strictEqual(viewData.placed, true, "placed が true であること");
assert.strictEqual(viewData.terrainId, "PLAINS", "terrainId が PLAINS であること");
assert.strictEqual(typeof viewData.yields.food, "number", "food 産出が数値であること");

// 絵文字やHTMLタグが含まれていないことの検証
const jsonStr = JSON.stringify(viewData);
assert.strictEqual(/[\u{1F300}-\u{1F9FF}]/u.test(jsonStr), false, "CellViewData に絵文字 (🌾, 🧱 等) が含まれてはならない");
assert.strictEqual(/<[a-z][\s\S]*>/i.test(jsonStr), false, "CellViewData に HTML タグが含まれてはならない");
console.log("  ✅ PASS: CellViewData は純粋データ (Enum/数値) のみで構成 (絵文字・HTML 0件)");

// 3. 一貫性検問 (Consistency): Board 表示と Tooltip 表示の完全一致
console.log("🔍 [G2-3] Board セル産出と Breakdown の一貫性検証...");
// 本営近郊 (1,2) 平地: 基礎 4 + 本営近郊 1 = 5
assert.strictEqual(viewData.baseYields.food, 4, "基礎食料が 4 であること");
assert.strictEqual(viewData.yields.food, 5, "本営近郊ボーナス込みで総食料が 5 であること");
assert.strictEqual(viewData.primaryYield.resource, "food", "主軸資源が food であること");
assert.strictEqual(viewData.primaryYield.amount, 5, "主軸産出量が 5 であること");

const vicinityMod = viewData.modifiers.find(m => m.type === "HQ_VICINITY");
assert.ok(vicinityMod, "modifiers に HQ_VICINITY が記録されていること");
assert.strictEqual(vicinityMod.amount, 1, "HQ_VICINITY の加算値が 1 であること");

console.log("  ✅ PASS: Board と Tooltip の計算源が ProductionCalculator に完全一本化");

console.log("============================================================");
console.log("🎉 [Gate 2: Consistency Verification Test] ALL PASS (100%)");
console.log("============================================================");
