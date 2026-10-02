import assert from "node:assert/strict";
import { BattleNarrativeProjector } from "../game/src/trial/presentation/battle_narrative_projector.js";
import { BattleAdvisorPresentationBridge } from "../game/src/trial/presentation/battle_advisor_presentation_bridge.js";
import { TRIAL_BATTLE_ADVISOR_HOOKS } from "../game/src/trial/presentation/trial_battle_advisor_semantic_provider.js";

function baseSnapshot(extra = {}) {
    return Object.freeze({
        battleId: "B-NARRATIVE",
        routeId: "R-1",
        battlefieldContext: Object.freeze({
            contact: Object.freeze({ inventedFromContext: true }),
            terrain: Object.freeze({ id: "E2_HILL" })
        }),
        presentationFacts: Object.freeze([]),
        actions: Object.freeze([
            Object.freeze({ actionId: "A1", type: "INTERCEPT", actor: "HUMAN" })
        ]),
        causes: Object.freeze([
            Object.freeze({
                causeId: "C1",
                type: "TERRAIN_ADVANTAGE",
                sourceAction: "A1",
                presentationPriority: 40,
                severity: "MAJOR",
                payload: Object.freeze({ canonical: true })
            }),
            Object.freeze({
                causeId: "C2",
                type: "LOCAL_SUPERIORITY",
                sourceAction: "A1",
                presentationPriority: 20,
                severity: "NORMAL"
            })
        ]),
        causalEvents: Object.freeze([]),
        consequences: Object.freeze([
            Object.freeze({
                consequenceId: "K1",
                type: "SUPPORT_DELAYED",
                sourceCauses: Object.freeze(["C1"]),
                derivedFrom: Object.freeze(["C1"]),
                resultingState: Object.freeze({ supportDelay: "DELAYED" })
            })
        ]),
        battleState: Object.freeze({ control: "HUMAN" }),
        normalOutcome: Object.freeze({
            outcome: "REPEL",
            battleControl: "REPEL",
            damageToSuppression: 30
        }),
        opportunity: null,
        emberCommit: null,
        fortuneRoll: null,
        decisiveEvent: null,
        finalCombatResult: null,
        flavorEvents: Object.freeze([]),
        finalized: true,
        ...extra
    });
}

const projector = new BattleNarrativeProjector();

const normal = baseSnapshot();
const beforeNormal = JSON.stringify(normal);
const normalProjection = projector.project(normal);
assert.equal(normalProjection.explanation.what.source, "NORMAL_OUTCOME");
assert.deepEqual(normalProjection.explanation.what.result, normal.normalOutcome);
assert.equal(normalProjection.explanation.normalResult.outcome, "REPEL");
assert.equal(normalProjection.explanation.finalResult, null);
assert.equal(normalProjection.explanation.fortune.status, "NONE");
assert.equal(normalProjection.explanation.why[0].causeId, "C1");
assert.equal(normalProjection.explanation.why[0].sourceAction, "A1");
assert.deepEqual(normalProjection.explanation.consequences, normal.consequences);
assert.equal(
    normalProjection.fullTimeline.some(row => row.type === "CONTACT"),
    false,
    "battlefieldContext.contact must not become a narrative fact"
);
assert.equal(JSON.stringify(normal), beforeNormal);

const withCanonicalContact = baseSnapshot({
    presentationFacts: Object.freeze([
        Object.freeze({ type: "BATTLE_CONTACT", direction: "NORTH", certainty: "CONFIRMED" })
    ])
});
const canonicalContactProjection = projector.project(withCanonicalContact);
const contact = canonicalContactProjection.fullTimeline.find(row => row.type === "CONTACT");
assert.ok(contact);
assert.equal(contact.payload.type, "BATTLE_CONTACT");
assert.equal(contact.payload.direction, "NORTH");

const decisive = Object.freeze({
    eventId: "D1",
    type: "BREAKTHROUGH_DENIED",
    sourceCauses: Object.freeze(["C2"]),
    presentationPriority: 1
});
const fortuneSnapshot = baseSnapshot({
    opportunity: Object.freeze({
        opportunityId: "O1",
        state: "AVAILABLE",
        declined: false,
        resolved: true
    }),
    emberCommit: Object.freeze({ committed: true, cost: 2 }),
    fortuneRoll: Object.freeze({ dice: Object.freeze([5, 4]), total: 9, result: "DECISIVE_SUCCESS" }),
    decisiveEvent: decisive,
    finalCombatResult: Object.freeze({ outcome: "DECISIVE_REPEL", suppressionDamage: 50 })
});
const fortuneProjection = projector.project(fortuneSnapshot);
assert.equal(fortuneProjection.explanation.what.source, "FINAL_COMBAT_RESULT");
assert.equal(fortuneProjection.explanation.normalResult.outcome, "REPEL");
assert.equal(fortuneProjection.explanation.finalResult.outcome, "DECISIVE_REPEL");
assert.equal(fortuneProjection.explanation.fortune.status, "RESOLVED");
assert.equal(fortuneProjection.explanation.fortune.roll.total, 9);
assert.deepEqual(
    fortuneProjection.explanation.decisive,
    decisive,
    "B presentation must use canonical decisiveEvent verbatim instead of selecting from highlighted causes"
);
assert.equal(fortuneProjection.explanation.decisive.sourceCauses[0], "C2");
assert.equal(
    fortuneProjection.highlightedCauses[0].id,
    "C1",
    "Cause highlight priority may differ from canonical Decisive Event and must not replace it"
);

