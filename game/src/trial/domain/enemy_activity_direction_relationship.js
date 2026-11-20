import { ENEMY_ACTIVITY_DIRECTIONS } from './enemy_activity_direction_snapshot.js';

export const ENEMY_ACTIVITY_DIRECTION_RELATIONSHIPS = Object.freeze({
    SAME: 'SAME',
    ADJACENT: 'ADJACENT',
    OPPOSITE: 'OPPOSITE'
});

const INDEX = Object.freeze(Object.fromEntries(
    ENEMY_ACTIVITY_DIRECTIONS.map((direction, index) => [direction, index])
));

function requireDirection(direction) {
    if (!ENEMY_ACTIVITY_DIRECTIONS.includes(direction)) {
        throw new TypeError('ENEMY_ACTIVITY_DIRECTION_INVALID');
    }
}

export function classifyEnemyActivityDirectionRelationship(first, second) {
    requireDirection(first);
    requireDirection(second);
    const distance = Math.abs(INDEX[first] - INDEX[second]);
    if (distance === 0) return ENEMY_ACTIVITY_DIRECTION_RELATIONSHIPS.SAME;
    if (distance === 2) return ENEMY_ACTIVITY_DIRECTION_RELATIONSHIPS.OPPOSITE;
    return ENEMY_ACTIVITY_DIRECTION_RELATIONSHIPS.ADJACENT;
}

/** Direction support only. It mirrors the existing 70/15/15 rule without selecting a direction. */
export function listSupportedIngressDirections(activityDirection) {
    requireDirection(activityDirection);
    const index = INDEX[activityDirection];
    return [
        activityDirection,
        ENEMY_ACTIVITY_DIRECTIONS[(index + 1) % ENEMY_ACTIVITY_DIRECTIONS.length],
        ENEMY_ACTIVITY_DIRECTIONS[(index + ENEMY_ACTIVITY_DIRECTIONS.length - 1)
            % ENEMY_ACTIVITY_DIRECTIONS.length]
    ];
}

