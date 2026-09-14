import assert from "node:assert/strict";
import { TrialScenarioFactory } from "../scenario/trial_scenario_factory.js";
import { TrialIngressResolver } from "../scenario/trial_ingress_resolver.js";
import { TrialIngressSelectionPolicy } from "../scenario/trial_ingress_selection_policy.js";
import { TrialRouteGenerator } from "../scenario/trial_route_generator.js";
import { TrialThreatResolver } from "../systems/trial_threat_resolver.js";
import { TrialController } from "../flow/trial_controller.js";
import { TRIAL_PHASES } from "../domain/trial_types.js";

function cell(r, c, { terrainId = "GL1_PLAINS", isHQ = false } = {}) {
    return {
        r,
        c,
        placed: true,
        isHQ,
        terrain: { id: terrainId }
    };
}

const grid = Array.from({ length: 5 }, (_, r) =>
    Array.from({ length: 5 }, (_, c) => cell(r, c))
);
grid[2][2] = cell(2, 2, { isHQ: true });
grid[1][2] = cell(1, 2, { terrainId: "E3_MOUNTAIN" });

const state = {
    grid,
    ember: 15,
    maxEmber: 20,
    currentDefense: 18,
    mystic: 3,
    stage: { id: 1 },
    mergedBlocks: {},
    mergeLinks: new Set(),
    getTerritoryTileCount() {
        return 8;
    },
    warningState: "IMMINENT",
    intel: { confidence: 999 }
};

const selectionPolicy = new TrialIngressSelectionPolicy({
    countResolver: () => 1,
    randomService: {
        shuffle(items) {
            // Deterministically choose north-center candidate first for diagnosis.
            return [...items].sort((a, b) => {
                const aTarget = a.r === 0 && a.c === 2 ? -1 : 0;
                const bTarget = b.r === 0 && b.c === 2 ? -1 : 0;
                return aTarget - bTarget || a.id.localeCompare(b.id);
            });
        }
    }
});

const ingressResolver = new TrialIngressResolver({
    selector: context => selectionPolicy.select(context)
});

const routeGenerator = new TrialRouteGenerator({
    costResolver: () => 1
});

const threatResolver = new TrialThreatResolver({
    baseThreatByTrial: { 1: 10 },
    territoryWeight: 1
});

const factory = new TrialScenarioFactory({
    threatResolver,
    ingressResolver,
    routeGenerator
});

const built = factory.build({ trialIndex: 1, gameState: state });
assert.equal(built.success, true);
assert.equal(built.scenario.enemySuppression, 18);
assert.equal(built.diagnostics.ingresses.length, 1);
assert.deepEqual(built.diagnostics.ingresses[0], {
    id: "INGRESS_0_2",
    r: 0,
    c: 2,
    edges: ["NORTH"],
    placed: true,
    terrainId: "GL1_PLAINS"
});
assert.equal(built.scenario.routes.length, 1);
assert.equal(
    built.scenario.routes[0].cells.some(({ r, c }) => r === 1 && c === 2),
    false
);
assert.deepEqual(
    built.scenario.routes[0].cells.at(-1),
    { r: 2, c: 2 }
);

const controller = new TrialController();
const trialState = controller.startScenario(built.scenario);
assert.equal(trialState.phase, TRIAL_PHASES.SETUP);
assert.equal(trialState.enemy.strategicSuppression, 18);
assert.equal(trialState.routes.length, 1);

// Changing Warning/Intel must not alter Trial truth with the same Trial-side inputs.
state.warningState = "CALM";
state.intel = { confidence: 0, knownDirection: "SOUTH" };
assert.deepEqual(
    factory.build({ trialIndex: 1, gameState: state }).scenario.routes,
    built.scenario.routes
);

console.log("diagnose_trial_scenario_generation_pipeline: PASS");
