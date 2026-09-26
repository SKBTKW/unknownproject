import assert from "node:assert/strict";

import { GameEngine } from "../game/src/core/game_engine.js";
import { TrialController } from "../game/src/trial/flow/trial_controller.js";
import {
    FIRST_RUN_TRIAL1_RELATIVE_DEPLOYMENT_POLICY_V1,
    createFirstRunTrial1RelativeDeploymentCostResolver,
    resolveFirstRunTrial1DeploymentBurdenShare
} from "../game/src/trial/config/first_run_trial1_relative_deployment_policy_v1.js";
import { TRIAL_DEPLOYMENT_COST_PROFILE_STATUS } from "../game/src/trial/domain/trial_deployment_cost_resolver.js";

console.log("\nFirstRun Trial1 relative deployment cost v1");

{
    const fullFar = resolveFirstRunTrial1DeploymentBurdenShare({
        requestedDefense: 24,
        defenseAvailable: 24,
        distance: 4
    });
    assert.equal(Number(fullFar.toFixed(3)), 0.800);

    const halfFar = resolveFirstRunTrial1DeploymentBurdenShare({
        requestedDefense: 12,
        defenseAvailable: 24,
        distance: 4
    });
    assert.equal(Number(halfFar.toFixed(3)), 0.625);

    const heavyFar = resolveFirstRunTrial1DeploymentBurdenShare({
        requestedDefense: 20,
        defenseAvailable: 24,
        distance: 4
    });
    assert.equal(Number(heavyFar.toFixed(3)), 0.775);

    assert.deepEqual(
        FIRST_RUN_TRIAL1_RELATIVE_DEPLOYMENT_POLICY_V1,
        {
            baseShare: 0.30,
            defenseShareWeight: 0.45,
            distanceShareWeight: 0.10,
            maxShare: 0.80,
            stage1MaxDistance: 4
        }
    );
}

{
    const resolver = createFirstRunTrial1RelativeDeploymentCostResolver({
        balanceProvider: () => ({ food: 100, material: 80 }),
        defenseBalanceProvider: () => 20
    });
    assert.equal(typeof resolver, "function");

    const cost = resolver({
        requestedDefense: 20,
        distance: 4,
        context: {
            trialIndex: 1,
            defenseAvailable: 20,
            interceptionCount: 1
        }
    });
    assert.equal(cost.food, 80);
    assert.equal(cost.material, 64);
    assert.equal(cost.breakdown.mode, "FIRST_RUN_TRIAL1_RELATIVE_V1");
    assert.equal(Number(cost.breakdown.burdenShare.toFixed(2)), 0.80);

    assert.equal(
        resolver({
            requestedDefense: 20,
            distance: 4,
            context: { trialIndex: 2, defenseAvailable: 20, interceptionCount: 1 }
        }),
        null,
        "relative policy must fail closed outside Trial1"
    );
    assert.equal(
        resolver({
            requestedDefense: 20,
            distance: 4,
            context: { trialIndex: 1, defenseAvailable: 20, interceptionCount: 2 }
        }),
        null,
        "v1 must fail closed if FirstRun Trial1 ever becomes multi-front"
    );
}

// Normal runs keep the previous product behavior: no deployment economy by default.
{
    const engine = GameEngine.createGame({ runSeed: 20260924 });
    assert.equal(engine.firstRunState?.active, false);
    assert.equal(engine.trialDeploymentAttachment, null);
    assert.equal(engine.trialDeploymentService, undefined);
}

// FirstRun production composition enables relative deployment economy.
{
    const engine = GameEngine.createGame({ runSeed: 20260924, firstRun: true });
    assert.equal(engine.firstRunState?.active, true);
    assert.equal(engine.trialDeploymentAttachment?.success, true);
    assert.equal(typeof engine.trialDeploymentService?.previewPlan, "function");

    const trial1Session = engine.trialDeploymentService.beginSession({
        trialState: {
            trialIndex: 1,
            human: {
                availableDefense: engine.getTrialAvailableDefense(),
                mystic: engine.state.mystic
            }
        }
    });
    assert.equal(trial1Session.success, true);
    assert.equal(trial1Session.applicable, true);
    assert.equal(engine.trialDeploymentService.isSessionApplicable(), true);

    engine.trialDeploymentService.endSession();

    const trial2Session = engine.trialDeploymentService.beginSession({
        trialState: {
            trialIndex: 2,
            human: {
                availableDefense: engine.getTrialAvailableDefense(),
                mystic: engine.state.mystic
            }
        }
    });
    assert.equal(trial2Session.success, true);
    assert.equal(trial2Session.applicable, false);
    assert.equal(engine.trialDeploymentService.isSessionApplicable(), false);
}

// TrialController must fall back to defense-only activation when a later Trial
// is not applicable to the FirstRun Trial1 deployment economy.
{
    const engine = GameEngine.createGame({ runSeed: 20260925, firstRun: true });
    const controller = new TrialController({
        deploymentService: engine.trialDeploymentService,
        defenseReservation: engine.trialDefenseReservation
    });

    controller.startScenario({
        id: "FIRST_RUN_TRIAL1_RELATIVE_SESSION",
        trialIndex: 1,
        availableDefense: engine.getTrialAvailableDefense(),
        enemySuppression: 0,
        routes: []
    });
    assert.equal(controller.sessionDeploymentService, engine.trialDeploymentService);

    controller.endScenario();
    controller.startScenario({
        id: "LATER_TRIAL_SESSION",
        trialIndex: 2,
        availableDefense: engine.getTrialAvailableDefense(),
        enemySuppression: 0,
        routes: []
    });
    assert.equal(controller.sessionDeploymentService, null);
}

// Explicit host/balance configuration has precedence over the FirstRun default.
{
    const explicitProfile = {
        status: TRIAL_DEPLOYMENT_COST_PROFILE_STATUS.RESOLVED,
        food: { base: 1, perDefense: 1, perDistance: 0 },
        material: { base: 2, perDefense: 1, perDistance: 0 }
    };
    const engine = GameEngine.createGame({
        runSeed: 20260926,
        firstRun: true,
        trialDeploymentEconomy: {
            costProfile: explicitProfile
        }
    });

    const cost = engine.trialDeploymentCostPolicy.calculate({
        requestedDefense: 3,
        boardFacts: { trialTraits: null },
        origin: { trialTraits: null },
        distance: 0,
        context: { trialIndex: 1, defenseAvailable: 5, interceptionCount: 1 }
    });
    assert.equal(cost.resolved, true);
    assert.equal(cost.food, 4);
    assert.equal(cost.material, 5);
    assert.equal(cost.breakdown.mode, undefined);
}

console.log("✅ FirstRun Trial1 relative deployment cost v1 PASS");
