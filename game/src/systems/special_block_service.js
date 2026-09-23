/* =============================================================
   game/src/systems/special_block_service.js
   Board-owned targeting / creation boundary for Special Blocks.
   ============================================================= */

import {
    BASE_TERRAIN_INTERACTIONS,
    getSpecialBlockDefinition,
    hasCellCapability,
    readCellCapabilities,
    readSpecialBlockTrialTraits
} from '../core/special_block_domain.js';

const CARDINAL_ORIENTATIONS = new Set(['N', 'E', 'S', 'W']);

function coords(target) {
    if (!target || typeof target !== 'object') return null;
    const r = Number.isInteger(target.r) ? target.r : target.row;
    const c = Number.isInteger(target.c) ? target.c : target.column;
    return Number.isInteger(r) && Number.isInteger(c) ? { r, c } : null;
}

function terrainId(cell) {
    return cell?.terrain?.terrainId || cell?.terrain?.id || cell?.terrainId || null;
}

function orthogonalNeighbors(r, c) {
    return [
        { r: r - 1, c },
        { r: r + 1, c },
        { r, c: c - 1 },
        { r, c: c + 1 }
    ];
}

function createSpecialBlockEntity(definition, r, c, state, context = {}) {
    return {
        instanceId: `${definition.id}@${r}:${c}`,
        type: definition.id,
        definitionId: definition.id,
        orientation: context.orientation || null,
        state: definition.lifecycle?.initialState || 'ACTIVE',
        historyReference: context.historyReference || null,
        createdVerse: Number.isInteger(context.verse)
            ? context.verse
            : (Number.isInteger(state?.turn) ? state.turn : null)
    };
}

export class SpecialBlockService {
    constructor(state) {
        this.state = state;
    }

    getCell(r, c) {
        return this.state?.grid?.[r]?.[c] || null;
    }

    isHQVicinity(r, c) {
        if (typeof this.state?.isHQVicinity === 'function') {
            return !!this.state.isHQVicinity(r, c);
        }
        const size = this.state?.grid?.length;
        if (!Number.isInteger(size) || size <= 0) return false;
        const center = Math.floor(size / 2);
        if (r === center && c === center) return false;
        return Math.abs(r - center) <= 1 && Math.abs(c - center) <= 1;
    }

    readCapabilities(target) {
        const point = coords(target);
        const cell = point ? this.getCell(point.r, point.c) : target;
        return readCellCapabilities(cell);
    }

    readTrialTraits(entityOrTarget) {
        const point = coords(entityOrTarget);
        const cell = point ? this.getCell(point.r, point.c) : entityOrTarget;
        return readSpecialBlockTrialTraits(cell);
    }

    findAdjacentCells(r, c) {
        return orthogonalNeighbors(r, c)
            .map(point => ({ ...point, cell: this.getCell(point.r, point.c) }))
            .filter(entry => entry.cell);
    }

    resolveTerrainCluster(target, definition) {
        const point = coords(target);
        if (!point) return [];
        const start = this.getCell(point.r, point.c);
        if (!start?.placed || !start.terrain) return [];

        const allowedIds = new Set(definition?.placement?.terrainIds || []);
        const startId = terrainId(start);
        if (allowedIds.size > 0 && !allowedIds.has(startId)) return [];

        const queue = [point];
        const visited = new Set();
        const cluster = [];
        while (queue.length > 0) {
            const current = queue.shift();
            const key = `${current.r}:${current.c}`;
            if (visited.has(key)) continue;
            visited.add(key);

            const cell = this.getCell(current.r, current.c);
            const id = terrainId(cell);
            if (!cell?.placed || !cell.terrain) continue;
            if (allowedIds.size > 0 && !allowedIds.has(id)) continue;

            cluster.push({ r: current.r, c: current.c, cell });
            for (const next of orthogonalNeighbors(current.r, current.c)) {
                if (!visited.has(`${next.r}:${next.c}`)) queue.push(next);
            }
        }
        return cluster;
    }

