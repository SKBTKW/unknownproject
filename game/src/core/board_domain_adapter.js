/* =============================================================
   game/src/core/board_domain_adapter.js
   Side-effect-free Board read/query boundary for Card Core and other domains.
   ============================================================= */

import { resolvePlacementGeometry } from './placement_geometry.js';
import {
    BOARD_CAPABILITIES,
    readCellCapabilities,
    readEffectiveGreenery
} from './special_block_domain.js';
import { BoardDamageService } from './board_damage_service.js';
import {
    isZoneConversionFunctional,
    readZoneConversion,
    readZoneConversionCapabilities
} from './zone_conversion_domain.js';
import { SpecialBlockService } from '../systems/special_block_service.js';
import { ZoneConversionService } from '../systems/zone_conversion_service.js';

function resolveLandSemantic(definition) {
    return definition?.terrain || definition || null;
}

function normalizeMinimum(options = {}) {
    const value = Number(options?.minimum ?? 1);
    return Number.isFinite(value) ? Math.max(1, Math.trunc(value)) : 1;
}

function normalizeTerrainQuery(value) {
    return typeof value === 'string' ? value.trim().toUpperCase() : '';
}

function cellTerrainId(cell) {
    return String(cell?.terrain?.terrainId || cell?.terrain?.id || cell?.terrainId || '').toUpperCase();
}

function matchesTerrainId(id, query) {
    if (!id || !query) return false;
    if (id === query) return true;
    // Semantic family names such as WETLAND / PLAINS / DESERT may be used by
    // world-event definitions without exposing Board's elevation/GL prefixes.
    return !/^((GL|E)\d+)_/.test(query) && (
        id.endsWith(`_${query}`) || id.includes(`_${query}_`)
    );
}

const CAPABILITY_ALIASES = Object.freeze({
    OBSERVATION: BOARD_CAPABILITIES.OBSERVATION_SITE,
    INVESTIGATION: BOARD_CAPABILITIES.INVESTIGATION_SITE,
    MILITARY: BOARD_CAPABILITIES.MILITARY_SITE,
    PRODUCTION: BOARD_CAPABILITIES.PRODUCTION_SITE,
    GARRISON: BOARD_CAPABILITIES.GARRISON_SITE
});

function normalizeCapability(value) {
    if (typeof value !== 'string') return '';
    const key = value.trim().toUpperCase();
    return CAPABILITY_ALIASES[key] || key;
}

function entityIds(entity) {
    if (!entity || typeof entity !== 'object') return [];
    return [
        entity.id,
        entity.type,
        entity.definitionId,
        entity.entityType,
        entity.kind
    ].filter(value => typeof value === 'string' && value)
        .map(value => value.toUpperCase());
}

export class BoardDomainAdapter {
    constructor({
        state,
        gridEngine,
        specialBlockService = null,
        boardDamageService = null,
        zoneConversionService = null,
        trialDeploymentSemanticSource = null
    } = {}) {
        this.state = state || gridEngine?.state || null;
        this.gridEngine = gridEngine || null;
        this.specialBlockService = specialBlockService || new SpecialBlockService(this.state);
        this.boardDamageService = boardDamageService || new BoardDamageService({ state: this.state });
        this.zoneConversionService = zoneConversionService || new ZoneConversionService({ state: this.state });
        this.trialDeploymentSemanticSource = trialDeploymentSemanticSource || this.zoneConversionService;
    }


    hasTerrain(terrain, options = {}) {
        const query = normalizeTerrainQuery(terrain);
        if (!query || !Array.isArray(this.state?.grid)) return false;
        const minimum = normalizeMinimum(options);
        let count = 0;
        for (const row of this.state.grid) {
            for (const cell of row || []) {
                if (!cell?.placed || !cell.terrain) continue;
                if (matchesTerrainId(cellTerrainId(cell), query) && ++count >= minimum) return true;
            }
        }
        return false;
    }

    hasEntity(entityType, options = {}) {
        const query = typeof entityType === 'string' ? entityType.trim().toUpperCase() : '';
        if (!query || !Array.isArray(this.state?.grid)) return false;
        const minimum = normalizeMinimum(options);
        let count = 0;
        for (const row of this.state.grid) {
            for (const cell of row || []) {
                const candidates = [
                    cell?.specialBlock,
                    cell?.socketResource,
                    cell?.entity,
                    ...(Array.isArray(cell?.entities) ? cell.entities : [])
                ];
                if (candidates.some(entity => entityIds(entity).includes(query)) && ++count >= minimum) {
                    return true;
                }
            }
        }
        return false;
    }

    hasCapability(capability, options = {}) {
        const query = normalizeCapability(capability);
        if (!query || !Array.isArray(this.state?.grid)) return false;
        const minimum = normalizeMinimum(options);
        let count = 0;
        for (const row of this.state.grid) {
            for (const cell of row || []) {
                if (readCellCapabilities(cell).has(query) && ++count >= minimum) return true;
            }
        }
        for (const groupId of Object.keys(this.state?.mergedBlocks || {})) {
            if (readZoneConversionCapabilities(this.state, groupId).has(query) && ++count >= minimum) {
                return true;
            }
        }
        return false;
    }

