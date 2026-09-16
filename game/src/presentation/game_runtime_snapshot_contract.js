export const GAME_RUNTIME_SNAPSHOT_CONTRACT_VERSION = 'game-runtime-snapshot-v1';

function isPlainObject(value) {
    if (value === null || typeof value !== 'object') return false;
    const proto = Object.getPrototypeOf(value);
    return proto === Object.prototype || proto === null;
}

function assertJsonSafe(value, path = '$') {
    if (value === null || typeof value === 'string' || typeof value === 'boolean') return;
    if (typeof value === 'number') {
        if (!Number.isFinite(value)) throw new Error(`GAME_RUNTIME_NON_FINITE_NUMBER:${path}`);
        return;
    }
    if (Array.isArray(value)) {
        value.forEach((item, index) => assertJsonSafe(item, `${path}[${index}]`));
        return;
    }
    if (isPlainObject(value)) {
        for (const [key, item] of Object.entries(value)) assertJsonSafe(item, `${path}.${key}`);
        return;
    }
    throw new Error(`GAME_RUNTIME_NON_SERIALIZABLE:${path}`);
}

function cloneJsonSafe(value) {
    assertJsonSafe(value);
    return JSON.parse(JSON.stringify(value));
}

export function createGameRuntimeSnapshotDto(readModel) {
    if (!readModel) throw new Error('GAME_RUNTIME_READ_MODEL_REQUIRED');

    const dto = {
        contractVersion: GAME_RUNTIME_SNAPSHOT_CONTRACT_VERSION,
        progression: cloneJsonSafe(readModel.progression ?? {}),
        board: cloneJsonSafe(readModel.board ?? { rows: 0, columns: 0 }),
        resources: cloneJsonSafe(readModel.resources ?? {})
    };

    assertJsonSafe(dto);
    return Object.freeze(dto);
}

export function serializeGameRuntimeSnapshotDto(readModel) {
    return JSON.stringify(createGameRuntimeSnapshotDto(readModel));
}

export function parseGameRuntimeSnapshotDto(serialized) {
    if (typeof serialized !== 'string') throw new Error('GAME_RUNTIME_SERIALIZED_STRING_REQUIRED');
    const parsed = JSON.parse(serialized);
    assertJsonSafe(parsed);
    if (parsed?.contractVersion !== GAME_RUNTIME_SNAPSHOT_CONTRACT_VERSION) {
        throw new Error(`UNSUPPORTED_GAME_RUNTIME_SNAPSHOT_CONTRACT:${parsed?.contractVersion ?? 'null'}`);
    }
    return parsed;
}
