import assert from "node:assert/strict";
import { BattlePresentationRuntimeBridge } from "../game/src/trial/presentation/battle_presentation_runtime_bridge.js";
import { TRIAL_BATTLE_ADVISOR_HOOKS } from "../game/src/trial/presentation/trial_battle_advisor_semantic_provider.js";

const snapshot = Object.freeze({
    battleId: "B1",
    routeId: "R1",
    actions: Object.freeze([
        Object.freeze({ actionId: "A1", type: "INTERCEPT", actor: "HUMAN", target: "ENEMY_FORCE" })
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
        })
    ]),
    causalEvents: Object.freeze([]),
    consequences: Object.freeze([
        Object.freeze({
            consequenceId: "K1",
            type: "SUPPORT_DELAYED",
            sourceCauses: ["C1"],
            sourceFacts: ["TERRAIN_WETLAND"],
            sourceAction: "A1",
            resultingState: { supportDelay: "DELAYED" },
            presentationPriority: 20
        })
    ]),
    battleState: Object.freeze({ mobility: "CONSTRAINED", supportDelay: "DELAYED" }),
    normalOutcome: Object.freeze({
        outcome: "REPEL",
        battleControl: "REPEL",
        damageToSuppression: 40,
        trueEnemyState: { hidden: true },
        rngState: "secret"
    }),
    opportunity: Object.freeze({
        opportunityId: "battle-opportunity:B1",
        available: true,
        declined: false,
        resolved: false
    }),
    fortuneRoll: null,
    decisiveEvent: null,
    finalCombatResult: null,
    flavorEvents: Object.freeze([]),
    presentationFacts: Object.freeze([])
});

const before = JSON.stringify(snapshot);
const bridge = new BattlePresentationRuntimeBridge();

const projected = bridge.project(snapshot);
assert.equal(projected.available, true);
assert.equal(projected.battleId, "B1");
assert.equal(projected.routeId, "R1");
assert.equal(projected.narrative.causalGraph.some(row => row.id === "A1"), true);
assert.equal(projected.narrative.causalGraph.some(row => row.id === "C1"), true);
assert.equal(projected.narrative.causalGraph.some(row => row.id === "K1"), true);
assert.equal(projected.presentationState.opportunityPanelOpen, true);
assert.equal(JSON.stringify(snapshot), before);

const firstAdvisor = bridge.projectAdvisorScene(snapshot, {
    sceneId: TRIAL_BATTLE_ADVISOR_HOOKS.NORMAL_RESULT
});
assert.equal(firstAdvisor.shouldEmit, true);
assert.equal(firstAdvisor.semantic.normalOutcome.trueEnemyState, undefined);
assert.equal(firstAdvisor.semantic.normalOutcome.rngState, undefined);

const duplicateAdvisor = bridge.projectAdvisorScene(snapshot, {
    sceneId: TRIAL_BATTLE_ADVISOR_HOOKS.NORMAL_RESULT,
    savedPresentationState: firstAdvisor.presentationState
});
assert.equal(duplicateAdvisor.shouldEmit, false);

const replayAdvisor = bridge.projectAdvisorScene(snapshot, {
    sceneId: TRIAL_BATTLE_ADVISOR_HOOKS.NORMAL_RESULT,
    savedPresentationState: firstAdvisor.presentationState,
    replay: true
});
assert.equal(replayAdvisor.shouldEmit, true);

const restored = bridge.project(snapshot, {
    savedPresentationState: {
        ...projected.presentationState,
        presentationCursor: 2,
        acknowledgedOpportunity: true
    }
});
assert.equal(restored.presentationState.presentationCursor, 2);
assert.equal(restored.presentationState.opportunityPanelOpen, false);

const unavailable = bridge.project(null);
assert.equal(unavailable.available, false);
assert.equal(JSON.stringify(snapshot), before);

console.log("✅ Battle Presentation runtime bridge focused test PASS");
