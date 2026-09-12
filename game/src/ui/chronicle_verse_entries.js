import { CHRONICLE_IMPORTANCE } from '../systems/chronicle_system.js';

const weight = { MINOR: 1, MAJOR: 2, HISTORIC: 3 };

/** Read-only projection of observed Verse starts and the Chronicle preceding them. */
export function describeChronicleVerse(point, previousPoint, i18n) {
    const verse = point.verse;
    const sourceTurn = point.sourceCompletedTurn;
    const events = (point.chronicle || []).filter(event => event.turn === sourceTurn &&
        event.type !== 'VERSE_COMMITTED');
    const representative = events.reduce((best, event) =>
        !best || (weight[event.importance] || 1) > (weight[best.importance] || 1) ? event : best, null);
    const schedule = point.gameState?.trialSchedule || {};
    const trialIndex = Object.keys(schedule).find(key => /^trial\d+$/.test(key) && schedule[key] === verse);
    const stage = point.gameState?.stage?.id;
    const stageChange = previousPoint && stage !== previousPoint.gameState?.stage?.id;
    const title = trialIndex
        ? i18n.t('DEV_CHRONICLE_TRIAL_START', { trial: trialIndex.slice(5) })
        : representative?.nameKey
            ? i18n.t(representative.nameKey)
            : verse === 1
                ? i18n.t('DEV_CHRONICLE_ORIGIN')
                : stageChange
                    ? i18n.t('DEV_CHRONICLE_STAGE', { stage })
                    : i18n.t('DEV_CHRONICLE_UNMARKED', { verse });
    const importance = trialIndex ? CHRONICLE_IMPORTANCE.HISTORIC
        : representative?.importance || (stageChange ? CHRONICLE_IMPORTANCE.MAJOR : CHRONICLE_IMPORTANCE.MINOR);
    return { verse, title, importance, events, trialStart: Boolean(trialIndex), stageChange: Boolean(stageChange) };
}
