import { EnemyArmyBlueprint } from '../domain/enemy_army_blueprint.js';
import {
    readBlueprintLifecycleSnapshot, freezeBlueprintLifecycleSnapshot
} from '../domain/enemy_army_blueprint_lifecycle_state.js';
import { EnemyArmyTraitProvenance } from '../domain/enemy_army_trait_provenance.js';
import {
    ENEMY_ARMY_TRAIT_PROVENANCE_STATE_SCHEMA_VERSION,
    freezeEnemyArmyTraitProvenanceState,
    readEnemyArmyTraitProvenanceState,
    validateEnemyArmyTraitProvenanceAssociations
} from '../domain/enemy_army_trait_provenance_state.js';

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
        const initialProvenance = readEnemyArmyTraitProvenanceState(gameState);
        validateEnemyArmyTraitProvenanceAssociations(initial, initialProvenance);
        if (Object.hasOwn(gameState, 'enemyArmyBlueprintState')) {
            gameState.enemyArmyBlueprintState = freezeBlueprintLifecycleSnapshot(initial);
        }
        if (Object.hasOwn(gameState, 'enemyArmyTraitProvenanceState')) {
            gameState.enemyArmyTraitProvenanceState = freezeEnemyArmyTraitProvenanceState(initialProvenance);
        }
        this.#gameState = gameState;
        Object.freeze(this);
    }

    registerBlueprint(stageId, blueprint, provenance = null) {
        validateStage(stageId);
        const validated = EnemyArmyBlueprint.fromSnapshot(
            blueprint instanceof EnemyArmyBlueprint ? blueprint.getSnapshot() : blueprint
        );
        const candidate = validated.getSnapshot();
        if (candidate.stageId !== stageId) throw new TypeError('BLUEPRINT_LIFECYCLE_STAGE_MISMATCH');
        const validatedProvenance = provenance === null ? null : EnemyArmyTraitProvenance.fromSnapshot(
            provenance instanceof EnemyArmyTraitProvenance ? provenance.getSnapshot() : provenance
        );
        const provenanceCandidate = validatedProvenance?.getSnapshot() ?? null;
        if (provenanceCandidate && provenanceCandidate.stageId !== stageId) {
            throw new TypeError('BLUEPRINT_LIFECYCLE_PROVENANCE_STAGE_MISMATCH');
        }
        const snapshot = this.getSnapshot();
        const provenanceSnapshot = this.getProvenanceSnapshot();
        const existing = snapshot.blueprints.find(entry => entry.stageId === stageId);
        const existingProvenance = provenanceSnapshot.provenances.find(entry => entry.stageId === stageId);
        if (existing) {
            if (contentKey(existing) !== contentKey(candidate)) throw new Error('BLUEPRINT_LIFECYCLE_STAGE_ALREADY_REGISTERED');
            if (existingProvenance && provenanceCandidate
                && contentKey(existingProvenance) !== contentKey(provenanceCandidate)) {
                throw new Error('BLUEPRINT_LIFECYCLE_PROVENANCE_ALREADY_REGISTERED');
            }
            if (!existingProvenance && provenanceCandidate) {
                const nextProvenance = freezeEnemyArmyTraitProvenanceState({
                    ...provenanceSnapshot,
                    provenances: [...provenanceSnapshot.provenances, provenanceCandidate]
                });
                validateEnemyArmyTraitProvenanceAssociations(snapshot, nextProvenance);
                this.#gameState.enemyArmyTraitProvenanceState = nextProvenance;
            }
            return {
                registered: false,
                provenanceRegistered: !existingProvenance && !!provenanceCandidate,
                blueprint: EnemyArmyBlueprint.fromSnapshot(existing),
                provenance: existingProvenance
                    ? EnemyArmyTraitProvenance.fromSnapshot(existingProvenance)
                    : validatedProvenance
            };
        }
        // Validate both snapshots before synchronously committing the associated pair.
        const next = freezeBlueprintLifecycleSnapshot({ ...snapshot, blueprints: [...snapshot.blueprints, candidate] });
        const nextProvenance = provenanceCandidate
            ? freezeEnemyArmyTraitProvenanceState({
                ...provenanceSnapshot,
                provenances: [...provenanceSnapshot.provenances, provenanceCandidate]
            })
            : freezeEnemyArmyTraitProvenanceState(provenanceSnapshot);
        validateEnemyArmyTraitProvenanceAssociations(next, nextProvenance);
        this.#gameState.enemyArmyBlueprintState = next;
        if (provenanceCandidate) this.#gameState.enemyArmyTraitProvenanceState = nextProvenance;
        return {
            registered: true,
            provenanceRegistered: !!provenanceCandidate,
            blueprint: validated,
            provenance: validatedProvenance
        };
    }

    getBlueprint(stageId) {
        validateStage(stageId);
        const saved = this.getSnapshot().blueprints.find(entry => entry.stageId === stageId);
        return saved ? EnemyArmyBlueprint.fromSnapshot(saved) : null;
    }

    getSnapshot() { return readBlueprintLifecycleSnapshot(this.#gameState); }

    getProvenance(stageId) {
        validateStage(stageId);
        const saved = this.getProvenanceSnapshot().provenances.find(entry => entry.stageId === stageId);
        return saved ? EnemyArmyTraitProvenance.fromSnapshot(saved) : null;
    }

    getProvenanceSnapshot() { return readEnemyArmyTraitProvenanceState(this.#gameState); }

    /** Explicit authoritative save replacement, not a registration/upsert operation. */
    restoreSnapshot(snapshot, provenanceSnapshot = {
        schemaVersion: ENEMY_ARMY_TRAIT_PROVENANCE_STATE_SCHEMA_VERSION,
        provenances: []
    }) {
        const next = freezeBlueprintLifecycleSnapshot(snapshot);
        const nextProvenance = freezeEnemyArmyTraitProvenanceState(provenanceSnapshot);
        validateEnemyArmyTraitProvenanceAssociations(next, nextProvenance);
        this.#gameState.enemyArmyBlueprintState = next;
        if (nextProvenance.provenances.length) {
            this.#gameState.enemyArmyTraitProvenanceState = nextProvenance;
        } else {
            delete this.#gameState.enemyArmyTraitProvenanceState;
        }
        return this.getSnapshot();
    }
}
