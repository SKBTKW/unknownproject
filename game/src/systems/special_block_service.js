import { readDiscoveredSocketResource, readSocketResourceIdentity, readSocketResourceYields } from '../core/socket_resource_read_model.js';
import { hasCellPositiveProduction } from '../core/special_block_production.js';
import { resolveStageId } from '../cards/card_stage_usage.js';
/* =============================================================
   game/src/systems/special_block_service.js
   Board-owned targeting / creation boundary for Special Blocks.
   ============================================================= */

import {
    BASE_TERRAIN_INTERACTIONS,
    SPECIAL_BLOCK_COST_STATUS,
    createSpecialBlockAdjacencyProfile,
    getSpecialBlockDefinition,
    hasCellCapability,
    isSpecialBlockFunctional,
    normalizeSpecialBlockResourceMap,
    readCellCapabilities,
    readSpecialBlockAdjacencyProfile,
    readSpecialBlockTrialTraits,
    resolveSpecialBlockCreationCost,
    validateTerrainAgainstSpecialBlockAdjacency
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

function sourceNeighbors(r, c, neighborhood) {
    if (neighborhood !== 'EIGHT_WAY') return orthogonalNeighbors(r, c);
    const result = [];
    for (let dr = -1; dr <= 1; dr++) for (let dc = -1; dc <= 1; dc++) {
        if (dr || dc) result.push({ r: r + dr, c: c + dc });
    }
    return result;
}

function sameResourceMap(left = {}, right = {}) {
    const keys = new Set([...Object.keys(left || {}), ...Object.keys(right || {})]);
    for (const key of keys) {
        if (Number(left?.[key] || 0) !== Number(right?.[key] || 0)) return false;
    }
    return true;
}

function hasAnyCost(resources = {}) {
    return Object.values(resources || {}).some(value => Number(value || 0) > 0);
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
            : (Number.isInteger(state?.turn) ? state.turn : null),
        ...(definition.placement?.maxCreationsPerStage
            ? { createdStage: resolveStageId(state) } : {}),
        ...(context.paidCost
            ? { paidCost: Object.freeze({ ...context.paidCost }) }
            : {}),
        ...(context.terrainAdjacencyProfile
            ? {
                terrainAdjacencyProfile: Object.freeze({
                    e: context.terrainAdjacencyProfile.e,
                    gl: context.terrainAdjacencyProfile.gl,
                    ...(context.terrainAdjacencyProfile.source
                        ? { source: Object.freeze({ ...context.terrainAdjacencyProfile.source }) }
                        : {})
                })
            }
            : {})
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

    isFunctional(entityOrTarget) {
        const point = coords(entityOrTarget);
        const cell = point ? this.getCell(point.r, point.c) : entityOrTarget;
        return isSpecialBlockFunctional(cell);
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

    resolveSourceGroup(target, definition) {
        const point = coords(target);
        if (!point) {
            return {
                kind: 'NONE',
                groupId: null,
                cells: []
            };
        }

        const start = this.getCell(point.r, point.c);
        if (!start?.placed || !start.terrain) {
            return {
                kind: 'NONE',
                groupId: null,
                cells: []
            };
        }

        const allowedIds = new Set(definition?.placement?.terrainIds || []);
        const startId = terrainId(start);
        if (allowedIds.size > 0 && !allowedIds.has(startId)) {
            return {
                kind: 'NONE',
                groupId: null,
                cells: []
            };
        }

        if (start.mergeGroupId !== null && start.mergeGroupId !== undefined) {
            const groupId = String(start.mergeGroupId);
            const cells = [];
            for (let r = 0; r < (this.state?.grid?.length || 0); r++) {
                for (let c = 0; c < (this.state.grid[r]?.length || 0); c++) {
                    const cell = this.state.grid[r][c];
                    if (!cell?.placed || !cell.terrain) continue;
                    if (String(cell.mergeGroupId) !== groupId) continue;
                    if (allowedIds.size > 0 && !allowedIds.has(terrainId(cell))) continue;
                    cells.push({ r, c, cell });
                }
            }
            return {
                kind: 'MERGE_GROUP',
                groupId,
                cells
            };
        }

        const queue = [point];
        const visited = new Set();
        const cells = [];
        while (queue.length > 0) {
            const current = queue.shift();
            const key = `${current.r}:${current.c}`;
            if (visited.has(key)) continue;
            visited.add(key);

            const cell = this.getCell(current.r, current.c);
            const id = terrainId(cell);
            if (!cell?.placed || !cell.terrain) continue;
            if (cell.mergeGroupId !== null && cell.mergeGroupId !== undefined) continue;
            if (allowedIds.size > 0 && !allowedIds.has(id)) continue;

            cells.push({ r: current.r, c: current.c, cell });
            for (const next of orthogonalNeighbors(current.r, current.c)) {
                if (!visited.has(`${next.r}:${next.c}`)) queue.push(next);
            }
        }

        return {
            kind: 'CONNECTED_TERRAIN_CLUSTER',
            groupId: null,
            cells
        };
    }

    resolveTerrainCluster(target, definition) {
        return this.resolveSourceGroup(target, definition).cells;
    }

    _matchesIndependentSourceCell(definition, cell, { allowSpecialBlock = false, position = cell } = {}) {
        if (cell?.isHQ) return false;
        if (definition?.placement?.sourcePositiveProductionResource) {
            return hasCellPositiveProduction(this.state, cell, position,
                definition.placement.sourcePositiveProductionResource, {
                    excludedDefinitionIds: definition.placement.sourceExcludedDefinitionIds
                });
        }
        if (cell?.specialBlock && definition?.placement?.sourceSpecialBlockTypes?.includes(cell.specialBlock.definitionId || cell.specialBlock.type)) {
            return isSpecialBlockFunctional(cell);
        }
        if (!cell?.placed || !cell.terrain) return false;
        if (!allowSpecialBlock && cell.specialBlock) return false;

        const placement = definition?.placement || {};
        const sourceTerrainIds = placement.sourceTerrainIds || [];
        if (sourceTerrainIds.length > 0 && !sourceTerrainIds.includes(terrainId(cell))) return false;

        const sourceResourceCategories = placement.sourceResourceCategories || [];
        if (
            sourceResourceCategories.length > 0
            && !readDiscoveredSocketResource(cell, sourceResourceCategories)
        ) return false;

        const sourceMinGL = Number(placement.sourceMinGL);
        if (Number.isFinite(sourceMinGL) && Number(cell.terrain?.gl) < sourceMinGL) return false;

        const sourceMaxGL = Number(placement.sourceMaxGL);
        if (Number.isFinite(sourceMaxGL) && Number(cell.terrain?.gl) > sourceMaxGL) return false;

        return true;
    }

    _resolveIndependentSourceCluster(definition, source) {
        const start = coords(source);
        if (!start) return [];

        const queue = [start];
        const visited = new Set();
        const cells = [];
        while (queue.length > 0) {
            const current = queue.shift();
            const key = `${current.r}:${current.c}`;
            if (visited.has(key)) continue;
            visited.add(key);

            const cell = this.getCell(current.r, current.c);
            if (!this._matchesIndependentSourceCell(definition, cell, { position: current })) continue;

            cells.push({ r: current.r, c: current.c, cell });
            for (const next of orthogonalNeighbors(current.r, current.c)) {
                if (!visited.has(`${next.r}:${next.c}`)) queue.push(next);
            }
        }
        return cells;
    }

    _resourcePositiveYieldChannelCount(cell) {
        const resource = cell?.socketResource;
        if (!resource) return 0;
        return Object.values(readSocketResourceYields(resource)).filter(value => value > 0).length;
    }

    _countDefinitionBoundToSource(definitionId, source) {
        if (!definitionId || !source || !Array.isArray(this.state?.grid)) return 0;
        let count = 0;
        for (let r = 0; r < this.state.grid.length; r++) {
            for (let c = 0; c < (this.state.grid[r]?.length || 0); c++) {
                const cell = this.state.grid[r][c];
                const entity = cell?.specialBlock;
                if (!entity) continue;
                if ((entity.definitionId || entity.type) !== definitionId) continue;
                const profile = readSpecialBlockAdjacencyProfile(cell);
                if (profile?.source?.r === source.r && profile?.source?.c === source.c) count++;
            }
        }
        return count;
    }

    _validateIndependentGenerationTarget(definition, target) {
        let source = coords(target?.source);
        const destination = coords(target?.destination || target?.target || target);
        if (destination && definition.placement?.mode === 'OVERLAY_OR_INDEPENDENT') {
            const reference = this.findAdjacentCells(destination.r, destination.c)
                .find(entry => this._matchesIndependentSourceCell(definition, entry.cell));
            if (!reference) return { valid: false, reason: 'SOURCE_TERRAIN_REQUIRED' };
            source = { r: reference.r, c: reference.c };
        }
        if (destination && definition.placement?.elevationInheritance === 'MAX_ADJACENT_SOURCE') {
            const minimum = Math.max(1, Number(definition.placement.minConnectedSourceCells) || 1);
            const qualified = this.findAdjacentCells(destination.r, destination.c)
                .find(entry => this._matchesIndependentSourceCell(definition, entry.cell)
                    && this._resolveIndependentSourceCluster(definition, entry).length >= minimum);
            if (!qualified) return { valid: false, reason: 'SOURCE_CLUSTER_TOO_SMALL' };
            source = { r: qualified.r, c: qualified.c };
        }
        if (!source || !destination) return { valid: false, reason: 'SOURCE_AND_DESTINATION_REQUIRED' };

        let sourceCell = this.getCell(source.r, source.c);
        const destinationCell = this.getCell(destination.r, destination.c);
        if ((!sourceCell?.placed || !sourceCell.terrain) && !this._matchesIndependentSourceCell(definition, sourceCell, { position: source }) || sourceCell?.isHQ) {
            return { valid: false, reason: 'SOURCE_TERRAIN_REQUIRED' };
        }
        if (sourceCell.specialBlock && !definition.placement?.sourcePositiveProductionResource && !definition.placement?.sourceSpecialBlockTypes?.includes(sourceCell.specialBlock.definitionId || sourceCell.specialBlock.type)) return { valid: false, reason: 'SOURCE_SPECIAL_BLOCK_OCCUPIED' };
        if (!this._matchesIndependentSourceCell(definition, sourceCell, { position: source })) {
            return { valid: false, reason: 'SOURCE_TERRAIN_NOT_ALLOWED' };
        }

        if (definition.placement?.sourceResourceCategories && target.sourceResourceReference) {
            const resource = readDiscoveredSocketResource(sourceCell, definition.placement.sourceResourceCategories);
            const reference = target.sourceResourceReference;
            if (reference.r !== source.r || reference.c !== source.c
                || reference.resourceId !== readSocketResourceIdentity(resource)
                || reference.category !== resource?.category) return { valid: false, reason: 'SOURCE_RESOURCE_STALE' };
        }

        const maxPerSource = Number(definition.placement?.maxPerSource);
        if (
            Number.isFinite(maxPerSource)
            && maxPerSource >= 0
            && this._countDefinitionBoundToSource(definition.id, source) >= Math.trunc(maxPerSource)
        ) {
            return { valid: false, reason: 'SOURCE_ALREADY_SERVICED' };
        }

        if (definition.placement?.requiresSourceIsolation === true) {
            const hasConnectedSameSource = this.findAdjacentCells(source.r, source.c)
                .some(entry => this._matchesIndependentSourceCell(
                    definition,
                    entry.cell,
                    { allowSpecialBlock: true }
                ));
            if (hasConnectedSameSource) {
                return { valid: false, reason: 'SOURCE_TERRAIN_NOT_ISOLATED' };
            }
        }

        const sourceCluster = this._resolveIndependentSourceCluster(definition, source);
        const minConnectedSourceCells = Number(definition.placement?.minConnectedSourceCells ?? 1);
        if (
            Number.isFinite(minConnectedSourceCells)
            && sourceCluster.length < Math.max(1, Math.trunc(minConnectedSourceCells))
        ) {
            return { valid: false, reason: 'SOURCE_CLUSTER_TOO_SMALL' };
        }

        if (!sourceNeighbors(source.r, source.c, definition.placement?.sourceNeighborhood)
            .some(point => point.r === destination.r && point.c === destination.c)) {
            return { valid: false, reason: 'DESTINATION_NOT_ADJACENT' };
        }
        if (!destinationCell) return { valid: false, reason: 'OUT_OF_BOUNDS' };
        if (destinationCell.placed || destinationCell.specialBlock) {
            return { valid: false, reason: 'DESTINATION_OCCUPIED' };
        }
        if (definition.placement?.destinationRegion === 'HQ_VICINITY_OUTER_EDGE') {
            if (this.isHQVicinity(destination.r, destination.c) || destinationCell.isHQ
                || !sourceNeighbors(destination.r, destination.c, 'EIGHT_WAY')
                    .some(point => this.getCell(point.r, point.c) && this.isHQVicinity(point.r, point.c))) {
                return { valid: false, reason: 'DESTINATION_REGION_NOT_ALLOWED' };
            }
        }

        // Choose the maximum E before applying placement restrictions. A lower
        // neighbor is never a fallback when the maximum makes placement illegal.
        if (definition.placement?.elevationInheritance === 'MAX_ADJACENT_SOURCE') {
            const reference = this.findAdjacentCells(destination.r, destination.c)
                .filter(entry => this._matchesIndependentSourceCell(definition, entry.cell))
                .sort((a, b) => Number(b.cell.terrain.e) - Number(a.cell.terrain.e)
                    || a.r - b.r || a.c - b.c)[0];
            source = { r: reference.r, c: reference.c };
            sourceCell = reference.cell;
        }

        return {
            valid: true,
            source,
            destination,
            sourceCell,
            destinationCell,
            sourceCluster
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

        let sourceGroup = null;
        if (definition.placement?.requiresSourceCluster) {
            sourceGroup = this.resolveSourceGroup(point, definition);
            if (sourceGroup.cells.length < 1) {
                return { valid: false, reason: 'SOURCE_CLUSTER_REQUIRED' };
            }
        }

        if (forCreation && definition.placement?.orientation === 'CARDINAL') {
            if (!CARDINAL_ORIENTATIONS.has(context.orientation)) {
                return { valid: false, reason: 'ORIENTATION_REQUIRED' };
            }
        }

        return { valid: true, target: point, cell, sourceGroup };
    }


    _validateAdjacencyAt(point, profile, definition = null) {
        if (!point || !profile) return { valid: false, reason: 'ADJACENCY_PROFILE_UNAVAILABLE', reasons: ['ADJACENCY_PROFILE_UNAVAILABLE'] };

        const reasons = [];
        for (const entry of this.findAdjacentCells(point.r, point.c)) {
            const neighbor = entry.cell;
            if (!neighbor || neighbor.isHQ) continue;

            if (neighbor.specialBlock) {
                const neighborProfile = readSpecialBlockAdjacencyProfile(neighbor);
                if (
                    neighborProfile
                    && Number.isFinite(profile.e)
                    && Number.isFinite(neighborProfile.e)
                    && Math.abs(profile.e - neighborProfile.e) >= 2
                ) {
                    if ((profile.e === 0 && neighborProfile.e === 3) || (profile.e === 3 && neighborProfile.e === 0)) {
                        reasons.push('WETLAND_MOUNTAIN_NEIGHBOR');
                    } else if ((profile.e === 0 && neighborProfile.e === 2) || (profile.e === 2 && neighborProfile.e === 0)) {
                        reasons.push('WETLAND_HILL_NEIGHBOR');
                    } else {
                        reasons.push('INVALID_ELEVATION_NEIGHBOR');
                    }
                }
                continue;
            }

            if (neighbor.placed && neighbor.terrain) {
                const isBoundSource = profile?.source?.r === entry.r && profile?.source?.c === entry.c;
                const allowSourceTerrainAdjacency =
                    isBoundSource && definition?.placement?.allowSourceTerrainAdjacency === true;
                const terrainCheck = validateTerrainAgainstSpecialBlockAdjacency(
                    neighbor.terrain,
                    profile,
                    {
                        allowDesert: allowSourceTerrainAdjacency,
                        allowMountain: allowSourceTerrainAdjacency
                    }
                );
                reasons.push(...terrainCheck.reasons);
            }
        }

        const uniqueReasons = [...new Set(reasons)];
        return {
            valid: uniqueReasons.length === 0,
            reason: uniqueReasons[0] || null,
            reasons: uniqueReasons
        };
    }

    validateTarget(typeOrDefinition, target, context = {}, options = {}) {
        const definition = typeof typeOrDefinition === 'string'
            ? getSpecialBlockDefinition(typeOrDefinition)
            : typeOrDefinition;
        if (!definition?.id) return { valid: false, reason: 'UNKNOWN_SPECIAL_BLOCK' };

        const placement = definition.placement || {};
        let stageCreations = 0;
        const pointForDistance = coords(target?.destination || target?.target || target);
        if (placement.maxCreationsPerStage || placement.minimumSameDefinitionDistance) {
            for (let r = 0; r < (this.state?.grid?.length || 0); r++) {
                for (let c = 0; c < (this.state.grid[r]?.length || 0); c++) {
                    const entity = this.state.grid[r][c]?.specialBlock;
                    if ((entity?.definitionId || entity?.type) !== definition.id) continue;
                    if (entity.createdStage === resolveStageId(this.state)) stageCreations++;
                    if (pointForDistance && Math.max(Math.abs(r - pointForDistance.r), Math.abs(c - pointForDistance.c))
                        < Number(placement.minimumSameDefinitionDistance || 0)) {
                        return { valid: false, reason: 'SAME_DEFINITION_TOO_CLOSE', definition };
                    }
                }
            }
            if (stageCreations >= Number(placement.maxCreationsPerStage ?? Infinity)) {
                return { valid: false, reason: 'STAGE_CREATION_LIMIT', definition };
            }
        }

        const dual = definition.placement?.mode === 'OVERLAY_OR_INDEPENDENT';
        const point = coords(target?.destination || target?.target || target);

        if (
            definition.placement?.mode === 'INDEPENDENT_CELL_GENERATION'
            && !coords(target?.source)
            && point
            && ['MAX_RESOURCE_BONUS_CHANNELS', 'FIRST_LEGAL_SOURCE'].includes(definition.placement?.sourceSelection)
        ) {
            const candidates = sourceNeighbors(point.r, point.c, definition.placement?.sourceNeighborhood)
                .map(entry => ({ ...entry, cell: this.getCell(entry.r, entry.c) }))
                .filter(entry => this._matchesIndependentSourceCell(definition, entry.cell, { position: entry }))
                .sort((a, b) =>
                    (definition.placement?.sourceSelection === 'MAX_RESOURCE_BONUS_CHANNELS'
                        ? this._resourcePositiveYieldChannelCount(b.cell) - this._resourcePositiveYieldChannelCount(a.cell) : 0)
                    || a.r - b.r
                    || a.c - b.c
                );

            let firstFailure = null;
            for (const candidate of candidates) {
                const candidateValidation = this.validateTarget(
                    definition,
                    {
                        source: { r: candidate.r, c: candidate.c },
                        destination: point
                    },
                    context,
                    options
                );
                if (candidateValidation.valid) return candidateValidation;
                if (!firstFailure) firstFailure = candidateValidation;
            }
            return firstFailure || {
                valid: false,
                reason: 'SOURCE_TERRAIN_REQUIRED',
                definition
            };
        }

        const independent = definition.placement?.mode === 'INDEPENDENT_CELL_GENERATION'
            || (dual && !this.getCell(point?.r, point?.c)?.placed);
        const structural = independent
            ? this._validateIndependentGenerationTarget(definition, target)
            : this._validateOverlayTarget(definition, target?.destination || target?.target || target, context, options);
        if (!structural.valid) return { ...structural, definition };

        const referenceCell = independent ? structural.sourceCell : structural.cell;
        const referencePoint = independent ? structural.source : structural.target;
        const placementPoint = independent ? structural.destination : structural.target;
        const adjacencyProfile = referenceCell?.specialBlock
            ? createSpecialBlockAdjacencyProfile({ terrain: { e: readSpecialBlockAdjacencyProfile(referenceCell)?.e } }, referencePoint, definition)
            : createSpecialBlockAdjacencyProfile(referenceCell, referencePoint, definition);
        const adjacency = this._validateAdjacencyAt(placementPoint, adjacencyProfile, definition);
        if (!adjacency.valid) {
            return {
                ...structural,
                ...adjacency,
                adjacencyProfile,
                definition
            };
        }

        return {
            ...structural,
            adjacencyProfile,
            independent,
            definition
        };
    }

    enumerateLegalTargets(typeOrDefinition, context = {}) {
        const definition = typeof typeOrDefinition === 'string'
            ? getSpecialBlockDefinition(typeOrDefinition)
            : typeOrDefinition;
        if (!definition?.id || !Array.isArray(this.state?.grid)) return [];

        const targets = [];
        if (definition.placement?.mode === 'OVERLAY_OR_INDEPENDENT') {
            for (let r = 0; r < this.state.grid.length; r++) {
                for (let c = 0; c < this.state.grid[r].length; c++) {
                    if (this.validateTarget(definition, { r, c }, context).valid) targets.push({ r, c });
                }
            }
            return targets;
        }
        if (definition.placement?.mode === 'INDEPENDENT_CELL_GENERATION') {
            if (['MAX_RESOURCE_BONUS_CHANNELS', 'FIRST_LEGAL_SOURCE'].includes(definition.placement?.sourceSelection)) {
                for (let r = 0; r < this.state.grid.length; r++) {
                    for (let c = 0; c < (this.state.grid[r]?.length || 0); c++) {
                        const destination = { r, c };
                        const validation = this.validateTarget(
                            definition,
                            { destination },
                            context
                        );
                        if (!validation.valid) continue;
                        targets.push({
                            r,
                            c,
                            source: { ...validation.source },
                            destination: { ...validation.destination },
                            ...(definition.placement?.sourceResourceCategories ? { sourceResourceReference: {
                                ...validation.source,
                                resourceId: readSocketResourceIdentity(validation.sourceCell.socketResource),
                                category: validation.sourceCell.socketResource.category
                            } } : {})
                        });
                    }
                }
                return targets;
            }

            for (let r = 0; r < this.state.grid.length; r++) {
                for (let c = 0; c < (this.state.grid[r]?.length || 0); c++) {
                    for (const destination of sourceNeighbors(r, c, definition.placement?.sourceNeighborhood)) {
                        const candidate = {
                            source: { r, c },
                            destination
                        };
                        const validation = this.validateTarget(definition, candidate, context);
                        if (validation.valid) {
                            if (Number(definition.placement?.minConnectedSourceCells) > 1) {
                                if (definition.placement?.elevationInheritance === 'MAX_ADJACENT_SOURCE'
                                    && targets.some(entry => entry.destination.r === destination.r
                                        && entry.destination.c === destination.c)) continue;
                                targets.push({
                                    ...candidate,
                                    source: validation.source,
                                    ...(definition.placement?.elevationInheritance === 'MAX_ADJACENT_SOURCE'
                                        ? { r: destination.r, c: destination.c } : {}),
                                    sourceClusterSize: Array.isArray(validation.sourceCluster)
                                        ? validation.sourceCluster.length
                                        : null
                                });
                            } else {
                                targets.push(candidate);
                            }
                        }
                    }
                }
            }
            return targets;
        }

        for (let r = 0; r < this.state.grid.length; r++) {
            for (let c = 0; c < (this.state.grid[r]?.length || 0); c++) {
                const validation = this.validateTarget(definition, { r, c }, context);
                if (validation.valid) {
                    const sourceGroup = definition.placement?.requiresSourceCluster
                        ? this.resolveSourceGroup({ r, c }, definition)
                        : null;
                    targets.push({
                        r,
                        c,
                        sourceClusterSize: sourceGroup ? sourceGroup.cells.length : null,
                        sourceGroupKind: sourceGroup?.kind || null,
                        sourceGroupId: sourceGroup?.groupId || null
                    });
                }
            }
        }
        return targets;
    }

    hasAnyLegalTarget(typeOrDefinition, context = {}) {
        return this.enumerateLegalTargets(typeOrDefinition, context).length > 0;
    }

    quoteCost(typeOrDefinition) {
        const definition = typeof typeOrDefinition === 'string'
            ? getSpecialBlockDefinition(typeOrDefinition)
            : typeOrDefinition;
        return resolveSpecialBlockCreationCost(definition);
    }

    validateTargetAfterPayment(typeOrDefinition, target, payment = {}, context = {}) {
        const validation = this.validateTarget(typeOrDefinition, target, context, { forCreation: true });
        if (!validation.valid) return validation;

        const cost = this.quoteCost(validation.definition || typeOrDefinition);
        if (cost.status !== SPECIAL_BLOCK_COST_STATUS.RESOLVED || !cost.resources) {
            return {
                ...validation,
                valid: false,
                reason: 'CREATION_COST_UNRESOLVED',
                cost
            };
        }

        const normalizedPayment = normalizeSpecialBlockResourceMap(payment);
        if (!normalizedPayment) {
            return {
                ...validation,
                valid: false,
                reason: 'PAYMENT_RESOURCE_MAP_UNRESOLVED',
                cost
            };
        }
        if (!sameResourceMap(normalizedPayment, cost.resources)) {
            return {
                ...validation,
                valid: false,
                reason: 'PAYMENT_COST_MISMATCH',
                cost,
                projectedPayment: normalizedPayment
            };
        }

        return {
            ...validation,
            valid: true,
            reason: null,
            cost,
            projectedPayment: normalizedPayment
        };
    }

    createSpecialBlock(type, target, context = {}) {
        const definition = getSpecialBlockDefinition(type);
        const validation = this.validateTarget(definition, target, context, { forCreation: true });
        if (!validation.valid) return { success: false, reason: validation.reason };

        const cost = this.quoteCost(definition);
        if (cost.status === SPECIAL_BLOCK_COST_STATUS.RESOLVED && hasAnyCost(cost.resources)) {
            if (context.paymentConfirmed !== true) {
                return { success: false, reason: 'PAYMENT_CONFIRMATION_REQUIRED', validation, cost };
            }
            const paidCost = normalizeSpecialBlockResourceMap(context.paidCost);
            if (!paidCost || !sameResourceMap(paidCost, cost.resources)) {
                return {
                    success: false,
                    reason: 'PAYMENT_COST_MISMATCH',
                    validation,
                    cost,
                    paidCost
                };
            }
        }
        const adjacencyContext = {
            ...context,
            terrainAdjacencyProfile: validation.adjacencyProfile
        };
        const creationContext = cost.status === SPECIAL_BLOCK_COST_STATUS.RESOLVED
            ? { ...adjacencyContext, paidCost: cost.resources }
            : adjacencyContext;

        if (validation.independent === true) {
            const { r, c } = validation.destination;
            const cell = validation.destinationCell;
            const entity = createSpecialBlockEntity(definition, r, c, this.state, creationContext);
            if (definition.placement?.sourceResourceCategories) {
                const resource = readDiscoveredSocketResource(validation.sourceCell, definition.placement.sourceResourceCategories);
                entity.sourceResourceReference = Object.freeze({
                    ...validation.source,
                    resourceId: readSocketResourceIdentity(resource),
                    category: resource.category
                });
            }
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

        const entity = createSpecialBlockEntity(definition, r, c, this.state, creationContext);

        if (interaction === BASE_TERRAIN_INTERACTIONS.TRANSFORMING_OVERLAY) {
            const delta = Number(definition.baseTerrainInteraction?.glDelta);
            if (Number.isFinite(delta) && Number.isFinite(cell.terrain?.gl)) {
                entity.baseTerrainEffect = {
                    glDelta: delta,
                    sourceGL: cell.terrain.gl
                };
            }
        }
        if (validation.sourceGroup) {
            entity.sourceGroupReference = {
                kind: validation.sourceGroup.kind,
                groupId: validation.sourceGroup.groupId,
                initialSize: validation.sourceGroup.cells.length,
                cells: validation.sourceGroup.cells.map(entry => ({ r: entry.r, c: entry.c }))
            };
        }
        cell.specialBlock = entity;
        if (definition.placement?.participatesInZones === false && cell.mergeGroupId) {
            const groupId = cell.mergeGroupId;
            for (const row of this.state.grid) for (const member of row) {
                if (member.mergeGroupId === groupId) {
                    member.mergeGroupId = null;
                    member.mergeType = null;
                    member.merged = false;
                }
            }
            if (this.state.mergedBlocks) delete this.state.mergedBlocks[groupId];
            if (this.state.mergeLinks instanceof Set) {
                for (const key of this.state.mergeLinks) {
                    if (String(key).split('::').includes(String(groupId))) this.state.mergeLinks.delete(key);
                }
            }
        }

        return {
            success: true,
            target: { r, c },
            entity: {
                ...entity,
                ...(entity.sourceGroupReference
                    ? {
                        sourceGroupReference: {
                            ...entity.sourceGroupReference,
                            cells: entity.sourceGroupReference.cells.map(point => ({ ...point }))
                        }
                    }
                    : {})
            },
            baseTerrain: cell.terrain ? { ...cell.terrain } : null,
            capabilities: [...readCellCapabilities(cell)],
            trialTraits: readSpecialBlockTrialTraits(cell),
            sourceGroup: validation.sourceGroup
                ? {
                    kind: validation.sourceGroup.kind,
                    groupId: validation.sourceGroup.groupId,
                    size: validation.sourceGroup.cells.length
                }
                : null
        };
    }
}

export default SpecialBlockService;
