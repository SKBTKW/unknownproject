import { EnemyArmyBlueprint } from '../domain/enemy_army_blueprint.js';
import {
    readBlueprintLifecycleSnapshot, freezeBlueprintLifecycleSnapshot
} from '../domain/enemy_army_blueprint_lifecycle_state.js';

function validateStage(stageId) {
    if (!Number.isSafeInteger(stageId) || stageId < 1) throw new TypeError('BLUEPRINT_LIFECYCLE_STAGE_INVALID');
}

// Object-key order is not part of blueprint content; array order remains significant.
function contentKey(value) {
    return JSON.stringify(value, (_key, entry) => entry && typeof entry === 'object' && !Array.isArray(entry)
        ? Object.fromEntries(Object.keys(entry).sort().map(key => [key, entry[key]]))
        : entry);
}

/** Explicit opt-in writer for GameState-owned snapshots. Never generates armies. */
export class EnemyArmyBlueprintLifecycleService {
    #gameState;

    constructor({ gameState = {} } = {}) {
        if (!gameState || typeof gameState !== 'object' || Array.isArray(gameState)) {
            throw new TypeError('BLUEPRINT_LIFECYCLE_GAME_STATE_REQUIRED');
        }
        const initial = readBlueprintLifecycleSnapshot(gameState);
        if (Object.hasOwn(gameState, 'enemyArmyBlueprintState')) {
            gameState.enemyArmyBlueprintState = freezeBlueprintLifecycleSnapshot(initial);
        }
        this.#gameState = gameState;
        Object.freeze(this);
    }

    registerBlueprint(stageId, blueprint) {
        validateStage(stageId);
        const validated = EnemyArmyBlueprint.fromSnapshot(
            blueprint instanceof EnemyArmyBlueprint ? blueprint.getSnapshot() : blueprint
        );
        const candidate = validated.getSnapshot();
        if (candidate.stageId !== stageId) throw new TypeError('BLUEPRINT_LIFECYCLE_STAGE_MISMATCH');
        const snapshot = this.getSnapshot();
        const existing = snapshot.blueprints.find(entry => entry.stageId === stageId);
        if (existing) {
            if (contentKey(existing) !== contentKey(candidate)) throw new Error('BLUEPRINT_LIFECYCLE_STAGE_ALREADY_REGISTERED');
            return { registered: false, blueprint: EnemyArmyBlueprint.fromSnapshot(existing) };
        }
        // Validate everything before the single state write.
        const next = freezeBlueprintLifecycleSnapshot({ ...snapshot, blueprints: [...snapshot.blueprints, candidate] });
        this.#gameState.enemyArmyBlueprintState = next;
        return { registered: true, blueprint: validated };
    }

    getBlueprint(stageId) {
        validateStage(stageId);
        const saved = this.getSnapshot().blueprints.find(entry => entry.stageId === stageId);
        return saved ? EnemyArmyBlueprint.fromSnapshot(saved) : null;
    }

    getSnapshot() { return readBlueprintLifecycleSnapshot(this.#gameState); }

    /** Explicit authoritative save replacement, not a registration/upsert operation. */
    restoreSnapshot(snapshot) {
        const next = freezeBlueprintLifecycleSnapshot(snapshot);
        this.#gameState.enemyArmyBlueprintState = next;
        return this.getSnapshot();
    }
}
