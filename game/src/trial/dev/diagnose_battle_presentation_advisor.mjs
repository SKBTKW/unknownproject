import assert from "node:assert/strict";
import { BattleNarrativeProjector, BATTLE_PRESENTATION_MODES } from "../presentation/battle_narrative_projector.js";
import { BattlePresentationState } from "../presentation/battle_presentation_state.js";
import { createResolvedBattleDicePresentation } from "../presentation/resolved_battle_dice_presentation.js";
import { TrialBattleAdvisorSemanticProvider, TRIAL_BATTLE_ADVISOR_HOOKS } from "../presentation/trial_battle_advisor_semantic_provider.js";
import { BattleFlavorResolver } from "../presentation/battle_flavor_resolver.js";
import { BattleEpithetResolver } from "../presentation/battle_epithet_resolver.js";

const snapshot = Object.freeze({
    battleId: "B1",
    routeId: "R1",
    actions: Object.freeze([
        Object.freeze({ actionId: "A1", type: "INTERCEPT", actor: "HUMAN_FORCE" })
    ]),
    causes: Object.freeze([
        Object.freeze({
            causeId: "C1",
            type: "MOVEMENT_CONSTRAINED",
            sourceAction: "A1",
            sourceFacts: ["TERRAIN_WETLAND"],
            severity: 2,
            presentationPriority: 20,
            payload: { mobility: "DISADVANTAGE" }
        }),
        Object.freeze({
            causeId: "C2",
            type: "VANGUARD_ISOLATED",
            derivedFrom: ["C1", "K1"],
            severity: 2,
            presentationPriority: 30,
            payload: { formationStretch: true }
        })
    ]),
    causalEvents: Object.freeze([
        Object.freeze({
            eventId: "E1",
            type: "ENEMY_VANGUARD_ISOLATED",
            sourceCauses: ["C2"],
            derivedFrom: ["C1", "K1"],
            severity: 2,
            presentationPriority: 30,
            payload: {}
        })
    ]),
    consequences: Object.freeze([
        Object.freeze({
            consequenceId: "K1",
            type: "SUPPORT_DELAYED",
            sourceCauses: ["C1"],
            resultingState: { supportDelay: "DELAYED" }
        })
    ]),
    battleState: Object.freeze({ supportDelay: "DELAYED", cohesion: "ORDERED" }),
    normalOutcome: Object.freeze({
        outcome: "REPEL",
        battleControl: "REPEL",
        enemyLoss: { suppressionDamage: 45 },
        humanLoss: null,
        reserveState: "HELD_BACK",
        postBattleState: { supportDelay: "DELAYED" }
    }),
    opportunity: Object.freeze({
        opportunityId: "battle-opportunity:B1",
        available: true,
        emberCost: 2,
        commitReady: true,
        declined: false,
        resolved: false
    }),
    emberCommit: Object.freeze({ paidCost: 2, committed: true }),
    fortuneRoll: Object.freeze({ die1: 4, die2: 5, total: 9, result: "NORMAL_OUTCOME_MAINTAINED" }),
    decisiveEvent: null,
    finalCombatResult: Object.freeze({ outcome: "REPEL" }),
    hidden: Object.freeze({
        trueEnemyState: Object.freeze({ reserves: 99 }),
        rngState: "secret"
    }),
    flavorEvents: Object.freeze([
        Object.freeze({ id: "F1", type: "BATTLE_FLAVOR", payload: { key: "FLAG_HELD" }, gameplayImpact: true })
    ]),
    presentationFacts: Object.freeze([
        Object.freeze({ type: "BATTLE_EPITHET", key: "TRIAL_EPITHET_TURNING_POINT" })
    ])
});

const before = JSON.stringify(snapshot);
const projector = new BattleNarrativeProjector();
const projections = Object.values(BATTLE_PRESENTATION_MODES).map(mode => projector.project(snapshot, { mode }));
for (const projection of projections) {
    assert.deepEqual(projection.gameplay.causes, snapshot.causes);
    assert.deepEqual(projection.gameplay.consequences, snapshot.consequences);
    assert.deepEqual(projection.gameplay.normalOutcome, snapshot.normalOutcome);
    assert.deepEqual(projection.gameplay.opportunity, snapshot.opportunity);
    assert.deepEqual(projection.gameplay.fortuneRoll, snapshot.fortuneRoll);
    assert.deepEqual(projection.gameplay.finalCombatResult, snapshot.finalCombatResult);
}
assert.ok(projections[0].events.length >= projections[1].events.length);
assert.ok(projections[1].events.length >= projections[2].events.length);