    validateLandPlacement(definition, anchor) {
        if (!this.gridEngine?.canPlaceShape || !definition || !anchor) {
            return { valid: false, reason: 'BOARD_QUERY_UNAVAILABLE', reasons: ['BOARD_QUERY_UNAVAILABLE'] };
        }

        const geometry = resolvePlacementGeometry(definition, anchor.r, anchor.c);
        const semantic = resolveLandSemantic(definition);
        const result = this.gridEngine.canPlaceShape(
            geometry.startR,
            geometry.startC,
            geometry.shape,
            semantic,
            geometry.attributeCells
        );
        return {
            valid: result.can === true,
            reason: result.reason || null,
            reasons: [...(result.reasons || [])],
            placement: geometry
        };
    }

    enumerateLegalLandPlacements(definition) {
        if (!Array.isArray(this.state?.grid) || !this.gridEngine?.canPlaceShape) return [];
        const legal = [];
        for (let r = 0; r < this.state.grid.length; r++) {
            const row = this.state.grid[r];
            for (let c = 0; c < (row?.length || 0); c++) {
                const result = this.validateLandPlacement(definition, { r, c });
                if (result.valid) legal.push({ anchor: { r, c }, placement: result.placement });
            }
        }
        return legal;
    }

    hasAnyLegalLandPlacement(definition) {
        if (!Array.isArray(this.state?.grid) || !this.gridEngine?.canPlaceShape) return false;
        for (let r = 0; r < this.state.grid.length; r++) {
            const row = this.state.grid[r];
            for (let c = 0; c < (row?.length || 0); c++) {
                if (this.validateLandPlacement(definition, { r, c }).valid) return true;
            }
        }
        return false;
    }

    validateSpecialBlockTarget(typeOrDefinition, target, context = {}) {
        return this.specialBlockService.validateTarget(typeOrDefinition, target, context);
    }

    enumerateLegalSpecialBlockTargets(typeOrDefinition, context = {}) {
        return this.specialBlockService.enumerateLegalTargets(typeOrDefinition, context);
    }

    hasAnyLegalSpecialBlockTarget(typeOrDefinition, context = {}) {
        return this.specialBlockService.hasAnyLegalTarget(typeOrDefinition, context);
    }

    createSpecialBlock(type, target, context = {}) {
        return this.specialBlockService.createSpecialBlock(type, target, context);
    }

    readZoneConversion(groupId) {
        return readZoneConversion(this.state, groupId);
    }

    isZoneConversionFunctional(groupId) {
        return isZoneConversionFunctional(this.state, groupId);
    }

    getZoneConversionCount(definitionId = null) {
        return this.zoneConversionService.getConversionCount(definitionId);
    }

    validateZoneConversionCandidate(definitionId, groupId) {
        return this.zoneConversionService.validateCandidate(definitionId, groupId);
    }

    enumerateZoneConversionCandidates(definitionId) {
        return this.zoneConversionService.enumerateCandidates(definitionId);
    }

    hasAnyZoneConversionCandidate(definitionId) {
        return this.zoneConversionService.hasAnyCandidate(definitionId);
    }

    quoteZoneConversionCost(definitionId) {
        return this.zoneConversionService.quoteCost(definitionId);
    }

    getZoneConversionMaintenancePlan(groupId, verse = this.state?.turn) {
        return this.zoneConversionService.getMaintenancePlan(groupId, verse);
    }

    enumerateZoneConversionMaintenanceDue(verse = this.state?.turn) {
        return this.zoneConversionService.enumerateMaintenanceDue(verse);
    }

    applyZoneConversionMaintenanceSettlement(groupId, result = {}) {
        return this.zoneConversionService.applyMaintenanceSettlement(groupId, result);
    }

    createZoneConversion(definitionId, groupId, context = {}) {
        return this.zoneConversionService.createConversion(definitionId, groupId, context);
    }

    readZoneConversionCapabilities(groupId) {
        return readZoneConversionCapabilities(this.state, groupId);
    }

    readCapabilities(target) {
        if (Number.isInteger(target?.r) && Number.isInteger(target?.c)) {
            return this.specialBlockService.readCapabilities(target);
        }
        return readCellCapabilities(target);
    }

    readTrialTraits(entityOrTarget) {
        return this.specialBlockService.readTrialTraits(entityOrTarget);
    }

    readEffectiveGreenery(target) {
        if (Number.isInteger(target?.r) && Number.isInteger(target?.c)) {
            return readEffectiveGreenery(this.state?.grid?.[target.r]?.[target.c] || null);
        }
        return readEffectiveGreenery(target);
    }

