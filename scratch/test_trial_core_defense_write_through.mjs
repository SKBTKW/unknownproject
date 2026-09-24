import assert from "node:assert/strict";

import { GameEngine } from "../game/src/core/game_engine.js";
import { TrialController } from "../game/src/trial/flow/trial_controller.js";
import { TRIAL_DEPLOYMENT_COST_PROFILE_STATUS } from "../game/src/trial/domain/trial_deployment_cost_resolver.js";

function createControllerFixture({
    defenseAllocation = 4,
    useCanonicalDefenseReservation = true
} = {}) {
    const engine = new GameEngine({ runSeed: 20260924 });
    const controller = new TrialController({
        gameFactHub: engine.gameFactHub,
        emberSystem: engine.emberSystem,
        deploymentService: engine.trialDeploymentService || null,
        defenseReservation: engine.trialDefenseReservation
    });

    const availableDefense = engine.getTrialAvailableDefense();
    controller.startScenario({
        id: "CORE_DEFENSE_WRITE_THROUGH",
        trialIndex: 1,
        availableDefense,
        ember: engine.state.ember,
        maxEmber: engine.state.maxEmber,
        mystic: engine.state.mystic,
        enemySuppression: 5,
        routes: [{
            id: "R1",
            strategicSuppression: 5,
            cells: [
                { r: 0, c: 1 },
                { r: 0, c: 2 }
            ]
        }]
    }, {
        useCanonicalDefenseReservation,
        cellResolver: (r, c) => ({
            r,
            c,
            placed: true,
            isHQ: false,
            terrain: {
                terrainId: "GL1_PLAINS",
                id: "GL1_PLAINS",
                e: 1,
                gl: 1
            }
        })
    });

    const drafts = new Map();
    const planned = controller.setRouteInterceptPlan(
        drafts,
        "R1",
        { r: 0, c: 1 },
        defenseAllocation
    );
    assert.equal(planned.success, true);

    const confirmed = controller.confirmInterceptionPlan(drafts, { allowWarnings: true });
    assert.equal(confirmed.success, true);

    return { engine, controller, confirmed, availableDefense };
}

console.log("\nTrial Core defense write-through");

{
    const { engine, controller, availableDefense } = createControllerFixture({ defenseAllocation: 4 });

    assert.equal(engine.trialDeploymentAttachment, null, "deployment economy must remain disabled by default");
    assert.ok(engine.trialDefenseReservation, "core defense reservation must exist independently of deployment economy");
    assert.equal(engine.trialDeploymentService, undefined);

    const activated = controller.activateInterceptionPlan();
    assert.equal(activated.success, true);
    assert.equal(activated.deploymentCommit, null);
    assert.equal(activated.defenseReservationCommit?.reserved, 4);
    assert.equal(engine.getTrialAvailableDefense(), availableDefense - 4);
    assert.equal(engine.state.currentDefense, availableDefense - 4);
    assert.equal(controller.state.human.availableDefense, availableDefense - 4);
}

{
    const { engine, controller, availableDefense } = createControllerFixture({
        defenseAllocation: 4,
        useCanonicalDefenseReservation: false
    });

    const activated = controller.activateInterceptionPlan();
    assert.equal(activated.success, true);
    assert.equal(
        engine.getTrialAvailableDefense(),
        availableDefense,
        "development/preview-style sessions may use an isolated virtual defense pool"
    );
    assert.equal(controller.state.human.availableDefense, availableDefense - 4);
    assert.equal(activated.defenseReservationCommit, null);
}

{
    const { engine, controller, availableDefense } = createControllerFixture({ defenseAllocation: 4 });

    const externalLoss = engine.applyTrialDefenseLoss(2);
    assert.equal(externalLoss.reduced, 2);
    const liveBeforeCommit = engine.getTrialAvailableDefense();
    assert.equal(liveBeforeCommit, availableDefense - 2);

    const activated = controller.activateInterceptionPlan();
    assert.equal(activated.success, false, "stale Trial-local budget must fail closed against live GameState defense");
    assert.equal(
        activated.errors.includes("INSUFFICIENT_DEFENSE"),
        true,
        JSON.stringify(activated)
    );
    assert.equal(engine.getTrialAvailableDefense(), liveBeforeCommit, "failed reservation must not consume additional defense");
    assert.equal(controller.state.planActivated, false);
}

{
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

    const engine = new GameEngine({
        runSeed: 20260925,
        trialDeploymentEconomy: {
            costProfile: resolvedProfile
        }
    });

    assert.equal(engine.trialDeploymentAttachment?.success, true);
    assert.equal(
        engine.trialDeploymentDefenseReservation,
        engine.trialDefenseReservation,
        "deployment economy must reuse the core reservation to avoid double defense authority"
    );
}

console.log("✅ Trial Core defense write-through PASS");
