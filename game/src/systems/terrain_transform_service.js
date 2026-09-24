/* =============================================================
   game/src/systems/terrain_transform_service.js

   Board-owned explicit terrain transformation boundary.
   Cards declare intent/target; this service owns legality and mutation.
   ============================================================= */

import {
    isCanonicalTerrainId,
    resolveCanonicalTerrainSemantic
} from "../data/land_system.js";
import { isTrueMergedCell } from "../core/merge_rules.js";

function coords(target) {
    if (!target || typeof target !== "object") return null;
    const r = Number.isInteger(target.r) ? target.r : target.row;
    const c = Number.isInteger(target.c) ? target.c : target.column;
    return Number.isInteger(r) && Number.isInteger(c) ? { r, c } : null;
}

function terrainId(cell) {
    return cell?.terrain?.terrainId || cell?.terrain?.id || cell?.terrainId || null;
}

function normalizeStringSet(values) {
    return new Set(
        (Array.isArray(values) ? values : [])
            .map(value => String(value || "").trim())
            .filter(Boolean)
    );
}

export class TerrainTransformService {
    constructor({ state = null, gridEngine = null } = {}) {
        this.state = state || gridEngine?.state || null;
        this.gridEngine = gridEngine || null;
    }

    getCell(r, c) {
        return this.state?.grid?.[r]?.[c] || null;
    }

    validateTarget(spec = {}, target = null) {
        const point = coords(target);
        if (!point) return { valid: false, reason: "INVALID_TARGET" };

        const cell = this.getCell(point.r, point.c);
        if (!cell) return { valid: false, reason: "OUT_OF_BOUNDS" };
        if (!cell.placed || !cell.terrain) {
            return { valid: false, reason: "PLACED_TERRAIN_REQUIRED" };
        }
        if (spec.excludeHQ !== false && cell.isHQ) {
            return { valid: false, reason: "HQ_FORBIDDEN" };
        }

        const sourceTerrainId = terrainId(cell);
        const allowedSources = normalizeStringSet(spec.fromTerrainIds);
        if (allowedSources.size > 0 && !allowedSources.has(sourceTerrainId)) {
            return { valid: false, reason: "SOURCE_TERRAIN_NOT_ALLOWED" };
        }

        const destinationTerrainId = String(spec.toTerrainId || "").trim();
        if (!destinationTerrainId || !isCanonicalTerrainId(destinationTerrainId)) {
            return { valid: false, reason: "DESTINATION_TERRAIN_UNKNOWN" };
        }

        if (spec.forbidTrueMerge === true && isTrueMergedCell(this.state, cell)) {
            return { valid: false, reason: "TRUE_MERGE_FORBIDDEN" };
        }

        const forbiddenSocketIds = normalizeStringSet(spec.forbiddenSocketIds);
        const socketId = cell.socketResource?.id || cell.socketResource?.resourceId || null;
        const lakeAliasForbidden = forbiddenSocketIds.has("SOCKET_LAKE")
            && cell.socketResource?.isLake === true;
        if ((socketId && forbiddenSocketIds.has(socketId)) || lakeAliasForbidden) {
            return { valid: false, reason: "SOCKET_FORBIDDEN" };
        }

        return {
            valid: true,
            target: point,
            cell,
            sourceTerrainId,
            destinationTerrainId
        };
    }

    enumerateTargets(spec = {}) {
        const targets = [];
        for (let r = 0; r < (this.state?.grid?.length || 0); r++) {
            for (let c = 0; c < (this.state.grid[r]?.length || 0); c++) {
                const validation = this.validateTarget(spec, { r, c });
                if (!validation.valid) continue;
                targets.push({
                    r,
                    c,
                    sourceTerrainId: validation.sourceTerrainId,
                    destinationTerrainId: validation.destinationTerrainId
                });
            }
        }
        return targets;
    }

    transform(spec = {}, target = null, { reconcileTopology = true } = {}) {
        const validation = this.validateTarget(spec, target);
        if (!validation.valid) {
            return {
                success: false,
                reason: validation.reason,
                validation
            };
        }

        const { target: point, cell, sourceTerrainId, destinationTerrainId } = validation;
        const nextTerrain = resolveCanonicalTerrainSemantic(destinationTerrainId);
        if (!nextTerrain || !isCanonicalTerrainId(nextTerrain.terrainId || nextTerrain.id)) {
            return {
                success: false,
                reason: "DESTINATION_TERRAIN_UNRESOLVED",
                validation
            };
        }

        cell.terrain = nextTerrain;
        // Any per-cell production snapshot belongs to the old terrain identity.
        // Canonical terrain production must be resolved from the new terrain.
        cell.production = null;

        let mergeResult = null;
        let linkResult = null;
        if (
            reconcileTopology
            && this.gridEngine
            && typeof this.gridEngine.checkMergePatterns === "function"
        ) {
            mergeResult = this.gridEngine.checkMergePatterns([{ ...point }]) || null;
            if (
                mergeResult?.merge2x2
                && typeof this.gridEngine.checkNewMergeLinks === "function"
            ) {
                linkResult = this.gridEngine.checkNewMergeLinks() || null;
            }
        }

        if (typeof this.state?.defenseSystem?.reconcileWithMax === "function") {
            this.state.defenseSystem.reconcileWithMax();
        }
        if (typeof this.state?.checkConditionalBuffs === "function") {
            this.state.checkConditionalBuffs();
        }

        return {
            success: true,
            target: { ...point },
            sourceTerrainId,
            destinationTerrainId,
            terrain: { ...cell.terrain },
            topology: {
                mergeResult,
                linkResult
            }
        };
    }
}

export default TerrainTransformService;
