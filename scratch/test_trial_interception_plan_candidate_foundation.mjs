import assert from "node:assert/strict";
import {
    createInterceptionPlanCandidate,
    projectInterceptionPlanSelection
} from "../game/src/trial/domain/interception_plan_candidate.js";
import { InterceptionPlanCandidateCompactor } from "../game/src/trial/systems/interception_plan_candidate_compactor.js";

let cases = 0;
function test(name, fn) {
    fn();
    cases += 1;
    console.log(`PASS ${name}`);
}

function candidate(overrides = {}) {
    return createInterceptionPlanCandidate({
        planId: overrides.planId || "plan:front",
        battleLocation: { r: 2, c: 2 },
        deploymentOrigin: overrides.deploymentOrigin || {
            cell: { r: 4, c: 0 },
            originType: "SEMANTIC_DEPLOYMENT_ORIGIN",
            capabilities: ["MOBILIZATION"]
        },
        maneuver: overrides.maneuver || {
            routeRef: "route:semantic-only",
            routeLength: 4,
            movementCost: 3,
            semantics: ["DIRECT_APPROACH"]
        },
        humanEngagementOrigin: overrides.humanEngagementOrigin || { r: 2, c: 1 },
        initialPositioning: overrides.initialPositioning || "FRONT",
        tacticIntent: overrides.tacticIntent || "DIRECT_INTERCEPTION",
        requirements: {
            requiredCapabilities: overrides.requiredCapabilities || ["MOBILIZATION"],
            requiredInfrastructure: overrides.requiredInfrastructure || []
        },
        capabilities: overrides.capabilities || ["MOBILIZATION"],
        infrastructure: overrides.infrastructure || [],
        burden: overrides.burden || { deploymentCost: 1, movementCost: 3 }
    });
}

test("Deployment Origin, engagement origin and battleLocation stay distinct", () => {
    const plan = candidate();
    assert.deepEqual(plan.battleLocation, { r: 2, c: 2, cellId: null });
    assert.deepEqual(plan.humanEngagementOrigin, { r: 2, c: 1, cellId: null });
    assert.deepEqual(plan.deploymentOrigin.cell, { r: 4, c: 0 });
    assert.notDeepEqual(plan.deploymentOrigin.cell, plan.humanEngagementOrigin);
    assert.equal(Object.isFrozen(plan), true);
});

test("tactic intent and initial positioning do not encode tactic success", () => {
    const plan = candidate({
        tacticIntent: "FLANKING_MANEUVER",
        initialPositioning: "FRONT",
        maneuver: {
            routeRef: "route:forest-detour",
            movementCost: 5,
            semantics: ["DETOUR", "CONCEALMENT_SEEKING"]
        }
    });
    assert.equal(plan.tacticIntent, "FLANKING_MANEUVER");
    assert.equal(plan.initialPositioning, "FRONT");
    assert.equal("success" in plan, false);
    assert.equal("outcome" in plan, false);
    assert.equal("tacticSucceeded" in plan, false);
});

test("selection projection is compatible with a future engagement-origin adapter", () => {
    const plan = candidate({
        tacticIntent: "HIGH_GROUND_DEPLOYMENT",
        humanEngagementOrigin: { r: 1, c: 2 },
        initialPositioning: "LEFT_FLANK"
    });
    const projected = projectInterceptionPlanSelection(plan);
    assert.deepEqual(projected.battleLocation, plan.battleLocation);
    assert.deepEqual(projected.humanEngagementOrigin, plan.humanEngagementOrigin);
    assert.deepEqual(projected.deploymentOrigin, plan.deploymentOrigin);
    assert.equal(projected.tacticIntent, "HIGH_GROUND_DEPLOYMENT");
});

test("same tactic intent can compress multiple maneuver alternatives", () => {
    const alternatives = [
        candidate({ planId: "a", tacticIntent: "FLANKING_MANEUVER", burden: { movementCost: 6 } }),
        candidate({ planId: "b", tacticIntent: "FLANKING_MANEUVER", burden: { movementCost: 4 } }),
        candidate({ planId: "c", tacticIntent: "DIRECT_INTERCEPTION", burden: { movementCost: 2 } })
    ];
    const compactor = new InterceptionPlanCandidateCompactor({
        maxCandidates: 4,
        representativeSelector: ({ alternatives: rows }) =>
            rows.reduce((best, row) =>
                (row.burden.movementCost ?? Infinity) < (best.burden.movementCost ?? Infinity)
                    ? row
                    : best
            )
    });
    const compacted = compactor.compact(alternatives);
    assert.equal(compacted.sourceCandidateCount, 3);
    assert.equal(compacted.semanticGroupCount, 2);
    assert.equal(compacted.candidates.length, 2);
    assert.equal(compacted.candidates[0].planId, "b");
    assert.equal(compacted.groups[0].alternativeCount, 2);
});

test("candidate count is capped without inventing a universal success score", () => {
    const rows = [
        candidate({ planId: "a", tacticIntent: "DIRECT_INTERCEPTION" }),
        candidate({ planId: "b", tacticIntent: "FLANKING_MANEUVER" }),
        candidate({ planId: "c", tacticIntent: "HIGH_GROUND_DEPLOYMENT" }),
        candidate({ planId: "d", tacticIntent: "CONCEALED_APPROACH" }),
        candidate({ planId: "e", tacticIntent: "RESERVE_SUPPORT" })
    ];
    const compacted = new InterceptionPlanCandidateCompactor({ maxCandidates: 4 }).compact(rows);
    assert.equal(compacted.candidates.length, 4);
    assert.equal(compacted.omittedSemanticGroups, 1);
    assert.equal(compacted.candidates.some(row => "score" in row), false);
});

test("future military facilities can connect through semantic capabilities only", () => {
    const plan = candidate({
        deploymentOrigin: {
            cell: { r: 4, c: 0 },
            originType: "MILITARY_ORIGIN",
            capabilities: ["MOBILIZATION", "RAPID_DEPLOYMENT"],
            infrastructure: ["TRAINED_FORCE_HUB"]
        },
        requiredCapabilities: ["RAPID_DEPLOYMENT"],
        requiredInfrastructure: ["TRAINED_FORCE_HUB"],
        infrastructure: ["TRAINED_FORCE_HUB"]
    });
    assert.deepEqual(plan.requirements.requiredCapabilities, ["RAPID_DEPLOYMENT"]);
    assert.deepEqual(plan.requirements.requiredInfrastructure, ["TRAINED_FORCE_HUB"]);
    assert.equal(plan.deploymentOrigin.facilityId, undefined);
});

console.log(`Trial Interception Plan Candidate Foundation: ${cases}/${cases} cases PASS`);
