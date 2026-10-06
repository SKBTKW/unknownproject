import { readSpecialBlockAdjacencyProfile } from '../../core/special_block_domain.js';

function cloneData(value) {
    if (value === undefined) return undefined;
    return JSON.parse(JSON.stringify(value));
}

function normalizeCell(cell) {
    if (!cell) return null;
    const terrain = cell.terrain || null;
    const specialAxes = cell.specialBlock ? readSpecialBlockAdjacencyProfile(cell) : null;
    const row = Number.isInteger(cell.row)
        ? cell.row
        : (Number.isInteger(cell.r) ? cell.r : null);
    const column = Number.isInteger(cell.column)
        ? cell.column
        : (Number.isInteger(cell.c) ? cell.c : null);
    const embeddedOrigin = cell.trialEngagementOrigin || null;
    const engagementCapabilities = [
        ...(Array.isArray(embeddedOrigin?.capabilities) ? embeddedOrigin.capabilities : []),
        ...(Array.isArray(cell.trialEngagementCapabilities) ? cell.trialEngagementCapabilities : [])
    ];
    return {
        cellId: cell.cellId || cell.id || null,
        row,
        column,
        r: row,
        c: column,
        placed: cell.placed === true,
        isHQ: cell.isHQ === true,
        terrain,
        terrainId: terrain?.terrainId || terrain?.id || cell.terrainId || null,
        elevation: specialAxes ? specialAxes.e : Number.isFinite(terrain?.e)
            ? terrain.e
            : (Number.isFinite(cell.elevation) ? cell.elevation : null),
        growthLevel: specialAxes ? specialAxes.gl : Number.isFinite(terrain?.gl)
            ? terrain.gl
            : (Number.isFinite(cell.growthLevel) ? cell.growthLevel : null),
        engagementOrigin: embeddedOrigin ? cloneData(embeddedOrigin) : null,
        engagementCapabilities: [...new Set(engagementCapabilities.filter(Boolean))],
        specialBlock: cell.specialBlock
            ? JSON.parse(JSON.stringify(cell.specialBlock))
            : null
    };
}

export function createBattleContext({
    interceptCell,
    approachCell,
    humanEngagementOrigin = null,
    allocatedDefense,
    baseInterceptionPower,
    enemySuppression,
    enemyStrategicSuppression = null,
    enemyReserveSuppression = 0,
    enemyDeployment = null,
    enemy = {},
    environment = {},
    links = [],
    supports = []
}) {
    return {
        interceptCell: normalizeCell(interceptCell),
        approachCell: normalizeCell(approachCell),
        humanEngagementOrigin: normalizeCell(humanEngagementOrigin),
        human: {
            allocatedDefense: Math.max(0, Number(allocatedDefense) || 0),
            baseInterceptionPower: Math.max(0, Number(baseInterceptionPower) || 0)
        },
        enemy: {
            suppression: Math.max(0, Number(enemySuppression) || 0),
            strategicSuppression: enemyStrategicSuppression == null
                ? null
                : Math.max(0, Number(enemyStrategicSuppression) || 0),
            reserveSuppression: Math.max(0, Number(enemyReserveSuppression) || 0),
            deployment: enemyDeployment ? JSON.parse(JSON.stringify(enemyDeployment)) : null,
            species: enemy.species || null,
            commander: enemy.commander || null
        },
        environment: { ...environment },
        links: [...links],
        supports: [...supports]
    };
}
