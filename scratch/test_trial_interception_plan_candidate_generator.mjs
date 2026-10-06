import assert from "node:assert/strict";
import { DeploymentOriginResolver } from "../game/src/trial/domain/deployment_origin_resolver.js";
import { InterceptionPlanCandidateGenerator } from "../game/src/trial/systems/interception_plan_candidate_generator.js";
import { InterceptionPlanCandidateCompactor } from "../game/src/trial/systems/interception_plan_candidate_compactor.js";

let cases = 0;
function test(name, fn) {
    fn();
    cases += 1;
    console.log(`PASS ${name}`);
}

function resolver(origins) {
    return new DeploymentOriginResolver({
        boardQuery: {
            listTrialDeploymentOrigins() {
                return origins;
            }
        }
    });
}

test("generator composes semantic origins and external maneuver proposals", () => {
    const generator = new InterceptionPlanCandidateGenerator({
        deploymentOriginResolver: resolver([{
            originId: "origin:west",
            cell: { r: 4, c: 0 },
            originType: "MILITARY_ORIGIN",
            capabilities: ["MOBILIZATION"],
            infrastructure: ["TRAINED_FORCE_HUB"]
        }]),
        maneuverProvider: {
            listManeuvers() {
                return [{
                    planId: "plan:west-direct",
                    routeRef: "route:external",
                    movementCost: 3,
                    humanEngagementOrigin: { r: 2, c: 1 },
                    initialPositioning: "FRONT",
                    tacticIntent: "DIRECT_INTERCEPTION",
                    requirements: {
                        requiredCapabilities: ["MOBILIZATION"],
                        requiredInfrastructure: ["TRAINED_FORCE_HUB"]
                    }
                }];
            }
        }
    });
    const result = generator.generate({ battleLocation: { r: 2, c: 2 } });
    assert.equal(result.success, true);
    assert.equal(result.candidates.length, 1);
    assert.equal(result.candidates[0].deploymentOrigin.originId, "origin:west");
    assert.equal(result.candidates[0].maneuver.routeRef, "route:external");
    assert.deepEqual(result.candidates[0].humanEngagementOrigin, { r: 2, c: 1, cellId: null });
});

test("generator rejects unmet tactic requirements without deciding tactic success", () => {
    const generator = new InterceptionPlanCandidateGenerator({
        deploymentOriginResolver: resolver([{
            originId: "origin:hq",
            cell: { r: 4, c: 4 },
            originType: "HQ",
            capabilities: ["MOBILIZATION"]
        }]),
        maneuverProvider: {
            listManeuvers() {
                return [{
                    planId: "plan:flank",
                    routeRef: "route:forest",
                    humanEngagementOrigin: { r: 2, c: 1 },
                    initialPositioning: "FRONT",
                    tacticIntent: "FLANKING_MANEUVER",
                    requirements: {
                        requiredCapabilities: ["CONCEALMENT_SUPPORT"]
                    }
                }];
            }
        }
    });
    const result = generator.generate({ battleLocation: { r: 2, c: 2 } });
    assert.equal(result.success, false);
    assert.equal(result.reason, "NO_ELIGIBLE_INTERCEPTION_PLAN");
    assert.equal(result.candidates.length, 0);
    assert.equal(result.rejected.length, 1);
    assert.equal(result.rejected[0].reasons[0].axis, "CAPABILITY");
    assert.equal("outcome" in result, false);
    assert.equal("successChance" in result, false);
});

test("FRONT positioning can coexist with a flanking maneuver intent", () => {
    const generator = new InterceptionPlanCandidateGenerator({
        deploymentOriginResolver: resolver([{
            originId: "origin:west",
            cell: { r: 4, c: 0 },
            originType: "MILITARY_ORIGIN",
            capabilities: ["MOBILITY", "CONCEALMENT_SUPPORT"]
        }]),
        maneuverProvider: {
            listManeuvers() {
                return [{
                    planId: "plan:flank-intent",
                    routeRef: "route:detour",
                    humanEngagementOrigin: { r: 2, c: 1 },
                    initialPositioning: "FRONT",
                    tacticIntent: "FLANKING_MANEUVER",
                    requirements: {
                        requiredCapabilities: ["MOBILITY", "CONCEALMENT_SUPPORT"]
                    }
                }];
            }
        }
    });
    const result = generator.generate({ battleLocation: { r: 2, c: 2 } });
    assert.equal(result.success, true);
    assert.equal(result.candidates[0].initialPositioning, "FRONT");
    assert.equal(result.candidates[0].tacticIntent, "FLANKING_MANEUVER");
});

