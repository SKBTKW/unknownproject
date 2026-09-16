import { hydrateGameState as hydrateBaseGameState } from "./hydrate_game_state_base.js";

function cloneData(value) {
    if (value === undefined) return undefined;
    return JSON.parse(JSON.stringify(value));
}

function hydrateKnownEnemyState(value) {
    if (!value || typeof value !== "object") return null;
    return {
        trialIndex: Number.isInteger(value.trialIndex) ? value.trialIndex : 1,
        reports: cloneData(Array.isArray(value.reports) ? value.reports : []) || [],
        observedTags: Array.isArray(value.observedTags)
            ? [...new Set(value.observedTags.filter(tag => typeof tag === "string"))]
            : []
    };
}

export function hydrateGameState(state, serialized, options = {}) {
    if (!serialized || typeof serialized !== "object") {
        throw new TypeError("HYDRATE_GAME_STATE_REQUIRED");
    }

    const {
        isGameOver = false,
        runTermination = null,
        investigationUnlocked = false,
        investigationUnlockedAtVerse = null,
        knownEnemyState = null,
        lastInvestigationReport = null,
        lastInvestigationComparison = null,
        scheduledGlobalEvents = [],
        ...baseSerialized
    } = serialized;

    const hydrated = hydrateBaseGameState(state, baseSerialized, options);
    hydrated.isGameOver = !!isGameOver;
    hydrated.runTermination = cloneData(runTermination) ?? null;
    hydrated.investigationUnlocked = !!investigationUnlocked;
    hydrated.investigationUnlockedAtVerse = Number.isInteger(investigationUnlockedAtVerse)
        ? investigationUnlockedAtVerse
        : null;
    hydrated.knownEnemyState = hydrateKnownEnemyState(knownEnemyState);
    hydrated.lastInvestigationReport = cloneData(lastInvestigationReport) ?? null;
    hydrated.lastInvestigationComparison = cloneData(lastInvestigationComparison) ?? null;
    hydrated.scheduledGlobalEvents = Array.isArray(scheduledGlobalEvents)
        ? (cloneData(scheduledGlobalEvents) || [])
        : [];
    return hydrated;
}

export default hydrateGameState;