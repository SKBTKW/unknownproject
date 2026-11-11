import { EnemyActivityDirectionSnapshot } from './enemy_activity_direction_snapshot.js';
import { EnemyInvasionPlan } from './enemy_invasion_plan.js';

export const ENEMY_INVASION_FOUNDATION_STATE_SCHEMA_VERSION = 1;

function freezeDeep(value) {
    Object.values(value).forEach(child => {
        if (child && typeof child === 'object') freezeDeep(child);
    });
    return Object.freeze(value);
}

export function copyEnemyInvasionFoundationState(snapshot) {
    if (!snapshot || Object.getPrototypeOf(snapshot) !== Object.prototype
        || Object.keys(snapshot).length !== 3
        || snapshot.schemaVersion !== ENEMY_INVASION_FOUNDATION_STATE_SCHEMA_VERSION
        || !Array.isArray(snapshot.directionSnapshots) || !Array.isArray(snapshot.plans)) {
        throw new TypeError('ENEMY_INVASION_FOUNDATION_STATE_INVALID');
    }
    const stageKeys = new Set();
    const directionSnapshots = snapshot.directionSnapshots.map(value => {
        const restored = EnemyActivityDirectionSnapshot.fromSnapshot(value).getSnapshot();
        const key = `${restored.stageId}:${restored.armyId}`;
        if (stageKeys.has(key)) throw new TypeError('ENEMY_INVASION_FOUNDATION_DIRECTION_DUPLICATE');
        stageKeys.add(key);
        return restored;
    });
    const planKeys = new Set();
    const plans = snapshot.plans.map(value => {
        const restored = EnemyInvasionPlan.fromSnapshot(value).getSnapshot();
        const key = `${restored.stageId}:${restored.armyId}`;
        if (planKeys.has(key)) throw new TypeError('ENEMY_INVASION_FOUNDATION_PLAN_DUPLICATE');
        planKeys.add(key);
        const directions = directionSnapshots.find(entry =>
            entry.stageId === restored.stageId && entry.armyId === restored.armyId
        );
        if (!directions) throw new TypeError('ENEMY_INVASION_FOUNDATION_DIRECTION_REQUIRED');
        for (const entry of restored.entries) {
            const source = directions.forces.find(force => force.sourceForceId === entry.sourceForceId);
            if (!source || source.activityDirection !== entry.activityDirection) {
                throw new TypeError('ENEMY_INVASION_FOUNDATION_ACTIVITY_MISMATCH');
            }
        }
        return restored;
    });
    return {
        schemaVersion: ENEMY_INVASION_FOUNDATION_STATE_SCHEMA_VERSION,
        directionSnapshots,
        plans
    };
}

export function emptyEnemyInvasionFoundationState() {
    return {
        schemaVersion: ENEMY_INVASION_FOUNDATION_STATE_SCHEMA_VERSION,
        directionSnapshots: [],
        plans: []
    };
}

export function readEnemyInvasionFoundationState(gameState) {
    return Object.hasOwn(gameState, 'enemyInvasionFoundationState')
        ? copyEnemyInvasionFoundationState(gameState.enemyInvasionFoundationState)
        : emptyEnemyInvasionFoundationState();
}

export function freezeEnemyInvasionFoundationState(snapshot) {
    return freezeDeep(copyEnemyInvasionFoundationState(snapshot));
}
