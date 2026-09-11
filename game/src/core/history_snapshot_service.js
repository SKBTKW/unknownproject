import { serializeGameState } from './state_serializer.js';

export const HISTORY_SNAPSHOT_SCHEMA_VERSION = 1;

function cloneData(value, fallback = null) {
    if (value === undefined) return fallback;
    return JSON.parse(JSON.stringify(value));
}

function freezeDeep(value) {
    if (!value || typeof value !== 'object' || Object.isFrozen(value)) return value;
    Object.values(value).forEach(freezeDeep);
    return Object.freeze(value);
}

/**
 * Internal historical snapshots captured at the committed Verse boundary.
 *
 * V4 is capture-only. Restore/hydration belongs to V5.
 */
export class HistorySnapshotService {
    constructor(engine) {
        if (!engine) throw new TypeError('HISTORY_SNAPSHOT_ENGINE_REQUIRED');
        this.engine = engine;
        this.snapshots = [];
    }

    capture({ completedTurn, nextTurn } = {}) {
        if (!Number.isInteger(completedTurn) || completedTurn < 1) {
            throw new TypeError('HISTORY_SNAPSHOT_COMPLETED_TURN_REQUIRED');
        }
        if (!Number.isInteger(nextTurn) || nextTurn !== completedTurn + 1) {
            throw new TypeError('HISTORY_SNAPSHOT_NEXT_TURN_INVALID');
        }

        const engine = this.engine;
        const state = engine.state;
        const snapshot = freezeDeep({
            schemaVersion: HISTORY_SNAPSHOT_SCHEMA_VERSION,
            completedTurn,
            resumeTurn: nextTurn,
            gameState: serializeGameState(state),
            rngState: cloneData(engine.checkSystem?.getState?.()),
            gameplayRngState: cloneData(engine.gameplayRandom?.getState?.()),
            chronicle: cloneData(engine.chronicleSystem?.getAllEvents?.(), []),
            runtime: {
                runSeed: Number.isFinite(engine.runSeed) ? engine.runSeed : null,
                trialSchedule: cloneData(state?.trialSchedule),
                nextTrialTurn: Number.isFinite(state?.nextTrialTurn) ? state.nextTrialTurn : null,
                activeGlobalEvents: cloneData(state?.activeGlobalEvents, []),
                eventCooldowns: cloneData(state?.eventCooldowns, {}),
                temporaryWeightModifiers: cloneData(state?.temporaryWeightModifiers, []),
                lastGlobalEventTurn: Number.isFinite(state?.lastGlobalEventTurn) ? state.lastGlobalEventTurn : 0,
                buffs: cloneData(engine.buffSystem?.buffs, []),
                lastTurnMaintenanceResult: cloneData(engine.lastTurnMaintenanceResult)
            }
        });

        const existingIndex = this.snapshots.findIndex(item => item.completedTurn === completedTurn);
        if (existingIndex >= 0) {
            this.snapshots[existingIndex] = snapshot;
        } else {
            this.snapshots.push(snapshot);
            this.snapshots.sort((a, b) => a.completedTurn - b.completedTurn);
        }
        return snapshot;
    }

    getByCompletedTurn(completedTurn) {
        return this.snapshots.find(snapshot => snapshot.completedTurn === completedTurn) || null;
    }

    getForResumeTurn(resumeTurn) {
        if (resumeTurn === 1) return null;
        return this.getByCompletedTurn(resumeTurn - 1);
    }

    getAll() {
        return [...this.snapshots];
    }

    clear() {
        this.snapshots = [];
    }
}

export default HistorySnapshotService;
