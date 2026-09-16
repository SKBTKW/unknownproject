import assert from "node:assert/strict";
import { attachTrialLaunchSubsystem } from "../integration/trial_launch_bootstrap.js";

function baseEngine() {
    return {
        state: { grid: [] },
        trialDueStateService: {
            getPendingRequest: () => null,
            acknowledgePending: () => ({ success: true })
        },
        gameplayRandom: { shuffle: items => items },
        globalEventManager: null
    };
}

const ui = {
    trialController: { state: null },
    startTrialSession: () => ({ mode: "TRIAL" })
};

assert.equal(
    attachTrialLaunchSubsystem(baseEngine(), ui).reason,
    "TRIAL_LAUNCH_ENEMY_TRUTH_REQUIRED"
);

const truth = {
    getSnapshot: () => ({ trialIndex: 1, strategicSuppression: 10 })
};

assert.equal(
    attachTrialLaunchSubsystem(baseEngine(), ui, { enemyTruthReadModel: truth }).reason,
    "TRIAL_LAUNCH_INGRESS_COUNT_POLICY_REQUIRED"
);

assert.equal(
    attachTrialLaunchSubsystem(baseEngine(), ui, {
        enemyTruthReadModel: truth,
        ingressCountResolver: () => 1
    }).reason,
    "TRIAL_LAUNCH_ROUTE_COST_POLICY_REQUIRED"
);

const engine = baseEngine();
const attached = attachTrialLaunchSubsystem(engine, ui, {
    enemyTruthReadModel: truth,
    ingressCountResolver: () => 1,
    routeCostResolver: () => 1
});
assert.equal(attached.success, true);
assert.equal(engine.trialLaunchCoordinator, attached.coordinator);

const activeUi = {
    ...ui,
    trialController: { state: { phase: "RESULT" } }
};
const activeEngine = baseEngine();
activeEngine.trialDueStateService.getPendingRequest = () => ({ trialIndex: 1 });
const activeAttached = attachTrialLaunchSubsystem(activeEngine, activeUi, {
    enemyTruthReadModel: truth,
    ingressResolver: { resolve: () => [{ id: "I0", r: 0, c: 0 }] },
    routeGenerator: { generate: () => [{ id: "R0", cells: [{ r: 0, c: 0 }] }] },
    scenarioFactory: {
        build: () => ({ success: true, scenario: { id: "TRIAL_1", trialIndex: 1 } })
    }
});
assert.equal(activeAttached.success, true);
assert.equal(
    activeAttached.coordinator.tryStartPending({ gameState: activeEngine.state }).reason,
    "TRIAL_LAUNCH_ALREADY_ACTIVE"
);

console.log("diagnose_trial_launch_bootstrap: PASS");
