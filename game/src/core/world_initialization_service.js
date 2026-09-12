/**
 * Platform-neutral initial world generation.
 *
 * Owns deterministic new-run world creation that used to live inside GameState.
 * The caller must provide the serializable gameplay RNG stream.
 */
export class WorldInitializationService {
    constructor(gameplayRandom) {
        if (!gameplayRandom ||
            typeof gameplayRandom.nextInt !== 'function' ||
            typeof gameplayRandom.shuffle !== 'function') {
            throw new Error('GAMEPLAY_RANDOM_REQUIRED');
        }
        this.random = gameplayRandom;
    }

    createInitialGrid(size = 5) {
        if (!Number.isInteger(size) || size <= 0) {
            throw new Error('WORLD_GRID_SIZE_INVALID');
        }

        const grid = [];
        const center = Math.floor(size / 2);

        for (let r = 0; r < size; r++) {
            const row = [];
            for (let c = 0; c < size; c++) {
                const isHQ = r === center && c === center;
                row.push({
                    r,
                    c,
                    placed: isHQ,
                    isHQ,
                    merged: false,
                    mergeGroupId: null,
                    mergeType: null,
                    placementGroupId: null,
                    terrain: isHQ
                        ? { id: 'HQ', nameKey: 'TERRAIN_HQ', food: 10, wood: 10, defense: 10, mystic: 1 }
                        : null,
                    searched: false,
                    hasSocket: false,
                    socketResource: null,
                    cachedSocketSeeds: {}
                });
            }
            grid.push(row);
        }

        const candidates = [];
        for (let r = 0; r < size; r++) {
            for (let c = 0; c < size; c++) {
                const isHQ = r === center && c === center;
                const isNearHQ = Math.abs(r - center) <= 1 && Math.abs(c - center) <= 1;
                if (!isHQ && !isNearHQ) candidates.push({ r, c });
            }
        }

        this.random.shuffle(candidates);

        const selectedSockets = [];
        for (const candidate of candidates) {
            if (selectedSockets.length >= 3) break;
            const isAdjacent = selectedSockets.some(socket =>
                Math.abs(socket.r - candidate.r) <= 1 &&
                Math.abs(socket.c - candidate.c) <= 1
            );
            if (!isAdjacent) selectedSockets.push(candidate);
        }

        for (const pos of selectedSockets) {
            grid[pos.r][pos.c].hasSocket = true;
        }

        return grid;
    }
}

export default WorldInitializationService;
