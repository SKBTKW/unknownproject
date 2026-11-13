export const STAGE1_TRIAL_PARTICIPATION_SCHEMA_VERSION = 1;

function freezeDeep(value) {
    Object.values(value).forEach(child => {
        if (child && typeof child === "object") freezeDeep(child);
    });
    return Object.freeze(value);
}

function requireSnapshot(snapshot) {
    if (!snapshot || Object.getPrototypeOf(snapshot) !== Object.prototype
        || snapshot.schemaVersion !== STAGE1_TRIAL_PARTICIPATION_SCHEMA_VERSION
        || snapshot.stageId !== 1 || snapshot.trialIndex !== 1
        || typeof snapshot.armyId !== "string" || !snapshot.armyId
        || !Number.isFinite(snapshot.strategicSuppression) || snapshot.strategicSuppression < 0
        || !snapshot.policy || snapshot.policy.enabled !== true
        || snapshot.policy.sourceDisposition !== "CONSOLIDATE_ALL_SOURCES"
        || snapshot.policy.runtimeProfileSource !== "PRIMARY_SOURCE"
        || typeof snapshot.policy.id !== "string" || !snapshot.policy.id
        || !Number.isSafeInteger(snapshot.policy.version) || snapshot.policy.version < 1
        || ![1, 2, 3].includes(snapshot.participantCount)
        || !Array.isArray(snapshot.sourceForceIds) || snapshot.sourceForceIds.length !== 3
        || !Array.isArray(snapshot.forces) || snapshot.forces.length !== snapshot.participantCount
        || !snapshot.consolidation) {
        throw new TypeError("STAGE1_TRIAL_PARTICIPATION_SNAPSHOT_INVALID");
    }
    const assigned = snapshot.forces.flatMap(force => force.sourceForceIds || []);
    const total = snapshot.forces.reduce((sum, force) => sum + Number(force.strategicSuppression || 0), 0);
    const forceIds = snapshot.forces.map(force => force.id);
    const ingressIds = snapshot.forces.map(force => force.ingressId);
    if (assigned.length !== 3 || new Set(assigned).size !== 3
        || new Set(snapshot.sourceForceIds).size !== 3
        || snapshot.sourceForceIds.some(id => !assigned.includes(id))
        || new Set(forceIds).size !== forceIds.length
        || new Set(ingressIds).size !== ingressIds.length
        || Math.abs(total - snapshot.strategicSuppression) > 1e-9
        || snapshot.forces.some(force => typeof force.id !== "string" || !force.id
            || !Array.isArray(force.sourceForceIds) || force.sourceForceIds.length === 0
            || !Number.isFinite(force.strategicSuppression) || force.strategicSuppression < 0
            || typeof force.ingressId !== "string" || !force.ingressId
            || !Number.isSafeInteger(force.ingressCell?.r) || !Number.isSafeInteger(force.ingressCell?.c))) {
        throw new TypeError("STAGE1_TRIAL_PARTICIPATION_FORCE_INVALID");
    }
}

export class Stage1TrialParticipationSnapshot {
    #snapshot;

    constructor(snapshot) {
        requireSnapshot(snapshot);
        this.#snapshot = freezeDeep(structuredClone(snapshot));
        Object.freeze(this);
    }

    getSnapshot() { return structuredClone(this.#snapshot); }

    static fromSnapshot(snapshot) { return new Stage1TrialParticipationSnapshot(snapshot); }
}

export function readStage1TrialParticipationState(gameState) {
    const raw = gameState?.stage1TrialParticipationState;
    if (raw === undefined) return { schemaVersion: 1, snapshots: [] };
    if (!raw || raw.schemaVersion !== 1 || !Array.isArray(raw.snapshots)) {
        throw new TypeError("STAGE1_TRIAL_PARTICIPATION_STATE_INVALID");
    }
    const snapshots = raw.snapshots.map(entry => Stage1TrialParticipationSnapshot.fromSnapshot(entry).getSnapshot());
    const keys = snapshots.map(entry => `${entry.stageId}:${entry.trialIndex}`);
    if (new Set(keys).size !== keys.length) {
        throw new TypeError("STAGE1_TRIAL_PARTICIPATION_STATE_DUPLICATE");
    }
    return { schemaVersion: 1, snapshots };
}

export function freezeStage1TrialParticipationState(state) {
    const copied = readStage1TrialParticipationState({ stage1TrialParticipationState: state });
    return freezeDeep(copied);
}
