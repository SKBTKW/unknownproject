import assert from "node:assert/strict";
import { TrialLaunchCoordinator } from "../integration/trial_launch_coordinator.js";

function createHarness({
    blocked = false,
    active = false,
    truth = { trialIndex: 1, strategicSuppression: 10 },
    buildResult = { success: true, scenario: { id: "TRIAL_1", trialIndex: 1 } },
    startResult = { mode: "TRIAL" }
} = {}) {
    let pending = { trialIndex: 1 };
    let ackCount = 0;
    let buildCount = 0;
    let startCount = 0;

    const dueStateService = {
        getPendingRequest: () => pending ? { ...pending } : null,
        acknowledgePending: trialIndex => {
            if (!pending || pending.trialIndex !== trialIndex) {
                return { success: false, reason: "TRIAL_DUE_PENDING_MISMATCH" };
            }
            ackCount += 1;
            pending = null;
            return { success: true, trialIndex };
        }
    };

    const coordinator = new TrialLaunchCoordinator({
        dueStateService,
        enemyTruthReadModel: { getSnapshot: () => truth },
        scenarioFactory: {
            build: args => {
                buildCount += 1;
                if (buildResult instanceof Error) throw buildResult;
                return typeof buildResult === "function" ? buildResult(args) : buildResult;
            }
        },
        startTrialSession: (scenario, options) => {
            startCount += 1;
            if (startResult instanceof Error) throw startResult;
            return typeof startResult === "function" ? startResult({ scenario, options, coordinator }) : startResult;
        },
        isTrialActive: () => active,
        isPresentationBlocked: () => blocked
    });

    return {
        coordinator,
        dueStateService,
        counts: () => ({ ackCount, buildCount, startCount }),
        hasPending: () => Boolean(pending)
    };
}

const success = createHarness();
const started = success.coordinator.tryStartPending({ gameState: {} });
assert.equal(started.started, true);
assert.deepEqual(success.counts(), { ackCount: 1, buildCount: 1, startCount: 1 });
assert.equal(success.hasPending(), false);
assert.equal(success.coordinator.tryStartPending({ gameState: {} }).reason, "TRIAL_LAUNCH_NOT_DUE");
assert.deepEqual(success.counts(), { ackCount: 1, buildCount: 1, startCount: 1 });

const blocked = createHarness({ blocked: true });
assert.equal(blocked.coordinator.tryStartPending({ gameState: {} }).reason, "TRIAL_LAUNCH_PRESENTATION_BLOCKED");
assert.deepEqual(blocked.counts(), { ackCount: 0, buildCount: 0, startCount: 0 });
assert.equal(blocked.hasPending(), true);

const active = createHarness({ active: true });
assert.equal(active.coordinator.tryStartPending({ gameState: {} }).reason, "TRIAL_LAUNCH_ALREADY_ACTIVE");
assert.deepEqual(active.counts(), { ackCount: 0, buildCount: 0, startCount: 0 });

const missingTruth = createHarness({ truth: null });
assert.equal(missingTruth.coordinator.tryStartPending({ gameState: {} }).reason, "TRIAL_LAUNCH_ENEMY_TRUTH_UNAVAILABLE");
assert.deepEqual(missingTruth.counts(), { ackCount: 0, buildCount: 0, startCount: 0 });
assert.equal(missingTruth.hasPending(), true);

const buildFailure = createHarness({ buildResult: { success: false, errors: ["ROUTES_UNRESOLVED"] } });
const buildFailed = buildFailure.coordinator.tryStartPending({ gameState: {} });
assert.equal(buildFailed.reason, "TRIAL_LAUNCH_SCENARIO_BUILD_FAILED");
assert.deepEqual(buildFailed.errors, ["ROUTES_UNRESOLVED"]);
assert.deepEqual(buildFailure.counts(), { ackCount: 0, buildCount: 1, startCount: 0 });
assert.equal(buildFailure.hasPending(), true);

const startFailure = createHarness({ startResult: null });
assert.equal(startFailure.coordinator.tryStartPending({ gameState: {} }).reason, "TRIAL_LAUNCH_SESSION_START_FAILED");
assert.deepEqual(startFailure.counts(), { ackCount: 0, buildCount: 1, startCount: 1 });
assert.equal(startFailure.hasPending(), true);

const thrownStart = createHarness({ startResult: new Error("boom") });
assert.throws(() => thrownStart.coordinator.tryStartPending({ gameState: {} }), /boom/);
assert.deepEqual(thrownStart.counts(), { ackCount: 0, buildCount: 1, startCount: 1 });
assert.equal(thrownStart.hasPending(), true);

let reentrantResult = null;
const reentrant = createHarness({
    startResult: ({ coordinator }) => {
        reentrantResult = coordinator.tryStartPending({ gameState: {} });
        return { mode: "TRIAL" };
    }
});
assert.equal(reentrant.coordinator.tryStartPending({ gameState: {} }).started, true);
assert.equal(reentrantResult?.reason, "TRIAL_LAUNCH_IN_FLIGHT");
assert.deepEqual(reentrant.counts(), { ackCount: 1, buildCount: 1, startCount: 1 });

console.log("diagnose_trial_launch_coordinator: PASS");
