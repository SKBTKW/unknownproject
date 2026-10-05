export const RELATIVE_ENGAGEMENT = Object.freeze({
    FRONT: "FRONT",
    LEFT_FLANK: "LEFT_FLANK",
    RIGHT_FLANK: "RIGHT_FLANK",
    REAR: "REAR",
    UNRESOLVED: "UNRESOLVED"
});

function clone(value) {
    return value == null ? value : JSON.parse(JSON.stringify(value));
}

function normalizePoint(point) {
    if (!point) return null;
    const r = Number.isInteger(point.r) ? point.r : point.row;
    const c = Number.isInteger(point.c) ? point.c : point.column;
    return Number.isInteger(r) && Number.isInteger(c)
        ? { r, c, cellId: point.cellId || point.id || null }
        : null;
}

export function createSpatialEngagement({
    battleLocation = null,
    enemyApproach = null,
    humanEngagementOrigin = null,
    enemyAdvanceVector = null,
    humanAttackVector = null,
    relativeEngagement = RELATIVE_ENGAGEMENT.UNRESOLVED
} = {}) {
    return Object.freeze({
        battleLocation: normalizePoint(battleLocation),
        enemyApproach: normalizePoint(enemyApproach),
        humanEngagementOrigin: normalizePoint(humanEngagementOrigin),
        enemyAdvanceVector: clone(enemyAdvanceVector),
        humanAttackVector: clone(humanAttackVector),
        relativeEngagement
    });
}

export default createSpatialEngagement;
