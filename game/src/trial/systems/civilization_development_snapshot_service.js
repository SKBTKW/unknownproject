import { isCompletedMergeGroup } from "../../core/merge_rules.js";

function nonNegativeInteger(value) {
    if (!Number.isFinite(Number(value))) return 0;
    return Math.max(0, Math.floor(Number(value)));
}

function resolveTerritoryTiles(state) {
    if (!state) return 0;
    if (typeof state.getTerritoryTileCount === "function") {
        return nonNegativeInteger(state.getTerritoryTileCount());
    }
    if (state.gridEngine && typeof state.gridEngine.getPlacedTileCount === "function") {
        return nonNegativeInteger(state.gridEngine.getPlacedTileCount());
    }
    if (state.gridEngine && typeof state.gridEngine.countPlacedTiles === "function") {
        return nonNegativeInteger(state.gridEngine.countPlacedTiles());
    }
    return 0;
}

function resolvePlacedBlockCount(state) {
    if (!state) return 0;
    if (Number.isFinite(Number(state.placedBlockCount))) {
        return nonNegativeInteger(state.placedBlockCount);
    }
    if (typeof state.countPlacedBlocks === "function") {
        return nonNegativeInteger(state.countPlacedBlocks());
    }
    if (state.gridEngine && typeof state.gridEngine.getPlacedBlockCount === "function") {
        return nonNegativeInteger(state.gridEngine.getPlacedBlockCount());
    }
    return 0;
}

function resolveCompletedZoneCount(state) {
    if (!state || !state.mergedBlocks || typeof state.mergedBlocks !== "object") return 0;
    return Object.keys(state.mergedBlocks)
        .filter(groupId => isCompletedMergeGroup(state, groupId))
        .length;
}

function resolveLinkCount(state) {
    if (!state) return 0;
    if (state.gridEngine && typeof state.gridEngine.getMergeLinkCount === "function") {
        return nonNegativeInteger(state.gridEngine.getMergeLinkCount());
    }
    if (state.mergeLinks instanceof Set) {
        return state.mergeLinks.size;
    }
    if (Array.isArray(state.mergeLinks)) {
        return new Set(state.mergeLinks).size;
    }
    return 0;
}

/**
 * Trial threat calculation向けに、文明の恒久的な発展状態だけを読み取る。
 *
 * 現在資源量、🔥、🛡️、一時Buff、Global Event、Intel/Warningは意図的に含めない。
 * 一時補正込みの ProductionCalculator 値も、Threatの自己相殺を避けるため現段階では含めない。
 */
export class CivilizationDevelopmentSnapshotService {
    capture(state) {
        if (!state) {
            return Object.freeze({
                stage: 1,
                placedBlockCount: 0,
                territoryTiles: 0,
                completedZones: 0,
                links: 0
            });
        }

        const snapshot = {
            stage: Math.max(1, nonNegativeInteger(state.stage?.id) || 1),
            placedBlockCount: resolvePlacedBlockCount(state),
            territoryTiles: resolveTerritoryTiles(state),
            completedZones: resolveCompletedZoneCount(state),
            links: resolveLinkCount(state)
        };

        return Object.freeze(snapshot);
    }
}

export function captureCivilizationDevelopment(state) {
    return new CivilizationDevelopmentSnapshotService().capture(state);
}
