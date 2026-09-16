import { InvestigationReportPresenter } from '../game/src/warning/presentation/investigation_report_presenter.js';

const presenter = new InvestigationReportPresenter();
const report = {
    id: 'r1',
    observedAtVerse: 9,
    trialIndex: 1,
    sourceType: 'FOOTPRINTS',
    observations: [
        { facet: 'DIRECTION', tag: 'NORTH_ACTIVITY' },
        { facet: 'PHYSIQUE', tag: 'LARGE_BODY_PRESENT' }
    ]
};

const view = presenter.present(report);

if (view.sourceTitleKey !== 'INVESTIGATION_SOURCE_FOOTPRINTS_TITLE') {
    throw new Error('source title key mismatch');
}
if (view.observations[0].valueKey !== 'INVESTIGATION_TAG_NORTH_ACTIVITY') {
    throw new Error('direction tag mapping mismatch');
}
if (view.observations[1].highlightToken !== 'LARGE_BODY_PRESENT') {
    throw new Error('highlight token mismatch');
}
if ('strategicSuppression' in view || 'routes' in view || 'ingress' in view) {
    throw new Error('truth leakage detected');
}

console.log('PASS investigation report presenter');
