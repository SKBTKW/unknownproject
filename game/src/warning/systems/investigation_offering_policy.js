function readInvestigationUnlocked(state) {
    if (!state || typeof state !== "object") return false;
    if (typeof state.isInvestigationUnlocked === "function") return state.isInvestigationUnlocked() === true;
    if (typeof state.investigationUnlocked === "boolean") return state.investigationUnlocked;
    if (typeof state.warningState?.investigationUnlocked === "boolean") return state.warningState.investigationUnlocked;
    return false;
}

export class InvestigationOfferingPolicy {
    isEligible(card, state) {
        if (!card || typeof card !== "object") return false;
        const investigationCard = card.category === "INVESTIGATION" || card.reqInvestigationUnlocked === true;
        if (!investigationCard) return true;
        return readInvestigationUnlocked(state);
    }
}

export { readInvestigationUnlocked };
export default InvestigationOfferingPolicy;