const declinedSnapshot = baseSnapshot({
    opportunity: Object.freeze({
        opportunityId: "O2",
        state: "DECLINED",
        declined: true,
        resolved: true
    }),
    finalCombatResult: Object.freeze({ outcome: "REPEL" })
});
const declinedProjection = projector.project(declinedSnapshot);
assert.equal(declinedProjection.explanation.fortune.status, "DECLINED");
assert.equal(declinedProjection.explanation.fortune.roll, null);
assert.equal(declinedProjection.explanation.decisive, null);
assert.equal(declinedProjection.explanation.normalResult.outcome, "REPEL");
assert.equal(declinedProjection.explanation.finalResult.outcome, "REPEL");

let emitted = 0;
const advisor = new BattleAdvisorPresentationBridge({
    enabledProvider: () => true,
    emitSemantic: semantic => {
        emitted += 1;
        assert.equal(semantic.battleId, "B-NARRATIVE");
        return true;
    }
});
const first = advisor.present(normal, {
    sceneId: TRIAL_BATTLE_ADVISOR_HOOKS.NORMAL_RESULT
});
assert.equal(first.emitted, true);
assert.equal(emitted, 1);

const duplicate = advisor.present(normal, {
    sceneId: TRIAL_BATTLE_ADVISOR_HOOKS.NORMAL_RESULT,
    savedPresentationState: first.presentationState
});
assert.equal(duplicate.emitted, false);
assert.equal(duplicate.reason, "ALREADY_PRESENTED");
assert.equal(emitted, 1);

const restoredBridge = new BattleAdvisorPresentationBridge({
    enabledProvider: () => false,
    emitSemantic: () => { throw new Error("MUST_NOT_EMIT"); }
});
const disabled = restoredBridge.present(normal, {
    sceneId: TRIAL_BATTLE_ADVISOR_HOOKS.NORMAL_RESULT
});
assert.equal(disabled.emitted, false);
assert.equal(disabled.reason, "ADVISOR_DISABLED");
const disabledDuplicate = restoredBridge.present(normal, {
    sceneId: TRIAL_BATTLE_ADVISOR_HOOKS.NORMAL_RESULT,
    savedPresentationState: disabled.presentationState
});
assert.equal(disabledDuplicate.reason, "ALREADY_PRESENTED");

const failingAdvisor = new BattleAdvisorPresentationBridge({
    enabledProvider: () => true,
    emitSemantic: () => { throw new Error("PRESENTATION_FAILURE"); }
});
const failed = failingAdvisor.present(fortuneSnapshot, {
    sceneId: TRIAL_BATTLE_ADVISOR_HOOKS.DECISIVE_RESULT
});
assert.equal(failed.emitted, false);
assert.equal(failed.reason, "ADVISOR_PRESENTATION_FAILED");
assert.equal(failed.presentationState.gameplayAdvisorScenesPlayed.length, 1);
const failedDuplicate = failingAdvisor.present(fortuneSnapshot, {
    sceneId: TRIAL_BATTLE_ADVISOR_HOOKS.DECISIVE_RESULT,
    savedPresentationState: failed.presentationState
});
assert.equal(failedDuplicate.reason, "ALREADY_PRESENTED");

const hiddenTruthSnapshot = baseSnapshot({
    normalOutcome: Object.freeze({
        outcome: "REPEL",
        trueEnemyState: Object.freeze({ reserve: 999 }),
        rngState: "SECRET"
    })
});
const sanitized = advisor.present(hiddenTruthSnapshot, {
    sceneId: TRIAL_BATTLE_ADVISOR_HOOKS.NORMAL_RESULT,
    dedupeKey: "hidden"
});
assert.equal(sanitized.semantic.normalOutcome.trueEnemyState, undefined);
assert.equal(sanitized.semantic.normalOutcome.rngState, undefined);

console.log("✅ Battle Narrative / Advisor Presentation v2 focused test PASS");
