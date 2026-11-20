import { copyInvestigationObservation } from './enemy_observation_subject.js';

export function createInvestigationReport({
    id,
    observedAtVerse,
    trialIndex,
    sourceType,
    threatRevision = null,
    observations = [],
    textKey = null
} = {}) {
    return {
        id: id || `investigation:${trialIndex ?? 'unknown'}:${observedAtVerse ?? 'unknown'}`,
        observedAtVerse: Number.isInteger(observedAtVerse) ? observedAtVerse : null,
        trialIndex: Number.isInteger(trialIndex) ? trialIndex : null,
        sourceType: sourceType || 'UNKNOWN',
        threatRevision,
        observations: observations.map(copyInvestigationObservation),
        textKey
    };
}
