import { recordInvestigationReport } from "../domain/known_enemy_state.js";
import { InvestigationHistoryComparator } from "./investigation_history_comparator.js";

function isSameTrial(report, trialIndex) {
    if (!Number.isInteger(trialIndex)) return true;
    return Number.isInteger(report?.trialIndex) && report.trialIndex === trialIndex;
}

function isEarlierReport(report, currentReport) {
    if (!report || report === currentReport) return false;
    const currentVerse = Number.isInteger(currentReport?.observedAtVerse)
        ? currentReport.observedAtVerse
        : null;
    const reportVerse = Number.isInteger(report?.observedAtVerse)
        ? report.observedAtVerse
        : null;

    if (currentVerse === null || reportVerse === null) return true;
    return reportVerse <= currentVerse;
}

/**
 * Coordinates KnownEnemyState history without reading Trial truth.
 *
 * Responsibilities:
 * - append an InvestigationReport to KnownEnemyState;
 * - find the immediately preceding report for the same Trial;
 * - compare only those two known snapshots;
 * - return the comparison alongside the recorded state.
 *
 * It deliberately does not infer enemy truth from missing observations.
 */
export class KnownEnemyStateService {
    constructor({ comparator = new InvestigationHistoryComparator() } = {}) {
        this.comparator = comparator;
    }

    findPreviousReport(state, currentReport) {
        const reports = Array.isArray(state?.reports) ? state.reports : [];
        const trialIndex = Number.isInteger(currentReport?.trialIndex)
            ? currentReport.trialIndex
            : (Number.isInteger(state?.trialIndex) ? state.trialIndex : null);

        for (let index = reports.length - 1; index >= 0; index -= 1) {
            const report = reports[index];
            if (!isSameTrial(report, trialIndex)) continue;
            if (!isEarlierReport(report, currentReport)) continue;
            return report;
        }
        return null;
    }

    record(state, report) {
        if (!state || !report) {
            return { state, report: report || null, previousReport: null, comparison: null };
        }

        const previousReport = this.findPreviousReport(state, report);
        recordInvestigationReport(state, report);

        const comparison = previousReport && this.comparator?.compare
            ? this.comparator.compare(previousReport, report)
            : null;

        return {
            state,
            report,
            previousReport,
            comparison
        };
    }
}

export default KnownEnemyStateService;
