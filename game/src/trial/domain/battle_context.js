function normalizeCell(cell) {
    if (!cell) return null;
    const terrain = cell.terrain || cell;
    return {
        cellId: cell.cellId || cell.id || null,
        row: Number.isInteger(cell.row) ? cell.row : null,
        column: Number.isInteger(cell.column) ? cell.column : null,
        terrain,
        terrainId: terrain.id || terrain.terrainId || null,
        elevation: Number.isFinite(terrain.e) ? terrain.e : 1,
        growthLevel: Number.isFinite(terrain.gl) ? terrain.gl : null
    };
}

export function createBattleContext({
    interceptCell,
    approachCell,
    allocatedDefense,
    baseInterceptionPower,
    enemySuppression,
    enemy = {},
    environment = {},
    links = [],
    supports = []
}) {
    return {
        interceptCell: normalizeCell(interceptCell),
        approachCell: normalizeCell(approachCell),
        human: {
            allocatedDefense: Math.max(0, Number(allocatedDefense) || 0),
            baseInterceptionPower: Math.max(0, Number(baseInterceptionPower) || 0)
        },
        enemy: {
            suppression: Math.max(0, Number(enemySuppression) || 0),
            species: enemy.species || null,
            commander: enemy.commander || null
        },
        environment: { ...environment },
        links: [...links],
        supports: [...supports]
    };
}

