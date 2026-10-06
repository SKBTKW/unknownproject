import assert from "node:assert/strict";
import { RelativeEngagementResolver } from "../game/src/trial/systems/relative_engagement_resolver.js";
import { HumanEngagementOriginResolver } from "../game/src/trial/systems/human_engagement_origin_resolver.js";
import { createTacticRequirement } from "../game/src/trial/domain/tactic_requirement.js";
import { createBattleAction, normalizeBattleActions } from "../game/src/trial/domain/battle_action.js";
import { createBattleContext } from "../game/src/trial/domain/battle_context.js";
import { BattlefieldContextResolver } from "../game/src/trial/systems/battlefield_context_resolver.js";

let cases = 0;
function test(name, fn) {
    fn();
    cases += 1;
    console.log(`PASS ${name}`);
}

test("relative engagement derives enemy-relative front rear and flanks", () => {
    const resolver = new RelativeEngagementResolver();
    const battleLocation = { r: 2, c: 2 };
    const enemyApproach = { r: 2, c: 1 };
    assert.equal(resolver.resolve({ battleLocation, enemyApproach, humanEngagementOrigin: { r: 2, c: 3 } }).relativeEngagement, "FRONT");
    assert.equal(resolver.resolve({ battleLocation, enemyApproach, humanEngagementOrigin: { r: 2, c: 1 } }).relativeEngagement, "REAR");
    assert.equal(resolver.resolve({ battleLocation, enemyApproach, humanEngagementOrigin: { r: 1, c: 2 } }).relativeEngagement, "LEFT_FLANK");
    assert.equal(resolver.resolve({ battleLocation, enemyApproach, humanEngagementOrigin: { r: 3, c: 2 } }).relativeEngagement, "RIGHT_FLANK");
});

test("human origin search stays local and capability-driven", () => {
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

test("tactic requirements describe deployment without deciding balance", () => {
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
    assert.equal(requirements.requiredDeployment.minimumDeployedForce.valueRef, "TACTIC_DEFINED");
    assert.equal(requirements.requiredDeployment.reserveRequired, true);
});

test("battle action remains INTERCEPT compatible and supports multiple future actions", () => {
    const actions = normalizeBattleActions([
        { type: "INTERCEPT", actor: "HUMAN", location: { r: 2, c: 2 } },
        { type: "FLANK_MANEUVER", actor: "HUMAN", origin: { r: 1, c: 2 }, deliveryMethod: "MANEUVER" }
    ]);
    assert.equal(actions.length, 2);
    assert.equal(actions[0].actionId, "battle-action:0");
    assert.equal(actions[0].origin, null);
    assert.equal(actions[0].deliveryMethod, null);
    assert.equal(actions[1].origin.r, 1);
});

test("Battle Context projects optional human origin without changing legacy intercept inputs", () => {
    const legacy = createBattleContext({
        interceptCell: { r: 2, c: 2, placed: true, terrain: { id: "E2_HILL", e: 2, gl: 1 } },
        approachCell: { r: 2, c: 1, placed: true, terrain: { id: "GL1_PLAINS", e: 1, gl: 1 } },
        allocatedDefense: 3,
        baseInterceptionPower: 3,
        enemySuppression: 4
    });
    assert.equal(legacy.humanEngagementOrigin, null);

    const withOrigin = createBattleContext({
        interceptCell: { r: 2, c: 2, placed: true, terrain: { id: "E2_HILL", e: 2, gl: 1 } },
        approachCell: { r: 2, c: 1, placed: true, terrain: { id: "GL1_PLAINS", e: 1, gl: 1 } },
        humanEngagementOrigin: {
            r: 1, c: 2, placed: true,
            terrain: { id: "GL2_FOREST", e: 1, gl: 2 },
            trialEngagementCapabilities: ["LOCAL_ENGAGEMENT_ORIGIN"]
        },
        allocatedDefense: 3,
        baseInterceptionPower: 3,
        enemySuppression: 4
    });
    const projected = new BattlefieldContextResolver().resolve({
        battleContext: withOrigin,
        combatResult: { human: { finalPower: 3 }, enemy: { finalPower: 4 }, prediction: { margin: -1, outcome: "REPEL" } }
    });
    assert.equal(projected.battleLocation.row, 2);
    assert.equal(projected.enemyApproach.column, 1);
    assert.equal(projected.humanEngagementOrigin.row, 1);
    assert.equal(projected.spatialEngagement.relativeEngagement, "LEFT_FLANK");
    assert.equal(projected.battlefieldCapabilities.humanOrigin.capabilities.concealment, "HIGH");
});

console.log(`Trial Spatial Engagement Tactical Foundation: ${cases}/${cases} cases PASS`);