    readTrialDeploymentFacts(target) {
        const r = Number.isInteger(target?.r) ? target.r : target?.row;
        const c = Number.isInteger(target?.c) ? target.c : target?.column;
        if (!Number.isInteger(r) || !Number.isInteger(c)) return null;
        const cell = this.state?.grid?.[r]?.[c] || null;
        if (!cell) return null;

        const terrain = cell.terrain || null;
        const capabilities = new Set(this.readCapabilities({ r, c }));
        const baseTrialTraits = this.readTrialTraits({ r, c }) || null;
        const external = this.trialDeploymentSemanticSource?.readCellDeploymentSemantics?.({ r, c }) || null;
        for (const capability of external?.capabilities || []) {
            if (typeof capability === 'string' && capability) capabilities.add(capability);
        }
        const trialTraits = {
            ...(baseTrialTraits || {}),
            ...(external?.trialTraits || {})
        };
        return {
            cell: { r, c },
            placed: cell.placed === true,
            isHQ: cell.isHQ === true,
            terrain: {
                terrainId: terrain?.terrainId || terrain?.id || cell.terrainId || null,
                elevation: Number.isFinite(terrain?.e) ? terrain.e : null,
                growthLevel: Number.isFinite(terrain?.gl) ? terrain.gl : null
            },
            capabilities: [...capabilities],
            trialTraits: Object.keys(trialTraits).length > 0
                ? JSON.parse(JSON.stringify(trialTraits))
                : null,
            damaged: Boolean(cell.damageState || cell.damage || cell.isDamaged)
        };
    }

    listTrialDeploymentOrigins() {
        if (!Array.isArray(this.state?.grid)) return [];
        const origins = [];
        for (let r = 0; r < this.state.grid.length; r++) {
            for (let c = 0; c < (this.state.grid[r]?.length || 0); c++) {
                const facts = this.readTrialDeploymentFacts({ r, c });
                if (!facts) continue;
                const capabilityOrigin = facts.capabilities.includes(BOARD_CAPABILITIES.REINFORCEMENT_ORIGIN);
                const traitOrigin = facts.trialTraits?.reinforcementOrigin === true;
                if (!facts.isHQ && !capabilityOrigin && !traitOrigin) continue;
                origins.push({
                    id: facts.isHQ ? `HQ:${r}:${c}` : `ORIGIN:${r}:${c}`,
                    kind: facts.isHQ ? 'HQ' : BOARD_CAPABILITIES.REINFORCEMENT_ORIGIN,
                    cell: { r, c },
                    capabilities: [...facts.capabilities],
                    trialTraits: facts.trialTraits ? JSON.parse(JSON.stringify(facts.trialTraits)) : null
                });
            }
        }
        const provided = this.trialDeploymentSemanticSource?.listDeploymentOrigins?.() || [];
        for (const origin of Array.isArray(provided) ? provided : []) {
            const r = origin?.cell?.r;
            const c = origin?.cell?.c;
            if (!Number.isInteger(r) || !Number.isInteger(c)) continue;
            const capabilities = Array.isArray(origin.capabilities)
                ? origin.capabilities.filter(value => typeof value === 'string' && value)
                : [];
            const trialTraits = origin.trialTraits && typeof origin.trialTraits === 'object'
                ? JSON.parse(JSON.stringify(origin.trialTraits))
                : null;
            const isSemanticOrigin = capabilities.includes(BOARD_CAPABILITIES.REINFORCEMENT_ORIGIN)
                || trialTraits?.reinforcementOrigin === true
                || origin.kind === BOARD_CAPABILITIES.REINFORCEMENT_ORIGIN;
            if (!isSemanticOrigin) continue;

            const normalized = {
                id: typeof origin.id === 'string' && origin.id
                    ? origin.id
                    : `ORIGIN:${r}:${c}`,
                kind: BOARD_CAPABILITIES.REINFORCEMENT_ORIGIN,
                cell: { r, c },
                capabilities: [...new Set([
                    ...capabilities,
                    BOARD_CAPABILITIES.REINFORCEMENT_ORIGIN
                ])],
                trialTraits
            };
            const duplicate = origins.some(existing => (
                existing.id === normalized.id
                || (
                    existing.kind === normalized.kind
                    && existing.cell.r === r
                    && existing.cell.c === c
                )
            ));
            if (!duplicate) origins.push(normalized);
        }
        return origins;
    }

    recordDamage(request) {
        return this.boardDamageService.recordDamage(request);
    }

    getDamageRecords(query) {
        return this.boardDamageService.getDamageRecords(query);
    }

    hasDamage(query) {
        return this.boardDamageService.hasDamage(query);
    }

    isHQVicinity(r, c) {
        if (typeof this.gridEngine?.isHQVicinity === 'function') {
            return this.gridEngine.isHQVicinity(r, c);
        }
        return this.specialBlockService.isHQVicinity(r, c);
    }
}

export default BoardDomainAdapter;
