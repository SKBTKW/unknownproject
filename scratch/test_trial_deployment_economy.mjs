import assert from "node:assert/strict";
import { TrialController } from "../game/src/trial/flow/trial_controller.js";
import { TrialDeploymentCostPolicy } from "../game/src/trial/domain/trial_deployment_cost_policy.js";
import { DeploymentOriginResolver } from "../game/src/trial/domain/deployment_origin_resolver.js";
import { TrialDeploymentService } from "../game/src/trial/systems/trial_deployment_service.js";
import { TrialResourcePayment } from "../game/src/trial/systems/trial_resource_payment.js";

function createFixture({ food = 30, material = 30, defense = 10 } = {}) {
    const resources = { food, wood: material, material };
    const cells = new Map([
        ["0:0", { r: 0, c: 0, placed: true, isHQ: true, terrain: { terrainId: "HQ", e: 0, gl: 0 } }],
        ["0:1", { r: 0, c: 1, placed: true, isHQ: false, terrain: { terrainId: "E1_PLAINS", e: 1, gl: 0 } }],
        ["0:2", { r: 0, c: 2, placed: true, isHQ: false, terrain: { terrainId: "E2_HILL", e: 2, gl: 0 } }]
    ]);
    const boardFacts = new Map([
        ["0:1", {
            cell: { r: 0, c: 1 },
            placed: true,
            isHQ: false,
            terrain: { terrainId: "E1_PLAINS", elevation: 1, growthLevel: 0 },
            capabilities: [],
            trialTraits: null,
            damaged: false
        }],
        ["0:2", {
            cell: { r: 0, c: 2 },
            placed: true,
            isHQ: false,
            terrain: { terrainId: "E2_HILL", elevation: 2, growthLevel: 0 },
            capabilities: ["DEFENSE_ANCHOR"],
            trialTraits: { fieldwork: true },
            damaged: false
        }]
    ]);

    const boardQuery = {
        readTrialDeploymentFacts(target) {
            return boardFacts.get(`${target.r}:${target.c}`) || null;
        },
        listTrialDeploymentOrigins() {
            return [{ id: "HQ:0:0", kind: "HQ", cell: { r: 0, c: 0 }, capabilities: [], trialTraits: null }];
        }
    };

    const payment = new TrialResourcePayment({ state: resources });
    const originResolver = new DeploymentOriginResolver({
        boardQuery,
        distanceResolver: ({ origin, target }) => (
            Math.abs(origin.cell.r - target.r) + Math.abs(origin.cell.c - target.c)
        )
    });
    const costPolicy = new TrialDeploymentCostPolicy({
        costResolver: ({ requestedDefense, distance, boardFacts: facts, frontCount, redeployment }) => ({
            food: requestedDefense + distance + Math.max(0, frontCount - 1) + (redeployment ? 1 : 0),
            material: Math.max(0, Number(facts.terrain?.elevation) || 0)
                + (facts.capabilities.includes("DEFENSE_ANCHOR") ? 0 : 1),
            breakdown: {
                logistics: { requestedDefense, distance, frontCount, redeployment },
                fieldwork: {
                    elevation: facts.terrain?.elevation || 0,
                    defenseAnchor: facts.capabilities.includes("DEFENSE_ANCHOR")
                }
            }
        })
    });
    const deploymentService = new TrialDeploymentService({
        boardQuery,
        costPolicy,
        originResolver,
        resourcePayment: payment
    });
    const controller = new TrialController({ deploymentService });
    controller.startScenario({
        id: "DEPLOYMENT_TEST",
        availableDefense: defense,
        enemySuppression: 10,
        routes: [{
            id: "R1",
            cells: [{ r: 0, c: 2 }, { r: 0, c: 1 }],
            strategicSuppression: 10
        }]
    }, {
        cellResolver: (r, c) => cells.get(`${r}:${c}`) || null
    });

    return { resources, cells, boardFacts, boardQuery, payment, originResolver, costPolicy, deploymentService, controller };
}

function confirmPlan(fixture, { cell = { r: 0, c: 2 }, defense = 4 } = {}) {
    const drafts = new Map();
    const planned = fixture.controller.setRouteInterceptPlan(drafts, "R1", cell, defense);
    assert.equal(planned.success, true);
    const confirmed = fixture.controller.confirmInterceptionPlan(drafts, { allowWarnings: true });
    assert.equal(confirmed.success, true);
    return confirmed;
}

