import { isWaterSourceInfluence } from '../core/lake_rules.js';

const CARDINAL_DIRECTIONS = Object.freeze([
    Object.freeze({ direction: 'NORTH', dr: -1, dc: 0 }),
    Object.freeze({ direction: 'EAST', dr: 0, dc: 1 }),
    Object.freeze({ direction: 'SOUTH', dr: 1, dc: 0 }),
    Object.freeze({ direction: 'WEST', dr: 0, dc: -1 })
]);

const DISPLAY_ROLE = Object.freeze({
    LAND_PRIMARY: 'LAND_PRIMARY',
    SOCKET: 'SOCKET',
    CLEAN: 'CLEAN'
});

function normalizeGroupId(value) {
    return value === null || value === undefined ? null : String(value);
}

function normalizeLinkEntries(mergeLinks) {
    if (mergeLinks instanceof Set) return [...mergeLinks];
    if (Array.isArray(mergeLinks)) return mergeLinks;
    return [];
}

function pickPrimaryYield(terrainId, production) {
    const food = production.food || 0;
    const wood = production.wood || 0;
    const defense = production.defense || 0;
    const mystic = production.mystic || 0;
    const max = Math.max(food, wood, defense, mystic);
    if (max <= 0) return null;

    const id = String(terrainId || '').toUpperCase();
    let order;
    if (id.includes('PLAINS')) order = ['food', 'wood', 'defense', 'mystic'];
    else if (id.includes('FOREST')) order = ['wood', 'food', 'defense', 'mystic'];
    else if (id.includes('HILL') || id.includes('MOUNTAIN')) order = ['defense', 'wood', 'food', 'mystic'];
    else order = ['mystic', 'food', 'wood', 'defense'];

    for (const resource of order) {
        if ((production[resource] || 0) === max) {
            return Object.freeze({ resource, amount: max });
        }
    }
    return null;
}

function addNonSocketProduction(target, viewData) {
    const base = viewData?.baseYields || {};
    target.food += base.food || 0;
    target.wood += base.wood || 0;
    target.defense += base.defense || 0;
    target.mystic += base.mystic || 0;

    for (const modifier of viewData?.modifiers || []) {
        if (!modifier || modifier.type === 'SOCKET') continue;
        const resource = modifier.resource;
        if (!Object.prototype.hasOwnProperty.call(target, resource)) continue;
        target[resource] += modifier.amount || 0;
    }
}

export class BoardPresentationSemanticService {
    constructor({ cellViewDataService } = {}) {
        this.cellViewDataService = cellViewDataService || null;
    }

    getZone(state, facts) {
        const zoneId = normalizeGroupId(facts?.mergeGroupId);
        if (!zoneId) return null;
        const group = state?.mergedBlocks?.[zoneId] || state?.mergedBlocks?.[facts.mergeGroupId] || null;
        return Object.freeze({
            zoneId,
            terrainId: group?.terrainId || facts?.terrainId || null,
            category: group?.zoneCategory || null,
            mergeType: group?.mergeType || null
        });
    }

    buildLinkIndex(state) {
        const byZone = new Map();
        for (const rawLink of normalizeLinkEntries(state?.mergeLinks)) {
            const linkId = String(rawLink);
            const zoneIds = linkId.split('::').map(normalizeGroupId).filter(Boolean);
            if (zoneIds.length !== 2 || zoneIds[0] === zoneIds[1]) continue;
            const link = Object.freeze({ linkId, zoneIds: Object.freeze(zoneIds) });
            for (const zoneId of zoneIds) {
                const current = byZone.get(zoneId) || [];
                current.push(link);
                byZone.set(zoneId, current);
            }
        }
        return byZone;
    }

    getDisplayRole(state, facts) {
        if (!facts?.placed || facts?.isHQ) return null;
        if (facts.socketResource) return DISPLAY_ROLE.SOCKET;

        const activeGroupId = normalizeGroupId(facts.mergeGroupId || facts.placementGroupId);
        if (!activeGroupId) return DISPLAY_ROLE.LAND_PRIMARY;

        const grid = state?.grid || [];
        for (let r = 0; r < grid.length; r++) {
            for (let c = 0; c < (grid[r]?.length || 0); c++) {
                const cell = grid[r][c];
                if (!cell) continue;
                const cellGroupId = normalizeGroupId(cell.mergeGroupId || cell.placementGroupId);
                if (cellGroupId !== activeGroupId || cell.socketResource) continue;
                return r === facts.r && c === facts.c
                    ? DISPLAY_ROLE.LAND_PRIMARY
                    : DISPLAY_ROLE.CLEAN;
            }
        }
        return DISPLAY_ROLE.LAND_PRIMARY;
    }

