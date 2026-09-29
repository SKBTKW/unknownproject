import assert from "node:assert/strict";
import { BattleNarrativeProjector, BATTLE_PRESENTATION_MODES } from "../presentation/battle_narrative_projector.js";
import { BattlePresentationState } from "../presentation/battle_presentation_state.js";
import { createResolvedBattleDicePresentation } from "../presentation/resolved_battle_dice_presentation.js";
import { TrialBattleAdvisorSemanticProvider, TRIAL_BATTLE_ADVISOR_HOOKS } from "../presentation/trial_battle_advisor_semantic_provider.js";
import { BattleFlavorResolver } from "../presentation/battle_flavor_resolver.js";
import { BattleEpithetResolver } from "../presentation/battle_epithet_resolver.js";

const snapshot = Object.freeze({
    battleId: "B1",
    causalEvents: Object.freeze([
        Object.freeze({ type: "ENEMY_DEPLOYMENT_DELAYED", importance: 90, payload: { terrain: "WETLAND" } }),
        Object.freeze({ type: "LOCAL_SUPERIORITY_ESTABLISHED", importance: 80, payload: { side: "HUMAN" } }),
        Object.freeze({ type: "ENEMY_LINE_DISRUPTED", importance: 70, payload: {} })
    ]),
    normalOutcome: Object.freeze({ outcome: "HUMAN_ADVANTAGE" }),
    opportunity: Object.freeze({ status: "OPPORTUNITY_PENDING" }),
    emberCommit: Object.freeze({ amount: 2 }),
    fortuneRoll: Object.freeze({ die1: 4, die2: 5, total: 9, outcome: "SUCCESS" }),
    decisiveEvent: Object.freeze({ type: "BREAKTHROUGH" }),
    finalCombatResult: Object.freeze({ outcome: "VICTORY" }),
    hidden: Object.freeze({
        trueEnemyState: Object.freeze({ reserves: 99 }),
        rngState: "secret"
    }),
    flavorEvents: Object.freeze([
        Object.freeze({ id: "F1", type: "BATTLE_FLAVOR", payload: { key: "FLAG_HELD" }, gameplayImpact: true })
    ]),
    resultEpithetKey: "TRIAL_EPITHET_TURNING_POINT"
});

const before = JSON.stringify(snapshot);
const projector = new BattleNarrativeProjector();
const projections = Object.values(BATTLE_PRESENTATION_MODES).map(mode => projector.project(snapshot, { mode }));
for (const projection of projections) {
    assert.deepEqual(projection.gameplay.finalCombatResult, snapshot.finalCombatResult);
    assert.deepEqual(projection.gameplay.fortuneRoll, snapshot.fortuneRoll);
}
assert.ok(projections[0].events.length >= projections[1].events.length);
assert.ok(projections[1].events.length >= projections[2].events.length);

const state = new BattlePresentationState();
state.restoreFromSnapshot(snapshot);
assert.equal(state.opportunityPanelOpen, true);
state.closeOpportunityPanel();
assert.equal(snapshot.opportunity.status, "OPPORTUNITY_PENDING");
state.skipToResult();
assert.equal(JSON.stringify(snapshot), before);
state.startReplay();
assert.equal(state.markAdvisorScenePlayed("X", "1"), true);
assert.equal(state.markAdvisorScenePlayed("X", "1"), false);

const dice = createResolvedBattleDicePresentation(snapshot);
assert.equal(dice.available, true);
assert.deepEqual(dice.result.dice, [4, 5]);
assert.equal(dice.result.total, 9);

const advisor = new TrialBattleAdvisorSemanticProvider();
const publicPayload = advisor.project({
    sceneId: TRIAL_BATTLE_ADVISOR_HOOKS.DECISIVE_RESULT,
    snapshot: {
        ...snapshot,
        finalCombatResult: { outcome: "VICTORY", trueEnemyState: { reserves: 3 }, rngState: "secret" }
    }
});
assert.equal(publicPayload.finalCombatResult.trueEnemyState, undefined);
assert.equal(publicPayload.finalCombatResult.rngState, undefined);

const flavors = new BattleFlavorResolver().resolve(snapshot);
assert.equal(flavors[0].gameplayImpact, false);
assert.equal(new BattleEpithetResolver().resolve(snapshot), "TRIAL_EPITHET_TURNING_POINT");
assert.equal(JSON.stringify(snapshot), before);

console.log("Battle Presentation / Advisor focused diagnostic: PASS");
