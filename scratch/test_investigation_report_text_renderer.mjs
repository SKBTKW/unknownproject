import {
    InvestigationReportPresenter,
    InvestigationReportTextRenderer
} from '../game/src/warning/index.js';

const presenter = new InvestigationReportPresenter();
const renderer = new InvestigationReportTextRenderer({ locale: 'ja' });

const view = presenter.present({
    id: 'r-footprints-1',
    observedAtVerse: 9,
    trialIndex: 1,
    sourceType: 'FOOTPRINTS',
    observations: [
        { facet: 'DIRECTION', tag: 'NORTH_ACTIVITY' },
        { facet: 'PHYSIQUE', tag: 'LARGE_BODY_PRESENT' }
    ]
});

const rendered = renderer.render(view);

if (rendered.title !== '足跡の調査') throw new Error('localized title mismatch');
if (!rendered.body.includes('足跡')) throw new Error('localized body mismatch');
if (rendered.observations[0].value !== '北方で活動の痕跡') {
    throw new Error('direction copy mismatch');
}
if (rendered.observations[1].value !== '大柄な個体を含む') {
    throw new Error('physique copy mismatch');
}
if (rendered.observations[1].highlightToken !== 'LARGE_BODY_PRESENT') {
    throw new Error('highlight token lost');
}
if ('strategicSuppression' in rendered || 'routes' in rendered || 'ingress' in rendered) {
    throw new Error('truth leakage detected');
}

const standardForceView = presenter.present({
    id: 'r-standard-force',
    observedAtVerse: 9,
    trialIndex: 1,
    sourceType: 'SCOUT_SIGHTING',
    observations: [
        { facet: 'PHYSIQUE', tag: 'MEDIUM_BODY_PRESENT' },
        { facet: 'EQUIPMENT', tag: 'STANDARD_EQUIPMENT' }
    ]
});
const standardForceRendered = renderer.render(standardForceView);
if (standardForceRendered.observations[0].value !== '中型の個体を含む') {
    throw new Error('medium physique copy mismatch');
}
if (standardForceRendered.observations[1].value !== '標準装備の個体を含む') {
    throw new Error('standard equipment copy mismatch');
}

console.log('PASS investigation report text renderer');
