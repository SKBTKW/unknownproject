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
        globalEventManager: {
            getPendingChoice: () => null
        }
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
assert.equal(engine.__trialLaunchSubsystemAttached, true);
assert.equal(typeof engine.retryPendingTrialLaunch, "function");
assert.equal(attached.retryPendingTrialLaunch, engine.retryPendingTrialLaunch);
assert.deepEqual(engine.retryPendingTrialLaunch(), {
    started: false,
    reason: "TRIAL_LAUNCH_NOT_DUE"
});
assert.deepEqual(engine.lastTrialLaunchAttempt, {
    started: false,
    reason: "TRIAL_LAUNCH_NOT_DUE"
});

const repeated = attachTrialLaunchSubsystem(engine, ui, {
    enemyTruthReadModel: truth,
    ingressCountResolver: () => 99,
    routeCostResolver: () => 99
});
assert.equal(repeated.success, true);
assert.equal(repeated.alreadyAttached, true);
assert.equal(repeated.coordinator, attached.coordinator);
assert.equal(repeated.retryPendingTrialLaunch, engine.retryPendingTrialLaunch);

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
    activeAttached.retryPendingTrialLaunch().reason,
    "TRIAL_LAUNCH_ALREADY_ACTIVE"
);

const blockedEngine = baseEngine();
blockedEngine.trialDueStateService.getPendingRequest = () => ({ trialIndex: 1 });
blockedEngine.globalEventManager.getPendingChoice = () => ({ eventId: "CHOICE" });
const blockedAttached = attachTrialLaunchSubsystem(blockedEngine, ui, {
    enemyTruthReadModel: truth,
    ingressResolver: { resolve: () => [{ id: "I0", r: 0, c: 0 }] },
    routeGenerator: { generate: () => [{ id: "R0", cells: [{ r: 0, c: 0 }] }] },
    scenarioFactory: {
        build: () => ({ success: true, scenario: { id: "TRIAL_1", trialIndex: 1 } })
    }
});
assert.equal(
    blockedAttached.retryPendingTrialLaunch().reason,
    "TRIAL_LAUNCH_PRESENTATION_BLOCKED"
);

console.log("diagnose_trial_launch_bootstrap: PASS");
