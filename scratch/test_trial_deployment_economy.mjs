import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { TrialController } from "../game/src/trial/flow/trial_controller.js";
import { TrialDeploymentCostPolicy } from "../game/src/trial/domain/trial_deployment_cost_policy.js";
import { DeploymentOriginResolver } from "../game/src/trial/domain/deployment_origin_resolver.js";
import { TrialDeploymentService } from "../game/src/trial/systems/trial_deployment_service.js";
import { TrialResourcePayment } from "../game/src/trial/systems/trial_resource_payment.js";

function createFixture({
    food = 30,
    material = 30,
    defense = 10,
    mystic = 4,
    includeReinforcementOrigin = false
} = {}) {
    const resources = { food, wood: material, material, mystic };
    const cells = new Map([
        ["0:0", { r: 0, c: 0, placed: true, isHQ: true, terrain: { terrainId: "HQ", e: 0, gl: 0 } }],
        ["0:1", { r: 0, c: 1, placed: true, isHQ: false, terrain: { terrainId: "E1_PLAINS", e: 1, gl: 0 } }],
        ["0:2", { r: 0, c: 2, placed: true, isHQ: false, terrain: { terrainId: "E2_HILL", e: 2, gl: 0 } }],
        ["1:0", { r: 1, c: 0, placed: true, isHQ: false, terrain: { terrainId: "E1_PLAINS", e: 1, gl: 0 } }],
        ["1:1", { r: 1, c: 1, placed: true, isHQ: false, terrain: { terrainId: "E1_PLAINS", e: 1, gl: 0 } }],
        ["1:2", { r: 1, c: 2, placed: true, isHQ: false, terrain: { terrainId: "E2_HILL", e: 2, gl: 0 } }]
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
        }],
        ["1:1", {
            cell: { r: 1, c: 1 },
            placed: true,
            isHQ: false,
            terrain: { terrainId: "E1_PLAINS", elevation: 1, growthLevel: 0 },
            capabilities: [],
            trialTraits: null,
            damaged: false
        }],
        ["1:2", {
            cell: { r: 1, c: 2 },
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
            const origins = [{
                id: "HQ:0:0",
                kind: "HQ",
                cell: { r: 0, c: 0 },
                capabilities: [],
                trialTraits: null
            }];
            if (includeReinforcementOrigin) {
                origins.push({
                    id: "ORIGIN:1:0",
                    kind: "REINFORCEMENT_ORIGIN",
                    cell: { r: 1, c: 0 },
                    capabilities: ["REINFORCEMENT_ORIGIN"],
                    trialTraits: { logisticsFoodDelta: 1, materialSetupDelta: 1 }
                });
            }
            return origins;
        }
    };

    const payment = new TrialResourcePayment({ state: resources });
    const originResolver = new DeploymentOriginResolver({ boardQuery });
    const costPolicy = new TrialDeploymentCostPolicy({
        costResolver: ({ requestedDefense, distance, boardFacts: facts, origin }) => ({
            food: requestedDefense
                + distance
                + Math.max(0, Number(origin?.trialTraits?.logisticsFoodDelta) || 0),
            material: Math.max(0, Number(facts.terrain?.elevation) || 0)
                + (facts.capabilities.includes("DEFENSE_ANCHOR") ? 0 : 2)
                + Math.max(0, Number(origin?.trialTraits?.materialSetupDelta) || 0),
            breakdown: {
                logistics: {
                    requestedDefense,
                    distance,
                    originKind: origin?.kind || null
                },
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
        mystic,
        enemySuppression: 10,
        routes: [
            {
                id: "R1",
                cells: [{ r: 0, c: 2 }, { r: 0, c: 1 }],
                strategicSuppression: 10
            },
            {
                id: "R2",
                cells: [{ r: 1, c: 2 }, { r: 1, c: 1 }],
                strategicSuppression: 10
            }
        ]
    }, {
        cellResolver: (r, c) => cells.get(`${r}:${c}`) || null
    });

    return {
        resources,
        cells,
        boardFacts,
        boardQuery,
        payment,
        originResolver,
        costPolicy,
        deploymentService,
        controller
    };
}

function confirmPlan(fixture, decisions = [{ routeId: "R1", cell: { r: 0, c: 2 }, defense: 4 }]) {
    const drafts = new Map();
    for (const decision of decisions) {
        const planned = fixture.controller.setRouteInterceptPlan(
            drafts,
            decision.routeId,
            decision.cell,
            decision.defense
        );
        assert.equal(planned.success, true);
    }
    const confirmed = fixture.controller.confirmInterceptionPlan(drafts, { allowWarnings: true });
    assert.equal(confirmed.success, true);
    return confirmed;
}

// Preview is pure; Commit spends ordinary resources and reserves defense exactly once.
{
    const f = createFixture();
    const before = { ...f.resources };
    const initialSnapshot = f.deploymentService.getSessionResourceSnapshot();
    assert.deepEqual(initialSnapshot, { food: 30, material: 30, mystic: 4, defense: 10 });

    const confirmed = confirmPlan(f);
    assert.equal(confirmed.deploymentPreview.success, true);
    assert.deepEqual(f.resources, before, "preview must not mutate the Trial resource pool");

    const activated = f.controller.activateInterceptionPlan();
    assert.equal(activated.success, true);
    assert.equal(f.resources.food, before.food - confirmed.deploymentPreview.foodCost);
    assert.equal(f.resources.wood, before.wood - confirmed.deploymentPreview.materialCost);
    assert.equal(f.resources.mystic, before.mystic, "deployment v1 must not infer mystic conversion");
    assert.equal(f.controller.state.human.availableDefense, 6);
    assert.equal(f.controller.getDeploymentHistory().length, 1);
    assert.deepEqual(
        f.deploymentService.getSessionResourceSnapshot(),
        initialSnapshot,
        "entry snapshot is audit-only and does not become a parallel resource SSOT"
    );

    const second = f.controller.activateInterceptionPlan();
    assert.equal(second.success, false, "same deployment plan cannot commit twice");
}

// v1 deployment is fixed after Commit: no redeploy, withdraw, or refund route exists.
{
    const f = createFixture();
    const confirmed = confirmPlan(f);
    const activated = f.controller.activateInterceptionPlan();
    assert.equal(activated.success, true);
    const paidState = { ...f.resources };

    const afterCommitPreview = f.deploymentService.previewAllocation({
        routeId: "R1",
        interceptCell: { r: 0, c: 1 },
        requestedDefense: 1
    });
    assert.equal(afterCommitPreview.success, false);
    assert.equal(afterCommitPreview.reasons.includes("DEPLOYMENT_LOCKED"), true);
    assert.equal(typeof f.deploymentService.redeploy, "undefined");
    assert.equal(typeof f.deploymentService.withdrawDeployment, "undefined");
    assert.equal(typeof f.deploymentService.refundDeployment, "undefined");
    assert.deepEqual(f.resources, paidState, "failed post-commit movement attempt cannot refund payment");
    assert.ok(confirmed.deploymentPreview.foodCost > 0);
}

// Food/material/defense failures are fail-closed and atomic.
{
    const f = createFixture({ food: 0, material: 30 });
    const confirmed = confirmPlan(f);
    const before = { ...f.resources };
    const defenseBefore = f.controller.state.human.availableDefense;
    assert.equal(confirmed.deploymentPreview.affordable, false);
    const activated = f.controller.activateInterceptionPlan();
    assert.equal(activated.success, false);
    assert.deepEqual(f.resources, before);
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
    assert.deepEqual(f.resources, before);
    assert.equal(f.controller.state.human.availableDefense, defenseBefore);
    assert.equal(f.controller.state.planActivated, false);
}
{
    const f = createFixture();
    confirmPlan(f, [{ routeId: "R1", cell: { r: 0, c: 2 }, defense: 8 }]);
    const before = { ...f.resources };
    f.controller.state.human.availableDefense = 3;
    const activated = f.controller.activateInterceptionPlan();
    assert.equal(activated.success, false);
    assert.deepEqual(f.resources, before);
    assert.equal(f.controller.state.planActivated, false);
}

// Commit always revalidates current resource and Board state.
{
    const f = createFixture();
    const confirmed = confirmPlan(f);
    const defenseBefore = f.controller.state.human.availableDefense;
    f.resources.food -= 1;
    const beforeCommit = { ...f.resources };
    const activated = f.controller.activateInterceptionPlan();
    assert.equal(activated.success, false);
    assert.equal(activated.errors.includes("STALE_PREVIEW"), true);
    assert.deepEqual(f.resources, beforeCommit);
    assert.equal(f.controller.state.human.availableDefense, defenseBefore);
    assert.equal(f.controller.state.planActivated, false);
    assert.equal(confirmed.deploymentPreview.success, true);
}
{
    const f = createFixture();
    confirmPlan(f);
    f.boardFacts.set("0:2", { ...f.boardFacts.get("0:2"), damaged: true });
    const before = { ...f.resources };
    const activated = f.controller.activateInterceptionPlan();
    assert.equal(activated.success, false);
    assert.equal(activated.errors.includes("STALE_PREVIEW"), true);
    assert.deepEqual(f.resources, before);
}

// Invalid target and inactive Trial session are rejected.
{
    const f = createFixture();
    const drafts = new Map();
    const invalid = f.controller.setRouteInterceptPlan(drafts, "R1", { r: 9, c: 9 }, 2);
    assert.equal(invalid.success, false);
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

// Multiple fronts are only the sum of independent deployments; no front-count surcharge exists.
{
    const singleA = createFixture();
    const a = singleA.deploymentService.previewAllocation({
        routeId: "R1",
        interceptCell: { r: 0, c: 2 },
        requestedDefense: 2
    });
    const singleB = createFixture();
    const b = singleB.deploymentService.previewAllocation({
        routeId: "R2",
        interceptCell: { r: 1, c: 2 },
        requestedDefense: 2
    });

    const multi = createFixture();
    const confirmed = confirmPlan(multi, [
        { routeId: "R1", cell: { r: 0, c: 2 }, defense: 2 },
        { routeId: "R2", cell: { r: 1, c: 2 }, defense: 2 }
    ]);
    assert.equal(confirmed.deploymentPreview.foodCost, a.foodCost + b.foodCost);
    assert.equal(confirmed.deploymentPreview.materialCost, a.materialCost + b.materialCost);
}

// Semantic REINFORCEMENT_ORIGIN works without Trial knowing any facility identity.
{
    const f = createFixture({ includeReinforcementOrigin: true });
    const preview = f.deploymentService.previewAllocation({
        routeId: "R2",
        interceptCell: { r: 1, c: 1 },
        requestedDefense: 2
    });
    assert.equal(preview.success, true);
    assert.equal(preview.origin.kind, "REINFORCEMENT_ORIGIN");
    assert.equal(preview.origin.id, "ORIGIN:1:0");
    assert.equal(preview.distance, 1, "generic origin -> target Manhattan distance is the v1 fallback");
    assert.equal(preview.breakdown.logistics.originKind, "REINFORCEMENT_ORIGIN");
}

// Requested defense, distance and semantic Board facts produce independent cost differences.
{
    const f = createFixture();
    const hill = f.deploymentService.previewAllocation({
        routeId: "R1",
        interceptCell: { r: 0, c: 2 },
        requestedDefense: 2
    });
    const plains = f.deploymentService.previewAllocation({
        routeId: "R1",
        interceptCell: { r: 0, c: 1 },
        requestedDefense: 3
    });
    assert.notEqual(hill.foodCost, plains.foodCost);
    assert.notEqual(hill.materialCost, plains.materialCost);
    assert.equal(hill.breakdown.fieldwork.defenseAnchor, true);
    assert.equal(plains.breakdown.fieldwork.defenseAnchor, false);
}

// Deployment Economy has no Production or mystic->defense responsibility.
{
    const f = createFixture();
    assert.equal(typeof f.deploymentService.produce, "undefined");
    assert.equal(typeof f.deploymentService.runProduction, "undefined");
    assert.equal(typeof f.deploymentService.convertMysticToDefense, "undefined");
    const initial = f.deploymentService.getSessionResourceSnapshot();
    f.resources.food += 99; // external mutation proves snapshot is audit-only, not a shadow SSOT
    assert.equal(f.deploymentService.getSessionResourceSnapshot().food, initial.food);
    assert.equal(f.payment.readBalances().food, 129, "payments always read current GameState balances");
}

// Enemy route/truth-facing data remains untouched.
{
    const f = createFixture();
    const beforeRoutes = JSON.stringify(f.controller.state.routes);
    confirmPlan(f);
    const activated = f.controller.activateInterceptionPlan();
    assert.equal(activated.success, true);
    assert.equal(JSON.stringify(f.controller.state.routes), beforeRoutes);
}

// Trial Core must not acquire a facility-specific Garrison branch.
{
    const sourcePaths = [
        "game/src/trial/domain/trial_deployment_cost_policy.js",
        "game/src/trial/domain/deployment_origin_resolver.js",
        "game/src/trial/systems/trial_deployment_service.js",
        "game/src/trial/flow/trial_controller_base.js"
    ];
    for (const path of sourcePaths) {
        const source = readFileSync(new URL(`../${path}`, import.meta.url), "utf8");
        assert.equal(/GARRISON/.test(source), false, `${path} must not branch on GARRISON identity`);
        assert.equal(/frontCount/.test(source), false, `${path} must not carry v1 front-count pricing`);
        assert.equal(/redeployment/.test(source), false, `${path} must not carry v1 redeployment pricing`);
    }
}

console.log("test_trial_deployment_economy: PASS");
