import {
    ENEMY_BLUEPRINT_LIFECYCLE_SCHEMA_VERSION,
    freezeBlueprintLifecycleSnapshot
} from '../trial/domain/enemy_army_blueprint_lifecycle_state.js';
import {
    ENEMY_ARMY_TRAIT_PROVENANCE_STATE_SCHEMA_VERSION,
    freezeEnemyArmyTraitProvenanceState,
    validateEnemyArmyTraitProvenanceAssociations
} from '../trial/domain/enemy_army_trait_provenance_state.js';
import { restoreDiscoveryLedger } from "../investigation/domain/world_discovery.js";
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
        postTrialTransition = null,
        investigationUnlocked = false,
        investigationUnlockedAtVerse = null,
        discoveryLedger = null,
        knownEnemyState = null,
        lastInvestigationReport = null,
        lastInvestigationComparison = null,
        scheduledGlobalEvents = [],
        enemyArmyBlueprintState,
        enemyArmyTraitProvenanceState,
        ...baseSerialized
    } = serialized;

    // Preflight before the base hydrator can change any live world data.
    const restoredBlueprintState = Object.hasOwn(serialized, 'enemyArmyBlueprintState')
        ? freezeBlueprintLifecycleSnapshot(enemyArmyBlueprintState)
        : null;
    const restoredProvenanceState = Object.hasOwn(serialized, 'enemyArmyTraitProvenanceState')
        ? freezeEnemyArmyTraitProvenanceState(enemyArmyTraitProvenanceState)
        : freezeEnemyArmyTraitProvenanceState({
            schemaVersion: ENEMY_ARMY_TRAIT_PROVENANCE_STATE_SCHEMA_VERSION,
            provenances: []
        });
    validateEnemyArmyTraitProvenanceAssociations(
        restoredBlueprintState ?? {
            schemaVersion: ENEMY_BLUEPRINT_LIFECYCLE_SCHEMA_VERSION,
            blueprints: []
        },
        restoredProvenanceState
    );
    const restoredDiscoveryLedger = restoreDiscoveryLedger(discoveryLedger);
    const hydrated = hydrateBaseGameState(state, baseSerialized, options);
    hydrated.isGameOver = !!isGameOver;
    hydrated.runTermination = cloneData(runTermination) ?? null;
    hydrated.postTrialTransition = cloneData(postTrialTransition) ?? null;
    hydrated.investigationUnlocked = !!investigationUnlocked;
    hydrated.investigationUnlockedAtVerse = Number.isInteger(investigationUnlockedAtVerse)
        ? investigationUnlockedAtVerse
        : null;
    hydrated.discoveryLedger = restoredDiscoveryLedger;
    hydrated.knownEnemyState = hydrateKnownEnemyState(knownEnemyState);
    hydrated.lastInvestigationReport = cloneData(lastInvestigationReport) ?? null;
    hydrated.lastInvestigationComparison = cloneData(lastInvestigationComparison) ?? null;
    hydrated.scheduledGlobalEvents = Array.isArray(scheduledGlobalEvents)
        ? (cloneData(scheduledGlobalEvents) || [])
        : [];
    if (restoredBlueprintState) hydrated.enemyArmyBlueprintState = restoredBlueprintState;
    else delete hydrated.enemyArmyBlueprintState; // An old save must not retain a future army.
    if (restoredProvenanceState.provenances.length) {
        hydrated.enemyArmyTraitProvenanceState = restoredProvenanceState;
    } else {
        delete hydrated.enemyArmyTraitProvenanceState;
    }
    return hydrated;
}

export default hydrateGameState;