    getDisplayProduction(state, facts) {
        if (!facts?.placed || facts?.isHQ) return null;
        const role = this.getDisplayRole(state, facts);
        if (role !== DISPLAY_ROLE.LAND_PRIMARY) return null;
        if (!this.cellViewDataService) return null;

        const activeGroupId = normalizeGroupId(facts.mergeGroupId || facts.placementGroupId);
        const production = { food: 0, wood: 0, defense: 0, mystic: 0 };

        if (activeGroupId) {
            const grid = state?.grid || [];
            for (let r = 0; r < grid.length; r++) {
                for (let c = 0; c < (grid[r]?.length || 0); c++) {
                    const cell = grid[r][c];
                    if (!cell?.placed) continue;
                    const matchesGroup = normalizeGroupId(cell.mergeGroupId) === activeGroupId
                        || normalizeGroupId(cell.placementGroupId) === activeGroupId;
                    if (!matchesGroup) continue;
                    addNonSocketProduction(production, this.cellViewDataService.getCellViewData(state, r, c));
                }
            }

            const sourceCell = state?.grid?.[facts.r]?.[facts.c];
            if (sourceCell?.merged && facts.mergeGroupId != null) {
                const group = state?.mergedBlocks?.[facts.mergeGroupId];
                const multiplier = group?.yieldMultiplier || 1.20;
                production.food = Math.floor(production.food * multiplier);
                production.wood = Math.floor(production.wood * multiplier);
                production.defense = Math.floor(production.defense * multiplier);
                production.mystic = Math.floor(production.mystic * multiplier);
            }
        } else {
            addNonSocketProduction(production, facts);
        }

        return Object.freeze({
            ...production,
            primaryYield: pickPrimaryYield(facts.terrainId, production)
        });
    }

    getInfluence(state, r, c) {
        const hqVicinity = typeof state?.isHQVicinity === 'function'
            ? Boolean(state.isHQVicinity(r, c))
            : false;
        const waterSource = typeof state?.isWaterSourceInfluence === 'function'
            ? Boolean(state.isWaterSourceInfluence(r, c))
            : Boolean(state && isWaterSourceInfluence(state, r, c));
        return Object.freeze({ hqVicinity, waterSource });
    }

    getLogicalEdges(state, facts, linkIndex = null) {
        const grid = state?.grid || [];
        const currentCell = grid?.[facts?.r]?.[facts?.c] || null;
        const currentPlacementGroupId = normalizeGroupId(currentCell?.placementGroupId ?? facts?.placementGroupId);
        const currentZoneId = normalizeGroupId(currentCell?.mergeGroupId ?? facts?.mergeGroupId);
        const currentInfluence = this.getInfluence(state, facts?.r, facts?.c);
        const currentLinks = currentZoneId ? (linkIndex?.get(currentZoneId) || []) : [];
        const linkedZoneIds = new Set();
        for (const link of currentLinks) {
            for (const zoneId of link.zoneIds || []) {
                if (zoneId !== currentZoneId) linkedZoneIds.add(zoneId);
            }
        }

        const edges = CARDINAL_DIRECTIONS.map(({ direction, dr, dc }) => {
            const nr = facts.r + dr;
            const nc = facts.c + dc;
            const neighborCell = grid?.[nr]?.[nc] || null;
            const neighbor = neighborCell ? Object.freeze({ r: nr, c: nc }) : null;
            const neighborPlacementGroupId = normalizeGroupId(neighborCell?.placementGroupId);
            const neighborZoneId = normalizeGroupId(neighborCell?.mergeGroupId);
            const samePlacementGroup = Boolean(
                currentPlacementGroupId
                && neighborPlacementGroupId
                && currentPlacementGroupId === neighborPlacementGroupId
            );
            const sameZone = Boolean(
                currentZoneId
                && neighborZoneId
                && currentZoneId === neighborZoneId
            );
            const linked = Boolean(
                currentZoneId
                && neighborZoneId
                && currentZoneId !== neighborZoneId
                && linkedZoneIds.has(neighborZoneId)
            );

            const neighborInfluence = neighborCell
                ? this.getInfluence(state, nr, nc)
                : Object.freeze({ hqVicinity: false, waterSource: false });
            const influenceBoundary = [];
            if (currentInfluence.hqVicinity !== neighborInfluence.hqVicinity) {
                influenceBoundary.push('HQ_VICINITY');
            }
            if (currentInfluence.waterSource !== neighborInfluence.waterSource) {
                influenceBoundary.push('WATER_SOURCE');
            }

            return Object.freeze({
                direction,
                neighbor,
                boardBoundary: !neighborCell,
                samePlacementGroup,
                sameZone,
                linked,
                placementBoundary: Boolean(currentPlacementGroupId && !samePlacementGroup),
                zoneBoundary: Boolean(currentZoneId && !sameZone),
                influenceBoundary: Object.freeze(influenceBoundary)
            });
        });

        return Object.freeze(edges);
    }

    getCellSemantic(state, facts, linkIndex = null) {
        const zone = this.getZone(state, facts);
        const links = zone
            ? Object.freeze([...(linkIndex?.get(zone.zoneId) || [])])
            : Object.freeze([]);
        const role = this.getDisplayRole(state, facts);
        const production = this.getDisplayProduction(state, facts);
        return Object.freeze({
            zone,
            links,
            display: Object.freeze({ role, production }),
            influence: this.getInfluence(state, facts.r, facts.c),
            edges: this.getLogicalEdges(state, facts, linkIndex)
        });
    }
}

export { DISPLAY_ROLE };
export default BoardPresentationSemanticService;
