import assert from "node:assert/strict";
import { GameFactHub, GAME_FACT_TYPES } from "../game/src/core/game_fact.js";
import { BoardBattleSiteRecorder } from "../game/src/core/board_battle_site_recorder.js";
import { BoardHistoryQuery } from "../game/src/core/board_history_query.js";
import { serializeGameState } from "../game/src/core/state_serializer.js";
import { hydrateGameState } from "../game/src/core/hydrate_game_state.js";

function makeState() {
    return {
        turn: 15,
        ember: 12,
        maxEmber: 20,
        food: 20,
        wood: 20,
        defense: 10,
        currentDefense: 10,
        maxDefense: 10,
        mystic: 0,
        reserveSlots: [],
        handOffering: [],
        mergeLinks: new Set(),
        roadEdges: new Set(),
        grantedConnectionPairs: new Set(),
        grid: [[
            {
                r: 0,
                c: 0,
                placed: true,
                isHQ: false,
                terrain: {
                    id: "GL1_PLAINS",
                    terrainId: "GL1_PLAINS",
                    food: 1,
                    wood: 0,
                    defense: 0,
                    mystic: 0
                }
            },
            {
                r: 0,
                c: 1,
                placed: true,
                isHQ: false,
                terrain: {
                    id: "E2_HILL",
                    terrainId: "E2_HILL",
                    food: 0,
                    wood: 0,
                    defense: 1,
                    mystic: 0
                }
            }
        ]],
        mergedBlocks: {},
        placedBlockProduction: {},
        stage: { id: 1, name: "Stage 1", size: 5, maxTiles: 24 }
    };
}

const state = makeState();
const hub = new GameFactHub();
const recorder = new BoardBattleSiteRecorder({ gameFactHub: hub, state });
const query = new BoardHistoryQuery({ state });

hub.emit(GAME_FACT_TYPES.TRIAL_BATTLE_RESOLVED, {
    scenarioId: "TRIAL_SCENARIO_1",
    trialIndex: 1,
    battleIndex: 0,
    routeId: "ROUTE_A",
    interceptCell: { r: 0, c: 0 },
    outcome: "REPEL",
    playerActualPower: 40,
    enemyActualPower: 30,
    margin: 10
});

assert.equal(query.hasBattleSite(), false, "resolved battle must remain staged before settlement");
assert.equal(recorder.getPendingBattles().length, 1);

hub.emit(GAME_FACT_TYPES.TRIAL_RESULT_SETTLED, {
    scenarioId: "OTHER_SCENARIO",
    trialIndex: 1,
    turn: 15,
    outcome: "SURVIVED"
});
assert.equal(query.hasBattleSite(), false, "other Trial settlement must not flush staged battle");

hub.emit(GAME_FACT_TYPES.TRIAL_RESULT_SETTLED, {
    scenarioId: "TRIAL_SCENARIO_1",
    trialIndex: 1,
    turn: 15,
    outcome: "SURVIVED"
});

assert.equal(query.hasBattleSite(), true);
assert.equal(query.hasBattleSite({ trialIndex: 1, outcome: "REPEL" }), true);
assert.equal(recorder.getPendingBattles().length, 0);

const firstSite = query.getBattleSites()[0];
assert.equal(firstSite.routeId, "ROUTE_A");
assert.equal(firstSite.trialOutcome, "SURVIVED");
assert.equal(firstSite.settledTurn, 15);
assert.equal(firstSite.damaged, undefined, "damage semantics must remain unspecified");

hub.emit(GAME_FACT_TYPES.TRIAL_RESULT_SETTLED, {
    scenarioId: "TRIAL_SCENARIO_1",
    trialIndex: 1,
    turn: 15,
    outcome: "SURVIVED"
});
assert.equal(query.getBattleSites().length, 1, "duplicate settlement must be idempotent");

hub.emit(GAME_FACT_TYPES.TRIAL_BATTLE_RESOLVED, {
    scenarioId: "TRIAL_SCENARIO_2",
    trialIndex: 2,
    battleIndex: 0,
    routeId: "ROUTE_B",
    interceptCell: { r: 99, c: 99 },
    outcome: "BREAKTHROUGH"
});
hub.emit(GAME_FACT_TYPES.TRIAL_RESULT_SETTLED, {
    scenarioId: "TRIAL_SCENARIO_2",
    trialIndex: 2,
    turn: 30,
    outcome: "SURVIVED"
});
assert.equal(query.getBattleSites().length, 1, "invalid Board coordinate must not create history");

const serialized = serializeGameState(state);
assert.equal(serialized.grid[0][0].entities?.length, 1, "Battle Site must serialize with Board cell");

const restored = makeState();
hydrateGameState(restored, serialized, { resolveCardMaster: () => null });
const restoredQuery = new BoardHistoryQuery({ state: restored });
assert.equal(restoredQuery.hasBattleSite({ trialIndex: 1, scenarioId: "TRIAL_SCENARIO_1" }), true);
assert.equal(restoredQuery.getBattleSites()[0].routeId, "ROUTE_A");

recorder.dispose();
console.log("PASS battle site lifecycle");
