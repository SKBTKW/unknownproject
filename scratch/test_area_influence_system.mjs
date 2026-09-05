import assert from "assert";
import { GameEngine } from "../game/src/core/game_engine.js";
import { serializeGameState } from "../game/src/core/state_serializer.js";
import { ProductionCalculator } from "../game/src/systems/production_calculator.js";
import { AreaInfluenceVisualService } from "../game/src/ui/area_influence_visual_service.js";
import {
    canSpawnWaterSourceAt,
    countPlacedWaterSources,
    getWaterSourceSpawnChance,
    getWaterSourceSpawnRateMultiplier,
    hasAdjacentWaterSource,
    isWithinWaterSourceExclusionRange
} from "../game/src/core/lake_rules.js";

console.log("============================================================");
console.log("🌊 [Water Source Rules & Area Influence Tests]");
console.log("============================================================");

const makeGrid = (size = 7) => Array.from({ length: size }, (_, r) =>
    Array.from({ length: size }, (_, c) => ({
        r, c, placed: false, isHQ: false, terrain: null, hasSocket: false,
        socketResource: null, cachedSocketSeeds: {}, mergeGroupId: null,
        mergeType: null, merged: false, placementGroupId: null
    }))
);

const addSource = (state, r, c, id = "SOCKET_LAKE") => {
    state.grid[r][c].placed = true;
    state.grid[r][c].terrain = { id: "GL1_PLAINS", terrainId: "GL1_PLAINS", food: 4 };
    state.grid[r][c].socketResource = { id, bonusFood: id === "SOCKET_LAKE" ? 2 : 1 };
};

const wetland = {
    id: "E0_WETLAND", terrainId: "E0_WETLAND", nameKey: "TERRAIN_WETLAND",
    gl: 1, e: 0, food: 2, wood: 0, defense: 1, mystic: 0
};
const plains = {
    id: "GL1_PLAINS", terrainId: "GL1_PLAINS", nameKey: "TERRAIN_PLAINS",
    gl: 1, e: 1, food: 4, wood: 0, defense: 0, mystic: 0
};

console.log("\n🧪 1. 水源数と発見率逓減:");
assert.strictEqual(getWaterSourceSpawnRateMultiplier(0), 1.00);
assert.strictEqual(getWaterSourceSpawnRateMultiplier(1), 0.70);
assert.strictEqual(getWaterSourceSpawnRateMultiplier(2), 0.40);
assert.strictEqual(getWaterSourceSpawnRateMultiplier(3), 0.20);
assert.strictEqual(getWaterSourceSpawnRateMultiplier(8), 0.20);

const rateState = { grid: makeGrid() };
assert.strictEqual(getWaterSourceSpawnChance(rateState, 3, 3, 0.20), 0.20, "通常湿原は20%");
assert.strictEqual(getWaterSourceSpawnChance(rateState, 3, 3, 0.60), 0.60, "ソケット湿原は60%");
addSource(rateState, 0, 0, "SOCKET_OASIS");
assert.strictEqual(countPlacedWaterSources(rateState), 1, "オアシスも水源数へ含める");
assert(Math.abs(getWaterSourceSpawnChance(rateState, 3, 3, 0.20) - 0.14) < Number.EPSILON);
addSource(rateState, 0, 6, "SOCKET_LAKE");
assert.strictEqual(getWaterSourceSpawnChance(rateState, 3, 3, 0.60), 0.24);
addSource(rateState, 6, 0, "SOCKET_OASIS");
assert.strictEqual(getWaterSourceSpawnChance(rateState, 3, 3, 0.25), 0.05, "オアシス基礎25%にも20%倍率");
console.log("  ✅ 湖とオアシスを合算し、1.00 / 0.70 / 0.40 / 0.20 を適用");

console.log("\n📏 2. マンハッタン距離2の水源近接禁止:");
const distanceState = { grid: makeGrid() };
addSource(distanceState, 1, 1);
assert.strictEqual(isWithinWaterSourceExclusionRange(distanceState, 2, 2), true);
assert.strictEqual(canSpawnWaterSourceAt(distanceState, 2, 2), false);
assert.strictEqual(getWaterSourceSpawnChance(distanceState, 2, 2, 0.60), 0);
assert.strictEqual(isWithinWaterSourceExclusionRange(distanceState, 3, 2), false);
assert.strictEqual(canSpawnWaterSourceAt(distanceState, 3, 2), true);
console.log("  ✅ 距離2は禁止、距離3は発見可能");

console.log("\n🎲 3. 配置実経路の水源発見:");
const normalWetlandEngine = new GameEngine();
normalWetlandEngine.state.grid[1][2].hasSocket = false;
normalWetlandEngine.state.rng = () => 0.19;
assert.strictEqual(normalWetlandEngine.gridEngine.placeShape(1, 2, [[1]], wetland).success, true);
assert.strictEqual(normalWetlandEngine.state.grid[1][2].socketResource.id, "SOCKET_LAKE", "通常湿原20%の実経路");

