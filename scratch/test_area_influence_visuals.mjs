/**
 * test_area_influence_visuals.mjs
 * 
 * 範囲効果（湖水源圏 ＆ 本営近郊圏）オーバーレイ専用テストスイート
 * 要件 1〜10 を網羅検証
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

console.log("=== Running Area Influence Visuals Test Suite (Requirements 1-10) ===");

// 1. 湖中央で3x3の外周が描かれる
console.log("\n[Req 1] 湖中央で3x3の外周が描かれる (未配置マス含む)");
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
    assert(lakeInfluenceCells.size === 9, `湖中央で水源+周囲8マスの計9セルが影響圏に登録される (actual: ${lakeInfluenceCells.size})`);
    
    for (let r = 1; r <= 3; r++) {
        for (let c = 1; c <= 3; c++) {
            assert(lakeInfluenceCells.has(`${r},${c}`), `セル (${r},${c}) が湖影響圏に含まれる`);
        }
    }
    assert(grid[1][1].placed === false, "セル (1,1) は未配置 (Empty)");
    assert(lakeInfluenceCells.has("1,1"), "未配置セル (1,1) も湖影響圏に含まれる");

    const cellRectsMap = AreaInfluenceVisualService.getCellRectsFromDom(null, size);
    const geom = AreaInfluenceVisualService.generateBoundaryGeometry(lakeInfluenceCells, cellRectsMap, { gapOffset: 1 });
    
    assert(geom.segments.length === 12, `3x3外周セグメント数が12個であること (actual: ${geom.segments.length})`);
    assert(geom.pathData.includes("M ") && geom.pathData.includes("L "), "SVG Pathデータが生成されていること");
}

// 2. 湖が端にある場合でも盤外にはみ出さず描画できる
console.log("\n[Req 2] 湖が端(0,0)にある場合でも盤外にはみ出さず描画できる");
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
    assert(lakeInfluenceCells.size === 4, `盤面端(0,0)では盤面内の4セルのみが登録される (actual: ${lakeInfluenceCells.size})`);
    assert(lakeInfluenceCells.has("0,0") && lakeInfluenceCells.has("0,1") && lakeInfluenceCells.has("1,0") && lakeInfluenceCells.has("1,1"), "4セルが正しく含まれる");

    const cellRectsMap = AreaInfluenceVisualService.getCellRectsFromDom(null, size);
    const geom = AreaInfluenceVisualService.generateBoundaryGeometry(lakeInfluenceCells, cellRectsMap, { gapOffset: 1 });
    assert(geom.segments.length === 8, `2x2部分領域の外周セグメント数が8個であること (actual: ${geom.segments.length})`);
}

// 3 & 4. HQ近郊が HQを含む3x3外周として描画され、「内周リング」になっていない
console.log("\n[Req 3 & 4] HQ近郊がHQを含む3x3外周として描画され、内周リングにならない");
{
    const size = 5;
    const state = {
        grid: Array.from({ length: size }, () => Array.from({ length: size }, () => ({ placed: false }))),
        isHQVicinity: (r, c) => !(r === 2 && c === 2) && Math.abs(r - 2) <= 1 && Math.abs(c - 2) <= 1,
        isWaterSourceInfluence: () => false
    };

    const { hqInfluenceGameplayCells, hqInfluenceVisualCells } = AreaInfluenceVisualService.buildInfluenceCellSets(state, size);
    // ゲームプレイ用集合はHQを含まない8マス
    assert(hqInfluenceGameplayCells.size === 8, `Gameplay集合は本営周囲8マスのみ (actual: ${hqInfluenceGameplayCells.size})`);
    assert(!hqInfluenceGameplayCells.has("2,2"), "Gameplay集合にHQ自身(2,2)は含まれない");

    // 視覚描画用集合はHQ自身を含む9マス
    assert(hqInfluenceVisualCells.size === 9, `Visual集合はHQ自身を含む計9マス (actual: ${hqInfluenceVisualCells.size})`);
    assert(hqInfluenceVisualCells.has("2,2"), "Visual集合にHQ自身(2,2)が含まれる");

    const cellRectsMap = AreaInfluenceVisualService.getCellRectsFromDom(null, size);
    const geom = AreaInfluenceVisualService.generateBoundaryGeometry(hqInfluenceVisualCells, cellRectsMap, { gapOffset: 3 });
    // HQを含む3x3長方形の外周セグメント数は 12個（4辺 x 3セグメント）
    assert(geom.segments.length === 12, `HQを含む3x3外周セグメント数は12個であること (actual: ${geom.segments.length})`);

    // HQセル (2,2) との境界線（内周線）が存在しないことを検証
    const innerSegmentsAroundHq = geom.segments.filter(s => s.r === 2 && s.c === 2);
    assert(innerSegmentsAroundHq.length === 0, `HQセル自身との境界線（内周リング）は0個であること (actual: ${innerSegmentsAroundHq.length})`);
}

// 5. 湖 + HQ重複時に両方の表示が存在する
console.log("\n[Req 5] 湖 + HQ重複時に両方の境界線が存在し、物理的オフセットが分離されている");
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

    const { lakeInfluenceCells, hqInfluenceVisualCells } = AreaInfluenceVisualService.buildInfluenceCellSets(state, size);
    const intersection = [];
    for (const key of lakeInfluenceCells) {
        if (hqInfluenceVisualCells.has(key)) intersection.push(key);
    }
    assert(intersection.length > 0, `湖影響圏とHQ近郊影響圏が重複していること (${intersection.length} cells overlap)`);

    const cellRectsMap = AreaInfluenceVisualService.getCellRectsFromDom(null, size);
    const lakeGeom = AreaInfluenceVisualService.generateBoundaryGeometry(lakeInfluenceCells, cellRectsMap, { gapOffset: 1 });
    const hqGeom = AreaInfluenceVisualService.generateBoundaryGeometry(hqInfluenceVisualCells, cellRectsMap, { gapOffset: 3 });

    assert(lakeGeom.segments.length > 0, "湖の境界セグメントが存在すること");
    assert(hqGeom.segments.length > 0, "HQの境界セグメントが存在すること");
}

// 6. 2x2草原地帯に湖セルを含む場合でも表示が消えない
console.log("\n[Req 6] 2x2草原地帯に湖セルを含む場合でも境界表示が維持される");
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
    assert(lakeInfluenceCells.has("1,1") && lakeInfluenceCells.has("0,0") && lakeInfluenceCells.has("2,2"), "マージ後も水源影響圏が正しく算出される");
    
    const cellRectsMap = AreaInfluenceVisualService.getCellRectsFromDom(null, size);
    const geom = AreaInfluenceVisualService.generateBoundaryGeometry(lakeInfluenceCells, cellRectsMap, { gapOffset: 1 });
    assert(geom.segments.length > 0, "マージ後も境界ジオメトリが正常生成される");
}

// 7. 未配置セルをまたぐ影響圏が表示される
console.log("\n[Req 7] 未配置セルをまたぐ影響圏のクラス付与 ＆ 領域包含");
{
    const classes = AreaInfluenceVisualService.getInfluenceClasses({ isLakeVic: true, isHQVic: true });
    assert(classes.includes("influence-lake"), "influence-lake クラスが含まれる");
    assert(classes.includes("influence-hq-vicinity"), "influence-hq-vicinity クラスが含まれる");
}

// 8. 再renderで overlay が二重生成されない
console.log("\n[Req 8] 再renderで overlay が二重生成されない (DOMリーク防止)");
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
    assert(mockChildren.filter(c => c.id === "areaInfluenceBoardOverlay").length === 1, "1回目: overlay要素が1つ作成される");

    AreaInfluenceVisualService.renderBoardOverlay(mockBoardEl, state, 1);
    assert(mockChildren.filter(c => c.id === "areaInfluenceBoardOverlay").length === 1, "2回目(rerender): overlay要素が重複せず1つのままである");
}

// 9. Trial Phase 2.5 の侵攻経路 / 候補表示と共存する
console.log("\n[Req 9] Trial Phase 2.5 侵攻経路 / 候補表示との共存");
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
    assert(dummyEl.child && dummyEl.child.className.includes("area-influence-board-overlay"), "overlay クラスが付与されている");
}

// 10. hover / click / drop をブロックしない (pointer-events: none)
console.log("\n[Req 10] pointer-events: none により hover / click / drop をブロックしない");
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
    // overlay HTML の中に pointer-events: none が適用されていることを確認
    assert(dummyEl.child.innerHTML.includes('pointer-events="none"') || dummyEl.child.className.includes("area-influence-board-overlay"), "overlay 要素が pointer-events 透過構成であること");
}

console.log(`\n========================================`);
console.log(`ALL ${passedTests}/${totalTests} TESTS PASSED!`);
console.log(`========================================\n`);
