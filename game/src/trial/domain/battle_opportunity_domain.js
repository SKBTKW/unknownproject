function cloneData(value) {
    if (value === undefined) return undefined;
    return JSON.parse(JSON.stringify(value));
}

/**
 * Domain-only Battle Opportunity contract.
 *
 * Eligibility rules, Ember cost and Fortune resolution are intentionally left
 * to later lifecycle policy. This object only preserves provenance and hooks.
 */
export function createBattleOpportunityState({
    opportunityId = null,
    state = "UNRESOLVED",
    eligibility = "UNRESOLVED",
    normalOutcome = null,
    normalOutcomeProvenance = null,
    emberCommitHook = null,
    fortuneResultHook = null,
    metadata = {}
} = {}) {
    return Object.freeze({
        opportunityId,
        state,
        eligibility,
        normalOutcome: cloneData(normalOutcome),
        normalOutcomeProvenance: cloneData(normalOutcomeProvenance),
        emberCommitHook: cloneData(emberCommitHook),
        fortuneResultHook: cloneData(fortuneResultHook),
        metadata: cloneData(metadata) || {}
    });
}
