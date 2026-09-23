/* =============================================================
   game/src/cards/card_offering_board_query.js

   Card-side port for board facts used by Offering eligibility.

   DeckManager depends on this query surface instead of scanning grid cells
   directly. A Board-domain implementation may be injected through
   engine.cardOfferingBoardQuery; this legacy state-backed adapter preserves
   current behavior until that boundary is supplied by Board.
   ============================================================= */

import { isTrueMergedCell } from "../core/merge_rules.js";

function terrainId(cell) {
    return cell?.terrain?.terrainId || cell?.terrain?.id || "";
}

class LegacyStateCardOfferingBoardQuery {
    constructor(state) {
        this.state = state;
        this.isLegacyStateBacked = true;
    }

    hasGrid() {
        return Boolean(this.state?.grid);
    }

    hasUnmergedDesertOrMountain() {
        const grid = this.state?.grid;
        if (!grid) return false;
        for (const row of grid) {
            for (const cell of row || []) {
                if (!cell?.placed || cell.merged || !cell.terrain) continue;
                const tid = terrainId(cell);
                if (tid === "GL0_DESERT" || tid === "E3_MOUNTAIN") return true;
            }
        }
        return false;
    }

    countPlacedBlocks() {
        if (typeof this.state?.countPlacedTiles === "function") {
            return this.state.countPlacedTiles();
        }
        const grid = this.state?.grid;
        if (!grid) return null;
        let count = 0;
        for (const row of grid) {
            for (const cell of row || []) {
                if (cell?.placed && !cell.isHQ) count++;
            }
        }
        return count;
    }

    totalDefense() {
        if (typeof this.state?.calculateTotalDefense === "function") {
            return this.state.calculateTotalDefense();
        }
        return this.state?.maxDefense ?? this.state?.defense ?? 0;
    }

    currentDefense() {
        if (typeof this.state?.getCurrentDefense === "function") {
            return this.state.getCurrentDefense();
        }
        return this.state?.currentDefense ?? this.state?.defense ?? 0;
    }

    hasAnySocket() {
        const grid = this.state?.grid;
        if (!grid) return false;
        return grid.some(row => (row || []).some(cell => Boolean(cell?.socketResource)));
    }

    countTerrainContaining(fragment, { excludeHQ = false } = {}) {
        const grid = this.state?.grid;
        if (!grid) return 0;
        let count = 0;
        for (const row of grid) {
            for (const cell of row || []) {
                if (!cell?.placed || !cell.terrain || (excludeHQ && cell.isHQ)) continue;
                if (terrainId(cell).includes(fragment)) count++;
            }
        }
        return count;
    }

    countPlainsOrReclaimed() {
        const grid = this.state?.grid;
        if (!grid) return 0;
        let count = 0;
        for (const row of grid) {
            for (const cell of row || []) {
                if (!cell?.placed || !cell.terrain) continue;
                const tid = terrainId(cell);
                if (tid.includes("PLAINS") || tid.includes("RECLAIMED_LAND")) count++;
            }
        }
        return count;
    }

    hasReclaimableWetland() {
        const grid = this.state?.grid;
        if (!grid) return false;
        for (const row of grid) {
            for (const cell of row || []) {
                if (!cell?.placed || cell.isHQ || !cell.terrain) continue;
                const tid = terrainId(cell);
                const isLakeCell = Boolean(cell.socketResource &&
                    (cell.socketResource.id === "SOCKET_LAKE" || cell.socketResource.isLake));
                if (tid.includes("WETLAND") && !isTrueMergedCell(this.state, cell) && !isLakeCell) {
                    return true;
                }
            }
        }
        return false;
    }

    hasLoggingCampOrForest() {
        const buffs = this.state?.activeBuffs || [];
        if (buffs.some(b => b?.id === "CMD_LOGGING_CAMP" || b?.id === "LOGGING_CAMP")) return true;
        return this.countTerrainContaining("FOREST") > 0;
    }

    hasOreSocket() {
        const grid = this.state?.grid;
        if (!grid) return false;
        for (const row of grid) {
            for (const cell of row || []) {
                const socket = cell?.socketResource;
                if (!socket) continue;
                const cat = socket.category || "";
                const sid = socket.id || "";
                if (
                    cat.includes("ORE") || cat.includes("STONE") || cat.includes("IRON") ||
                    sid.includes("ORE") || sid.includes("STONE")
                ) return true;
            }
        }
        return false;
    }

    hasWaterSource() {
        const grid = this.state?.grid;
        if (!grid) return false;
        for (const row of grid) {
            for (const cell of row || []) {
                const socket = cell?.socketResource;
                if (!socket) continue;
                if (socket.id === "SOCKET_LAKE" || socket.id === "SOCKET_OASIS" || socket.isLake) return true;
            }
        }
        return false;
    }

    hasPlainsMerge() {
        const mergedBlocks = this.state?.mergedBlocks;
        return Boolean(mergedBlocks && Object.values(mergedBlocks)
            .some(m => m?.terrainId && m.terrainId.includes("PLAINS")));
    }

    countTerritoryTiles() {
        const grid = this.state?.grid;
        if (!grid) return 0;
        let count = 0;
        for (const row of grid) {
            for (const cell of row || []) {
                if (cell?.placed && !cell.isHQ) count++;
            }
        }
        return count;
    }
}

function resolveCardOfferingBoardQuery(state, engine = null) {
    const injected = engine?.cardOfferingBoardQuery;
    if (injected && typeof injected === "object") return injected;
    return new LegacyStateCardOfferingBoardQuery(state);
}

export {
    LegacyStateCardOfferingBoardQuery,
    resolveCardOfferingBoardQuery
};
