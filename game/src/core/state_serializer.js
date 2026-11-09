import { readBlueprintLifecycleSnapshot } from '../trial/domain/enemy_army_blueprint_lifecycle_state.js';
import {
    readEnemyArmyTraitProvenanceState,
    validateEnemyArmyTraitProvenanceAssociations
} from '../trial/domain/enemy_army_trait_provenance_state.js';
import { restoreDiscoveryLedger } from "../investigation/domain/world_discovery.js";
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
    const armyState = state ? validateEnemyArmyTraitProvenanceAssociations(
        readBlueprintLifecycleSnapshot(state), readEnemyArmyTraitProvenanceState(state)
    ) : null;
    const blueprintState = armyState?.blueprintState ?? null;
    const provenanceState = armyState?.provenanceState ?? null;
    const serialized = serializeBaseGameState(createSerializerStateView(state));
    if (!serialized) return serialized;
    return {
        ...serialized,
        ...(blueprintState?.blueprints.length ? { enemyArmyBlueprintState: blueprintState } : {}),
        ...(provenanceState?.provenances.length
            ? { enemyArmyTraitProvenanceState: provenanceState }
            : {}),
        isGameOver: !!state?.isGameOver,
        runTermination: cloneData(state?.runTermination),
        postTrialTransition: cloneData(state?.postTrialTransition),
        investigationUnlocked: !!state?.investigationUnlocked,
        investigationUnlockedAtVerse: Number.isInteger(state?.investigationUnlockedAtVerse)
            ? state.investigationUnlockedAtVerse
            : null,
        discoveryLedger: restoreDiscoveryLedger(state?.discoveryLedger ?? null),
        knownEnemyState: serializeKnownEnemyState(state),
        lastInvestigationReport: cloneData(state?.lastInvestigationReport),
        lastInvestigationComparison: cloneData(state?.lastInvestigationComparison),
        scheduledGlobalEvents: cloneData(
            Array.isArray(state?.scheduledGlobalEvents) ? state.scheduledGlobalEvents : [],
            []
        )
    };
}

export default serializeGameState;
