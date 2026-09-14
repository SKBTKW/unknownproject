import { INVESTIGATION_SOURCE_POLICIES } from "../../data/investigation_sources_data.js";
import { InvestigationResolver } from "./investigation_resolver.js";
import { KnownEnemyStateService } from "./known_enemy_state_service.js";

function findSourcePolicy(sourceType, policies) {
    if (!sourceType || !Array.isArray(policies)) return null;
    return policies.find(policy => policy?.sourceType === sourceType) || null;
}

/**
 * Executes an investigation card against an already-redacted enemy profile.
 *
 * This service does not read Trial truth. The caller must provide an
 * ObservableEnemyProfile produced by EnemyObservationProjector.
 */
export class InvestigationCardExecutionService {
    constructor({
        sourcePolicies = INVESTIGATION_SOURCE_POLICIES,
        resolver = new InvestigationResolver(),
        knownEnemyStateService = new KnownEnemyStateService()
    } = {}) {
        this.sourcePolicies = sourcePolicies;
        this.resolver = resolver;
        this.knownEnemyStateService = knownEnemyStateService;
    }

    execute({ card, profile, knownEnemyState, observedAtVerse, reportId = null } = {}) {
        if (!card || card.category !== "INVESTIGATION") {
            return { success: false, reason: "NOT_INVESTIGATION_CARD" };
        }

        const sourceType = card.investigationSourceType;
        const basePolicy = findSourcePolicy(sourceType, this.sourcePolicies);
        if (!basePolicy) {
            return { success: false, reason: "SOURCE_POLICY_NOT_FOUND" };
        }

        const sourcePolicy = {
            ...basePolicy,
            maxObservations: Number.isInteger(card.maxObservations) ? card.maxObservations : 1,
            textKey: typeof card.textKey === "string" ? card.textKey : null
        };

        const report = this.resolver.resolve({
            profile,
            observedAtVerse,
            sourcePolicy,
            reportId
        });

        const recorded = this.knownEnemyStateService.record(knownEnemyState, report);

        return {
            success: true,
            report,
            comparison: recorded.comparison,
            previousReport: recorded.previousReport,
            state: recorded.state
        };
    }
}

export default InvestigationCardExecutionService;
