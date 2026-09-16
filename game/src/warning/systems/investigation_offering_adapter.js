import { INVESTIGATION_CARDS_MASTER } from "../../data/investigation_cards_data.js";
import { InvestigationOfferingPolicy } from "./investigation_offering_policy.js";

/**
 * Adds investigation cards to an existing card master without changing the
 * base master or creating a dedicated Offering slot.
 */
export class InvestigationOfferingAdapter {
    constructor({
        investigationCards = INVESTIGATION_CARDS_MASTER,
        policy = new InvestigationOfferingPolicy()
    } = {}) {
        this.investigationCards = Array.isArray(investigationCards)
            ? investigationCards
            : [];
        this.policy = policy;
    }

    extendMaster(baseMaster, state) {
        const base = Array.isArray(baseMaster) ? baseMaster : [];
        const map = new Map();

        for (const card of base) {
            if (card?.id) map.set(card.id, card);
        }

        for (const card of this.investigationCards) {
            if (!card?.id) continue;
            if (!this.policy.isEligible(card, state)) continue;
            if (!map.has(card.id)) map.set(card.id, card);
        }

        return Array.from(map.values());
    }
}

export default InvestigationOfferingAdapter;
