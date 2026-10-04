import { InvestigationReportPresenter } from "./investigation_report_presenter.js";
import { InvestigationReportTextRenderer } from "./investigation_report_text_renderer.js";
import { InvestigationNarrativeComposer } from "./investigation_narrative_composer.js";
import { InvestigationNarrativeTextRenderer } from "./investigation_narrative_text_renderer.js";
import { InvestigationHistoryPresenter } from "./investigation_history_presenter.js";

function freezeShallow(value) {
    return value && typeof value === "object" ? Object.freeze(value) : value;
}

function freezeSnapshot(value) {
    if (!value || typeof value !== "object" || Object.isFrozen(value)) return value;
    for (const child of Object.values(value)) freezeSnapshot(child);
    return Object.freeze(value);
}

/**
 * Presentation-only adapter from an already-resolved Investigation execution
 * result to player-facing report/narrative models.
 *
 * Enemy facts come exclusively from result.report. Roll/comparison metadata
 * explains observation volume and whether evidence is new/reconfirmed.
 */
export class InvestigationResultPresentationBridge {
    constructor({
        locale = "ja",
        reportPresenter = new InvestigationReportPresenter(),
        reportRenderer = null,
        narrativeComposer = new InvestigationNarrativeComposer(),
        narrativeRenderer = null,
        historyPresenter = new InvestigationHistoryPresenter()
    } = {}) {
        this.reportPresenter = reportPresenter;
        this.reportRenderer = reportRenderer || new InvestigationReportTextRenderer({ locale });
        this.narrativeComposer = narrativeComposer;
        this.narrativeRenderer = narrativeRenderer || new InvestigationNarrativeTextRenderer({ locale });
        this.historyPresenter = historyPresenter;
    }

    projectHistory(reportsOrState) {
        const entries = this.historyPresenter.presentHistory(reportsOrState);
        return Object.freeze(entries.map(entry => Object.freeze({
            ...entry,
            newlyObserved: Object.freeze((entry.newlyObserved || []).map(item => Object.freeze({ ...item }))),
            reconfirmed: Object.freeze((entry.reconfirmed || []).map(item => Object.freeze({ ...item }))),
            snapshot: entry.snapshot == null
                ? null
                : freezeSnapshot(JSON.parse(JSON.stringify(entry.snapshot)))
        })));
    }

    project(result) {
        if (!result?.success || !result?.report) {
            return Object.freeze({
                available: false,
                report: null,
                narrative: null,
                historyDelta: null
            });
        }

        const reportView = this.reportPresenter.presentResult(result);
        const renderedReport = this.reportRenderer.render(reportView);
        const narrativeModel = this.narrativeComposer.compose(renderedReport);
        const narrative = this.narrativeRenderer.render(narrativeModel);
        const historyDelta = result.comparison
            ? this.historyPresenter.present(result.comparison)
            : null;

        return Object.freeze({
            available: true,
            report: freezeShallow(renderedReport),
            narrative: freezeShallow(narrative),
            historyDelta: freezeShallow(historyDelta)
        });
    }
}

export default InvestigationResultPresentationBridge;