    _validateIndependentGenerationTarget(definition, target) {
        const source = coords(target?.source);
        const destination = coords(target?.destination || target?.target);
        if (!source || !destination) return { valid: false, reason: 'SOURCE_AND_DESTINATION_REQUIRED' };

        const sourceCell = this.getCell(source.r, source.c);
        const destinationCell = this.getCell(destination.r, destination.c);
        if (!sourceCell?.placed || !sourceCell.terrain || sourceCell.isHQ) {
            return { valid: false, reason: 'SOURCE_TERRAIN_REQUIRED' };
        }
        if (sourceCell.specialBlock) return { valid: false, reason: 'SOURCE_SPECIAL_BLOCK_OCCUPIED' };

        const sourceTerrainIds = definition.placement?.sourceTerrainIds || [];
        if (sourceTerrainIds.length > 0 && !sourceTerrainIds.includes(terrainId(sourceCell))) {
            return { valid: false, reason: 'SOURCE_TERRAIN_NOT_ALLOWED' };
        }

        const hasConnectedSameSource = this.findAdjacentCells(source.r, source.c)
            .some(entry => entry.cell?.placed && sourceTerrainIds.includes(terrainId(entry.cell)));
        if (hasConnectedSameSource) {
            return { valid: false, reason: 'SOURCE_TERRAIN_NOT_ISOLATED' };
        }

        const orthogonallyAdjacent = Math.abs(source.r - destination.r) + Math.abs(source.c - destination.c) === 1;
        if (!orthogonallyAdjacent) return { valid: false, reason: 'DESTINATION_NOT_ADJACENT' };
        if (!destinationCell) return { valid: false, reason: 'OUT_OF_BOUNDS' };
        if (destinationCell.placed || destinationCell.specialBlock) {
            return { valid: false, reason: 'DESTINATION_OCCUPIED' };
        }

        return {
            valid: true,
            source,
            destination,
            sourceCell,
            destinationCell
        };
    }

    _validateOverlayTarget(definition, target, context = {}, { forCreation = false } = {}) {
        const point = coords(target);
        if (!point) return { valid: false, reason: 'INVALID_TARGET' };
        const cell = this.getCell(point.r, point.c);
        if (!cell) return { valid: false, reason: 'OUT_OF_BOUNDS' };
        if (definition.placement?.requirePlacedTerrain && (!cell.placed || !cell.terrain)) {
            return { valid: false, reason: 'BASE_TERRAIN_REQUIRED' };
        }
        if (definition.placement?.excludeHQ && cell.isHQ) {
            return { valid: false, reason: 'HQ_FORBIDDEN' };
        }
        if (definition.placement?.requireEmptySpecialBlock && cell.specialBlock) {
            return { valid: false, reason: 'SPECIAL_BLOCK_OCCUPIED' };
        }

        const allowedIds = definition.placement?.terrainIds || [];
        if (allowedIds.length > 0 && !allowedIds.includes(terrainId(cell))) {
            return { valid: false, reason: 'BASE_TERRAIN_NOT_ALLOWED' };
        }

        const minGL = definition.placement?.minGL;
        if (Number.isFinite(minGL) && Number(cell.terrain?.gl) < minGL) {
            return { valid: false, reason: 'BASE_TERRAIN_GL_TOO_LOW' };
        }

        const adjacentCapability = definition.placement?.requiresAdjacentCapability;
        if (adjacentCapability) {
            const hasAdjacent = this.findAdjacentCells(point.r, point.c)
                .some(entry => hasCellCapability(entry.cell, adjacentCapability));
            if (!hasAdjacent) return { valid: false, reason: 'ADJACENT_CAPABILITY_REQUIRED' };
        }

        if (definition.placement?.requiresSourceCluster) {
            const cluster = this.resolveTerrainCluster(point, definition);
            if (cluster.length < 1) return { valid: false, reason: 'SOURCE_CLUSTER_REQUIRED' };
        }

        if (forCreation && definition.placement?.orientation === 'CARDINAL') {
            if (!CARDINAL_ORIENTATIONS.has(context.orientation)) {
                return { valid: false, reason: 'ORIENTATION_REQUIRED' };
            }
        }

        return { valid: true, target: point, cell };
    }

