/* =============================================================
   game/src/cards/card_offering_eligibility_service.js
   Offering-only eligibility boundary. It is intentionally separate from
   execution requirements so Reserve/board changes can be revalidated later.
   ============================================================= */

import { normalizeCardDefinitionV1 } from './card_definition_v1.js';

class CardOfferingEligibilityService {
    constructor({ state, placementQuery, requirementEvaluator = null } = {}) {
        this.state = state;
        this.placementQuery = placementQuery;
        this.requirementEvaluator = requirementEvaluator;
    }

    evaluate(cardDefinition, context = {}) {
        const card = normalizeCardDefinitionV1(cardDefinition);
        if (!card?.id) return Object.freeze({ eligible: false, reason: "INVALID_CARD_DEFINITION" });

        if (card.category === "LAND") {
            if (!this.placementQuery?.hasAnyLegalPlacement(card.legacy)) {
                return Object.freeze({ eligible: false, reason: "NO_LEGAL_PLACEMENT" });
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
