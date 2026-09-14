export function createKnownEnemyState({ trialIndex = 1 } = {}) {
    return {
        trialIndex,
        reports: [],
        observedTags: new Set()
    };
}

export function recordInvestigationReport(state, report) {
    if (!state || !report) return state;
    state.reports.push(report);
    for (const observation of report.observations || []) {
        if (observation?.tag) state.observedTags.add(observation.tag);
    }
    return state;
}
