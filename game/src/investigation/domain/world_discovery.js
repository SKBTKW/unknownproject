// Pure, opt-in world observation/report contracts. No RNG, Truth or board writes.
function freeze(value) {
    if (value && typeof value === 'object') {
        Object.values(value).forEach(freeze);
        Object.freeze(value);
    }
    return value;
}
function text(value) {
    if (typeof value !== 'string' || !value.trim()) throw new TypeError('DISCOVERY_STRING_REQUIRED');
    return value;
}
function list(value = []) {
    if (!Array.isArray(value)) throw new TypeError('DISCOVERY_LIST_REQUIRED');
    return [...new Set(value.map(text))];
}
function discovery(value) {
    if (!value || typeof value !== 'object') throw new TypeError('DISCOVERY_REQUIRED');
    return {
        id: text(value.id), category: text(value.category),
        nameKey: text(value.nameKey), descriptionKey: text(value.descriptionKey),
        tags: list(value.tags), capabilities: list(value.capabilities),
        offeringUnlockKeys: list(value.offeringUnlockKeys)
    };
}
export function createObservableWorldProfile({ observations = [] } = {}) {
    if (!Array.isArray(observations)) throw new TypeError('WORLD_OBSERVATIONS_REQUIRED');
    const entries = observations.map(discovery);
    if (new Set(entries.map(e => e.id)).size !== entries.length) throw new TypeError('DUPLICATE_DISCOVERY_ID');
    return freeze({ schemaVersion: 1, observations: entries });
}
export function createWorldInvestigationReport({ id, category, observedAtVerse, sourceType,
    discoveries, phase = 'BASIC', parentReportId = null, checkResult = null } = {}) {
    if (!Number.isInteger(observedAtVerse) || observedAtVerse < 1) throw new TypeError('DISCOVERY_VERSE_REQUIRED');
    if (!['BASIC', 'FOLLOW_UP'].includes(phase)) throw new TypeError('DISCOVERY_PHASE_INVALID');
    if (phase === 'BASIC' && (checkResult !== null || parentReportId !== null)) throw new TypeError('BASIC_CHECK_FORBIDDEN');
    if (phase === 'FOLLOW_UP') {
        text(parentReportId);
        if (!checkResult || typeof checkResult !== 'object') throw new TypeError('SHARED_CHECK_RESULT_REQUIRED');
    }
    const entries = createObservableWorldProfile({ observations: discoveries }).observations;
    if (phase === 'BASIC' && !entries.length) throw new TypeError('BASIC_DISCOVERY_REQUIRED');
    if (entries.some(e => e.category !== category)) throw new TypeError('CROSS_CATEGORY_DISCOVERY_FORBIDDEN');
    // Shared CheckResult is copied without an Investigation-specific roll format.
    return freeze({ schemaVersion: 1, id: text(id), category: text(category), observedAtVerse,
        sourceType: text(sourceType), phase, parentReportId,
        checkResult: checkResult === null ? null : JSON.parse(JSON.stringify(checkResult)), discoveries: entries });
}
export function createDiscoveryLedger(reports = []) {
    if (!Array.isArray(reports)) throw new TypeError('DISCOVERY_REPORTS_REQUIRED');
    let ledger = freeze({ schemaVersion: 1, reports: [] });
    for (const report of reports) ledger = recordWorldDiscovery(ledger, report).ledger;
    return ledger;
}
export function recordWorldDiscovery(ledger, value) {
    if (ledger?.schemaVersion !== 1 || !Array.isArray(ledger.reports)) throw new TypeError('DISCOVERY_LEDGER_REQUIRED');
    const report = createWorldInvestigationReport(value);
    const existing = ledger.reports.find(r => r.id === report.id);
    if (existing) {
        if (JSON.stringify(existing) !== JSON.stringify(report)) throw new TypeError('DISCOVERY_REPORT_ID_CONFLICT');
        return freeze({ ledger, report: existing, recorded: false, newIds: [], repeatedIds: [] });
    }
    if (report.phase === 'FOLLOW_UP') {
        const parent = ledger.reports.find(r => r.id === report.parentReportId);
        if (!parent || parent.phase !== 'BASIC' || parent.category !== report.category) throw new TypeError('DISCOVERY_PARENT_REQUIRED');
        if (ledger.reports.some(r => r.parentReportId === parent.id)) throw new TypeError('DISCOVERY_FOLLOW_UP_ALREADY_RECORDED');
    }
    const prior = ledger.reports.flatMap(r => r.discoveries);
    if (report.discoveries.some(d => prior.some(p => p.id === d.id && p.category !== d.category))) throw new TypeError('DISCOVERY_CATEGORY_CONFLICT');
    const ids = new Set(prior.map(d => d.id));
    return freeze({ ledger: { schemaVersion: 1, reports: [...ledger.reports, report] }, report, recorded: true,
        newIds: report.discoveries.filter(d => !ids.has(d.id)).map(d => d.id),
        repeatedIds: report.discoveries.filter(d => ids.has(d.id)).map(d => d.id) });
}
export function hasRecordedDiscovery(ledger, id) {
    return typeof id === 'string' && id.length > 0 && ledger?.schemaVersion === 1 &&
        Array.isArray(ledger.reports) && ledger.reports.some(r => r.discoveries?.some(d => d.id === id));
}
export function projectWorldDiscoveryReport(ledger, reportId) {
    const index = ledger?.reports?.findIndex(r => r.id === reportId) ?? -1;
    if (index < 0) return null;
    const earlier = new Set(ledger.reports.slice(0, index).flatMap(r => r.discoveries.map(d => d.id)));
    const report = ledger.reports[index];
    return freeze({ reportId: report.id, category: report.category, observedAtVerse: report.observedAtVerse,
        phase: report.phase, checkResult: report.checkResult,
        discoveries: report.discoveries.map(d => ({ ...d, isNew: !earlier.has(d.id) })),
        // These are declared future unlocks, not a claim that any card is active.
        potentialOfferingUnlockKeys: [...new Set(report.discoveries.flatMap(d => d.offeringUnlockKeys))] });
}
// Future composition opts into this policy; existing runtime availability is unchanged.
export function isExplorationCategoryAvailable({ firstRun, investigationUnlocked = false } = {}) {
    if (typeof firstRun !== 'boolean') return false;
    return firstRun ? investigationUnlocked === true : true;
}

export function restoreDiscoveryLedger(value = null) {
    if (value !== null && (value?.schemaVersion !== 1 || !Array.isArray(value.reports))) {
        throw new TypeError('DISCOVERY_LEDGER_INVALID');
    }
    return createDiscoveryLedger(value?.reports || []);
}
