import { POST_TRIAL_STEP_TYPES } from "../systems/post_trial_progression_service.js";

export const POST_TRIAL_INTERLUDE_SCENES = Object.freeze({
    AFTERMATH: "AFTERMATH",
    ASSESSMENT: "ASSESSMENT",
    TRIAL_MEANING: "TRIAL_MEANING",
    REWARD: "REWARD",
    UNLOCK: "UNLOCK",
    STAGE_PRELUDE: "STAGE_PRELUDE",
    STAGE_REVEAL: "STAGE_REVEAL",
    POST_STAGE_COMMENT: "POST_STAGE_COMMENT",
    SKILL: "SKILL",
    FINAL_RUN_COMPLETION: "FINAL_RUN_COMPLETION",
    CLOSE: "CLOSE"
});

export const POST_TRIAL_MEANING_VARIANTS = Object.freeze({
    FIRST: "FIRST",
    CONTINUING: "CONTINUING",
    FINAL: "FINAL"
});

const SYSTEM_FALLBACK_REQUIRED = new Set([
    POST_TRIAL_INTERLUDE_SCENES.AFTERMATH,
    POST_TRIAL_INTERLUDE_SCENES.ASSESSMENT,
    POST_TRIAL_INTERLUDE_SCENES.STAGE_PRELUDE
]);

function resolveMeaningVariant(trialIndex) {
    if (Number(trialIndex) === 1) return POST_TRIAL_MEANING_VARIANTS.FIRST;
    if (Number(trialIndex) === 3) return POST_TRIAL_MEANING_VARIANTS.FINAL;
    return POST_TRIAL_MEANING_VARIANTS.CONTINUING;
}

function createScene(id, {
    trialIndex = null,
    meaningVariant = null,
    opensStageProgressionGate = false,
    boardReveal = false,
    semanticSceneId = null,
    occurrenceOwner = null,
    dedupeKey = null,
    required = false
} = {}) {
    return Object.freeze({
        id,
        trialIndex: Number.isInteger(Number(trialIndex)) ? Number(trialIndex) : null,
        meaningVariant,
        systemFallbackRequired: SYSTEM_FALLBACK_REQUIRED.has(id),
        opensStageProgressionGate,
        boardReveal,
        semanticSceneId,
        occurrenceOwner,
        dedupeKey,
        required: Boolean(required)
    });
}

/**
 * Pure presentation contract for the post-Trial interlude.
 *
 * TRIAL_SURVIVED_* remains an immediate Advisor Reaction emitted directly from
 * the settled Trial result. This sequence begins after that first reaction and
 * never mutates progression state. Stage authorization remains owned by
 * PostTrialProgression / TrialStageProgressionService.
 */
export function buildPostTrialInterludeSceneSequence(readModel = {}, {
    firstRunPolicy = null
} = {}) {
    if (!readModel?.available) return [];

    const trialIndex = Number.isInteger(Number(readModel.trialIndex))
        ? Number(readModel.trialIndex)
        : null;
    const stepTypes = new Set(
        (Array.isArray(readModel.stepTypes) ? readModel.stepTypes : readModel.pendingStepTypes || [])
            .filter(type => typeof type === "string")
    );
    const scenes = [
        createScene(POST_TRIAL_INTERLUDE_SCENES.AFTERMATH, { trialIndex }),
        createScene(POST_TRIAL_INTERLUDE_SCENES.ASSESSMENT, { trialIndex }),
        createScene(POST_TRIAL_INTERLUDE_SCENES.TRIAL_MEANING, {
            trialIndex,
            meaningVariant: resolveMeaningVariant(trialIndex),
            semanticSceneId: firstRunPolicy?.semanticSceneId || null,
            occurrenceOwner: firstRunPolicy?.occurrenceOwner || null,
            dedupeKey: firstRunPolicy?.dedupeKey || null,
            required: firstRunPolicy?.requiredMeaningScene === true
        })
    ];

    if (readModel.runTerminated) {
        scenes.push(createScene(POST_TRIAL_INTERLUDE_SCENES.CLOSE, { trialIndex }));
        return Object.freeze(scenes);
    }

    if (stepTypes.has(POST_TRIAL_STEP_TYPES.REWARD_SELECTION)) {
        scenes.push(createScene(POST_TRIAL_INTERLUDE_SCENES.REWARD, { trialIndex }));
    }
    if (stepTypes.has(POST_TRIAL_STEP_TYPES.UNLOCK_APPLY)) {
        scenes.push(createScene(POST_TRIAL_INTERLUDE_SCENES.UNLOCK, { trialIndex }));
    }
    if (stepTypes.has(POST_TRIAL_STEP_TYPES.STAGE_ADVANCE)) {
        scenes.push(createScene(POST_TRIAL_INTERLUDE_SCENES.STAGE_PRELUDE, {
            trialIndex,
            opensStageProgressionGate: true
        }));
        scenes.push(createScene(POST_TRIAL_INTERLUDE_SCENES.STAGE_REVEAL, {
            trialIndex,
            boardReveal: true
        }));
        scenes.push(createScene(POST_TRIAL_INTERLUDE_SCENES.POST_STAGE_COMMENT, { trialIndex }));
    }
    if (stepTypes.has(POST_TRIAL_STEP_TYPES.SKILL_PROGRESSION)) {
        scenes.push(createScene(POST_TRIAL_INTERLUDE_SCENES.SKILL, { trialIndex }));
    }
    if (stepTypes.has(POST_TRIAL_STEP_TYPES.FINAL_RUN_COMPLETION)) {
        scenes.push(createScene(POST_TRIAL_INTERLUDE_SCENES.FINAL_RUN_COMPLETION, { trialIndex }));
    }

    scenes.push(createScene(POST_TRIAL_INTERLUDE_SCENES.CLOSE, { trialIndex }));
    return Object.freeze(scenes);
}

export function requiresPostTrialSystemFallback(sceneId) {
    return SYSTEM_FALLBACK_REQUIRED.has(sceneId);
}

export default buildPostTrialInterludeSceneSequence;