{
    const f = createFixture();
    const before = { ...f.resources };
    const confirmed = confirmPlan(f);
    assert.equal(confirmed.deploymentPreview.success, true);
    assert.equal(f.resources.food, before.food, "preview must not spend food");
    assert.equal(f.resources.wood, before.wood, "preview must not spend material");

    const activated = f.controller.activateInterceptionPlan();
    assert.equal(activated.success, true);
    assert.equal(f.resources.food, before.food - confirmed.deploymentPreview.foodCost);
    assert.equal(f.resources.wood, before.wood - confirmed.deploymentPreview.materialCost);
    assert.equal(f.controller.state.human.availableDefense, 6);
    assert.equal(f.controller.getDeploymentHistory().length, 1);

    const second = f.controller.activateInterceptionPlan();
    assert.equal(second.success, false, "same plan cannot commit twice");
}

{
    const f = createFixture({ food: 0, material: 30 });
    const confirmed = confirmPlan(f);
    const before = { ...f.resources };
    const defenseBefore = f.controller.state.human.availableDefense;
    assert.equal(confirmed.deploymentPreview.affordable, false);
    const activated = f.controller.activateInterceptionPlan();
    assert.equal(activated.success, false);
    assert.deepEqual(f.resources, before, "food failure must be atomic");
    assert.equal(f.controller.state.human.availableDefense, defenseBefore);
    assert.equal(f.controller.state.planActivated, false);
}

{
    const f = createFixture({ food: 30, material: 0 });
    confirmPlan(f);
    const before = { ...f.resources };
    const defenseBefore = f.controller.state.human.availableDefense;
    const activated = f.controller.activateInterceptionPlan();
    assert.equal(activated.success, false);
    assert.deepEqual(f.resources, before, "material failure must be atomic");
    assert.equal(f.controller.state.human.availableDefense, defenseBefore);
    assert.equal(f.controller.state.planActivated, false);
}

{
    const f = createFixture();
    confirmPlan(f, { defense: 8 });
    const before = { ...f.resources };
    f.controller.state.human.availableDefense = 3;
    const activated = f.controller.activateInterceptionPlan();
    assert.equal(activated.success, false);
    assert.deepEqual(f.resources, before, "defense failure must not consume ordinary resources");
    assert.equal(f.controller.state.planActivated, false);
}

{
    const f = createFixture();
    const confirmed = confirmPlan(f);
    const beforeDefense = f.controller.state.human.availableDefense;
    f.resources.food -= 1;
    const beforeCommit = { ...f.resources };
    const activated = f.controller.activateInterceptionPlan();
    assert.equal(activated.success, false);
    assert.equal(activated.errors.includes("STALE_PREVIEW"), true);
    assert.deepEqual(f.resources, beforeCommit);
    assert.equal(f.controller.state.human.availableDefense, beforeDefense);
    assert.equal(f.controller.state.planActivated, false);
    assert.equal(confirmed.deploymentPreview.success, true);
}

{
    const f = createFixture();
    confirmPlan(f);
    f.boardFacts.set("0:2", {
        ...f.boardFacts.get("0:2"),
        damaged: true
    });
    const before = { ...f.resources };
    const activated = f.controller.activateInterceptionPlan();
    assert.equal(activated.success, false);
    assert.equal(activated.errors.includes("STALE_PREVIEW"), true);
    assert.deepEqual(f.resources, before, "board stale failure must not spend resources");
}

{
    const f = createFixture();
    const drafts = new Map();
    const invalid = f.controller.setRouteInterceptPlan(drafts, "R1", { r: 9, c: 9 }, 2);
    assert.equal(invalid.success, false, "invalid interception point is rejected");
    assert.equal(f.deploymentService.getDeploymentHistory().length, 0);
}

{
    const f = createFixture();
    f.deploymentService.endSession();
    const preview = f.deploymentService.previewAllocation({
        routeId: "R1",
        interceptCell: { r: 0, c: 2 },
        requestedDefense: 2
    });
    assert.equal(preview.success, false);
    assert.equal(preview.reasons.includes("TRIAL_SESSION_INACTIVE"), true);
}

{
    const f = createFixture();
    const beforeRoutes = JSON.stringify(f.controller.state.routes);
    const confirmed = confirmPlan(f);
    assert.equal(confirmed.deploymentPreview.breakdown.fronts[0].modifiers.fieldwork.defenseAnchor, true);
    const activated = f.controller.activateInterceptionPlan();
    assert.equal(activated.success, true);
    assert.equal(JSON.stringify(f.controller.state.routes), beforeRoutes, "enemy route/truth-facing route data must stay unchanged");
}

console.log("test_trial_deployment_economy: PASS");
