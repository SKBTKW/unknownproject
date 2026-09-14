import { serializeGameState as serializeBaseGameState } from "./state_serializer_base.js";
import { createSerializerStateView } from "./state_serializer_state_view.js";

function cloneData(value, fallback = null) {
    if (value === undefined) return fallback;
    return JSON.parse(JSON.stringify(value));
}

function serializeKnownEnemyState(state) {
    const known = state?.knownEnemyState;
    if (!known || typeof known !== "object") return null;
    return {
        trialIndex: Number.isInteger(known.trialIndex) ? known.trialIndex : 1,
        reports: cloneData(Array.isArray(known.reports) ? known.reports : [], []),
        observedTags: Array.isArray(known.observedTags)
            ? [...new Set(known.observedTags.filter(tag => typeof tag === "string"))]
            : []
    };
}

export function serializeGameState(state) {
    const serialized = serializeBaseGameState(createSerializerStateView(state));
    if (!serialized) return serialized;
    return {
        ...serialized,
        isGameOver: !!state?.isGameOver,
        runTermination: cloneData(state?.runTermination),
        investigationUnlocked: !!state?.investigationUnlocked,
        investigationUnlockedAtVerse: Number.isInteger(state?.investigationUnlockedAtVerse)
            ? state.investigationUnlockedAtVerse
            : null,
        knownEnemyState: serializeKnownEnemyState(state),
        lastInvestigationReport: cloneData(state?.lastInvestigationReport),
        lastInvestigationComparison: cloneData(state?.lastInvestigationComparison)
    };
}

export default serializeGameState;
