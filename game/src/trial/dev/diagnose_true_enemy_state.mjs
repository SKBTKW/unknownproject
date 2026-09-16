import assert from "node:assert/strict";
import { GameFactHub, GAME_FACT_TYPES } from "../../core/game_fact.js";
import { TrueEnemyStateService } from "../systems/true_enemy_state_service.js";
import { EnemyTruthReadModel } from "../systems/enemy_truth_read_model.js";
import { TrialScenarioFactory } from "../scenario/trial_scenario_factory.js";

const gameState = {
    turn: 8,
    stage: { id: 1 },
    currentDefense: 10,
    ember: 20,
    maxEmber: 20,
    mystic: 0,
    getTerritoryTileCount: () => 3,
    mergedBlocks: {},
    mergeLinks: new Set()
};

const hub = new GameFactHub();
const inertTruth = new TrueEnemyStateService({ gameState, gameFactHub: hub });
const before = inertTruth.getSnapshot();
hub.emit(GAME_FACT_TYPES.TRIAL_THREAT_UPDATED, {
    previous: { trialIndex: 1, committedVerse: 7, threat: { strategicSuppression: 4 } },
    current: { trialIndex: 1, committedVerse: 8, threat: { strategicSuppression: 9 } }
});
assert.deepEqual(inertTruth.getSnapshot(), before);
inertTruth.dispose();

const truth = new TrueEnemyStateService({
    gameState,
    gameFactHub: hub,
    transitionResolver: ({ previousEnemyState, currentThreat, verse, trialIndex }) => ({
        trialIndex,
        strategicSuppression: currentThreat.strategicSuppression,
        forces: [{ id: "FORCE_A", role: "MAIN" }],
        attributes: {
            body: ["LARGE"],
            equipment: ["METAL"],
            terrainAffinity: [],
            marchTraits: ["NIGHT"]
        },
        lastTransition: { type: "REINFORCEMENT", verse, fromRevision: previousEnemyState.revision }
    })
});

hub.emit(GAME_FACT_TYPES.TRIAL_THREAT_UPDATED, {
    previous: { trialIndex: 1, committedVerse: 8, threat: { strategicSuppression: 9 } },
    current: { trialIndex: 1, committedVerse: 9, threat: { strategicSuppression: 12 } }
});

const truthSnapshot = truth.getSnapshot();
assert.equal(truthSnapshot.strategicSuppression, 12);
assert.equal(truthSnapshot.revision, 1);
assert.equal(truthSnapshot.updatedAtVerse, 9);
assert.deepEqual(truthSnapshot.attributes.body, ["LARGE"]);

const readModel = new EnemyTruthReadModel(truth);
const exposed = readModel.getSnapshot();
exposed.strategicSuppression = 999;
exposed.attributes.body.push("SMALL");
assert.equal(truth.getSnapshot().strategicSuppression, 12);
assert.deepEqual(truth.getSnapshot().attributes.body, ["LARGE"]);

const factory = new TrialScenarioFactory({
    enemyTruthReadModel: readModel,
    ingressResolver: { resolve: () => [{ id: "N0", r: 0, c: 0, edges: ["NORTH"] }] },
    routeGenerator: { generate: () => [{ id: "R0", cells: [{ r: 0, c: 0 }, { r: 1, c: 0 }] }] }
});
const built = factory.build({ trialIndex: 1, gameState });
assert.equal(built.success, true);
assert.equal(built.scenario.enemySuppression, 12);
assert.deepEqual(built.scenario.forces, [{ id: "FORCE_A", role: "MAIN" }]);
assert.equal(built.diagnostics.threat.source, "ENEMY_TRUTH");

hub.emit(GAME_FACT_TYPES.TRIAL_THREAT_UPDATED, {
    previous: { trialIndex: 1, committedVerse: 9, threat: { strategicSuppression: 12 } },
    current: { trialIndex: 1, committedVerse: 10, threat: { strategicSuppression: 15 } }
});
assert.equal(truth.getSnapshot().strategicSuppression, 15);
assert.equal(built.scenario.enemySuppression, 12);

console.log("diagnose_true_enemy_state: PASS");
