import { POST_TRIAL_INTERLUDE_SCENES } from "./post_trial_interlude_scene_contract.js";

const FORBIDDEN_PUBLIC_KEYS = new Set([
    "trueenemystate",
    "enemytruthreadmodel",
    "hiddenroute",
    "hiddenroutes",
    "internalrng",
    "gameplayrandom",
    "randomseed",
    "rngstate",
    "trialschedule",
    "nexttrialturn",
    "nexttrialverse",
    "enemyintent",
    "enemyobjective",
    "enemytarget"
]);

function normalizeKey(key) {
    return String(key || "").replace(/[^a-z0-9]/gi, "").toLowerCase();
}

function sanitizePublicData(value) {
    if (value === null || value === undefined) return value ?? null;
    if (Array.isArray(value)) return value.map(item => sanitizePublicData(item));
    if (typeof value !== "object") return value;

    const result = {};
    for (const [key, item] of Object.entries(value)) {
        if (FORBIDDEN_PUBLIC_KEYS.has(normalizeKey(key))) continue;
        result[key] = sanitizePublicData(item);
    }
    return result;
}

function normalizePublicFacts(publicFacts) {
    if (!Array.isArray(publicFacts)) return [];
    return publicFacts
        .filter(fact => fact && typeof fact === "object")
        .map(fact => sanitizePublicData(fact));
}

/**
 * Builds the Advisor-facing semantic payload from already-settled public state.
 *
 * This provider has no engine/state dependency by design. It cannot reach
 * TrueEnemyState, hidden routes, TrialSchedule, or internal RNG. KnownEnemyState
 * is accepted only for TRIAL_MEANING, while post-Stage public board state is
 * accepted only for POST_STAGE_COMMENT.
 */
export function createPostTrialAdvisorSemanticPayload({
    sceneId,
    readModel,
    publicFacts = [],
    knownEnemyState = null,
    postStagePublicState = null,
    semanticSceneId = null,
    occurrenceOwner = null,
    dedupeKey = null,
    required = false
} = {}) {
    if (!Object.values(POST_TRIAL_INTERLUDE_SCENES).includes(sceneId)) {
        return null;
    }
    if (!readModel?.available) return null;

    const aftermath = readModel.aftermath || {};
    const payload = {
        sceneId,
        transitionId: readModel.transitionId || null,
        trialIndex: Number.isInteger(Number(readModel.trialIndex))
            ? Number(readModel.trialIndex)
            : null,
        scenarioId: readModel.scenarioId || aftermath.scenarioId || null,
        verse: Number.isInteger(Number(aftermath.turn)) ? Number(aftermath.turn) : null,
        outcome: aftermath.outcome || null,
        result: sanitizePublicData(aftermath.result),
        settlement: sanitizePublicData(aftermath.settlement),
        stageAdvance: sanitizePublicData(readModel.stageAdvance),
        publicFacts: normalizePublicFacts(publicFacts),
        semanticSceneId: typeof semanticSceneId === "string" ? semanticSceneId : null,
        occurrenceOwner: typeof occurrenceOwner === "string" ? occurrenceOwner : null,
        dedupeKey: typeof dedupeKey === "string" ? dedupeKey : null,
        required: Boolean(required)
    };

    if (sceneId === POST_TRIAL_INTERLUDE_SCENES.TRIAL_MEANING) {
        payload.knownEnemyState = sanitizePublicData(knownEnemyState);
    }
    if (sceneId === POST_TRIAL_INTERLUDE_SCENES.POST_STAGE_COMMENT) {
        payload.postStagePublicState = sanitizePublicData(postStagePublicState);
    }

    return Object.freeze(payload);
}

export default createPostTrialAdvisorSemanticPayload;
