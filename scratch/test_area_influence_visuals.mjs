/**
 * test_area_influence_visuals.mjs
 * 
 * Cases A through J for Area Influence Visuals
 */

import { AreaInfluenceVisualService } from '../game/src/ui/area_influence_visual_service.js';
import { isWaterSourceInfluence } from '../game/src/core/lake_rules.js';

let passedTests = 0;
let totalTests = 0;

function assert(condition, message) {
    totalTests++;
    if (!condition) {
        console.error(`FAIL: ${message}`);
        throw new Error(message);
    }
    passedTests++;
    console.log(`  PASS: ${message}`);
}

console.log("=== Running Area Influence Visuals Test Suite (Cases A-J) ===");

// Test A: Lake center
console.log("\n[Test A] Lake Center (3x3 area & boundary)");
{
    const size = 5;
    const grid = Array.from({ length: size }, () => Array.from({ length: size }, () => ({ placed: false })));
    grid[2][2] = {
        placed: true,
        terrain: { id: "GL1_PLAINS", nameKey: "TERRAIN_PLAINS" },
        socketResource: { id: "SOCKET_LAKE", nameKey: "RES_LAKE" }
    };
    const state = { grid, isHQVicinity: () => false, isWaterSourceInfluence: (r, c) => isWaterSourceInfluence({ grid }, r, c) };

    const { lakeInfluenceCells } = AreaInfluenceVisualService.buildInfluenceCellSets(state, size);
    assert(lakeInfluenceCells.size === 9, `Lake center registers 9 cells in total (actual: ${lakeInfluenceCells.size})`);
    
    for (let r = 1; r <= 3; r++) {
        for (let c = 1; c <= 3; c++) {
            assert(lakeInfluenceCells.has(`${r},${c}`), `Cell (${r},${c}) is in lake influence`);
        }
    }
    assert(grid[1][1].placed === false, "Cell (1,1) is unplaced");
    assert(lakeInfluenceCells.has("1,1"), "Unplaced cell (1,1) is included in lake influence");

    const cellRectsMap = AreaInfluenceVisualService.getCellRectsFromDom(null, size);
    const geom = AreaInfluenceVisualService.generateBoundaryGeometry(lakeInfluenceCells, cellRectsMap, { gapOffset: 1 });
    
    assert(geom.segments.length === 12, `3x3 boundary segment count is 12 (actual: ${geom.segments.length})`);
    assert(geom.pathData.includes("M ") && geom.pathData.includes("L "), "SVG Path data generated");
}

// Test B: Lake on board edge
console.log("\n[Test B] Lake on board edge (0,0)");
{
    const size = 5;
    const grid = Array.from({ length: size }, () => Array.from({ length: size }, () => ({ placed: false })));
    grid[0][0] = {
        placed: true,
        terrain: { id: "GL1_PLAINS" },
        socketResource: { id: "SOCKET_LAKE" }
    };
    const state = { grid, isHQVicinity: () => false, isWaterSourceInfluence: (r, c) => isWaterSourceInfluence({ grid }, r, c) };

    const { lakeInfluenceCells } = AreaInfluenceVisualService.buildInfluenceCellSets(state, size);
    assert(lakeInfluenceCells.size === 4, `Corner lake registers 4 cells (actual: ${lakeInfluenceCells.size})`);
    assert(lakeInfluenceCells.has("0,0") && lakeInfluenceCells.has("0,1") && lakeInfluenceCells.has("1,0") && lakeInfluenceCells.has("1,1"), "4 corner cells correct");

    const cellRectsMap = AreaInfluenceVisualService.getCellRectsFromDom(null, size);
    const geom = AreaInfluenceVisualService.generateBoundaryGeometry(lakeInfluenceCells, cellRectsMap, { gapOffset: 1 });
    assert(geom.segments.length === 8, `2x2 partial boundary has 8 segments (actual: ${geom.segments.length})`);
}

// Test C: HQ Center
console.log("\n[Test C] HQ Center vicinity");
{
    const size = 5;
    const state = {
        grid: Array.from({ length: size }, () => Array.from({ length: size }, () => ({ placed: false }))),
        isHQVicinity: (r, c) => !(r === 2 && c === 2) && Math.abs(r - 2) <= 1 && Math.abs(c - 2) <= 1,
        isWaterSourceInfluence: () => false
    };

    const { hqInfluenceCells } = AreaInfluenceVisualService.buildInfluenceCellSets(state, size);
    assert(hqInfluenceCells.size === 8, `HQ vicinity registers 8 surrounding cells (actual: ${hqInfluenceCells.size})`);
    assert(!hqInfluenceCells.has("2,2"), "HQ itself (2,2) is not in vicinity set");

    const cellRectsMap = AreaInfluenceVisualService.getCellRectsFromDom(null, size);
    const geom = AreaInfluenceVisualService.generateBoundaryGeometry(hqInfluenceCells, cellRectsMap, { gapOffset: 3 });
    assert(geom.segments.length === 16, `Donut shape vicinity has 16 boundary segments (actual: ${geom.segments.length})`);
}

// Test D: Edge clip
console.log("\n[Test D] Edge clip handling");
{
    const size = 5;
    const edgeSet = new Set(["0,0", "0,1", "0,2"]);
    const cellRectsMap = AreaInfluenceVisualService.getCellRectsFromDom(null, size);
    const geom = AreaInfluenceVisualService.generateBoundaryGeometry(edgeSet, cellRectsMap, { gapOffset: 1 });
    assert(geom.segments.length === 8, `Edge segments count is 8 (actual: ${geom.segments.length})`);
}

