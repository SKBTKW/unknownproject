import { isIrrigationInfluence } from '../core/irrigation_rules.js';
import { getWaterSourceInfluenceType } from '../core/lake_rules.js';
import { resolvePlacedBlockProduction } from '../core/land_production_contract.js';
import { hasRoadBetween } from '../core/road_network.js';

const CARDINAL_DIRECTIONS = Object.freeze([
    Object.freeze({ direction: 'NORTH', dr: -1, dc: 0 }),
    Object.freeze({ direction: 'EAST', dr: 0, dc: 1 }),
    Object.freeze({ direction: 'SOUTH', dr: 1, dc: 0 }),
    Object.freeze({ direction: 'WEST', dr: 0, dc: -1 })
]);

const DISPLAY_ROLE = Object.freeze({
    LAND_PRIMARY: 'LAND_PRIMARY',
    SOCKET: 'SOCKET',
    SPECIAL_BLOCK: 'SPECIAL_BLOCK',
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

const DISPLAY_GROUP_KIND = Object.freeze({
    ZONE: 'ZONE',
    PLACEMENT: 'PLACEMENT'
});

function resolveDisplayGroup(facts) {
    const zoneId = normalizeGroupId(facts?.mergeGroupId);
    if (zoneId) return Object.freeze({ kind: DISPLAY_GROUP_KIND.ZONE, id: zoneId });

    const placementGroupId = normalizeGroupId(facts?.placementGroupId);
    if (placementGroupId) {
        return Object.freeze({ kind: DISPLAY_GROUP_KIND.PLACEMENT, id: placementGroupId });
    }

    return null;
}

function cellMatchesDisplayGroup(cell, group) {
    if (!cell || !group) return false;
    if (group.kind === DISPLAY_GROUP_KIND.ZONE) {
        return normalizeGroupId(cell.mergeGroupId) === group.id;
    }
    return normalizeGroupId(cell.mergeGroupId) === null
        && normalizeGroupId(cell.placementGroupId) === group.id;
}

function findPlacementDisplayOwner(state, placementGroupId) {
    const targetId = normalizeGroupId(placementGroupId);
    if (!targetId) return null;

    const grid = state?.grid || [];
    let fallback = null;
    for (let r = 0; r < grid.length; r++) {
        for (let c = 0; c < (grid[r]?.length || 0); c++) {
            const cell = grid[r][c];
            if (!cell?.placed || normalizeGroupId(cell.placementGroupId) !== targetId) continue;
            if (!fallback) fallback = { r, c, cell };
            if (!cell.socketResource) return { r, c, cell };
        }
    }
    return fallback;
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

function getSocketYieldValues(socket) {
    const yields = socket?.yields || {};
    return {
        food: yields.food ?? socket?.bonusFood ?? 0,
        wood: yields.wood ?? yields.material ?? socket?.bonusMaterial ?? socket?.bonusWood ?? 0,
        defense: yields.defense ?? socket?.bonusDefense ?? 0,
        mystic: yields.mystic ?? socket?.bonusMystic ?? 0
    };
}

export function resolveSocketPrimaryYield(socket) {
    if (!socket) return null;
    const production = getSocketYieldValues(socket);
    const max = Math.max(production.food, production.wood, production.defense, production.mystic);
    if (max <= 0) return null;

    const key = String(socket.nameKey || socket.id || '').toUpperCase();
    let order;
    if (key.includes('MINE') || key.includes('ORE') || key.includes('IRON') || key.includes('HIDDEN')) {
        order = ['wood', 'defense', 'mystic', 'food'];
    } else if (key.includes('FORT') || key.includes('PEAK') || key.includes('GUARD')) {
        order = ['defense', 'mystic', 'wood', 'food'];
    } else if (key.includes('LAKE') || key.includes('WHEAT') || key.includes('CLEAR') || key.includes('WILD')) {
        order = ['food', 'wood', 'defense', 'mystic'];
    } else {
        order = ['mystic', 'wood', 'defense', 'food'];
    }

    for (const resource of order) {
        if (production[resource] === max) {
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
        if (!modifier || modifier.type === 'SOCKET' || modifier.type === 'SPECIAL_BLOCK') continue;
        const resource = modifier.resource;
        if (!Object.prototype.hasOwnProperty.call(target, resource)) continue;
        target[resource] += modifier.amount || 0;
    }
}

function addSpecialBlockProduction(target, viewData) {
    const yields = viewData?.specialBlock?.yields || {};
    target.food += yields.food || 0;
    target.wood += yields.wood || 0;
    target.defense += yields.defense || 0;
    target.mystic += yields.mystic || 0;
}

export function resolveBoardDisplayRole(state, facts) {
    if (!facts || facts.isHQ) return null;
    if (!facts.placed && facts.specialBlock) return DISPLAY_ROLE.SPECIAL_BLOCK;
    if (!facts.placed) return null;
    if (facts.socketResource) return DISPLAY_ROLE.SOCKET;

    const activeGroup = resolveDisplayGroup(facts);
    if (!activeGroup) return DISPLAY_ROLE.LAND_PRIMARY;

    const grid = state?.grid || [];
    for (let r = 0; r < grid.length; r++) {
        for (let c = 0; c < (grid[r]?.length || 0); c++) {
            const cell = grid[r][c];
            if (!cellMatchesDisplayGroup(cell, activeGroup) || cell.socketResource) continue;
            return r === facts.r && c === facts.c
                ? DISPLAY_ROLE.LAND_PRIMARY
                : DISPLAY_ROLE.CLEAN;
        }
    }
    return DISPLAY_ROLE.LAND_PRIMARY;
}

export function resolveBoardDisplayProduction(state, facts, cellViewDataService) {
    if (!facts || facts.isHQ || !cellViewDataService) return null;
    const role = resolveBoardDisplayRole(state, facts);
    if (role === DISPLAY_ROLE.SPECIAL_BLOCK) {
        const production = {
            food: facts.yields?.food || 0,
            wood: facts.yields?.wood || 0,
            defense: facts.yields?.defense || 0,
            mystic: facts.yields?.mystic || 0
        };
        return Object.freeze({
            ...production,
            primaryYield: facts.primaryYield || pickPrimaryYield(facts.specialBlock?.type, production)
        });
    }
    if (!facts.placed) return null;
    if (role !== DISPLAY_ROLE.LAND_PRIMARY && role !== DISPLAY_ROLE.SOCKET) return null;

    if (role === DISPLAY_ROLE.SOCKET) {
        const socketProduction = getSocketYieldValues(facts.socketResource);
        const socketPrimaryYield = resolveSocketPrimaryYield(facts.socketResource);
        if (socketPrimaryYield) {
            return Object.freeze({
                ...socketProduction,
                primaryYield: socketPrimaryYield
            });
        }
    }

    const activeGroup = resolveDisplayGroup(facts);
    const production = { food: 0, wood: 0, defense: 0, mystic: 0 };
    const specialProduction = { food: 0, wood: 0, defense: 0, mystic: 0 };

    if (activeGroup) {
        const grid = state?.grid || [];
        const placementGroups = new Set();
        for (let r = 0; r < grid.length; r++) {
            for (let c = 0; c < (grid[r]?.length || 0); c++) {
                const cell = grid[r][c];
                if (!cell?.placed) continue;
                if (!cellMatchesDisplayGroup(cell, activeGroup)) continue;
                if (cell.placementGroupId != null) placementGroups.add(String(cell.placementGroupId));
                const cellView = cellViewDataService.getCellViewData(state, r, c);
                addNonSocketProduction(production, cellView);
                addSpecialBlockProduction(specialProduction, cellView);
            }
        }

        const sourceCell = state?.grid?.[facts.r]?.[facts.c];
        if (activeGroup.kind === DISPLAY_GROUP_KIND.ZONE
            && sourceCell?.merged
            && facts.mergeGroupId != null) {
            const group = state?.mergedBlocks?.[facts.mergeGroupId];
            const multiplier = group?.yieldMultiplier || 1.20;
            // Keep presentation rounding identical to ProductionCalculator settlement.
            production.food = Math.ceil(production.food * multiplier);
            production.wood = Math.ceil(production.wood * multiplier);
            production.defense = Math.ceil(production.defense * multiplier);
            production.mystic = Math.ceil(production.mystic * multiplier);
        }

        // Block-owned output is not a cell/Zone output. Add it once per
        // placementGroup after Zone multipliers so display matches settlement.
        for (const placementGroupId of placementGroups) {
            const owner = findPlacementDisplayOwner(state, placementGroupId);
            if (!owner || !cellMatchesDisplayGroup(owner.cell, activeGroup)) continue;

            const blockProduction = resolvePlacedBlockProduction(state, placementGroupId);
            if (!blockProduction.defined) continue;
            production.food += blockProduction.yields.food;
            production.wood += blockProduction.yields.wood;
            production.defense += blockProduction.yields.defense;
            production.mystic += blockProduction.yields.mystic;
        }
        production.food += specialProduction.food;
        production.wood += specialProduction.wood;
        production.defense += specialProduction.defense;
        production.mystic += specialProduction.mystic;
    } else {
        addNonSocketProduction(production, facts);
        addSpecialBlockProduction(production, facts);
    }

    return Object.freeze({
        ...production,
        primaryYield: pickPrimaryYield(facts.terrainId, production)
    });
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
        return resolveBoardDisplayRole(state, facts);
    }

    getDisplayProduction(state, facts) {
        return resolveBoardDisplayProduction(state, facts, this.cellViewDataService);
    }

    getHistory(state, facts) {
        const cell = state?.grid?.[facts?.r]?.[facts?.c] || null;
        const battleSites = Array.isArray(cell?.entities)
            ? cell.entities
                .filter(entity => {
                    const type = String(
                        entity?.entityType
                        || entity?.type
                        || entity?.definitionId
                        || entity?.kind
                        || entity?.id
                        || ''
                    ).toUpperCase();
                    return type === 'BATTLE_SITE' || type.startsWith('BATTLE_SITE@');
                })
                .map(entity => Object.freeze({
                    id: entity.id || null,
                    trialIndex: Number.isInteger(entity.trialIndex) ? entity.trialIndex : null,
                    scenarioId: entity.scenarioId || null,
                    battleIndex: Number.isInteger(entity.battleIndex) ? entity.battleIndex : null,
                    routeId: entity.routeId || null,
                    outcome: entity.outcome || null,
                    trialOutcome: entity.trialOutcome || null,
                    settledTurn: Number.isInteger(entity.settledTurn) ? entity.settledTurn : null
                }))
            : [];
        const damageRecords = Array.isArray(cell?.damageRecords)
            ? cell.damageRecords.map(record => Object.freeze({
                id: record?.id || null,
                target: record?.target || null,
                source: record?.source ? Object.freeze({ ...record.source }) : null,
                metadata: record?.metadata ? Object.freeze({ ...record.metadata }) : null
            }))
            : [];
        const landDamageRecords = damageRecords.filter(record => record.target === 'LAND');
        const specialBlockDamageRecords = damageRecords.filter(record => record.target === 'SPECIAL_BLOCK');

        return Object.freeze({
            battleSite: battleSites.length > 0,
            battleSites: Object.freeze(battleSites),
            damage: Object.freeze({
                any: damageRecords.length > 0,
                land: landDamageRecords.length > 0,
                specialBlock: specialBlockDamageRecords.length > 0,
                records: Object.freeze(damageRecords),
                landRecords: Object.freeze(landDamageRecords),
                specialBlockRecords: Object.freeze(specialBlockDamageRecords)
            })
        });
    }

    getInfluence(state, r, c) {
        const hqVicinity = typeof state?.isHQVicinity === 'function'
            ? Boolean(state.isHQVicinity(r, c))
            : false;
        const waterSourceType = state
            ? getWaterSourceInfluenceType(state, r, c)
            : null;
        const waterSource = typeof state?.isWaterSourceInfluence === 'function'
            ? Boolean(state.isWaterSourceInfluence(r, c))
            : Boolean(state && isIrrigationInfluence(state, r, c));
        return Object.freeze({ hqVicinity, waterSource, waterSourceType });
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
            const road = Boolean(
                neighborCell
                && hasRoadBetween(
                    state,
                    { r: facts.r, c: facts.c },
                    { r: nr, c: nc }
                )
            );

            const neighborInfluence = neighborCell
                ? this.getInfluence(state, nr, nc)
                : Object.freeze({ hqVicinity: false, waterSource: false, waterSourceType: null });
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
                road,
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
            history: this.getHistory(state, facts),
            influence: this.getInfluence(state, facts.r, facts.c),
            edges: this.getLogicalEdges(state, facts, linkIndex)
        });
    }
}

export { DISPLAY_ROLE };
export default BoardPresentationSemanticService;
