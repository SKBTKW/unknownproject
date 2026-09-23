/* =============================================================
   game/src/cards/card_offering_eligibility_service.js
   Offering-only eligibility boundary. It is intentionally separate from
   execution requirements so Reserve/board changes can be revalidated later.
   ============================================================= */

import { normalizeCardDefinitionV1 } from './card_definition_v1.js';
import { CARD_EFFECT_TYPES } from './card_effect_executor.js';
import { CARD_DOMAIN_ACTIONS } from './card_domain_action_executor.js';

class CardOfferingEligibilityService {
    constructor({
        state,
        placementQuery,
        requirementEvaluator = null,
        executionTargetQuery = null
    } = {}) {
        this.state = state;
        this.placementQuery = placementQuery;
        this.requirementEvaluator = requirementEvaluator;
        this.executionTargetQuery = executionTargetQuery;
    }

    evaluate(cardDefinition, context = {}) {
        const card = normalizeCardDefinitionV1(cardDefinition);
        if (!card?.id) return Object.freeze({ eligible: false, reason: "INVALID_CARD_DEFINITION" });

        if (card.category === "LAND") {
            if (!this.placementQuery?.hasAnyLegalPlacement(card.legacy)) {
                return Object.freeze({ eligible: false, reason: "NO_LEGAL_PLACEMENT" });
            }
        }

        const requiresBoardExecutionTarget = card.effects.some(effect =>
            effect?.type === CARD_EFFECT_TYPES.DOMAIN_ACTION
            && effect?.action === CARD_DOMAIN_ACTIONS.CREATE_SPECIAL_BLOCK
        );
        if (requiresBoardExecutionTarget) {
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
