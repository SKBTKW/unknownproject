import assert from "assert";
import { GameEngine } from "../game/src/core/game_engine.js";
import { AreaInfluenceVisualService } from "../game/src/ui/area_influence_visual_service.js";
import { countPlacedLakes, getLakeSpawnRateMultiplier } from "../game/src/core/lake_rules.js";

console.log("============================================================");
console.log("🌊 [Area Influence & Lake Diminishing Spawn Rate Tests]");
console.log("============================================================");

// ------------------------------------------------------------
// 1. 湖発見確率逓減ロジック & オアシス除外検証
// ------------------------------------------------------------
console.log("\n🧪 1. 湖発見確率逓減 multiplier 検証:");
assert.strictEqual(getLakeSpawnRateMultiplier(0), 1.00, "湖0個時: 1.00");
assert.strictEqual(getLakeSpawnRateMultiplier(1), 0.55, "湖1個時: 0.55");
assert.strictEqual(getLakeSpawnRateMultiplier(2), 0.25, "湖2個時: 0.25");
assert.strictEqual(getLakeSpawnRateMultiplier(3), 0.10, "湖3個時: 0.10");
assert.strictEqual(getLakeSpawnRateMultiplier(5), 0.10, "湖5個時: 0.10 (下限維持)");
console.log("  ✅ PASS: 湖数に応じた逓減倍率が正確に計算されます！");

console.log("\n🏝️ 2. 盤面上の湖カウント & オアシス除外の検証 (Single Source of Truth):");
const mockState = {
    grid: [
        [
            { placed: true, socketResource: { id: "SOCKET_LAKE" } },
            { placed: true, socketResource: { id: "SOCKET_OASIS" } } // オアシス
        ],
        [
            { placed: true, socketResource: { id: "SOCKET_LAKE" } },
            { placed: false, socketResource: { id: "SOCKET_LAKE" } } // 未配置
        ]
    ]
};
const lakeCount = countPlacedLakes(mockState);
assert.strictEqual(lakeCount, 2, "配置済み SOCKET_LAKE のみがカウントされ、OASISや未配置は除外されること");
console.log("  ✅ PASS: オアシスは湖カウントから除外され、湖のみがカウントされます！");

// ------------------------------------------------------------
// 3. AreaInfluenceVisualService クラス & オーバーレイ生成検証
// ------------------------------------------------------------
console.log("\n🎨 3. AreaInfluenceVisualService のクラス・SVG生成検証:");

// 単独湖影響圏
const lakeClasses = AreaInfluenceVisualService.getInfluenceClasses({ isLakeVic: true, isHQVic: false });
assert(lakeClasses.includes("influence-lake"), "influence-lake クラスが含まれること");
assert(!lakeClasses.includes("influence-hq-vicinity"), "influence-hq-vicinity は含まれないこと");

const lakeOverlay = AreaInfluenceVisualService.createInfluenceOverlayHtml({ isLakeVic: true, isHQVic: false });
assert(lakeOverlay.includes("influence-svg-lake"), "湖波紋 SVG が含まれること");
assert(!lakeOverlay.includes("influence-svg-hq"), "近郊 SVG は含まれないこと");
console.log("  ✅ PASS: 湖単独の影響圏クラスおよび波紋 SVG が正常生成されます！");

// 単独本営近郊
const hqClasses = AreaInfluenceVisualService.getInfluenceClasses({ isLakeVic: false, isHQVic: true });
assert(!hqClasses.includes("influence-lake"), "influence-lake は含まれないこと");
assert(hqClasses.includes("influence-hq-vicinity"), "influence-hq-vicinity が含まれること");

const hqOverlay = AreaInfluenceVisualService.createInfluenceOverlayHtml({ isLakeVic: false, isHQVic: true });
assert(!hqOverlay.includes("influence-svg-lake"), "湖波紋 SVG は含まれないこと");
assert(hqOverlay.includes("influence-svg-hq"), "近郊 L字マーカー SVG が含まれること");
console.log("  ✅ PASS: 本営近郊単独のクラスおよび外周四隅 L字マーカー SVG が正常生成されます！");

// 重複時 (湖 + 本営近郊)
const dualClasses = AreaInfluenceVisualService.getInfluenceClasses({ isLakeVic: true, isHQVic: true });
assert(dualClasses.includes("influence-lake") && dualClasses.includes("influence-hq-vicinity"), "両クラスが共存すること");

const dualOverlay = AreaInfluenceVisualService.createInfluenceOverlayHtml({ isLakeVic: true, isHQVic: true });
assert(dualOverlay.includes("influence-svg-lake") && dualOverlay.includes("influence-svg-hq"), "湖波紋と近郊L字マーカーの両方が1つのオーバーレイ内に共存すること");
console.log("  ✅ PASS: 湖 + 近郊の重複時に両オーバーレイが物理的に分離して共存します！");

// 影響なしマス
const noneClasses = AreaInfluenceVisualService.getInfluenceClasses({ isLakeVic: false, isHQVic: false });
assert.strictEqual(noneClasses.length, 0, "影響なしマスにはクラスが付与されないこと");
const noneOverlay = AreaInfluenceVisualService.createInfluenceOverlayHtml({ isLakeVic: false, isHQVic: false });
assert.strictEqual(noneOverlay, "", "影響なしマスにはオーバーレイ HTML が生成されないこと");
console.log("  ✅ PASS: 影響なしマスはオーバーレイ完全ゼロ (空文字) で無駄な DOM を生成しません！");

// ------------------------------------------------------------
// 4. Undo snapshot と cachedSocketSeeds の整合性検証
// ------------------------------------------------------------
console.log("\n↩️ 4. Undo snapshot と cachedSocketSeeds の整合性検証:");
const engine = new GameEngine();
engine.gridEngine.initGrid(5);

// (0,1) のセルに cachedSocketSeeds を仕込む
engine.state.grid[0][1].cachedSocketSeeds = { "test_seed": { id: "SOCKET_LAKE" } };
engine.undoSystem.captureSnapshot([{ r: 0, c: 1 }]);

// スナップショットに保持されているか確認
assert(engine.undoSystem.snapshot.grid[0][1].cachedSocketSeeds["test_seed"], "snapshot に cachedSocketSeeds が複製・保存されていること");
assert.strictEqual(engine.undoSystem.snapshot.grid[0][1].cachedSocketSeeds["test_seed"].id, "SOCKET_LAKE", "確定 socket オブジェクトが保持されること");
console.log("  ✅ PASS: Undo snapshot は cachedSocketSeeds を完全に保全します！");

console.log("\n============================================================");
console.log("🎉 【完全実機合格】Area Influence 表示 ＆ 湖発見確率逓減システム ALL PASS (100%)");
console.log("============================================================");
