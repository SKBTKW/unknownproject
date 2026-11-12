import { ENEMY_OBSERVATION_SCOPES } from './enemy_observation_subject.js';

/** Returns immutable references into Known reports; it never rewrites or promotes observations. */
export function resolveParticipatingForceInvestigationProvenance({
    participatingForce,
    knownEnemyState
} = {}) {
    if (!participatingForce || !Array.isArray(participatingForce.sourceForceIds)
        || typeof participatingForce.participantUnitId !== 'string') {
        throw new TypeError('PARTICIPATING_FORCE_PROVENANCE_PARTICIPANT_INVALID');
    }
    const reports = Array.isArray(knownEnemyState?.reports) ? knownEnemyState.reports : [];
    const sourceIds = new Set(participatingForce.sourceForceIds);
    const reportReferences = [];
    reports.forEach((report, reportIndex) => {
        const observationIndexes = [];
        const matchedSourceForceIds = new Set();
        (Array.isArray(report?.observations) ? report.observations : []).forEach((observation, index) => {
            const subject = observation?.subject;
            if (subject?.scope === ENEMY_OBSERVATION_SCOPES.SOURCE_FORCE
                && sourceIds.has(subject.sourceForceId)) {
                observationIndexes.push(index);
                matchedSourceForceIds.add(subject.sourceForceId);
            }
        });
        if (observationIndexes.length) {
            reportReferences.push({
                reportId: report.id ?? null,
                reportIndex,
                observationIndexes,
                sourceForceIds: [...matchedSourceForceIds]
            });
        }
    });
    return Object.freeze({
        participantUnitId: participatingForce.participantUnitId,
        sourceForceIds: Object.freeze([...participatingForce.sourceForceIds]),
        reportReferences: Object.freeze(reportReferences.map(reference => Object.freeze({
            ...reference,
            observationIndexes: Object.freeze(reference.observationIndexes),
            sourceForceIds: Object.freeze(reference.sourceForceIds)
        })))
    });
}

