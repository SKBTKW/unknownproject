import { DefenseSystem } from '../systems/defense_system.js';

function toNonNegativeInteger(value, fallback = 0) {
    if (!Number.isFinite(value)) return fallback;
    return Math.max(0, Math.floor(value));
}

function resolveBoardSize(state) {
    const grid = Array.isArray(state?.grid) ? state.grid : [];
    return {
        rows: grid.length,
        columns: grid.reduce((max, row) => Math.max(max, Array.isArray(row) ? row.length : 0), 0)
    };
}

function resolveDefense(state) {
    const max = DefenseSystem.calculateMaxDefense(state);
    const storedCurrent = state?.currentDefense;
    const current = storedCurrent === undefined || storedCurrent === null
        ? max
        : Math.min(toNonNegativeInteger(storedCurrent), max);
    return Object.freeze({ current, max });
}

export class GameRuntimeSnapshotDataService {
    getSnapshot(state) {
        if (!state) throw new Error('GAME_RUNTIME_STATE_REQUIRED');

        const stage = state.stage || null;
        const board = resolveBoardSize(state);

        return Object.freeze({
            progression: Object.freeze({
                verse: Number.isInteger(state.turn) && state.turn > 0 ? state.turn : 1,
                stage: Object.freeze({
                    id: stage?.id ?? 1,
                    name: stage?.name ?? 'Stage 1',
                    size: Number.isInteger(stage?.size) ? stage.size : board.rows,
                    maxTiles: Number.isFinite(stage?.maxTiles) ? stage.maxTiles : null
                })
            }),
            board: Object.freeze(board),
            resources: Object.freeze({
                ember: Object.freeze({
                    current: toNonNegativeInteger(state.ember, 0),
                    max: toNonNegativeInteger(state.maxEmber, toNonNegativeInteger(state.ember, 0))
                }),
                food: Object.freeze({ current: toNonNegativeInteger(state.food, 0) }),
                material: Object.freeze({ current: toNonNegativeInteger(state.wood ?? state.material, 0) }),
                defense: resolveDefense(state),
                mystic: Object.freeze({ current: toNonNegativeInteger(state.mystic, 0) })
            })
        });
    }
}

export default GameRuntimeSnapshotDataService;