const socketWetlandEngine = new GameEngine();
socketWetlandEngine.state.grid[1][2].hasSocket = true;
socketWetlandEngine.state.rng = () => 0.59;
assert.strictEqual(socketWetlandEngine.gridEngine.placeShape(1, 2, [[1]], wetland).success, true);
assert.strictEqual(socketWetlandEngine.state.grid[1][2].socketResource.id, "SOCKET_LAKE", "ソケット湿原60%の実経路");

const oasisEngine = new GameEngine();
addSource(oasisEngine.state, 4, 2, "SOCKET_LAKE");
oasisEngine.state.grid[1][2].hasSocket = true;
oasisEngine.state.rng = () => 0;
const desert = { id: "GL0_DESERT", terrainId: "GL0_DESERT", nameKey: "TERRAIN_DESERT", gl: 0, e: 1 };
assert.strictEqual(oasisEngine.gridEngine.placeShape(1, 2, [[1]], desert).success, true);
assert.strictEqual(oasisEngine.state.grid[1][2].socketResource.id, "SOCKET_OASIS", "距離3のオアシス実経路");

const blockedOasisEngine = new GameEngine();
addSource(blockedOasisEngine.state, 0, 1, "SOCKET_LAKE");
blockedOasisEngine.state.grid[1][2].hasSocket = true;
blockedOasisEngine.state.rng = () => 0;
assert.strictEqual(blockedOasisEngine.gridEngine.placeShape(1, 2, [[1]], desert).success, true);
assert.notStrictEqual(blockedOasisEngine.state.grid[1][2].socketResource.id, "SOCKET_OASIS", "距離2ではオアシスを生成しない");
console.log("  ✅ 通常湿原20%、ソケット湿原60%、オアシス25%と距離制約を実配置で確認");

console.log("\n🌿 4. 湿原の直辺隣接禁止・水源近傍での湖発見禁止・地帯化禁止:");
const wetlandAdjacencyEngine = new GameEngine();
Object.assign(wetlandAdjacencyEngine.state.grid[0][0], {
    placed: true, terrain: wetland, isHQ: false
});
Object.assign(wetlandAdjacencyEngine.state.grid[1][2], {
    placed: true, terrain: plains, isHQ: false
});
const orthogonalWetland = wetlandAdjacencyEngine.gridEngine.canPlaceShape(0, 1, [[1]], wetland);
assert.strictEqual(orthogonalWetland.can, false, "通常湿原同士の直辺隣接は禁止");
assert.ok(orthogonalWetland.reasons.includes("WETLAND_TOO_CLOSE"));

const diagonalWetland = wetlandAdjacencyEngine.gridEngine.canPlaceShape(1, 1, [[1]], wetland);
assert.strictEqual(diagonalWetland.can, true, "別領土へ接続できれば通常湿原の斜め配置は可能");

const axialDistanceTwoWetland = wetlandAdjacencyEngine.gridEngine.canPlaceShape(0, 2, [[1]], wetland);
assert.strictEqual(axialDistanceTwoWetland.can, true, "通常湿原から直線距離2の配置は可能");

const lakeAdjacentWetlandEngine = new GameEngine();
Object.assign(lakeAdjacentWetlandEngine.state.grid[0][0], {
    placed: true,
    terrain: wetland,
    socketResource: { id: "SOCKET_LAKE", bonusFood: 2 },
    isHQ: false
});
lakeAdjacentWetlandEngine.state.rng = () => 0;
const lakeAdjacentWetland = lakeAdjacentWetlandEngine.gridEngine.canPlaceShape(0, 1, [[1]], wetland);
assert.strictEqual(lakeAdjacentWetland.can, true, "湖を持つ湿原セルには新しい湿原を直辺隣接できる");
assert.strictEqual(lakeAdjacentWetlandEngine.gridEngine.placeShape(0, 1, [[1]], wetland).success, true);
assert.notStrictEqual(
    lakeAdjacentWetlandEngine.state.grid[0][1].socketResource?.id,
    "SOCKET_LAKE",
    "配置は成功しても既存湖から距離2以内では新しい湖を発見しない"
);

const distantDiscoveryEngine = new GameEngine();
addSource(distantDiscoveryEngine.state, 0, 0, "SOCKET_LAKE");
distantDiscoveryEngine.state.rng = () => 0;
assert.strictEqual(distantDiscoveryEngine.gridEngine.placeShape(2, 1, [[1]], wetland).success, true);
assert.strictEqual(
    distantDiscoveryEngine.state.grid[2][1].socketResource.id,
    "SOCKET_LAKE",
    "既存湖からマンハッタン距離3の湿原は湖を発見できる"
);

