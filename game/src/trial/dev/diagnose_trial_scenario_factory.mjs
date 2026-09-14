import assert from "node:assert/strict";
import { TrialScenarioFactory } from "../scenario/trial_scenario_factory.js";
import { TrialThreatResolver } from "../systems/trial_threat_resolver.js";
import { TrialController } from "../flow/trial_controller.js";
import { TRIAL_PHASES } from "../domain/trial_types.js";
import { TRIAL_SCENARIO_BUILD_REASONS } from "../scenario/trial_scenario_contract.js";

function buildState() {
    const mergeLinks = new Set(["1::2", "2::3"]);
    return {
        turn: 30,
        ember: 17,
        maxEmber: 20,
        currentDefense: 23,
        maxDefense: 31,
        mystic: 4,
        stage: { id: 2 },
        getTerritoryTileCount() {
            return 12;
        },
        mergedBlocks: {
            1: {
                groupId: 1,
                mergeType: "2x2",
                cells: [{ r: 0, c: 0 }, { r: 0, c: 1 }, { r: 1, c: 0 }, { r: 1, c: 1 }]
            },
            2: {
                groupId: 2,
                mergeType: "1x3",
                cells: [{ r: 2, c: 0 }, { r: 2, c: 1 }, { r: 2, c: 2 }]
            },
            3: {
                groupId: 3,
                mergeType: "T_SHAPE",
                cells: [{ r: 3, c: 0 }, { r: 3, c: 1 }, { r: 3, c: 2 }, { r: 4, c: 1 }]
            }
        },
        mergeLinks,
        gridEngine: {
            getMergeLinkCount() {
                return mergeLinks.size;
            }
        },
        // Factory must not reconcile/mutate defense state. Trial Entry may do that later.
        defenseSystem: {
            getTrialAvailableDefense() {
                throw new Error("FACTORY_MUST_NOT_RECONCILE_DEFENSE");
            }
        },
        // Warning/Intel may coexist on GameState, but they are not scenario truth inputs.
        warningState: "IMMINENT",
        intel: { confidence: 999 }
    };
}

const state = buildState();
const before = JSON.stringify({
    ember: state.ember,
    maxEmber: state.maxEmber,
    currentDefense: state.currentDefense,
    maxDefense: state.maxDefense,
    mystic: state.mystic
});

const threatResolver = new TrialThreatResolver({
    baseThreatByTrial: { 1: 10, 2: 20, 3: 30 },
    territoryWeight: 1,
    completedZoneWeight: 3,
    linkWeight: 4,
    stageWeight: 5
});

const factory = new TrialScenarioFactory({
    threatResolver,
    ingressResolver: {
        resolve: () => [{ id: "N2", edge: "NORTH", r: 0, c: 2 }]
    },
    routeGenerator: {
        generate: ({ threat }) => [{
            id: "ROUTE_N2",
            suppression: threat.strategicSuppression,
            cells: [{ r: 0, c: 2 }, { r: 1, c: 2 }, { r: 2, c: 2 }]
        }]
    },
    environmentResolver: {
        resolve: () => ({ source: "SCENARIO_FACTORY_DIAGNOSTIC" })
    }
});

const built = factory.build({ trialIndex: 2, gameState: state });
assert.equal(built.success, true);
assert.equal(built.scenario.enemySuppression, 51);
assert.equal(built.scenario.availableDefense, 23);
assert.equal(built.scenario.ember, 17);
assert.equal(built.scenario.maxEmber, 20);
assert.equal(built.scenario.mystic, 4);
assert.equal(built.scenario.routes.length, 1);
assert.deepEqual(built.diagnostics.development, {
    stage: 2,
    territoryTiles: 12,
    completedZones: 2,
    links: 2
});
assert.equal(built.diagnostics.threat.strategicSuppression, 51);
assert.equal(
    JSON.stringify({
        ember: state.ember,
        maxEmber: state.maxEmber,
        currentDefense: state.currentDefense,
        maxDefense: state.maxDefense,
        mystic: state.mystic
    }),
    before
);

const missingIngressFactory = new TrialScenarioFactory({ threatResolver });
const missingIngress = missingIngressFactory.build({ trialIndex: 2, gameState: state });
assert.equal(missingIngress.success, false);
assert.deepEqual(missingIngress.errors, [TRIAL_SCENARIO_BUILD_REASONS.INGRESS_RESOLVER_REQUIRED]);

const controller = new TrialController();
const trialState = controller.startScenario(built.scenario);
assert.equal(trialState.phase, TRIAL_PHASES.SETUP);
assert.equal(trialState.enemy.strategicSuppression, 51);
assert.equal(trialState.human.availableDefense, 23);
assert.equal(trialState.human.ember, 17);
assert.equal(trialState.human.mystic, 4);

console.log("diagnose_trial_scenario_factory: PASS");