test("multiple origins may feed different plans without exposing facility IDs", () => {
    const origins = [{
        originId: "origin:hq",
        cell: { r: 4, c: 4 },
        originType: "HQ",
        capabilities: ["MOBILIZATION"]
    }, {
        originId: "origin:west",
        cell: { r: 4, c: 0 },
        originType: "MILITARY_ORIGIN",
        capabilities: ["MOBILIZATION", "CONCEALMENT_SUPPORT"]
    }];
    const generator = new InterceptionPlanCandidateGenerator({
        deploymentOriginResolver: resolver(origins),
        maneuverProvider: {
            listManeuvers({ deploymentOrigin }) {
                if (deploymentOrigin.originId === "origin:hq") return [{
                    planId: "plan:direct",
                    routeRef: "route:hq",
                    humanEngagementOrigin: { r: 3, c: 2 },
                    tacticIntent: "DIRECT_INTERCEPTION",
                    requirements: { requiredCapabilities: ["MOBILIZATION"] }
                }];
                return [{
                    planId: "plan:flank",
                    routeRef: "route:forest",
                    humanEngagementOrigin: { r: 2, c: 1 },
                    tacticIntent: "FLANKING_MANEUVER",
                    requirements: { requiredCapabilities: ["CONCEALMENT_SUPPORT"] }
                }];
            }
        }
    });
    const result = generator.generate({ battleLocation: { r: 2, c: 2 } });
    assert.equal(result.success, true);
    assert.equal(result.candidates.length, 2);
    assert.deepEqual(result.candidates.map(x => x.deploymentOrigin.originId), ["origin:hq", "origin:west"]);
    assert.equal(result.candidates.some(x => x.deploymentOrigin.facilityId !== undefined), false);
});

test("generator delegates route multiplicity compression instead of listing raw paths", () => {
    const generator = new InterceptionPlanCandidateGenerator({
        deploymentOriginResolver: resolver([{
            originId: "origin:west",
            cell: { r: 4, c: 0 },
            originType: "MILITARY_ORIGIN",
            capabilities: ["MOBILIZATION"]
        }]),
        maneuverProvider: {
            listManeuvers() {
                return [
                    { planId: "a", routeRef: "route:a", movementCost: 6, humanEngagementOrigin: { r: 2, c: 1 }, tacticIntent: "DIRECT_INTERCEPTION" },
                    { planId: "b", routeRef: "route:b", movementCost: 3, humanEngagementOrigin: { r: 1, c: 2 }, tacticIntent: "DIRECT_INTERCEPTION" },
                    { planId: "c", routeRef: "route:c", movementCost: 5, humanEngagementOrigin: { r: 2, c: 3 }, tacticIntent: "HIGH_GROUND_DEPLOYMENT" }
                ];
            }
        },
        compactor: new InterceptionPlanCandidateCompactor({
            maxCandidates: 4,
            representativeSelector: ({ alternatives }) =>
                alternatives.reduce((best, row) =>
                    (row.burden.movementCost ?? Infinity) < (best.burden.movementCost ?? Infinity)
                        ? row
                        : best
                )
        })
    });
    const result = generator.generate({ battleLocation: { r: 2, c: 2 } });
    assert.equal(result.sourceCandidateCount, 3);
    assert.equal(result.semanticGroupCount, 2);
    assert.equal(result.candidates.length, 2);
    assert.equal(result.candidates[0].planId, "b");
});

test("missing providers fail closed without touching current Trial runtime", () => {
    const noOrigin = new InterceptionPlanCandidateGenerator({
        maneuverProvider: { listManeuvers() { return []; } }
    }).generate({ battleLocation: { r: 2, c: 2 } });
    assert.equal(noOrigin.success, false);
    assert.equal(noOrigin.reason, "DEPLOYMENT_ORIGIN_RESOLVER_UNAVAILABLE");

    const noManeuver = new InterceptionPlanCandidateGenerator({
        deploymentOriginResolver: resolver([])
    }).generate({ battleLocation: { r: 2, c: 2 } });
    assert.equal(noManeuver.success, false);
    assert.equal(noManeuver.reason, "MANEUVER_PROVIDER_UNAVAILABLE");
});

console.log(`Trial Interception Plan Candidate Generator: ${cases}/${cases} cases PASS`);
