import { WARNING_STATES, getWarningStateRank } from "../domain/warning_state.js";

export function readInvestigationUnlocked(state) {
    if (!state || typeof state !== "object") return false;
    if (typeof state.isInvestigationUnlocked === "function") return state.isInvestigationUnlocked() === true;
    if (typeof state.investigationUnlocked === "boolean") return state.investigationUnlocked;
    if (typeof state.warningState?.investigationUnlocked === "boolean") return state.warningState.investigationUnlocked;
    return false;
}

function readWarningState(state, warningStateService = null) {
    const fromService = warningStateService?.getState?.();
    if (typeof fromService === "string") return fromService;
    if (typeof state?.warningState === "string") return state.warningState;
    if (typeof state?.warningState?.state === "string") return state.warningState.state;
    return null;
}

/**
 * Card/Offering-facing read policy. It owns no Offering weight or card selection.
 * The canonical unlock bit is authoritative; semantic Warning state is used only
 * as an additional consistency guard when it is available.
 */
export class InvestigationAvailabilityPolicy {
    isAvailable(state, { warningStateService = null } = {}) {
        if (!readInvestigationUnlocked(state)) return false;

        const warningState = readWarningState(state, warningStateService);
        if (!warningState) return true;

        return getWarningStateRank(warningState) >= getWarningStateRank(WARNING_STATES.OMEN);
    }
}

export function isInvestigationAvailable(state, options = {}) {
    return new InvestigationAvailabilityPolicy().isAvailable(state, options);
}

export default InvestigationAvailabilityPolicy;
