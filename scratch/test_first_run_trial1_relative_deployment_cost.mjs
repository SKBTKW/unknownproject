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
    assert.equal(Number(fullFar.toFixed(3)), 0.900);

    const halfFar = resolveFirstRunTrial1DeploymentBurdenShare({
        requestedDefense: 12,
        defenseAvailable: 24,
        distance: 4
    });
    assert.equal(Number(halfFar.toFixed(3)), 0.860);

    const heavyFar = resolveFirstRunTrial1DeploymentBurdenShare({
        requestedDefense: 20,
        defenseAvailable: 24,
        distance: 4
    });
    assert.equal(Number(heavyFar.toFixed(3)), 0.887);

    assert.deepEqual(
        FIRST_RUN_TRIAL1_RELATIVE_DEPLOYMENT_POLICY_V1,
        {
            baseShare: 0.80,
            defenseShareWeight: 0.08,
            distanceShareWeight: 0.02,
            foodShareBonus: 0,
            minimumFoodReserve: 35,
            foodReserveShare: 0.10,
            maxShare: 0.90,
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
    assert.equal(cost.food, 90);
    assert.equal(cost.material, 72);
    assert.equal(cost.breakdown.mode, "FIRST_RUN_TRIAL1_RELATIVE_V1");
    assert.equal(Number(cost.breakdown.burdenShare.toFixed(2)), 0.90);
    assert.equal(Number(cost.breakdown.foodShare.toFixed(2)), 0.90);

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

// Reserve protection must not grant free deployment at low balances.
{
    for (const [food, expectedCost] of [[108, 97], [36, 32], [35, 31], [20, 18], [0, 0]]) {
        const resolver = createFirstRunTrial1RelativeDeploymentCostResolver({
            balanceProvider: () => ({ food, material: 80 }),
            defenseBalanceProvider: () => 20
        });
        const cost = resolver({ requestedDefense: 20, distance: 4, context: { trialIndex: 1 } });
        assert.equal(cost.food, expectedCost, `food balance ${food}`);
        assert.ok(cost.food >= Math.ceil(food * 0.8));
        if (food > 0) assert.ok(cost.food > 0);
        assert.equal(cost.breakdown.nominalFoodCost - cost.breakdown.foodReserveDiscount, cost.food);
    }
}

// Increasing the balance must never reduce the charge at reserve boundaries.
{
    let previousCost = 0;
    for (let food = 0; food <= 150; food += 1) {
        const resolver = createFirstRunTrial1RelativeDeploymentCostResolver({
            balanceProvider: () => ({ food, material: 80 }),
            defenseBalanceProvider: () => 20
        });
        const cost = resolver({ requestedDefense: 20, distance: 4, context: { trialIndex: 1 } });
        assert.ok(cost.food >= previousCost, `cost must be monotonic at balance ${food}`);
        assert.ok(cost.food <= food);
        previousCost = cost.food;
    }
}

// Sweep low balances, reserve boundaries, and expanded storage. Earlier spending
// must not count toward the minimum: both live resource balances pay >=80%.
{
    for (const balance of [0, 1, 2, 5, 20, 35, 99, 100, 150, 170, 200, 350, 1000]) {
        for (const fraction of [0.1, 0.5, 0.8, 1]) {
            for (const distance of [0, 2, 4]) {
                const resolver = createFirstRunTrial1RelativeDeploymentCostResolver({
                    balanceProvider: () => ({ food: balance, material: balance }),
                    defenseBalanceProvider: () => 100
                });
                const quote = resolver({ requestedDefense: fraction * 100, distance,
                    context: { trialIndex: 1, interceptionCount: 1 } });
                for (const amount of [quote.food, quote.material]) {
                    assert.ok(amount >= Math.ceil(balance * 0.8));
                    assert.ok(amount <= balance);
                }
            }
        }
    }
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
