import { INVESTIGATION_CARDS_MASTER } from "../../data/investigation_cards_data.js";
import { createKnownEnemyState } from "../domain/known_enemy_state.js";
import { InvestigationResolver } from "../systems/investigation_resolver.js";
import { InvestigationOfferingAdapter } from "../systems/investigation_offering_adapter.js";
import { InvestigationCardExecutionService } from "../systems/investigation_card_execution_service.js";

function cardDefinition(card) {
    return card?.terrain || card || null;
}

function sourceCard(state, source) {
    if (!state || !source || !Number.isInteger(source.index)) return null;
    if (source.type === "OFFERING" && Array.isArray(state.handOffering)) {
        return state.handOffering[source.index] || null;
    }
    if (source.type === "RESERVE" && Array.isArray(state.reserveSlots)) {
        return state.reserveSlots[source.index] || null;
    }
    return null;
}

function sameCard(expected, actual) {
    if (!expected || !actual) return false;
    if (expected === actual) return true;
    return typeof expected.id === "string" && expected.id.length > 0
        && typeof actual.id === "string" && actual.id.length > 0
        && expected.id === actual.id;
}

function removeCardFromSource(state, source) {
    if (source.type === "OFFERING") state.handOffering.splice(source.index, 1);
    else if (source.type === "RESERVE") state.reserveSlots[source.index] = null;
}

export function attachInvestigationRuntime(engine, {
    observableProfileProvider,
    offeringAdapter = new InvestigationOfferingAdapter(),
    executionService = null
} = {}) {
    if (!engine || !engine.state || !engine.deckManager) {
        return { success: false, reason: "ENGINE_NOT_READY" };
    }
    if (typeof observableProfileProvider !== "function") {
        return { success: false, reason: "OBSERVABLE_PROFILE_PROVIDER_REQUIRED" };
    }
    if (!engine.gameplayRandom || typeof engine.gameplayRandom.nextFloat !== "function" || typeof engine.gameplayRandom.nextId !== "function") {
        return { success: false, reason: "GAMEPLAY_RANDOM_REQUIRED" };
    }
    if (engine.__investigationRuntimeAttached) {
        return { success: true, alreadyAttached: true };
    }

    const state = engine.state;
    if (!state.knownEnemyState) state.knownEnemyState = createKnownEnemyState({ trialIndex: 1 });
    if (typeof state.investigationUnlocked !== "boolean") state.investigationUnlocked = false;

    const resolvedExecutionService = executionService || new InvestigationCardExecutionService({
        resolver: new InvestigationResolver({ rng: () => engine.gameplayRandom.nextFloat() })
    });

    const deckManager = engine.deckManager;
    const originalGetMaster = deckManager.getLandCardMaster.bind(deckManager);
    deckManager.getLandCardMaster = function getLandCardMasterWithInvestigation() {
        return offeringAdapter.extendMaster(originalGetMaster(), state);
    };

    const previousRestoreMasters = typeof engine.getAdditionalCardMastersForRestore === "function"
        ? engine.getAdditionalCardMastersForRestore.bind(engine)
        : null;
    engine.getAdditionalCardMastersForRestore = function getAdditionalCardMastersForRestore() {
        const previous = previousRestoreMasters?.() || [];
        return [...previous, ...INVESTIGATION_CARDS_MASTER];
    };

    engine.executeInvestigationCard = function executeInvestigationCard(card, source) {
        if (!state.investigationUnlocked) return { success: false, reason: "INVESTIGATION_LOCKED" };
        if (state.hasPickedThisTurn) return { success: false, reason: "ALREADY_PICKED" };

        const actualCard = sourceCard(state, source);
        if (!actualCard || !sameCard(card, actualCard)) {
            return { success: false, reason: "INVESTIGATION_SOURCE_MISMATCH" };
        }

        const definition = cardDefinition(actualCard);
        if (!definition || definition.category !== "INVESTIGATION") {
            return { success: false, reason: "NOT_INVESTIGATION_CARD" };
        }

        const profile = observableProfileProvider({ engine, state, card: definition });
        if (!profile) return { success: false, reason: "OBSERVABLE_PROFILE_UNAVAILABLE" };

        if (!state.knownEnemyState) {
            state.knownEnemyState = createKnownEnemyState({
                trialIndex: Number.isInteger(profile.trialIndex) ? profile.trialIndex : 1
            });
        }

        const verse = Number.isInteger(state.turn) ? state.turn : null;
        const trialIndex = Number.isInteger(profile.trialIndex) ? profile.trialIndex : "unknown";
        const reportId = engine.gameplayRandom.nextId("investigation", `${trialIndex}:${verse ?? "unknown"}`);
        const result = resolvedExecutionService.execute({
            card: definition,
            profile,
            knownEnemyState: state.knownEnemyState,
            observedAtVerse: verse,
            reportId
        });
        if (!result.success) return result;

        removeCardFromSource(state, source);
        state.hasPickedThisTurn = true;
        state.lastInvestigationReport = result.report;
        state.lastInvestigationComparison = result.comparison || null;

        if (engine.cardCycleSystem?.registerOffering) {
            engine.cardCycleSystem.registerOffering([actualCard], Number.isInteger(state.turn) ? state.turn : 1);
        }

        return result;
    };

    engine.__investigationRuntimeAttached = true;
    return { success: true };
}

export default attachInvestigationRuntime;