const full = projections[0].fullTimeline;
const positions = Object.fromEntries(full.filter(row => row.id).map((row, index) => [row.id, index]));
assert.ok(positions.A1 < positions.C1);
assert.ok(positions.C1 < positions.K1);
assert.ok(positions.K1 < positions.C2);
assert.ok(positions.C2 < positions.E1);

const graphById = Object.fromEntries(
    projections[0].causalGraph.map(row => [row.id, row])
);
assert.deepEqual(graphById.C1.whyRefs, ["A1"]);
assert.deepEqual(graphById.K1.whyRefs, ["C1"]);
assert.deepEqual(graphById.C2.whyRefs, ["C1", "K1"]);
assert.deepEqual(graphById.E1.whyRefs, ["C2", "C1", "K1"]);
assert.ok(graphById.A1.leadsToRefs.includes("C1"));
assert.ok(graphById.C1.leadsToRefs.includes("K1"));
assert.ok(graphById.K1.leadsToRefs.includes("C2"));
assert.ok(graphById.C2.leadsToRefs.includes("E1"));

assert.equal(projections[0].highlightedCauses[0].id, "C2");
assert.equal(projections[0].resultSummary.battleControl, "REPEL");
assert.equal(projections[0].chronicleProjection.majorCauseRefs[0], "C2");

const state = new BattlePresentationState();
state.restoreFromSnapshot(snapshot);
assert.equal(state.opportunityPanelOpen, true);
state.advanceNarrative();
state.markSemanticEventEmitted("TRIAL_NORMAL_RESULT:B1");
state.markPresentationPhaseComplete("NORMAL_RESULT");
state.markFlavorViewed("F1");
state.markAdvisorScenePlayed("TRIAL_NORMAL_RESULT", "B1");
const saved = state.serialize();

const restored = new BattlePresentationState();
restored.restoreFromSnapshot(snapshot, saved);
assert.equal(restored.presentationCursor, 1);
assert.equal(restored.markSemanticEventEmitted("TRIAL_NORMAL_RESULT:B1"), false);
assert.equal(restored.markAdvisorScenePlayed("TRIAL_NORMAL_RESULT", "B1"), false);
assert.equal(restored.markFlavorViewed("F1"), false);

const beforeSkip = JSON.stringify(snapshot);
restored.skipToResult();
restored.setFastForward(true);
restored.startReplay();
assert.equal(JSON.stringify(snapshot), beforeSkip);

assert.throws(
    () => restored.bindSnapshot({ battleId: "B2", routeId: "R2" }),
    /BATTLE_PRESENTATION_BATTLE_MISMATCH/
);

const dice = createResolvedBattleDicePresentation(snapshot);
assert.equal(dice.available, true);
assert.deepEqual(dice.result.dice, [4, 5]);
assert.equal(dice.result.total, 9);

const advisor = new TrialBattleAdvisorSemanticProvider();
const publicPayload = advisor.project({
    sceneId: TRIAL_BATTLE_ADVISOR_HOOKS.NORMAL_RESULT,
    snapshot: {
        ...snapshot,
        normalOutcome: {
            ...snapshot.normalOutcome,
            trueEnemyState: { reserves: 3 },
            rngState: "secret"
        }
    }
});
assert.equal(publicPayload.normalOutcome.trueEnemyState, undefined);
assert.equal(publicPayload.normalOutcome.rngState, undefined);
assert.equal(advisor.projectOptional({ sceneId: "UNKNOWN", snapshot }), null);

const flavors = new BattleFlavorResolver().resolve(snapshot);
assert.equal(flavors[0].gameplayImpact, false);
assert.equal(new BattleEpithetResolver().resolve(snapshot), "TRIAL_EPITHET_TURNING_POINT");
assert.equal(JSON.stringify(snapshot), before);

console.log("Battle Presentation / Advisor reconciled focused diagnostic: PASS");
