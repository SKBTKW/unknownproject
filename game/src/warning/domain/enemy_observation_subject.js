export const ENEMY_OBSERVATION_SCOPES = Object.freeze({
    SOURCE_FORCE: 'SOURCE_FORCE',
    ARMY: 'ARMY',
    REGION_UNATTRIBUTED: 'REGION_UNATTRIBUTED'
});

function exactKeys(value, keys) {
    return value && Object.getPrototypeOf(value) === Object.prototype
        && Object.keys(value).length === keys.length
        && keys.every(key => Object.hasOwn(value, key));
}

export function copyEnemyObservationSubject(subject) {
    if (!subject || typeof subject.scope !== 'string') {
        throw new TypeError('ENEMY_OBSERVATION_SUBJECT_INVALID');
    }
    if (subject.scope === ENEMY_OBSERVATION_SCOPES.SOURCE_FORCE
        && exactKeys(subject, ['scope', 'sourceForceId'])
        && typeof subject.sourceForceId === 'string' && subject.sourceForceId) {
        return { scope: subject.scope, sourceForceId: subject.sourceForceId };
    }
    if (subject.scope === ENEMY_OBSERVATION_SCOPES.ARMY
        && exactKeys(subject, ['scope', 'armyId'])
        && typeof subject.armyId === 'string' && subject.armyId) {
        return { scope: subject.scope, armyId: subject.armyId };
    }
    if (subject.scope === ENEMY_OBSERVATION_SCOPES.REGION_UNATTRIBUTED
        && exactKeys(subject, ['scope', 'regionId'])
        && typeof subject.regionId === 'string' && subject.regionId) {
        return { scope: subject.scope, regionId: subject.regionId };
    }
    throw new TypeError('ENEMY_OBSERVATION_SUBJECT_INVALID');
}

export function copyInvestigationObservation(observation) {
    if (!observation || Object.getPrototypeOf(observation) !== Object.prototype) {
        throw new TypeError('INVESTIGATION_OBSERVATION_INVALID');
    }
    const snapshot = structuredClone(observation);
    if (Object.hasOwn(snapshot, 'subject')) {
        snapshot.subject = copyEnemyObservationSubject(snapshot.subject);
    }
    return snapshot;
}