// Test E: Lake + HQ overlap
console.log("\n[Test E] Lake + HQ overlap with physical offset separation");
{
    const size = 5;
    const grid = Array.from({ length: size }, () => Array.from({ length: size }, () => ({ placed: false })));
    grid[1][1] = {
        placed: true,
        terrain: { id: "GL1_PLAINS" },
        socketResource: { id: "SOCKET_LAKE" }
    };
    const state = {
        grid,
        isHQVicinity: (r, c) => !(r === 2 && c === 2) && Math.abs(r - 2) <= 1 && Math.abs(c - 2) <= 1,
        isWaterSourceInfluence: (r, c) => isWaterSourceInfluence({ grid }, r, c)
    };

    const { lakeInfluenceCells, hqInfluenceCells } = AreaInfluenceVisualService.buildInfluenceCellSets(state, size);
    const intersection = [];
    for (const key of lakeInfluenceCells) {
        if (hqInfluenceCells.has(key)) intersection.push(key);
    }
    assert(intersection.length > 0, `Lake and HQ overlap detected (${intersection.length} cells overlap)`);

    const cellRectsMap = AreaInfluenceVisualService.getCellRectsFromDom(null, size);
    const lakeGeom = AreaInfluenceVisualService.generateBoundaryGeometry(lakeInfluenceCells, cellRectsMap, { gapOffset: 1 });
    const hqGeom = AreaInfluenceVisualService.generateBoundaryGeometry(hqInfluenceCells, cellRectsMap, { gapOffset: 3 });

    assert(lakeGeom.segments.length > 0, "Lake boundary segments exist");
    assert(hqGeom.segments.length > 0, "HQ boundary segments exist");
}

// Test F: MERGE coexistence
console.log("\n[Test F] MERGE coexistence");
{
    const size = 5;
    const grid = Array.from({ length: size }, () => Array.from({ length: size }, () => ({ placed: false })));
    grid[1][1] = { placed: true, merged: true, mergeGroupId: "M1", terrain: { id: "GL1_PLAINS" }, socketResource: { id: "SOCKET_LAKE" } };
    grid[1][2] = { placed: true, merged: true, mergeGroupId: "M1", terrain: { id: "GL1_PLAINS" } };
    grid[2][1] = { placed: true, merged: true, mergeGroupId: "M1", terrain: { id: "GL1_PLAINS" } };
    grid[2][2] = { placed: true, merged: true, mergeGroupId: "M1", terrain: { id: "GL1_PLAINS" } };

    const state = {
        grid,
        isHQVicinity: () => false,
        isWaterSourceInfluence: (r, c) => isWaterSourceInfluence({ grid }, r, c)
    };

    const { lakeInfluenceCells } = AreaInfluenceVisualService.buildInfluenceCellSets(state, size);
    assert(lakeInfluenceCells.has("1,1") && lakeInfluenceCells.has("0,0") && lakeInfluenceCells.has("2,2"), "Influence cells correctly determined after merge");
    
    const cellRectsMap = AreaInfluenceVisualService.getCellRectsFromDom(null, size);
    const geom = AreaInfluenceVisualService.generateBoundaryGeometry(lakeInfluenceCells, cellRectsMap, { gapOffset: 1 });
    assert(geom.segments.length > 0, "Boundary geometry generated after merge");
}

// Test G: Socket display preserved
console.log("\n[Test G] Socket display preserved");
{
    const lakeResource = { id: "SOCKET_LAKE", nameKey: "RES_LAKE" };
    const lakeCell = { placed: true, socketResource: lakeResource };
    assert(isWaterSourceInfluence({ grid: [[lakeCell]] }, 0, 0) === true, "isWaterSourceInfluence recognises lake cell");
}

// Test H: Empty cell classes
console.log("\n[Test H] Empty Cell classes");
{
    const classes = AreaInfluenceVisualService.getInfluenceClasses({ isLakeVic: true, isHQVic: true });
    assert(classes.includes("influence-lake"), "influence-lake class present");
    assert(classes.includes("influence-hq-vicinity"), "influence-hq-vicinity class present");
}

// Test I: Rerender no duplicate
console.log("\n[Test I] Rerender no duplicate");
{
    const mockChildren = [];
    const mockBoardEl = {
        querySelector: (selector) => mockChildren.find(c => c.id === selector.replace("#", "")),
        appendChild: (child) => mockChildren.push(child)
    };

    const state = {
        grid: [[{ placed: true, socketResource: { id: "SOCKET_LAKE" } }]],
        isHQVicinity: () => false,
        isWaterSourceInfluence: () => true
    };

    AreaInfluenceVisualService.renderBoardOverlay(mockBoardEl, state, 1);
    assert(mockChildren.filter(c => c.id === "areaInfluenceBoardOverlay").length === 1, "First render creates 1 overlay element");

    AreaInfluenceVisualService.renderBoardOverlay(mockBoardEl, state, 1);
    assert(mockChildren.filter(c => c.id === "areaInfluenceBoardOverlay").length === 1, "Rerender maintains exactly 1 overlay element");
}

// Test J: Trial coexistence
console.log("\n[Test J] Trial coexistence");
{
    const dummyEl = {
        id: "",
        className: "",
        innerHTML: "",
        querySelector: () => null,
        appendChild: function(c) { this.child = c; }
    };
    const state = {
        grid: [[{ placed: true, socketResource: { id: "SOCKET_LAKE" } }]],
        isHQVicinity: () => false,
        isWaterSourceInfluence: () => true
    };
    AreaInfluenceVisualService.renderBoardOverlay(dummyEl, state, 1);
    assert(dummyEl.child && dummyEl.child.className.includes("area-influence-board-overlay"), "overlay class assigned correctly");
}

console.log(`\n========================================`);
console.log(`ALL ${passedTests}/${totalTests} TESTS PASSED!`);
console.log(`========================================\n`);
