import assert from "node:assert/strict";
import { createTacticRequirement } from "../game/src/trial/domain/tactic_requirement.js";
import { TacticRequirementEvaluator } from "../game/src/trial/systems/tactic_requirement_evaluator.js";

let cases = 0;
function test(name, fn) {
    fn();
    cases += 1;
    console.log(`PASS ${name}`);
}

const evaluator = new TacticRequirementEvaluator();

test("all declared semantic axes can satisfy eligibility without tactic success semantics", () => {
    const requirement = createTacticRequirement({
        requiredContext: ["ROUGH_TERRAIN"],
        requiredCapabilities: ["RAPID_DEPLOYMENT"],
        requiredDeployment: { originType: "MILITARY_ORIGIN", posture: "MOBILE" },
        requiredStates: ["ENEMY_FIXED"],
        requiredInfrastructure: ["TRAINED_FORCE_HUB"],
        requiredTiming: ["CONTACT_WINDOW"]
    });
    const result = evaluator.evaluate({
        requirement,
        context: ["ROUGH_TERRAIN", "CONCEALMENT_AVAILABLE"],
        capabilities: ["RAPID_DEPLOYMENT", "MOBILIZATION"],
        deployment: { originType: "MILITARY_ORIGIN", posture: "MOBILE" },
        states: ["ENEMY_FIXED"],
        infrastructure: ["TRAINED_FORCE_HUB"],
        timing: ["CONTACT_WINDOW"]
    });
    assert.equal(result.eligible, true);
    assert.deepEqual(result.reasons, []);
    assert.equal("success" in result, false);
    assert.equal("outcome" in result, false);
});

test("missing axes are reported independently instead of collapsed into a score", () => {
    const requirement = createTacticRequirement({
        requiredCapabilities: ["MOBILITY", "CONCEALMENT_SUPPORT"],
        requiredInfrastructure: ["TRAINED_FORCE_HUB"],
        requiredTiming: ["BEFORE_ENEMY_REORIENTS"]
    });
    const result = evaluator.evaluate({
        requirement,
        capabilities: ["MOBILITY"],
        infrastructure: [],
        timing: []
    });
    assert.equal(result.eligible, false);
    assert.deepEqual(result.reasons.map(row => row.axis), [
        "CAPABILITY",
        "INFRASTRUCTURE",
        "TIMING"
    ]);
    assert.equal(result.reasons.some(row => row.axis === "SCORE"), false);
});

test("FRONT can remain valid context while a maneuver intent requests other requirements", () => {
    const requirement = createTacticRequirement({
        requiredContext: ["INITIAL_FRONT"],
        requiredCapabilities: ["MOBILITY"],
        requiredStates: ["ENEMY_ATTENTION_FIXED"]
    });
    const result = evaluator.evaluate({
        requirement,
        context: ["INITIAL_FRONT"],
        capabilities: ["MOBILITY"],
        states: ["ENEMY_ATTENTION_FIXED"]
    });
    assert.equal(result.eligible, true);
});

test("deployment requirements are semantic and need no facility ID", () => {
    const requirement = createTacticRequirement({
        requiredDeployment: {
            originType: "MILITARY_ORIGIN",
            capabilities: ["MOBILIZATION"]
        }
    });
    const result = evaluator.evaluate({
        requirement,
        deployment: {
            originType: "MILITARY_ORIGIN",
            capabilities: ["MOBILIZATION", "RAPID_DEPLOYMENT"]
        }
    });
    assert.equal(result.eligible, true);
    assert.equal(result.reasons.length, 0);
});

test("nested deployment mismatches remain explicit and fail closed", () => {
    const requirement = createTacticRequirement({
        requiredDeployment: {
            route: { concealment: "AVAILABLE", arrival: "ON_TIME" }
        }
    });
    const result = evaluator.evaluate({
        requirement,
        deployment: {
            route: { concealment: "AVAILABLE", arrival: "LATE" }
        }
    });
    assert.equal(result.eligible, false);
    assert.equal(result.reasons[0].axis, "DEPLOYMENT");
});

console.log(`Trial Tactic Requirement Evaluator: ${cases}/${cases} cases PASS`);
