/* =============================================================
   game/src/cards/card_offering_eligibility_service.js
   Offering-only eligibility boundary. It is intentionally separate from
   execution requirements so Reserve/board changes can be revalidated later.
   ============================================================= */

import { normalizeCardDefinitionV1 } from './card_definition_v1.js';
import { evaluateCardRuntimeVisibility } from './card_runtime_visibility_policy.js';

class CardOfferingEligibilityService {
    constructor({
        state,
        placementQuery,
        requirementEvaluator = null,
        executionTargetRequired = null,
        executionTargetQuery = null
    } = {}) {
        this.state = state;
        this.placementQuery = placementQuery;
        this.requirementEvaluator = requirementEvaluator;
        this.executionTargetRequired = executionTargetRequired;
        this.executionTargetQuery = executionTargetQuery;
    }

    evaluate(cardDefinition, context = {}) {
        const card = normalizeCardDefinitionV1(cardDefinition);
        if (!card?.id) return Object.freeze({ eligible: false, reason: "INVALID_CARD_DEFINITION" });

        const visibility = evaluateCardRuntimeVisibility(card.legacy || cardDefinition);
        if (!visibility.visible) {
            return Object.freeze({
                eligible: false,
                reason: visibility.reason || "CARD_NOT_RUNTIME_VISIBLE"
            });
        }

        if (card.category === "LAND") {
            if (!this.placementQuery?.hasAnyLegalPlacement(card.legacy, {
                cache: context.placeabilityCache || context.options?.placeabilityCache || null
            })) {
                return Object.freeze({ eligible: false, reason: "NO_LEGAL_PLACEMENT" });
            }
        }

        const requiresExecutionTarget = typeof this.executionTargetRequired === "function"
            ? this.executionTargetRequired(card, {
                ...context,
                state: this.state
            }) === true
            : false;
        if (requiresExecutionTarget) {
            if (typeof this.executionTargetQuery !== "function") {
                return Object.freeze({
                    eligible: false,
                    reason: "EXECUTION_TARGET_QUERY_REQUIRED"
                });
            }
            const targets = this.executionTargetQuery(card, {
                ...context,
                state: this.state
            });
            if (!Array.isArray(targets) || targets.length === 0) {
                return Object.freeze({
                    eligible: false,
                    reason: "NO_LEGAL_EXECUTION_TARGET"
                });
            }
        }

        for (const requirement of card.offering.requirements) {
            if (typeof this.requirementEvaluator !== "function") {
                return Object.freeze({ eligible: false, reason: "OFFERING_REQUIREMENT_EVALUATOR_REQUIRED" });
            }
            if (!this.requirementEvaluator(requirement, {
                ...context,
                state: this.state,
                card: card.legacy,
                definition: card
            })) {
                return Object.freeze({
                    eligible: false,
                    reason: requirement.id || requirement.type || "OFFERING_REQUIREMENT_FAILED"
                });
            }
        }

        return Object.freeze({ eligible: true, reason: null });
    }
}

export { CardOfferingEligibilityService };
export default CardOfferingEligibilityService;
