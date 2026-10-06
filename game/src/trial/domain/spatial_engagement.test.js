import test from "node:test";
import assert from "node:assert/strict";
import { RelativeEngagementResolver } from "../systems/relative_engagement_resolver.js";
import { HumanEngagementOriginResolver } from "../systems/human_engagement_origin_resolver.js";
import { createTacticRequirement } from "./tactic_requirement.js";
import { createBattleAction, normalizeBattleActions } from "./battle_action.js";

test("relative engagement derives front, rear and enemy-relative flanks", () => {
    const resolver = new RelativeEngagementResolver();
    const battleLocation = { r: 2, c: 2 };
    const enemyApproach = { r: 2, c: 1 };
    assert.equal(resolver.resolve({ battleLocation, enemyApproach, humanEngagementOrigin: { r: 2, c: 3 } }).relativeEngagement, "FRONT");
    assert.equal(resolver.resolve({ battleLocation, enemyApproach, humanEngagementOrigin: { r: 2, c: 1 } }).relativeEngagement, "REAR");
    assert.equal(resolver.resolve({ battleLocation, enemyApproach, humanEngagementOrigin: { r: 1, c: 2 } }).relativeEngagement, "LEFT_FLANK");
    assert.equal(resolver.resolve({ battleLocation, enemyApproach, humanEngagementOrigin: { r: 3, c: 2 } }).relativeEngagement, "RIGHT_FLANK");
});

test("origin discovery is local and semantic, with extension hooks", () => {
    const cells = new Map([
        ["1:2", { r: 1, c: 2, trialEngagementCapabilities: ["LOCAL_ENGAGEMENT_ORIGIN"] }],
        ["2:3", { r: 2, c: 3, trialEngagementOrigin: { capabilities: ["PROJECTILE_DELIVERY"] } }],
        ["4:4", { r: 4, c: 4, trialEngagementCapabilities: ["SHOULD_NOT_SCAN"] }]
    ]);
    const resolver = new HumanEngagementOriginResolver({
        cellResolver: (r, c) => cells.get(`${r}:${c}`) || null,
        linkedOriginResolver: () => [{ r: 0, c: 0, trialEngagementCapabilities: ["LINKED_MILITARY_ORIGIN"] }]
    });
    const result = resolver.resolveCandidates({ battleLocation: { r: 2, c: 2 } });
    assert.equal(result.success, true);
    assert.deepEqual(result.candidates.map(row => `${row.cell.r}:${row.cell.c}`).sort(), ["0:0", "1:2", "2:3"]);
    assert.equal(result.candidates.some(row => row.cell.r === 4 && row.cell.c === 4), false);
});

test("tactic requirements and battle actions stay declarative and multi-action capable", () => {
    const requirements = createTacticRequirement({
        requiredContext: ["FLANK_POSITION_AVAILABLE"],
        requiredCapabilities: ["CONCEALMENT"],
        requiredDeployment: {
            minimumDeployedForce: { comparator: "AT_LEAST", valueRef: "TACTIC_DEFINED" },
            reserveRequired: true,
            secondaryForceRequired: true,
            capabilityForceRequirements: [{ capability: "PROJECTILE_DELIVERY", scaleRef: "TACTIC_DEFINED" }]
        },
        requiredStates: ["ENEMY_AWARENESS_NOT_CONFIRMED"],
        requiredInfrastructure: ["ENGAGEMENT_ORIGIN"],
        requiredTiming: ["BEFORE_CONTACT"]
    });
    const actions = normalizeBattleActions([
        { type: "INTERCEPT", actor: "HUMAN", location: { r: 2, c: 2 } },
        { type: "FLANK_MANEUVER", actor: "HUMAN", origin: { r: 1, c: 2 }, requirements }
    ]);
    assert.equal(actions.length, 2);
    assert.equal(actions[0].actionId, "battle-action:0");
    assert.equal(actions[1].origin.r, 1);
    assert.equal(requirements.requiredDeployment.reserveRequired, true);

    const intercept = createBattleAction({ type: "INTERCEPT", actor: "HUMAN", location: { r: 2, c: 2 } });
    assert.equal(intercept.origin, null);
    assert.equal(intercept.deliveryMethod, null);
});
