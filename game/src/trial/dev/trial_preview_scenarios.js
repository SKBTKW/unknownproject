const terrain = (id, e, gl, nameKey) => ({ id, terrainId: id, e, gl, nameKey });

const TERRAIN_COMPARE_BASIC = Object.freeze({
    id: "TERRAIN_COMPARE_BASIC",
    nameKey: "DEV_TRIAL_SCENARIO_TERRAIN_COMPARE",
    stage: 1,
    enemySuppression: 14,
    deployedDefense: 16,
    availableDefense: 20,
    routeId: "TERRAIN_COMPARE_ROUTE",
    route: [
        { r: 0, c: 0, terrain: terrain("E0_WETLAND", 0, 1, "TERRAIN_WETLAND") },
        { r: 1, c: 0, terrain: terrain("GL1_PLAINS", 1, 1, "TERRAIN_PLAINS") },
        { r: 2, c: 0, terrain: terrain("GL1_PLAINS", 1, 1, "TERRAIN_PLAINS") },
        { r: 2, c: 1, terrain: terrain("GL2_FOREST", 1, 2, "TERRAIN_FOREST") },
        { r: 3, c: 1, terrain: terrain("E2_FOREST_HILL", 2, 2, "TERRAIN_FOREST_HILL") }
    ],
    routes: [
        {
            id: "TERRAIN_COMPARE_ROUTE",
            nameKey: "DEV_TRIAL_ROUTE_COMMANDER",
            isCommanderRoute: true,
            suppression: 10,
            cells: [
                { r: 0, c: 0, terrain: terrain("E0_WETLAND", 0, 1, "TERRAIN_WETLAND"), placementGroupId: "block_0_0" },
                { r: 1, c: 0, terrain: terrain("GL1_PLAINS", 1, 1, "TERRAIN_PLAINS"), placementGroupId: "block_1_0" },
                { r: 2, c: 0, terrain: terrain("GL1_PLAINS", 1, 1, "TERRAIN_PLAINS"), placementGroupId: "block_2_0" },
                { r: 2, c: 1, terrain: terrain("GL2_FOREST", 1, 2, "TERRAIN_FOREST"), placementGroupId: "block_2_1" },
                { r: 3, c: 1, terrain: terrain("E2_FOREST_HILL", 2, 2, "TERRAIN_FOREST_HILL"), placementGroupId: "block_3_1" }
            ]
        },
        {
            id: "TERRAIN_COMPARE_ROUTE_EAST",
            nameKey: "DEV_TRIAL_ROUTE_EAST",
            isCommanderRoute: false,
            suppression: 6,
            cells: [
                { r: 0, c: 2, terrain: terrain("GL1_PLAINS", 1, 1, "TERRAIN_PLAINS"), placementGroupId: "block_0_2" },
                { r: 1, c: 2, terrain: terrain("GL2_FOREST", 1, 2, "TERRAIN_FOREST"), placementGroupId: "block_1_2" },
                { r: 2, c: 2, terrain: terrain("GL1_PLAINS", 1, 1, "TERRAIN_PLAINS"), placementGroupId: "block_2_2" },
                { r: 3, c: 2, terrain: terrain("GL1_PLAINS", 1, 1, "TERRAIN_PLAINS"), placementGroupId: "block_3_2" }
            ]
        },
        {
            id: "TERRAIN_COMPARE_ROUTE_SOUTH",
            nameKey: "DEV_TRIAL_ROUTE_SOUTH",
            isCommanderRoute: false,
            suppression: 4,
            cells: [
                { r: 0, c: 3, terrain: terrain("GL1_PLAINS", 1, 1, "TERRAIN_PLAINS"), placementGroupId: "block_0_3" },
                { r: 1, c: 3, terrain: terrain("GL1_PLAINS", 1, 1, "TERRAIN_PLAINS"), placementGroupId: "block_1_3" },
                { r: 2, c: 3, terrain: terrain("GL1_PLAINS", 1, 1, "TERRAIN_PLAINS"), placementGroupId: "block_2_3" },
                { r: 3, c: 3, terrain: terrain("GL1_PLAINS", 1, 1, "TERRAIN_PLAINS"), placementGroupId: "block_3_3" }
            ]
        }
    ]
});

export const TRIAL_PREVIEW_SCENARIOS = Object.freeze({
    [TERRAIN_COMPARE_BASIC.id]: TERRAIN_COMPARE_BASIC
});

export function getTrialPreviewScenario(id = "TERRAIN_COMPARE_BASIC") {
    const scenario = TRIAL_PREVIEW_SCENARIOS[id];
    return scenario ? JSON.parse(JSON.stringify(scenario)) : null;
}
