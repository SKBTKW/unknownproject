import { InvestigationHistoryPresenter } from '../../warning/presentation/investigation_history_presenter.js';

/**
 * Read-only record timeline. Investigation reports stay authoritative in
 * KnownEnemyState; no second history is persisted or inferred from gameLogs.
 */
export function getAdvisorRecords(state, limit = 20) {
    const logs = Array.isArray(state?.gameLogs) ? state.gameLogs : [];
    const logRecords = logs.map(raw => {
        const match = typeof raw === "string" ? raw.match(/^\[T(\d+)\]\s*(.*)$/) : null;
        return match
            ? { turn: Number(match[1]), message: match[2] }
            : { turn: state?.turn || 1, message: String(raw ?? "") };
    });
    const history = new InvestigationHistoryPresenter().presentHistory(state?.knownEnemyState || null);
    const investigationRecords = history.flatMap(report => [
        ...report.newlyObserved.map(observation => ({ observation, statusKey: 'INVESTIGATION_STATUS_NEW' })),
        ...report.reconfirmed.map(observation => ({ observation, statusKey: 'INVESTIGATION_STATUS_RECONFIRMED' }))
    ].map(({ observation, statusKey }) => ({
        turn: report.observedAtVerse,
        valueKey: observation.valueKey,
        statusKey
    })));

    const count = Number.isInteger(limit) ? Math.max(0, limit) : 20;
    return [...logRecords, ...investigationRecords]
        .map((record, index) => ({ ...record, index }))
        .sort((a, b) => {
            const aTurn = Number.isInteger(a.turn) ? a.turn : -1;
            const bTurn = Number.isInteger(b.turn) ? b.turn : -1;
            return bTurn - aTurn || a.index - b.index;
        })
        .slice(0, count)
        .map(({ index, ...record }) => record);
}
