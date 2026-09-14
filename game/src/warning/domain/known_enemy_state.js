export function createKnownEnemyState({ trialIndex = 1 } = {}) {
    return {
        trialIndex,
        reports: [],
        observedTags: []
    };
}

export function recordInvestigationReport(state, report) {
    if (!state || !report) return state;
    if (!Array.isArray(state.reports)) state.reports = [];
    if (!Array.isArray(state.observedTags)) state.observedTags = [];

    state.reports.push(report);
    for (const observation of report.observations || []) {
        const tag = observation?.tag;
        if (typeof tag === "string" && tag.length > 0 && !state.observedTags.includes(tag)) {
            state.observedTags.push(tag);
        }
    }
    return state;
}
