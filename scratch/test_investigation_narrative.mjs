import {
    InvestigationReportPresenter,
    InvestigationReportTextRenderer,
    InvestigationNarrativeComposer,
    InvestigationNarrativeTextRenderer
} from '../game/src/warning/index.js';

const report = {
    id: 'narrative-1',
    observedAtVerse: 9,
    trialIndex: 1,
    sourceType: 'FOOTPRINTS',
    observations: [
        { facet: 'PHYSIQUE', tag: 'LARGE_BODY_PRESENT' },
        { facet: 'DIRECTION', tag: 'NORTH_ACTIVITY' }
    ]
};

const presenter = new InvestigationReportPresenter();
const textRenderer = new InvestigationReportTextRenderer({ locale: 'ja' });
const composer = new InvestigationNarrativeComposer();
const narrativeRenderer = new InvestigationNarrativeTextRenderer({ locale: 'ja' });

const view = presenter.present(report);
const rendered = textRenderer.render(view);
const narrative = composer.compose(rendered);
const output = narrativeRenderer.render(narrative);

if (rendered.sourceType !== 'FOOTPRINTS') {
    throw new Error('source type was not preserved');
}
if (!output.text.includes('北方')) {
    throw new Error('direction evidence missing from narrative');
}
if (!output.text.includes('大柄')) {
    throw new Error('physique evidence missing from narrative');
}
if (output.text.includes('strategicSuppression') || output.text.includes('ingress') || output.text.includes('route')) {
    throw new Error('truth leakage detected in narrative');
}
if (output.highlights.join(',') !== 'NORTH_ACTIVITY,LARGE_BODY_PRESENT') {
    throw new Error('narrative evidence ordering mismatch');
}

const unknownReport = {
    id: 'narrative-unknown',
    observedAtVerse: 10,
    trialIndex: 1,
    sourceType: 'FOOTPRINTS',
    observations: [{ facet: 'UNKNOWN', tag: 'UNMAPPED_TRACE' }]
};
const unknownOutput = narrativeRenderer.render(
    composer.compose(textRenderer.render(presenter.present(unknownReport)))
);
if (!unknownOutput.text.includes('INVESTIGATION_TAG_UNMAPPED_TRACE')) {
    throw new Error('unknown observation did not fall back visibly');
}

console.log('PASS investigation narrative');