const plainsSocketNearLakeEngine = new GameEngine();
addSource(plainsSocketNearLakeEngine.state, 0, 0, "SOCKET_LAKE");
plainsSocketNearLakeEngine.state.grid[0][1].hasSocket = true;
plainsSocketNearLakeEngine.state.rng = () => 0;
assert.strictEqual(plainsSocketNearLakeEngine.gridEngine.placeShape(0, 1, [[1]], plains).success, true);
assert.notStrictEqual(
    plainsSocketNearLakeEngine.state.grid[0][1].socketResource.id,
    "SOCKET_LAKE",
    "既存湖から距離2以内の資源ソケット草原では湖を発見しない"
);

const plainsSocketDistanceThreeEngine = new GameEngine();
addSource(plainsSocketDistanceThreeEngine.state, 0, 0, "SOCKET_LAKE");
plainsSocketDistanceThreeEngine.state.grid[2][1].hasSocket = true;
plainsSocketDistanceThreeEngine.state.rng = () => 0;
assert.strictEqual(plainsSocketDistanceThreeEngine.gridEngine.placeShape(2, 1, [[1]], plains).success, true);
assert.strictEqual(
    plainsSocketDistanceThreeEngine.state.grid[2][1].socketResource.id,
    "SOCKET_LAKE",
    "既存湖からマンハッタン距離3の資源ソケット草原は湖を発見できる"
);

const multiCellWetlandEngine = new GameEngine();
const multiCellWetland = multiCellWetlandEngine.gridEngine.canPlaceShape(1, 1, [[1, 1]], wetland);
assert.strictEqual(multiCellWetland.can, false);
assert.ok(multiCellWetland.reasons.includes("WETLAND_TOO_CLOSE"));

const mergeEngine = new GameEngine();
const mergeState = mergeEngine.state;
for (const [r, c] of [[0, 0], [0, 1], [1, 0], [1, 1]]) {
    Object.assign(mergeState.grid[r][c], { placed: true, terrain: wetland, isHQ: false });
}
const before = { food: mergeState.food, wood: mergeState.wood, mystic: mergeState.mystic, ember: mergeState.ember };
const wetlandMerge = mergeEngine.gridEngine.checkMergePatterns([{ r: 1, c: 1 }]);
assert.strictEqual(wetlandMerge.merge2x2, false);
for (const [r, c] of [[0, 0], [0, 1], [1, 0], [1, 1]]) {
    assert.strictEqual(mergeState.grid[r][c].mergeGroupId, null);
}
assert.deepStrictEqual(
    { food: mergeState.food, wood: mergeState.wood, mystic: mergeState.mystic, ember: mergeState.ember },
    before,
    "湿原2x2は即時報酬なし"
);
assert.strictEqual(ProductionCalculator.getResourceBreakdown(mergeState).food.tiles, 8, "湿原4マスは1.2倍にならない");

const connectionEngine = new GameEngine();
Object.assign(connectionEngine.state.grid[1][1], { placed: true, terrain: wetland, placementGroupId: "a" });
Object.assign(connectionEngine.state.grid[1][2], { placed: true, terrain: wetland, placementGroupId: "b" });
assert.deepStrictEqual(connectionEngine.gridEngine.checkConnectionBonus(1, 2, wetland), { connected: false });
assert.strictEqual(connectionEngine.state.grid[1][1].mergeGroupId, null);
assert.strictEqual(connectionEngine.state.grid[1][2].mergeGroupId, null);

const waterConnectionEngine = new GameEngine();
Object.assign(waterConnectionEngine.state.grid[1][1], {
    placed: true, terrain: plains, placementGroupId: "source",
    socketResource: { id: "SOCKET_OASIS" }
});
Object.assign(waterConnectionEngine.state.grid[1][2], { placed: true, terrain: plains, placementGroupId: "new" });
assert.strictEqual(!!waterConnectionEngine.gridEngine.checkConnectionBonus(1, 2, plains)?.connected, false);
assert.strictEqual(waterConnectionEngine.state.grid[1][1].mergeGroupId, null);
assert.strictEqual(waterConnectionEngine.state.grid[1][2].mergeGroupId, null);

const waterMergeEngine = new GameEngine();
for (const [r, c] of [[0, 0], [0, 1], [1, 0], [1, 1]]) {
    Object.assign(waterMergeEngine.state.grid[r][c], { placed: true, terrain: plains, isHQ: false });
}
waterMergeEngine.state.grid[0][0].socketResource = { id: "SOCKET_LAKE" };
assert.strictEqual(waterMergeEngine.gridEngine.checkMergePatterns([{ r: 1, c: 1 }]).merge2x2, false);
assert.strictEqual(Object.keys(waterMergeEngine.state.mergedBlocks).length, 0, "水源セルを含む2x2地帯は生成しない");
console.log("  ✅ 通常湿原は直辺隣接のみ禁止。水源距離2以内は配置可能だが湖発見0%、距離3から抽選");

