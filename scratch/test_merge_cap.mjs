import assert from 'node:assert';
import { GameEngine, GridEngine } from '../game/src/app.js';

console.log("🧪 [1x1ブロック連結4マス上限 ＆ 即時ボーナス検問テスト開始]");

const engine = new GameEngine();
engine.state.grid = engine.gridEngine.initGrid(5);

const plains = { id: "GL1_PLAINS", terrainId: "GL1_PLAINS", nameKey: "TERRAIN_PLAINS", food: 2, wood: 0, mystic: 0 };

// 1マス目配置 (1,2)
engine.state.hasPickedThisTurn = false;
engine.state.placeShape(1, 2, [[1]], plains);
assert.strictEqual(engine.state.grid[1][2].placed, true);

// 2マス目配置 (1,3) -> 1x2 連結ボーナス発生
engine.state.hasPickedThisTurn = false;
const foodBefore = engine.state.food;
const res = engine.state.placeShape(1, 3, [[1]], plains);
assert(engine.state.food > foodBefore, "1x2 連結ボーナスで食料が増加すること");
assert(engine.state.toastQueue && engine.state.toastQueue.length > 0, "toastQueue にポップアップエントリが追加されること");
console.log("  ✅ [PASS] 1x2 連結ボーナス＆ポップアップキュー正常");

// 3マス目配置 (1,4) -> 1x3 連結
engine.state.hasPickedThisTurn = false;
engine.state.placeShape(1, 4, [[1]], plains);
const gId = engine.state.grid[1][2].mergeGroupId;
assert.strictEqual(engine.state.mergedBlocks[gId].cells.length, 3, "グループ所属マス数が 3 であること");

// 4マス目配置 (0,4) -> 1x4 連結 (4マス目)
engine.state.hasPickedThisTurn = false;
engine.state.placeShape(0, 4, [[1]], plains);
assert.strictEqual(engine.state.mergedBlocks[gId].cells.length, 4, "グループ所属マス数が上限の 4 であること");
console.log("  ✅ [PASS] 4マスまで同一グループに正常連結");

// 5マス目配置 (0,3) -> 4マス上限のため既存グループには入らず単独ブロックとなる
engine.state.hasPickedThisTurn = false;
engine.state.placeShape(0, 3, [[1]], plains);
assert.notStrictEqual(engine.state.grid[0][3].mergeGroupId, gId, "5マス目は既存の4マスグループには連結されないこと");
console.log("  ✅ [PASS] 5マス目からの単独ブロック化・4マス上限遵守確認");

console.log("🎉 全検問合格！");