    validateTarget(typeOrDefinition, target, context = {}, options = {}) {
        const definition = typeof typeOrDefinition === 'string'
            ? getSpecialBlockDefinition(typeOrDefinition)
            : typeOrDefinition;
        if (!definition?.id) return { valid: false, reason: 'UNKNOWN_SPECIAL_BLOCK' };

        if (definition.placement?.mode === 'INDEPENDENT_CELL_GENERATION') {
            return {
                ...this._validateIndependentGenerationTarget(definition, target),
                definition
            };
        }

        return {
            ...this._validateOverlayTarget(definition, target, context, options),
            definition
        };
    }

    enumerateLegalTargets(typeOrDefinition, context = {}) {
        const definition = typeof typeOrDefinition === 'string'
            ? getSpecialBlockDefinition(typeOrDefinition)
            : typeOrDefinition;
        if (!definition?.id || !Array.isArray(this.state?.grid)) return [];

        const targets = [];
        if (definition.placement?.mode === 'INDEPENDENT_CELL_GENERATION') {
            for (let r = 0; r < this.state.grid.length; r++) {
                for (let c = 0; c < (this.state.grid[r]?.length || 0); c++) {
                    for (const destination of orthogonalNeighbors(r, c)) {
                        const candidate = {
                            source: { r, c },
                            destination
                        };
                        const validation = this.validateTarget(definition, candidate, context);
                        if (validation.valid) targets.push(candidate);
                    }
                }
            }
            return targets;
        }

        for (let r = 0; r < this.state.grid.length; r++) {
            for (let c = 0; c < (this.state.grid[r]?.length || 0); c++) {
                const validation = this.validateTarget(definition, { r, c }, context);
                if (validation.valid) {
                    const cluster = definition.placement?.requiresSourceCluster
                        ? this.resolveTerrainCluster({ r, c }, definition)
                        : null;
                    targets.push({
                        r,
                        c,
                        sourceClusterSize: cluster ? cluster.length : null
                    });
                }
            }
        }
        return targets;
    }

    hasAnyLegalTarget(typeOrDefinition, context = {}) {
        return this.enumerateLegalTargets(typeOrDefinition, context).length > 0;
    }

    createSpecialBlock(type, target, context = {}) {
        const definition = getSpecialBlockDefinition(type);
        const validation = this.validateTarget(definition, target, context, { forCreation: true });
        if (!validation.valid) return { success: false, reason: validation.reason };
        if (definition?.placement?.mode === 'INDEPENDENT_CELL_GENERATION') {
            const { r, c } = validation.destination;
            const cell = validation.destinationCell;
            const entity = createSpecialBlockEntity(definition, r, c, this.state, context);
            cell.specialBlock = entity;

            return {
                success: true,
                target: { r, c },
                source: { ...validation.source },
                entity: { ...entity },
                baseTerrain: null,
                specialOnly: true,
                capabilities: [...readCellCapabilities(cell)],
                trialTraits: readSpecialBlockTrialTraits(cell)
            };
        }

        const { r, c } = validation.target;
        const cell = validation.cell;
        const interaction = definition.baseTerrainInteraction?.kind;

        if (interaction === BASE_TERRAIN_INTERACTIONS.TRANSFORMING_OVERLAY) {
            const delta = Number(definition.baseTerrainInteraction?.glDelta);
            if (Number.isFinite(delta) && Number.isFinite(cell.terrain?.gl)) {
                cell.terrain = {
                    ...cell.terrain,
                    gl: Math.max(0, cell.terrain.gl + delta)
                };
            }
        }

        const entity = createSpecialBlockEntity(definition, r, c, this.state, context);
        cell.specialBlock = entity;

        return {
            success: true,
            target: { r, c },
            entity: { ...entity },
            baseTerrain: cell.terrain ? { ...cell.terrain } : null,
            capabilities: [...readCellCapabilities(cell)],
            trialTraits: readSpecialBlockTrialTraits(cell)
        };
    }
}

export default SpecialBlockService;
