import { createKnownEnemyState } from "../domain/known_enemy_state.js";
import { InvestigationOfferingAdapter } from "../systems/investigation_offering_adapter.js";
import { InvestigationCardExecutionService } from "../systems/investigation_card_execution_service.js";

function cardDefinition(card) {
    return card?.terrain || card || null;
}

function removeCardFromSource(state, source) {
    if (!state || !source) return;
    if (source.type === "OFFERING" && Number.isInteger(source.index) && Array.isArray(state.handOffering)) {
        state.handOffering.splice(source.index, 1);
    } else if (source.type === "RESERVE" && Number.isInteger(source.index) && Array.isArray(state.reserveSlots)) {
        state.reserveSlots[source.index] = null;
    }
}

export function attachInvestigationRuntime(engine, {
    observableProfileProvider,
    offeringAdapter = new InvestigationOfferingAdapter(),
    executionService = new InvestigationCardExecutionService()
} = {}) {
    if (!engine || !engine.state || !engine.deckManager) {
        return { success: false, reason: "ENGINE_NOT_READY" };
    }
    if (typeof observableProfileProvider !== "function") {
        return { success: false, reason: "OBSERVABLE_PROFILE_PROVIDER_REQUIRED" };
    }
    if (engine.__investigationRuntimeAttached) {
        return { success: true, alreadyAttached: true };
    }

    const state = engine.state;
    if (!state.knownEnemyState) {
        state.knownEnemyState = createKnownEnemyState({ trialIndex: 1 });
    }
    if (typeof state.investigationUnlocked !== "boolean") {
        state.investigationUnlocked = false;
    }

    const deckManager = engine.deckManager;
    const originalGetMaster = deckManager.getLandCardMaster.bind(deckManager);
    deckManager.getLandCardMaster = function getLandCardMasterWithInvestigation() {
        return offeringAdapter.extendMaster(originalGetMaster(), state);
    };

    const previousRestoreMasterProvider = typeof engine.getAdditionalCardMastersForRestore === "function"
        ? engine.getAdditionalCardMastersForRestore.bind(engine)
        : null;
    engine.getAdditionalCardMastersForRestore = function getAdditionalCardMastersForRestore() {
        const previous = previousRestoreMasterProvider?.() || [];
        const own = Array.isArray(offeringAdapter.investigationCards) ? offeringAdapter.investigationCards : [];
        const byId = new Map();
        for (const master of [...previous, ...own]) {
            if (master?.id) byId.set(master.id, master);
        }
        return Array.from(byId.values());
    };

    engine.executeInvestigationCard = function executeInvestigationCard(card, source = { type: "OFFERING", index: -1 }) {
        const definition = cardDefinition(card);
        if (!definition || definition.category !== "INVESTIGATION") {
            return { success: false, reason: "NOT_INVESTIGATION_CARD" };
        }
        if (!state.investigationUnlocked) {
            return { success: false, reason: "INVESTIGATION_LOCKED" };
        }
        if (state.hasPickedThisTurn) {
            return { success: false, reason: "ALREADY_PICKED" };
        }

        const profile = observableProfileProvider({ engine, state, card: definition });
        if (!profile) {
            return { success: false, reason: "OBSERVABLE_PROFILE_UNAVAILABLE" };
        }

        if (!state.knownEnemyState) {
            state.knownEnemyState = createKnownEnemyState({
                trialIndex: Number.isInteger(profile.trialIndex) ? profile.trialIndex : 1
            });
        }

        const result = executionService.execute({
            card: definition,
            profile,
            knownEnemyState: state.knownEnemyState,
            observedAtVerse: Number.isInteger(state.turn) ? state.turn : null
        });
        if (!result.success) return result;

        removeCardFromSource(state, source);
        state.hasPickedThisTurn = true;
        state.lastInvestigationReport = result.report;
        state.lastInvestigationComparison = result.comparison || null;

        if (engine.cardCycleSystem?.registerOffering) {
            engine.cardCycleSystem.registerOffering([card], Number.isInteger(state.turn) ? state.turn : 1);
        }

        return result;
    };

    engine.__investigationRuntimeAttached = true;
    return { success: true };
}

export default attachInvestigationRuntime;
