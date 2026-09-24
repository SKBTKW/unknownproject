import assert from "node:assert/strict";

import { GameEngine } from "../game/src/core/game_engine.js";
import { TrialController } from "../game/src/trial/flow/trial_controller.js";

function createBoardFixture() {
    const cells = new Map([
        ["0:0", {
            r: 0,
            c: 0,
            placed: true,
            isHQ: true,
            terrain: { terrainId: "HQ", id: "HQ", e: 0, gl: 0 }
        }],
        ["0:4", {
            r: 0,
            c: 4,
            placed: true,
            isHQ: false,
            terrain: { terrainId: "E1_PLAINS", id: "E1_PLAINS", e: 1, gl: 0 }
        }]
    ]);

    const boardDomainAdapter = {
        zoneConversionService: null,

        readTrialDeploymentFacts(target) {
            const cell = cells.get(`${target?.r}:${target?.c}`) || null;
            if (!cell || !cell.placed || cell.isHQ) return null;
            return {
                cell: { r: cell.r, c: cell.c },
                placed: true,
                isHQ: false,
                terrain: {
                    terrainId: cell.terrain.terrainId,
                    elevation: Number(cell.terrain.e) || 0,
                    growthLevel: Number(cell.terrain.gl) || 0
                },
                capabilities: [],
                trialTraits: null,
                damaged: false
            };
        },

        listTrialDeploymentOrigins() {
            return [{
                id: "HQ:0:0",
                kind: "HQ",
                cell: { r: 0, c: 0 },
                capabilities: [],
                trialTraits: null
            }];
        }
    };

    return {
        cells,
        boardDomainAdapter,
        cellResolver: (r, c) => cells.get(`${r}:${c}`) || null
    };
}

function createFirstRunFixture() {
    const board = createBoardFixture();
    const engine = GameEngine.createGame({
        runSeed: 20260924,
        firstRun: true,
        boardDomainAdapter: board.boardDomainAdapter
    });

    engine.state.food = 100;
    engine.state.wood = 80;
    if ("material" in engine.state) engine.state.material = 80;

    const currentMax = engine.defenseSystem.getMaxDefense();
    if (currentMax < 20) {
        engine.defenseSystem.increaseMaxCapacity(20 - currentMax);
    }
    engine.defenseSystem.recoverToMax();
    assert.equal(engine.getTrialAvailableDefense(), 20);

    const controller = new TrialController({
        deploymentService: engine.trialDeploymentService,
        defenseReservation: engine.trialDefenseReservation
    });

    controller.startScenario({
        id: "FIRST_RUN_TRIAL1_RELATIVE_PAYMENT",
        trialIndex: 1,
        availableDefense: engine.getTrialAvailableDefense(),
        mystic: engine.state.mystic,
        enemySuppression: 20,
        routes: [{
            id: "R1",
            strategicSuppression: 20,
            cells: [{ r: 0, c: 4 }]
        }]
    }, {
        cellResolver: board.cellResolver
    });

    return { engine, controller, board };
}

function confirmFullFarPlan(fixture) {
    const drafts = new Map();
    const planned = fixture.controller.setRouteInterceptPlan(
        drafts,
        "R1",
        { r: 0, c: 4 },
        20
    );
    assert.equal(planned.success, true);

    const confirmed = fixture.controller.confirmInterceptionPlan(drafts, {
        allowWarnings: true
    });
    assert.equal(confirmed.success, true);
    assert.equal(confirmed.deploymentPreview?.success, true);
    assert.equal(confirmed.deploymentPreview?.affordable, true);
    return confirmed;
}

console.log("\nFirstRun Trial1 relative payment integration");

{
    const fixture = createFirstRunFixture();
    const { engine, controller } = fixture;

    assert.equal(engine.firstRunState?.active, true);
    assert.equal(engine.trialDeploymentAttachment?.success, true);
    assert.equal(controller.sessionDeploymentService, engine.trialDeploymentService);

    const before = {
        food: engine.state.food,
        material: engine.state.wood,
        defense: engine.getTrialAvailableDefense()
    };

    const confirmed = confirmFullFarPlan(fixture);

    assert.equal(confirmed.deploymentPreview.foodCost, 80);
    assert.equal(confirmed.deploymentPreview.materialCost, 64);
    assert.equal(
        Number(confirmed.deploymentPreview.breakdown.fronts[0].modifiers.burdenShare.toFixed(2)),
        0.80
    );
    assert.deepEqual(
        {
            food: engine.state.food,
            material: engine.state.wood,
            defense: engine.getTrialAvailableDefense()
        },
        before,
        "Preview must be pure"
    );

    const activated = controller.activateInterceptionPlan();
    assert.equal(activated.success, true);
    assert.equal(activated.deploymentCommit?.success, true);
    assert.deepEqual(activated.deploymentCommit?.payment?.paid, {
        food: 80,
        material: 64
    });
    assert.equal(engine.state.food, 20);
    assert.equal(engine.state.wood, 16);
    if ("material" in engine.state) assert.equal(engine.state.material, 16);
    assert.equal(engine.getTrialAvailableDefense(), 0);
    assert.equal(controller.state.human.availableDefense, 0);
    assert.equal(controller.getDeploymentHistory().length, 1);
}

// Preview is evidence, never authority. A live resource mutation between
// confirmation and activation must invalidate the preview before any defense
// or additional resource payment is committed.
{
    const fixture = createFirstRunFixture();
    const { engine, controller } = fixture;
    const confirmed = confirmFullFarPlan(fixture);
    assert.equal(confirmed.deploymentPreview.foodCost, 80);

    engine.state.food -= 1;
    const beforeActivation = {
        food: engine.state.food,
        material: engine.state.wood,
        defense: engine.getTrialAvailableDefense()
    };

    const activated = controller.activateInterceptionPlan();
    assert.equal(activated.success, false);
    assert.equal(
        activated.errors?.includes("STALE_PREVIEW"),
        true,
        JSON.stringify(activated)
    );
    assert.deepEqual(
        {
            food: engine.state.food,
            material: engine.state.wood,
            defense: engine.getTrialAvailableDefense()
        },
        beforeActivation,
        "stale rejection must not partially consume resources or defense"
    );
    assert.equal(controller.state.planActivated, false);
    assert.equal(controller.getDeploymentHistory().length, 0);
}

console.log("✅ FirstRun Trial1 relative payment integration PASS");
