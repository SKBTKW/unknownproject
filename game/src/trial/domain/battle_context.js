function normalizeCell(cell) {
    if (!cell) return null;
    const terrain = cell.terrain || cell;
    return {
        cellId: cell.cellId || cell.id || null,
        row: Number.isInteger(cell.row) ? cell.row : null,
        column: Number.isInteger(cell.column) ? cell.column : null,
        terrain,
        terrainId: terrain.terrainId || terrain.id || null,
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
