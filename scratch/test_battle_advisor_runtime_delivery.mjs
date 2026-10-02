import assert from "node:assert/strict";
import { ADVISOR_SCENES, ADVISOR_EXPRESSIONS } from "../game/src/data/advisor_scene_catalog.js";
import { BattleAdvisorReactionProjector } from "../game/src/trial/presentation/battle_advisor_reaction_projector.js";
import { BattleAdvisorRuntimeDelivery } from "../game/src/trial/presentation/battle_advisor_runtime_delivery.js";
import { TRIAL_BATTLE_ADVISOR_HOOKS } from "../game/src/trial/presentation/trial_battle_advisor_semantic_provider.js";

const projector = new BattleAdvisorReactionProjector();
const semantic = Object.freeze({
    sceneId: ADVISOR_SCENES.TRIAL_NORMAL_RESULT,
    battleId: "B1",
    routeId: "R1",
    normalOutcome: Object.freeze({ outcome: "REPEL" }),
    finalCombatResult: null
});

const silentCharacter = Object.freeze({
    id: "silent",
    reactions: Object.freeze({})
});
assert.equal(
    projector.project({ semantic, character: silentCharacter }),
    null,
    "missing character reaction data must remain intentional silence"
);

const reactiveCharacter = Object.freeze({
    id: "test-advisor",
    reactions: Object.freeze({
        [ADVISOR_SCENES.TRIAL_NORMAL_RESULT]: Object.freeze({
            expression: ADVISOR_EXPRESSIONS.ATTENTIVE,
            lines: Object.freeze(["戦闘結果を確認しました。"]),
            priority: 91
        })
    })
});
const projected = projector.project({ semantic, character: reactiveCharacter });
assert.equal(projected.characterId, "test-advisor");
assert.equal(projected.scene, ADVISOR_SCENES.TRIAL_NORMAL_RESULT);
assert.equal(projected.line, "戦闘結果を確認しました。");
assert.equal(projected.expression, ADVISOR_EXPRESSIONS.ATTENTIVE);
assert.equal(projected.priority, 91);
assert.equal(projected.payload, semantic);

assert.equal(
    projector.project({
        semantic: { sceneId: ADVISOR_SCENES.FIRST_RUN_TRIAL_ROUTE },
        character: reactiveCharacter
    }),
    null,
    "DUTY scenes must not be reinterpreted as Battle reactions"
);

const snapshot = Object.freeze({
    battleId: "B1",
    routeId: "R1",
    actions: Object.freeze([]),
    causes: Object.freeze([]),
    causalEvents: Object.freeze([]),
    consequences: Object.freeze([]),
    battleState: Object.freeze({}),
    normalOutcome: Object.freeze({
        outcome: "REPEL",
        trueEnemyState: Object.freeze({ reserve: 99 }),
        rngState: "SECRET"
    }),
    opportunity: null,
    emberCommit: null,
    fortuneRoll: null,
    decisiveEvent: null,
    finalCombatResult: null,
    presentationFacts: Object.freeze([]),
    flavorEvents: Object.freeze([])
});

const emitted = [];
let enabled = true;
const delivery = new BattleAdvisorRuntimeDelivery({
    dialogueSystem: {
        emitPresentation(presentation) {
            emitted.push(presentation);
            return true;
        }
    },
    characterProvider: () => reactiveCharacter,
    enabledProvider: () => enabled
});

const first = delivery.present(snapshot, {
    sceneId: TRIAL_BATTLE_ADVISOR_HOOKS.NORMAL_RESULT
});
assert.equal(first.emitted, true);
assert.equal(emitted.length, 1);
assert.equal(emitted[0].scene, ADVISOR_SCENES.TRIAL_NORMAL_RESULT);
assert.equal(emitted[0].payload.normalOutcome.trueEnemyState, undefined);
assert.equal(emitted[0].payload.normalOutcome.rngState, undefined);

const duplicate = delivery.present(snapshot, {
    sceneId: TRIAL_BATTLE_ADVISOR_HOOKS.NORMAL_RESULT,
    savedPresentationState: first.presentationState
});
assert.equal(duplicate.emitted, false);
assert.equal(duplicate.reason, "ALREADY_PRESENTED");
assert.equal(emitted.length, 1);

enabled = false;
const disabled = delivery.present(snapshot, {
    sceneId: TRIAL_BATTLE_ADVISOR_HOOKS.NORMAL_RESULT,
    dedupeKey: "disabled"
});
assert.equal(disabled.emitted, false);
assert.equal(disabled.reason, "ADVISOR_DISABLED");
assert.equal(emitted.length, 1);

const silentDelivery = new BattleAdvisorRuntimeDelivery({
    dialogueSystem: {
        emitPresentation() {
            throw new Error("MUST_NOT_BE_CALLED");
        }
    },
    characterProvider: () => silentCharacter,
    enabledProvider: () => true
});
const silent = silentDelivery.present(snapshot, {
    sceneId: TRIAL_BATTLE_ADVISOR_HOOKS.NORMAL_RESULT,
    dedupeKey: "silent"
});
assert.equal(silent.emitted, false);
assert.equal(silent.reason, "ADVISOR_PRESENTATION_REJECTED");

const brokenDelivery = new BattleAdvisorRuntimeDelivery({
    dialogueSystem: {
        emitPresentation() {
            throw new Error("UI_FAILURE");
        }
    },
    characterProvider: () => reactiveCharacter,
    enabledProvider: () => true
});
const failed = brokenDelivery.present(snapshot, {
    sceneId: TRIAL_BATTLE_ADVISOR_HOOKS.NORMAL_RESULT,
    dedupeKey: "failure"
});
assert.equal(failed.emitted, false);
assert.equal(failed.reason, "ADVISOR_PRESENTATION_FAILED");

console.log("✅ Battle Advisor runtime delivery focused test PASS");
