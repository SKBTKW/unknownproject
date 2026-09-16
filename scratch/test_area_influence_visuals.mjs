/**
 * test_area_influence_visuals.mjs
 * 
 * 範囲効果（湖水源圏 ＆ 本営近郊圏）オーバーレイ専用テストスイート
 * 指示要件 11. A〜M および 代表セル実測デバッグを網羅検証
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

console.log("=== Running Area Influence Visuals Test Suite (Requirements A-M) ===");

// -------------------------------------------------------------
// A. 中央3x3 HQ Visualの外周が12 segments相当で、HQ内周がない
// -------------------------------------------------------------
console.log("\n[Req A] 中央3x3 HQ Visualの外周が12 segments相当で、HQ内周がない");
{
    const size = 5;
    const state = {
        grid: Array.from({ length: size }, () => Array.from({ length: size }, () => ({ placed: false }))),
        isHQVicinity: (r, c) => !(r === 2 && c === 2) && Math.abs(r - 2) <= 1 && Math.abs(c - 2) <= 1,
        isWaterSourceInfluence: () => false
    };

    const { hqInfluenceGameplayCells, hqInfluenceVisualCells } = AreaInfluenceVisualService.buildInfluenceCellSets(state, size);
    assert(hqInfluenceGameplayCells.size === 8, `Gameplay集合は本営周囲8マスのみ (actual: ${hqInfluenceGameplayCells.size})`);
    assert(hqInfluenceVisualCells.size === 9, `Visual集合は本営自身を含む9マス (actual: ${hqInfluenceVisualCells.size})`);

    const cellRectsMap = AreaInfluenceVisualService.getCellRectsFromDom(null, size);
    const geom = AreaInfluenceVisualService.generateBoundaryGeometry(hqInfluenceVisualCells, cellRectsMap, { size });
    assert(geom.segments.length === 12, `HQを含む3x3外周セグメント数は12個であること (actual: ${geom.segments.length})`);

    // HQセル (2,2) との境界線（内周リング）が存在しないことを検証
    const innerSegmentsAroundHq = geom.segments.filter(s => s.r === 2 && s.c === 2);
    assert(innerSegmentsAroundHq.length === 0, `HQセル自身との境界線（内周リング）は0個であること (actual: ${innerSegmentsAroundHq.length})`);
}

// -------------------------------------------------------------
// B. 内部shared edgeの座標が、両側rectのgap中心と一致する (縦境界: boundaryX)
// -------------------------------------------------------------
console.log("\n[Req B] 内部shared edge (縦境界) の座標が両側rectのgap中心と一致する");
{
    const size = 2;
    const cellRectsMap = new Map();
    // leftRect: (0,0) [right = 100]
    cellRectsMap.set("0,0", { left: 20, top: 20, right: 100, bottom: 100, width: 80, height: 80 });
    // rightRect: (0,1) [left = 104]
    cellRectsMap.set("0,1", { left: 104, top: 20, right: 184, bottom: 100, width: 80, height: 80 });
    cellRectsMap.set("1,0", { left: 20, top: 104, right: 100, bottom: 184, width: 80, height: 80 });
    cellRectsMap.set("1,1", { left: 104, top: 104, right: 184, bottom: 184, width: 80, height: 80 });

    const { gridLinesX } = AreaInfluenceVisualService.resolveBoundaryCoordinates(cellRectsMap, size);
    // (100 + 104) / 2 = 102
    assert(gridLinesX[0] === 102, `列0と列1の間の縦境界X座標が実測gap中心 102 であること (actual: ${gridLinesX[0]})`);
}

// -------------------------------------------------------------
// C. 横方向も同様 (横境界: boundaryY)
// -------------------------------------------------------------
console.log("\n[Req C] 内部shared edge (横境界) の座標が両側rectのgap中心と一致する");
{
    const size = 2;
    const cellRectsMap = new Map();
    // topRect: (0,0) [bottom = 100]
    cellRectsMap.set("0,0", { left: 20, top: 20, right: 100, bottom: 100, width: 80, height: 80 });
    cellRectsMap.set("0,1", { left: 104, top: 20, right: 184, bottom: 100, width: 80, height: 80 });
    // bottomRect: (1,0) [top = 104]
    cellRectsMap.set("1,0", { left: 20, top: 104, right: 100, bottom: 184, width: 80, height: 80 });
    cellRectsMap.set("1,1", { left: 104, top: 104, right: 184, bottom: 184, width: 80, height: 80 });

    const { gridLinesY } = AreaInfluenceVisualService.resolveBoundaryCoordinates(cellRectsMap, size);
    // (100 + 104) / 2 = 102
    assert(gridLinesY[0] === 102, `行0と行1の間の横境界Y座標が実測gap中心 102 であること (actual: ${gridLinesY[0]})`);
}

// -------------------------------------------------------------
// D. gapが4px以外でも成立 (5px gap: right=100 / left=105 -> center=102.5)
// -------------------------------------------------------------
console.log("\n[Req D] gapが4px以外 (5px) でも実測gap中心 (102.5) になる");
{
    const size = 2;
    const cellRectsMap = new Map();
    cellRectsMap.set("0,0", { left: 20, top: 20, right: 100, bottom: 100, width: 80, height: 80 });
    cellRectsMap.set("0,1", { left: 105, top: 20, right: 185, bottom: 100, width: 80, height: 80 });
    cellRectsMap.set("1,0", { left: 20, top: 105, right: 100, bottom: 185, width: 80, height: 80 });
    cellRectsMap.set("1,1", { left: 105, top: 105, right: 185, bottom: 185, width: 80, height: 80 });

    const { gridLinesX, gridLinesY } = AreaInfluenceVisualService.resolveBoundaryCoordinates(cellRectsMap, size);
    assert(gridLinesX[0] === 102.5, `5px gapで縦境界が 102.5 であること (actual: ${gridLinesX[0]})`);
    assert(gridLinesY[0] === 102.5, `5px gapで横境界が 102.5 であること (actual: ${gridLinesY[0]})`);
}

// -------------------------------------------------------------
// E. fractional rect でも成立 (小数のDOM rect)
// -------------------------------------------------------------
console.log("\n[Req E] fractional rect (小数座標) でも成立");
{
    const size = 2;
    const cellRectsMap = new Map();
    cellRectsMap.set("0,0", { left: 20.25, top: 20.25, right: 100.75, bottom: 100.75, width: 80.5, height: 80.5 });
    cellRectsMap.set("0,1", { left: 104.25, top: 20.25, right: 184.75, bottom: 100.75, width: 80.5, height: 80.5 });
    cellRectsMap.set("1,0", { left: 20.25, top: 104.25, right: 100.75, bottom: 184.75, width: 80.5, height: 80.5 });
    cellRectsMap.set("1,1", { left: 104.25, top: 104.25, right: 184.75, bottom: 184.75, width: 80.5, height: 80.5 });

    const { gridLinesX } = AreaInfluenceVisualService.resolveBoundaryCoordinates(cellRectsMap, size);
    // (100.75 + 104.25) / 2 = 102.5
    assert(gridLinesX[0] === 102.5, `小数座標で正確に 102.5 が算出される (actual: ${gridLinesX[0]})`);
}

// -------------------------------------------------------------
// F. 同一edgeを左右セルから二重生成しない
// -------------------------------------------------------------
console.log("\n[Req F] 同一edgeを左右セルから二重生成しない (Canonical Boundary Edge)");
{
    const size = 3;
    // (1,1) のみ影響圏
    const singleSet = new Set(["1,1"]);
    const edges = AreaInfluenceVisualService.extractBoundaryEdges(singleSet, size);
    // 1セルの周囲4辺なので 4本のエッジ
    assert(edges.size === 4, `単一セルの境界エッジは正確に4本であること (actual: ${edges.size})`);

    // (1,1) と (1,2) が両方影響圏
    const twoSet = new Set(["1,1", "1,2"]);
    const twoEdges = AreaInfluenceVisualService.extractBoundaryEdges(twoSet, size);
    // 2セルの結合領域の外周は 6本のエッジ
    assert(twoEdges.size === 6, `隣接2セルの外周エッジは重複なく正確に6本であること (actual: ${twoEdges.size})`);
    assert(!twoEdges.has("V:1:1"), "隣接セル間の境界 V:1:1 は内部エッジとして除外されること");
}

// -------------------------------------------------------------
// G. lake単独edgeはcenter (offset = 0)
// -------------------------------------------------------------
console.log("\n[Req G] lake単独edgeはcenter (laneOffset = 0)");
{
    const size = 3;
    const lakeSet = new Set(["1,1"]);
    const cellRectsMap = AreaInfluenceVisualService.getCellRectsFromDom(null, size);
    const { gridLinesX } = AreaInfluenceVisualService.resolveBoundaryCoordinates(cellRectsMap, size);

    const geom = AreaInfluenceVisualService.generateBoundaryGeometry(lakeSet, cellRectsMap, {
        otherCellSet: null, // 単独
        isLake: true,
        size
    });

    const rightEdge = geom.segments.find(s => s.id === "V:1:1");
    assert(rightEdge !== undefined, "右辺エッジ V:1:1 が存在すること");
    assert(rightEdge.x1 === gridLinesX[1], `単独lakeエッジのX座標がgridLinesX[1]と完全一致 (offset=0) (actual: ${rightEdge.x1}, expected: ${gridLinesX[1]})`);
}

// -------------------------------------------------------------
// H. HQ単独edgeはcenter (offset = 0)
// -------------------------------------------------------------
console.log("\n[Req H] HQ単独edgeはcenter (laneOffset = 0)");
{
    const size = 3;
    const hqSet = new Set(["1,1"]);
    const cellRectsMap = AreaInfluenceVisualService.getCellRectsFromDom(null, size);
    const { gridLinesX } = AreaInfluenceVisualService.resolveBoundaryCoordinates(cellRectsMap, size);

    const geom = AreaInfluenceVisualService.generateBoundaryGeometry(hqSet, cellRectsMap, {
        otherCellSet: null, // 単独
        isLake: false,
        size
    });

    const rightEdge = geom.segments.find(s => s.id === "V:1:1");
    assert(rightEdge !== undefined, "右辺エッジ V:1:1 が存在すること");
    assert(rightEdge.x1 === gridLinesX[1], `単独HQエッジのX座標がgridLinesX[1]と完全一致 (offset=0) (actual: ${rightEdge.x1}, expected: ${gridLinesX[1]})`);
}

// -------------------------------------------------------------
// I. lake + HQ同一edge時のみlane分離される (lake: -1px, HQ: +1px)
// -------------------------------------------------------------
console.log("\n[Req I] lake + HQ同一edge時のみlane分離される");
{
    const size = 3;
    const commonSet = new Set(["1,1"]);
    const cellRectsMap = AreaInfluenceVisualService.getCellRectsFromDom(null, size);
    const { gridLinesX } = AreaInfluenceVisualService.resolveBoundaryCoordinates(cellRectsMap, size);

    const lakeGeom = AreaInfluenceVisualService.generateBoundaryGeometry(commonSet, cellRectsMap, {
        otherCellSet: commonSet, // 同一エッジ重複
        isLake: true,
        size
    });

    const hqGeom = AreaInfluenceVisualService.generateBoundaryGeometry(commonSet, cellRectsMap, {
        otherCellSet: commonSet, // 同一エッジ重複
        isLake: false,
        size
    });

    const lakeRight = lakeGeom.segments.find(s => s.id === "V:1:1");
    const hqRight = hqGeom.segments.find(s => s.id === "V:1:1");

    assert(lakeRight.x1 === gridLinesX[1] - 1, `重複時lakeエッジは center - 1px (actual: ${lakeRight.x1}, center: ${gridLinesX[1]})`);
    assert(hqRight.x1 === gridLinesX[1] + 1, `重複時HQエッジは center + 1px (actual: ${hqRight.x1}, center: ${gridLinesX[1]})`);
}

// -------------------------------------------------------------
// J. 盤面端外周がboardから不自然にはみ出さない
// -------------------------------------------------------------
console.log("\n[Req J] 盤面端外周がboardから不自然にはみ出さない");
{
    const size = 5;
    const cornerSet = new Set(["0,0"]);
    const cellRectsMap = AreaInfluenceVisualService.getCellRectsFromDom(null, size);
    const { gridLinesX, gridLinesY, measuredGapX, measuredGapY } = AreaInfluenceVisualService.resolveBoundaryCoordinates(cellRectsMap, size);

    const rect0 = cellRectsMap.get("0,0");
    assert(gridLinesX[-1] === rect0.left - measuredGapX / 2, `左端GridLineが rect.left - gap/2 であること`);
    assert(gridLinesY[-1] === rect0.top - measuredGapY / 2, `上端GridLineが rect.top - gap/2 であること`);
}

// -------------------------------------------------------------
// K. MERGEを模した不均一rect入力でもshared edgeの両側rectから中心を取る
// -------------------------------------------------------------
console.log("\n[Req K] MERGEを模した不均一rect入力でも非マージ行から正確にgap中心を取る");
{
    const size = 3;
    const cellRectsMap = new Map();
    // 行0: (0,0) と (0,1) がマージされ右に4px拡張 (gap = 0)
    cellRectsMap.set("0,0", { left: 20, top: 20, right: 104, bottom: 100, width: 84, height: 80 });
    cellRectsMap.set("0,1", { left: 104, top: 20, right: 184, bottom: 100, width: 80, height: 80 });
    cellRectsMap.set("0,2", { left: 188, top: 20, right: 268, bottom: 100, width: 80, height: 80 });

    // 行1: 通常 (gap = 4px, right=100, left=104)
    cellRectsMap.set("1,0", { left: 20, top: 104, right: 100, bottom: 184, width: 80, height: 80 });
    cellRectsMap.set("1,1", { left: 104, top: 104, right: 184, bottom: 184, width: 80, height: 80 });
    cellRectsMap.set("1,2", { left: 188, top: 104, right: 268, bottom: 184, width: 80, height: 80 });

    cellRectsMap.set("2,0", { left: 20, top: 188, right: 100, bottom: 268, width: 80, height: 80 });
    cellRectsMap.set("2,1", { left: 104, top: 188, right: 184, bottom: 268, width: 80, height: 80 });
    cellRectsMap.set("2,2", { left: 188, top: 188, right: 268, bottom: 268, width: 80, height: 80 });

    const { gridLinesX } = AreaInfluenceVisualService.resolveBoundaryCoordinates(cellRectsMap, size);
    // 行0はマージ拡張でgap=0だが、行1の通常gapから正確に (100 + 104) / 2 = 102 が抽出される
    assert(gridLinesX[0] === 102, `マージ行があっても非マージ行から正確に 102 を解決できる (actual: ${gridLinesX[0]})`);
}

// -------------------------------------------------------------
// L. rerenderでoverlay重複なし
// -------------------------------------------------------------
console.log("\n[Req L] rerenderでoverlay重複なし");
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

// -------------------------------------------------------------
// M. Trial previewと共存
// -------------------------------------------------------------
console.log("\n[Req M] Trial previewと共存");
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

// -------------------------------------------------------------
// 12. 実測デバッグシミュレーション (C2-D2, C2-C3, C3-D3, C4-D4)
// -------------------------------------------------------------
console.log("\n[Debug Verification] 代表セル境界の実測デバッグ検証 (5x5)");
{
    const size = 5;
    const cellRectsMap = AreaInfluenceVisualService.getCellRectsFromDom(null, size);
    const { gridLinesX, gridLinesY } = AreaInfluenceVisualService.resolveBoundaryCoordinates(cellRectsMap, size);

    // C2 (行1, 列2: C列・2行目) と D2 (行1, 列3: D列・2行目) の間の縦境界
    const c2Rect = cellRectsMap.get("1,2");
    const d2Rect = cellRectsMap.get("1,3");
    const gapC2D2 = d2Rect.left - c2Rect.right;
    const centerC2D2 = gridLinesX[2];
    assert(centerC2D2 === (c2Rect.right + d2Rect.left) / 2, `C2-D2間の縦境界X座標が実測中心 (${centerC2D2}) と一致`);

    // C2 (行1, 列2) と C3 (行2, 列2: HQ) の間の横境界
    const c3Rect = cellRectsMap.get("2,2");
    const gapC2C3 = c3Rect.top - c2Rect.bottom;
    const centerC2C3 = gridLinesY[1];
    assert(centerC2C3 === (c2Rect.bottom + c3Rect.top) / 2, `C2-C3間の横境界Y座標が実測中心 (${centerC2C3}) と一致`);

    // C3 (行2, 列2: HQ) と D3 (行2, 列3) の間の縦境界
    const d3Rect = cellRectsMap.get("2,3");
    const centerC3D3 = gridLinesX[2];
    assert(centerC3D3 === (c3Rect.right + d3Rect.left) / 2, `C3-D3間の縦境界X座標が実測中心 (${centerC3D3}) と一致`);

    // C4 (行3, 列2) と D4 (行3, 列3) の間の縦境界
    const c4Rect = cellRectsMap.get("3,2");
    const d4Rect = cellRectsMap.get("3,3");
    const centerC4D4 = gridLinesX[2];
    assert(centerC4D4 === (c4Rect.right + d4Rect.left) / 2, `C4-D4間の縦境界X座標が実測中心 (${centerC4D4}) と一致`);

    console.log(`  [Debug Output] C2-D2 gap: ${gapC2D2}px, center: ${centerC2D2}px`);
    console.log(`  [Debug Output] C2-C3 gap: ${gapC2C3}px, center: ${centerC2C3}px`);
    console.log(`  [Debug Output] C3-D3 gap: ${d3Rect.left - c3Rect.right}px, center: ${centerC3D3}px`);
    console.log(`  [Debug Output] C4-D4 gap: ${d4Rect.left - c4Rect.right}px, center: ${centerC4D4}px`);
}

console.log(`\n========================================`);
console.log(`ALL ${passedTests}/${totalTests} TESTS PASSED!`);
console.log(`========================================\n`);
