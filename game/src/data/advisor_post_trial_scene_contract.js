import { ADVISOR_SCENES } from "./advisor_scene_catalog.js";

// Post-Trial presentation owns occurrence and ordering. Advisor only consumes
// already-public, already-settled context through this contract.
export const ADVISOR_POST_TRIAL_SCENE_SEQUENCE = Object.freeze([
    ADVISOR_SCENES.ASSESSMENT,
    ADVISOR_SCENES.TRIAL_MEANING,
    ADVISOR_SCENES.STAGE_PRELUDE,
    ADVISOR_SCENES.POST_STAGE_COMMENT
]);

const contracts = {
    [ADVISOR_SCENES.ASSESSMENT]: {
        source: "SETTLED_AFTERMATH",
        allowedContextKeys: ["trialIndex", "aftermath"]
    },
    [ADVISOR_SCENES.TRIAL_MEANING]: {
        source: "SETTLED_AFTERMATH_OR_KNOWN_ENEMY",
        allowedContextKeys: ["trialIndex", "aftermath", "knownEnemySnapshot"],
        interpretationAllowed: true,
        enemyIntentInferenceAllowed: false,
        hiddenTruthAllowed: false,
        futureTrialInferenceAllowed: false
    },
    [ADVISOR_SCENES.STAGE_PRELUDE]: {
        source: "AUTHORIZED_STAGE_TRANSITION",
        allowedContextKeys: ["trialIndex", "fromStageId", "toStageId", "size"]
    },
    [ADVISOR_SCENES.POST_STAGE_COMMENT]: {
        source: "APPLIED_STAGE_TRANSITION",
        allowedContextKeys: ["trialIndex", "fromStageId", "toStageId", "size", "publicBoardSummary"]
    }
};

export const ADVISOR_POST_TRIAL_SCENE_CONTRACTS = Object.freeze(
    Object.fromEntries(
        Object.entries(contracts).map(([sceneId, contract]) => [
            sceneId,
            Object.freeze({
                interpretationAllowed: false,
                enemyIntentInferenceAllowed: false,
                hiddenTruthAllowed: false,
                futureTrialInferenceAllowed: false,
                ...contract,
                allowedContextKeys: Object.freeze([...(contract.allowedContextKeys || [])])
            })
        ])
    )
);

export function getAdvisorPostTrialSceneContract(sceneId) {
    return ADVISOR_POST_TRIAL_SCENE_CONTRACTS[sceneId] || null;
}

// Whitelist projection prevents callers from smuggling TrueEnemyState, exact
// future Trial timing, hidden routes, RNG state, or inferred enemy intent into
// Advisor presentation payloads. Nested aftermath is safe because its canonical
// producer captures only the immutable TRIAL_RESULT_SETTLED snapshot.
export function projectAdvisorPostTrialSceneContext(sceneId, context = {}) {
    const contract = getAdvisorPostTrialSceneContract(sceneId);
    if (!contract || !context || typeof context !== "object" || Array.isArray(context)) {
        return Object.freeze({});
    }

    const projected = {};
    contract.allowedContextKeys.forEach(key => {
        if (Object.prototype.hasOwnProperty.call(context, key)) projected[key] = context[key];
    });
    return Object.freeze(projected);
}
