import assert from "node:assert/strict";
import { GameEngine } from "../game/src/core/game_engine.js";
import { ProductionCalculator } from "../game/src/systems/production_calculator.js";
import {
    countPlacedWaterSources,
    getWaterSourceInfluenceType,
    hasAdjacentWaterSource,
    isWaterSourceInfluence,
    isWithinWaterSourceExclusionRange
} from "../game/src/core/lake_rules.js";

console.log("Current irrigation / legacy water-source compatibility tests");

const wetland = {
    id: "E0_WETLAND",
    terrainId: "E0_WETLAND",
    nameKey: "TERRAIN_WETLAND",
    gl: 1,
    e: 0,
    food: 2,
    wood: 0,
    defense: 1,
    mystic: 0
};
const plains = {
    id: "GL1_PLAINS",
    terrainId: "GL1_PLAINS",
    nameKey: "TERRAIN_PLAINS",
    gl: 1,
    e: 1,
    food: 4,
    wood: 0,
    defense: 0,
    mystic: 0
};

// Current-run placement must not create retired special water resources.
{
    const engine = GameEngine.createGame({ runSeed: 0xA0711001 });
    Object.assign(engine.state.grid[1][2], {
        placed: true,
        isHQ: false,
        terrain: plains
    });
    engine.state.grid[0][2].hasSocket = true;
    engine.state.hasPickedThisTurn = false;

    const preflight = engine.gridEngine.canPlaceShape(0, 2, [[1]], wetland);
    assert.equal(preflight.can, true, `wetland fixture must be placeable: ${preflight.reasons.join(",")}`);
    const placed = engine.gridEngine.placeShape(0, 2, [[1]], wetland);
    assert.equal(placed.success, true);
    assert.notEqual(engine.state.grid[0][2].socketResource?.id, "SOCKET_LAKE");
    assert.notEqual(engine.state.grid[0][2].socketResource?.id, "SOCKET_OASIS");
}

// Legacy lake/oasis data remains readable for old saves and influence semantics.
{
    const engine = GameEngine.createGame({ runSeed: 0xA0711002 });
    for (const row of engine.state.grid) {
        for (const cell of row) {
            if (!cell.isHQ) {
                cell.placed = false;
                cell.terrain = null;
                cell.socketResource = null;
                cell.hasSocket = false;
            }
        }
    }
    Object.assign(engine.state.grid[0][0], {
        placed: true,
        terrain: wetland,
        socketResource: { id: "SOCKET_LAKE", isLake: true, bonusFood: 2 }
    });
    Object.assign(engine.state.grid[1][1], {
        placed: true,
        terrain: plains
    });
    Object.assign(engine.state.grid[0][2], {
        placed: true,
        terrain: wetland,
        socketResource: { id: "SOCKET_OASIS", bonusFood: 1 }
    });

    assert.equal(countPlacedWaterSources(engine.state), 2);
    assert.equal(getWaterSourceInfluenceType(engine.state, 1, 1), "LAKE");
    assert.equal(isWaterSourceInfluence(engine.state, 1, 1), true);
    assert.equal(hasAdjacentWaterSource(engine.state, 1, 1), true);
    assert.equal(isWithinWaterSourceExclusionRange(engine.state, 1, 1), true);

    const breakdown = ProductionCalculator.calculateCellYieldBreakdown(engine.state, 1, 1);
    assert.equal(Array.isArray(breakdown.modifiers), true, "production breakdown remains readable with legacy water-source data");
    assert.equal(
        breakdown.modifiers.some(mod => mod.type === "LAKE_IRRIGATION"),
        false,
        "retired lake irrigation production modifier must not be reintroduced by legacy save data"
    );
}

// Wetland adjacency remains current gameplay behavior and does not require a legacy spawn roll.
{
    const engine = GameEngine.createGame({ runSeed: 0xA0711003 });
    Object.assign(engine.state.grid[0][1], {
        placed: true,
        isHQ: false,
        terrain: wetland
    });
    Object.assign(engine.state.grid[1][1], {
        placed: true,
        isHQ: false,
        terrain: plains
    });

    const orthogonal = engine.gridEngine.canPlaceShape(0, 0, [[1]], wetland);
    assert.equal(orthogonal.can, false);
    assert.ok(orthogonal.reasons.includes("WETLAND_TOO_CLOSE"));

    const diagonal = engine.gridEngine.canPlaceShape(1, 0, [[1]], wetland);
    assert.equal(diagonal.can, true, `diagonal wetland should remain legal outside HQ vicinity: ${diagonal.reasons.join(",")}`);
}

console.log("Current irrigation / legacy water-source compatibility: PASS");