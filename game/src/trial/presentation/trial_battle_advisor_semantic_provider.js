import { ADVISOR_SCENES } from "../../data/advisor_scene_catalog.js";

const FORBIDDEN_PUBLIC_KEYS = new Set([
    "trueenemystate",
    "enemytruth",
    "enemytruthreadmodel",
    "hiddenroute",
    "hiddenroutes",
    "hiddenintent",
    "enemyintent",
    "enemyobjective",
    "enemytarget",
    "unseenequipment",
    "undiscoveredinvestigation",
    "internalrng",
    "gameplayrandom",
    "randomseed",
    "rngstate",
    "trialschedule",
    "nexttrialturn",
    "nexttrialverse"
]);

function normalizeKey(key) {
    return String(key || "").replace(/[^a-z0-9]/gi, "").toLowerCase();
}

function sanitize(value) {
    if (value === null || value === undefined) return value ?? null;
    if (Array.isArray(value)) return value.map(sanitize);
    if (typeof value !== "object") return value;
    const result = {};
    for (const [key, item] of Object.entries(value)) {
        if (FORBIDDEN_PUBLIC_KEYS.has(normalizeKey(key))) continue;
        result[key] = sanitize(item);
    }
    return result;
}

export const TRIAL_BATTLE_ADVISOR_HOOKS = Object.freeze({
    BATTLEFIELD_READ: ADVISOR_SCENES.TRIAL_BATTLEFIELD_READ,
    CAUSAL_ADVANTAGE: ADVISOR_SCENES.TRIAL_CAUSAL_ADVANTAGE,
    CAUSAL_DANGER: ADVISOR_SCENES.TRIAL_CAUSAL_DANGER,
    TURNING_POINT: ADVISOR_SCENES.TRIAL_BATTLE_TURNING_POINT,
    OPPORTUNITY: ADVISOR_SCENES.TRIAL_OPPORTUNITY,
    FORTUNE_SUCCESS: ADVISOR_SCENES.TRIAL_FORTUNE_SUCCESS,
    FORTUNE_MISSED: ADVISOR_SCENES.TRIAL_FORTUNE_MISSED,
    DECISIVE_RESULT: ADVISOR_SCENES.TRIAL_DECISIVE_RESULT,
    NORMAL_RESULT: ADVISOR_SCENES.TRIAL_NORMAL_RESULT
});

export class TrialBattleAdvisorSemanticProvider {
    project({ sceneId, snapshot, narrativeEvent = null } = {}) {
        if (!Object.values(TRIAL_BATTLE_ADVISOR_HOOKS).includes(sceneId)) return null;
        if (!snapshot || typeof snapshot !== "object") return null;

        return Object.freeze({
            sceneId,
            battleId: snapshot.battleId ?? snapshot.id ?? null,
            routeId: snapshot.routeId ?? null,
            normalOutcome: sanitize(snapshot.normalOutcome ?? null),
            battleState: sanitize(snapshot.battleState ?? null),
            finalCombatResult: sanitize(snapshot.finalCombatResult ?? null),
            opportunity: sceneId === ADVISOR_SCENES.TRIAL_OPPORTUNITY
                ? sanitize(snapshot.opportunity ?? null) : null,
            fortuneRoll: (
                sceneId === ADVISOR_SCENES.TRIAL_FORTUNE_SUCCESS
                || sceneId === ADVISOR_SCENES.TRIAL_FORTUNE_MISSED
            ) ? sanitize(snapshot.fortuneRoll ?? null) : null,
            decisiveEvent: sceneId === ADVISOR_SCENES.TRIAL_DECISIVE_RESULT
                ? sanitize(snapshot.decisiveEvent ?? null) : null,
            narrativeEvent: sanitize(narrativeEvent)
        });
    }

    projectOptional(args = {}) {
        try {
            return this.project(args);
        } catch {
            return null;
        }
    }
}

export default TrialBattleAdvisorSemanticProvider;
