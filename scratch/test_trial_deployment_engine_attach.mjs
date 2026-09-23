import assert from "node:assert/strict";
import { GameEngine } from "../game/src/core/game_engine.js";
import { TRIAL_DEPLOYMENT_COST_PROFILE_STATUS } from "../game/src/trial/domain/trial_deployment_cost_resolver.js";

const resolvedProfile = {
    status: TRIAL_DEPLOYMENT_COST_PROFILE_STATUS.RESOLVED,
    food: {
        base: 0,
        perDefense: 1,
        perDistance: 1
    },
    material: {
        base: 0,
        perDefense: 1,
        perDistance: 0
    }
};

// Default gameplay remains unchanged: no hidden balance profile, no auto-enable.
{
    const engine = new GameEngine({ runSeed: 101 });
    assert.equal(engine.trialDeploymentAttachment, null);
    assert.equal(engine.trialDeploymentService, undefined);
    assert.equal(engine.trialDeploymentCostPolicy, undefined);
}

// A caller can explicitly activate Deployment Economy without changing Trial/UI code.
{
    const engine = new GameEngine({
        runSeed: 102,
        trialDeploymentEconomy: {
            costProfile: resolvedProfile
        }
    });

    assert.equal(engine.trialDeploymentAttachment?.success, true);
    assert.equal(typeof engine.trialDeploymentService?.previewAllocation, "function");
    assert.equal(typeof engine.trialDeploymentDefenseReservation?.reserve, "function");
    assert.equal(typeof engine.trialDeploymentResourcePayment?.pay, "function");
    assert.equal(engine.trialDeploymentDefenseReservation.readBalance(), engine.getTrialAvailableDefense());
}

// Explicit-but-unresolved configuration is observable and fail-closed.
{
    const engine = new GameEngine({
        runSeed: 103,
        trialDeploymentEconomy: {
            costProfile: {
                status: TRIAL_DEPLOYMENT_COST_PROFILE_STATUS.UNRESOLVED
            }
        }
    });

    assert.equal(engine.trialDeploymentAttachment?.success, false);
    assert.equal(
        engine.trialDeploymentAttachment?.reason,
        "TRIAL_DEPLOYMENT_COST_POLICY_UNRESOLVED"
    );
    assert.equal(engine.trialDeploymentService, undefined);
}

// Explicit custom resolver remains supported for test/dev/balance experiments.
{
    const engine = new GameEngine({
        runSeed: 104,
        trialDeploymentEconomy: {
            costResolver: ({ requestedDefense, distance }) => ({
                food: requestedDefense + distance,
                material: requestedDefense,
                breakdown: { source: "TEST_ONLY" }
            })
        }
    });

    assert.equal(engine.trialDeploymentAttachment?.success, true);
    assert.equal(typeof engine.trialDeploymentService?.commitPlan, "function");
}

console.log("test_trial_deployment_engine_attach: PASS");
