function cloneData(value) {
    if (value === undefined) return undefined;
    return JSON.parse(JSON.stringify(value));
}

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

    const snapshot = cloneData(report);
    state.reports.push(snapshot);
    for (const observation of snapshot.observations || []) {
        const tag = observation?.tag;
        if (typeof tag === "string" && tag.length > 0 && !state.observedTags.includes(tag)) {
            state.observedTags.push(tag);
        }
    }
    return state;
}
