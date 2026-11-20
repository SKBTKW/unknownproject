import { InvestigationHistoryPresenter } from '../../warning/presentation/investigation_history_presenter.js';

const TOPICS = Object.freeze([
    Object.freeze({ id: 'ENEMY', labelKey: 'UI_ADVISOR_TOPIC_ENEMY' }),
    Object.freeze({ id: 'LAND', labelKey: 'UI_ADVISOR_TOPIC_LAND' }),
    Object.freeze({ id: 'STATUS', labelKey: 'UI_ADVISOR_TOPIC_STATUS' })
]);

/** Read-only projection. Never turn an observation tag into a guess about a force. */
export function projectAdvisorReportTopics(state, { historyPresenter = new InvestigationHistoryPresenter() } = {}) {
    const history = historyPresenter.presentHistory(state?.knownEnemyState || null);
    const enemyEntries = [];
    for (const item of history) {
        for (const observation of [...item.newlyObserved, ...item.reconfirmed]) {
            enemyEntries.push(Object.freeze({
                verse: item.observedAtVerse,
                reportId: item.reportId,
                facet: observation.facet,
                tag: observation.tag,
                valueKey: observation.valueKey,
                statusKey: item.newlyObserved.includes(observation)
                    ? 'INVESTIGATION_STATUS_NEW' : 'INVESTIGATION_STATUS_RECONFIRMED'
            }));
        }
    }
    // LAND: only typed, evidenced land records may be added in a later contract.
    // No inference from free-form gameLogs and no fabricated coordinates.
    return Object.freeze(TOPICS.map(topic => Object.freeze({
        ...topic,
        entries: Object.freeze(topic.id === 'ENEMY' ? enemyEntries : [])
    })));
}
