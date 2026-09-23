import { InvestigationAvailabilityPolicy, readInvestigationUnlocked } from "./investigation_availability_policy.js";

export class InvestigationOfferingPolicy {
    constructor({ availabilityPolicy = new InvestigationAvailabilityPolicy() } = {}) {
        this.availabilityPolicy = availabilityPolicy;
    }

    isEligible(card, state) {
        if (!card || typeof card !== "object") return false;
        const investigationCard = card.category === "INVESTIGATION" || card.reqInvestigationUnlocked === true;
        if (!investigationCard) return true;
        return this.availabilityPolicy.isAvailable(state);
    }
}

export { readInvestigationUnlocked };
export default InvestigationOfferingPolicy;
