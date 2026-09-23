import assert from "node:assert/strict";
import { GameFactHub, GAME_FACT_TYPES } from "../game/src/core/game_fact.js";
import { BoardDamageService, BOARD_DAMAGE_TARGETS } from "../game/src/core/board_damage_service.js";
import { TrialBoardDamagePolicy } from "../game/src/trial/systems/trial_board_damage_policy.js";
import { TrialBoardDamageBridge } from "../game/src/trial/systems/trial_board_damage_bridge.js";

function makeState() {
    return {
        grid: [[
            {
                r: 0,
                c: 0,
                placed: true,
                isHQ: false,
                terrain: { terrainId: "GL1_PLAINS" },
                specialBlock: { type: "WATCHTOWER", definitionId: "WATCHTOWER", state: "ACTIVE" }
            },
            {
                r: 0,
                c: 1,
                placed: true,
                isHQ: false,
                terrain: { terrainId: "E2_HILL" }
            },
            {
                r: 0,
                c: 2,
                placed: true,
                isHQ: false,
                terrain: { terrainId: "GL2_FOREST" }
            }
        ]]
    };
}

const policy = new TrialBoardDamagePolicy();
assert.deepEqual(
    policy.resolve({ battle: { outcome: "REPEL" }, cell: { specialBlock: {} } }),
    { shouldRecord: false, targets: [] }
);
assert.deepEqual(
    policy.resolve({ battle: { outcome: "EXACT" }, cell: {} }),
    { shouldRecord: true, targets: [BOARD_DAMAGE_TARGETS.LAND], reason: "ENEMY_NOT_REPELLED" }
);
assert.deepEqual(
    policy.resolve({ battle: { outcome: "BREAKTHROUGH" }, cell: { specialBlock: {} } }),
    {
        shouldRecord: true,
        targets: [BOARD_DAMAGE_TARGETS.LAND, BOARD_DAMAGE_TARGETS.SPECIAL_BLOCK],
        reason: "ENEMY_NOT_REPELLED"
    }
);

const state = makeState();
const hub = new GameFactHub();
const damageService = new BoardDamageService({ state });
const bridge = new TrialBoardDamageBridge({
    gameFactHub: hub,
    state,
    boardDamageService: damageService,
    policy
});

hub.emit(GAME_FACT_TYPES.TRIAL_BATTLE_RESOLVED, {
    scenarioId: "TRIAL_1",
    trialIndex: 1,
    battleIndex: 0,
    routeId: "R_REPEL",
    interceptCell: { r: 0, c: 2 },
    outcome: "REPEL",
    margin: 5
});
assert.equal(bridge.getPendingDamage().length, 0);
assert.equal(damageService.hasDamage({ r: 0, c: 2 }), false);

hub.emit(GAME_FACT_TYPES.TRIAL_BATTLE_RESOLVED, {
    scenarioId: "TRIAL_1",
    trialIndex: 1,
    battleIndex: 1,
    routeId: "R_EXACT",
    interceptCell: { r: 0, c: 1 },
    outcome: "EXACT",
    margin: 0
});
hub.emit(GAME_FACT_TYPES.TRIAL_BATTLE_RESOLVED, {
    scenarioId: "TRIAL_1",
    trialIndex: 1,
    battleIndex: 2,
    routeId: "R_BREAK",
    interceptCell: { r: 0, c: 0 },
    outcome: "BREAKTHROUGH",
    margin: -7
});

assert.equal(bridge.getPendingDamage().length, 2);
assert.equal(damageService.hasDamage({ r: 0, c: 0 }), false);
assert.equal(damageService.hasDamage({ r: 0, c: 1 }), false);

hub.emit(GAME_FACT_TYPES.TRIAL_RESULT_SETTLED, {
    scenarioId: "OTHER",
    trialIndex: 1,
    outcome: "SURVIVED",
    turn: 15
});
assert.equal(damageService.hasDamage({ r: 0, c: 0 }), false);

hub.emit(GAME_FACT_TYPES.TRIAL_RESULT_SETTLED, {
    scenarioId: "TRIAL_1",
    trialIndex: 1,
    outcome: "SURVIVED",
    turn: 15
});

assert.equal(damageService.hasDamage({ r: 0, c: 1, target: BOARD_DAMAGE_TARGETS.LAND }), true);
assert.equal(damageService.hasDamage({ r: 0, c: 1, target: BOARD_DAMAGE_TARGETS.SPECIAL_BLOCK }), false);
assert.equal(damageService.hasDamage({ r: 0, c: 0, target: BOARD_DAMAGE_TARGETS.LAND }), true);
assert.equal(damageService.hasDamage({ r: 0, c: 0, target: BOARD_DAMAGE_TARGETS.SPECIAL_BLOCK }), true);
assert.equal(damageService.hasDamage({ r: 0, c: 2 }), false);
assert.equal(bridge.getPendingDamage().length, 0);

const breakLand = damageService.getDamageRecords({
    r: 0, c: 0, target: BOARD_DAMAGE_TARGETS.LAND
})[0];
assert.equal(breakLand.metadata.outcome, "BREAKTHROUGH");
assert.equal(breakLand.metadata.margin, -7);
assert.equal(breakLand.metadata.policyReason, "ENEMY_NOT_REPELLED");
assert.equal(breakLand.metadata.settledOutcome, "SURVIVED");
assert.equal(breakLand.metadata.settledTurn, 15);

// Settlement replay must stay idempotent.
hub.emit(GAME_FACT_TYPES.TRIAL_RESULT_SETTLED, {
    scenarioId: "TRIAL_1",
    trialIndex: 1,
    outcome: "SURVIVED",
    turn: 15
});
assert.equal(damageService.getDamageRecords({ r: 0, c: 0 }).length, 2);

bridge.dispose();
console.log("PASS trial board damage policy");