console.log("\n🌊 5. 水源効果の非重複:");
const irrigationEngine = new GameEngine();
const irrigationState = irrigationEngine.state;
for (const row of irrigationState.grid) {
    for (const cell of row) {
        if (!cell.isHQ) Object.assign(cell, { placed: false, terrain: null, socketResource: null });
    }
}
Object.assign(irrigationState.grid[1][1], { placed: true, terrain: plains });
addSource(irrigationState, 0, 0, "SOCKET_LAKE");
addSource(irrigationState, 0, 2, "SOCKET_OASIS");
assert.strictEqual(hasAdjacentWaterSource(irrigationState, 1, 1), true);
const breakdown = ProductionCalculator.calculateCellYieldBreakdown(irrigationState, 1, 1);
const waterModifiers = breakdown.modifiers.filter(mod => mod.type === "LAKE_IRRIGATION");
assert.strictEqual(waterModifiers.length, 1);
assert.strictEqual(waterModifiers[0].amount, 2, "食料4の+50%を1回だけ加算");
console.log("  ✅ 複数範囲が重なっても同一セルの+50%は1回のみ");

console.log("\n↩️ 6. 水源抽選失敗のUndo固定化:");
const undoEngine = new GameEngine();
const target = undoEngine.state.grid[1][2];
target.hasSocket = false;
undoEngine.state.rng = () => 0.99;
undoEngine.undoSystem.captureSnapshot([{ r: 1, c: 2 }]);
const firstPlacement = undoEngine.gridEngine.placeShape(1, 2, [[1]], wetland);
assert.strictEqual(firstPlacement.success, true);
assert.strictEqual(target.socketResource, null);
assert(Object.prototype.hasOwnProperty.call(target.cachedSocketSeeds, "1_2"));
assert.strictEqual(target.cachedSocketSeeds["1_2"], null, "非発見結果もキャッシュする");
assert.strictEqual(undoEngine.undoSystem.undo(), true);
undoEngine.state.rng = () => 0;
const repeatedPlacement = undoEngine.gridEngine.placeShape(1, 2, [[1]], wetland);
assert.strictEqual(repeatedPlacement.success, true);
assert.strictEqual(undoEngine.state.grid[1][2].socketResource, null, "Undo後も再抽選しない");
console.log("  ✅ 失敗結果を含めて同じセルの水源抽選結果を保持");

console.log("\n💾 7. 直列化後の水源状態:");
const serialized = serializeGameState(irrigationState);
const roundTrip = JSON.parse(JSON.stringify(serialized));
assert.strictEqual(countPlacedWaterSources(roundTrip), 2);
assert.strictEqual(roundTrip.grid[0][0].socketResource.id, "SOCKET_LAKE");
assert.strictEqual(roundTrip.grid[0][2].socketResource.id, "SOCKET_OASIS");
assert.strictEqual(getWaterSourceSpawnRateMultiplier(countPlacedWaterSources(roundTrip)), 0.40);
console.log("  ✅ JSON往復後も水源数・位置・逓減段階を復元可能");

const expansionEngine = new GameEngine();
addSource(expansionEngine.state, 0, 0, "SOCKET_LAKE");
addSource(expansionEngine.state, 4, 4, "SOCKET_OASIS");
expansionEngine.gridEngine.expandGrid(7);
expansionEngine.gridEngine.expandGrid(9);
assert.strictEqual(countPlacedWaterSources(expansionEngine.state), 2, "盤面拡張後も水源状態を維持");

console.log("\n🎨 8. AreaInfluenceVisualService:");
const lakeClasses = AreaInfluenceVisualService.getInfluenceClasses({ isLakeVic: true, isHQVic: false });
assert(lakeClasses.includes("influence-lake"));
const dualOverlay = AreaInfluenceVisualService.createInfluenceOverlayHtml({ isLakeVic: true, isHQVic: true });
assert(dualOverlay.includes("influence-svg-lake") && dualOverlay.includes("influence-svg-hq"));
const noneOverlay = AreaInfluenceVisualService.createInfluenceOverlayHtml({ isLakeVic: false, isHQVic: false });
assert.strictEqual(noneOverlay, "");
console.log("  ✅ 水源・本営近郊オーバーレイの既存表示を維持");

console.log("\n============================================================");
console.log("✅ Water source rules and area influence regression tests passed");
console.log("============================================================");
