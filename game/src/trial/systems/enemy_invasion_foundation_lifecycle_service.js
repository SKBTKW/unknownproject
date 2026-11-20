import { EnemyActivityDirectionSnapshot } from '../domain/enemy_activity_direction_snapshot.js';
import { EnemyInvasionPlan } from '../domain/enemy_invasion_plan.js';
import { EnemyForceConsolidationSnapshot } from '../domain/enemy_force_consolidation_snapshot.js';
import {
    freezeEnemyInvasionFoundationState,
    readEnemyInvasionFoundationState
} from '../domain/enemy_invasion_foundation_state.js';

function contentKey(value) {
    return JSON.stringify(value, (_key, entry) => entry && typeof entry === 'object' && !Array.isArray(entry)
        ? Object.fromEntries(Object.keys(entry).sort().map(key => [key, entry[key]]))
        : entry);
}

function registerImmutable(values, candidate, label) {
    const existing = values.find(entry =>
        entry.stageId === candidate.stageId && entry.armyId === candidate.armyId
    );
    if (!existing) return { registered: true, values: [...values, candidate], value: candidate };
    if (contentKey(existing) !== contentKey(candidate)) {
        throw new Error(`ENEMY_INVASION_FOUNDATION_${label}_ALREADY_REGISTERED`);
    }
    return { registered: false, values, value: existing };
}

/** Explicit GameState owner. It never resolves directions, cells, or observations. */
export class EnemyInvasionFoundationLifecycleService {
    #gameState;

    constructor({ gameState = {} } = {}) {
        if (!gameState || typeof gameState !== 'object' || Array.isArray(gameState)) {
            throw new TypeError('ENEMY_INVASION_FOUNDATION_GAME_STATE_REQUIRED');
        }
        if (Object.hasOwn(gameState, 'enemyInvasionFoundationState')) {
            gameState.enemyInvasionFoundationState = freezeEnemyInvasionFoundationState(
                gameState.enemyInvasionFoundationState
            );
        }
        this.#gameState = gameState;
        Object.freeze(this);
    }

    registerDirectionSnapshot(value) {
        const candidate = EnemyActivityDirectionSnapshot.fromSnapshot(
            value instanceof EnemyActivityDirectionSnapshot ? value.getSnapshot() : value
        ).getSnapshot();
        const state = this.getSnapshot();
        const result = registerImmutable(state.directionSnapshots, candidate, 'DIRECTION');
        this.#gameState.enemyInvasionFoundationState = freezeEnemyInvasionFoundationState({
            ...state,
            directionSnapshots: result.values
        });
        return { registered: result.registered, snapshot: EnemyActivityDirectionSnapshot.fromSnapshot(result.value) };
    }

    getDirectionSnapshot(stageId, armyId) {
        const value = this.getSnapshot().directionSnapshots.find(entry =>
            entry.stageId === stageId && entry.armyId === armyId
        );
        return value ? EnemyActivityDirectionSnapshot.fromSnapshot(value) : null;
    }

    registerPlan(value) {
        const candidate = EnemyInvasionPlan.fromSnapshot(
            value instanceof EnemyInvasionPlan ? value.getSnapshot() : value
        ).getSnapshot();
        const state = this.getSnapshot();
        const result = registerImmutable(state.plans, candidate, 'PLAN');
        this.#gameState.enemyInvasionFoundationState = freezeEnemyInvasionFoundationState({
            ...state,
            plans: result.values
        });
        return { registered: result.registered, plan: EnemyInvasionPlan.fromSnapshot(result.value) };
    }

    getPlan(stageId, armyId) {
        const value = this.getSnapshot().plans.find(entry =>
            entry.stageId === stageId && entry.armyId === armyId
        );
        return value ? EnemyInvasionPlan.fromSnapshot(value) : null;
    }

    registerConsolidation(value) {
        const candidate = EnemyForceConsolidationSnapshot.fromSnapshot(
            value instanceof EnemyForceConsolidationSnapshot ? value.getSnapshot() : value
        ).getSnapshot();
        const state = this.getSnapshot();
        const result = registerImmutable(state.consolidations, candidate, 'CONSOLIDATION');
        this.#gameState.enemyInvasionFoundationState = freezeEnemyInvasionFoundationState({
            ...state,
            consolidations: result.values
        });
        return {
            registered: result.registered,
            consolidation: EnemyForceConsolidationSnapshot.fromSnapshot(result.value)
        };
    }

    getConsolidation(stageId, armyId) {
        const value = this.getSnapshot().consolidations.find(entry =>
            entry.stageId === stageId && entry.armyId === armyId
        );
        return value ? EnemyForceConsolidationSnapshot.fromSnapshot(value) : null;
    }

    getSnapshot() { return readEnemyInvasionFoundationState(this.#gameState); }

    restoreSnapshot(snapshot) {
        this.#gameState.enemyInvasionFoundationState = freezeEnemyInvasionFoundationState(snapshot);
        return this.getSnapshot();
    }
}

export default EnemyInvasionFoundationLifecycleService;
