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
    battleId = null,
    state = "UNRESOLVED",
    eligibility = "UNRESOLVED",
    normalOutcome = null,
    normalOutcomeProvenance = null,
    causalProvenance = null,
    sourceCauses = [],
    emberCommitHook = null,
    fortuneResultHook = null,
    metadata = {}
} = {}) {
    return Object.freeze({
        opportunityId,
        battleId,
        state,
        eligibility,
        normalOutcome: cloneData(normalOutcome),
        normalOutcomeProvenance: cloneData(normalOutcomeProvenance),
        causalProvenance: cloneData(causalProvenance),
        sourceCauses: Object.freeze([...(Array.isArray(sourceCauses) ? sourceCauses : [])]),
        emberCommitHook: cloneData(emberCommitHook),
        fortuneResultHook: cloneData(fortuneResultHook),
        metadata: cloneData(metadata) || {}
    });
}
