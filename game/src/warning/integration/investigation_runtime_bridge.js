import { GAME_FACT_TYPES } from "../../core/game_fact.js";
import { INVESTIGATION_CARDS_MASTER } from "../../data/investigation_cards_data.js";
import { createKnownEnemyState } from "../domain/known_enemy_state.js";
import { InvestigationResolver } from "../systems/investigation_resolver.js";
import { InvestigationOfferingAdapter } from "../systems/investigation_offering_adapter.js";
import { InvestigationCardExecutionService } from "../systems/investigation_card_execution_service.js";
import { InvestigationAvailabilityPolicy } from "../systems/investigation_availability_policy.js";
import { INVESTIGATION_ALL_FACETS } from "../systems/investigation_request_service.js";

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
        resolver: new InvestigationResolver({ rng: () => engine.gameplayRandom.nextFloat() }),
        randomSource: engine.gameplayRandom
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

    const availabilityPolicy = new InvestigationAvailabilityPolicy();

    const performDomainInvestigation = ({
        sourceType = "INVESTIGATION",
        allowedFacets = INVESTIGATION_ALL_FACETS,
        baseObservations = 1,
        enhanced = false,
        costPaid = null,
        observationModifiers = null,
        reportId = null,
        semanticSourceId = null,
        requireAvailability = true
    } = {}) => {
        if (requireAvailability && !availabilityPolicy.isAvailable(state, {
            warningStateService: engine.warningStateService || null
        })) {
            return { success: false, reason: "INVESTIGATION_LOCKED" };
        }

        const profile = observableProfileProvider({ engine, state });
        if (!profile) return { success: false, reason: "OBSERVABLE_PROFILE_UNAVAILABLE" };

        if (!state.knownEnemyState) {
            state.knownEnemyState = createKnownEnemyState({
                trialIndex: Number.isInteger(profile.trialIndex) ? profile.trialIndex : 1
            });
        }

        const verse = Number.isInteger(state.turn) ? state.turn : null;
        const trialIndex = Number.isInteger(profile.trialIndex) ? profile.trialIndex : "unknown";
        const resolvedReportId = reportId
            || engine.gameplayRandom.nextId("investigation", `${trialIndex}:${verse ?? "unknown"}`);
        const requestService = resolvedExecutionService.requestService;
        if (!requestService || typeof requestService.perform !== "function") {
            return { success: false, reason: "INVESTIGATION_REQUEST_SERVICE_REQUIRED" };
        }

        const result = requestService.perform({
            profile,
            knownEnemyState: state.knownEnemyState,
            observedAtVerse: verse,
            reportId: resolvedReportId,
            sourceType,
            allowedFacets,
            baseObservations,
            enhanced,
            costPaid,
            observationModifiers
        });
        if (!result.success) return result;

        state.lastInvestigationReport = result.report;
        state.lastInvestigationComparison = result.comparison || null;

        engine.gameFactHub?.emit?.(GAME_FACT_TYPES.INVESTIGATION_RECORDED, {
            trialIndex: Number.isInteger(profile.trialIndex) ? profile.trialIndex : null,
            verse,
            cardId: semanticSourceId,
            reportId: result.report?.id || resolvedReportId,
            sourceType
        });
        return result;
    };

    engine.isInvestigationAvailable = function isInvestigationAvailable() {
        return availabilityPolicy.isAvailable(state, {
            warningStateService: engine.warningStateService || null
        });
    };

    engine.performInvestigation = function performInvestigation(request = {}) {
        return performDomainInvestigation(request);
    };

    engine.performGrantedInvestigation = function performGrantedInvestigation(request = {}) {
        return performDomainInvestigation({
            ...request,
            requireAvailability: false
        });
    };

    engine.executeInvestigationCard = function executeInvestigationCard(card, source) {
        if (!engine.isInvestigationAvailable()) return { success: false, reason: "INVESTIGATION_LOCKED" };
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

        engine.gameFactHub?.emit?.(GAME_FACT_TYPES.INVESTIGATION_RECORDED, {
            trialIndex: Number.isInteger(profile.trialIndex) ? profile.trialIndex : null,
            verse,
            cardId: definition.id || null,
            reportId: result.report?.id || reportId,
            sourceType: definition.investigationSourceType || null
        });

        return result;
    };

    engine.__investigationRuntimeAttached = true;
    return { success: true };
}

export default attachInvestigationRuntime;
