/**
 * 🗺️ AreaInfluenceVisualService (範囲効果オーバーレイ専用 View サービス)
 * 
 * 責務:
 * 1. ゲームロジック側（Single Source of Truth）で判定された範囲効果フラグ
 *    (isLakeVic, isHQVic) を受け取り、表示用 CSS クラスおよびオーバーレイ SVG HTML を生成する。
 * 2. ゲームルール（周囲8マス判定等）の再計算・複製は 100% 禁止。
 * 3. 湖（セル内側ティール波紋）と本営近郊（外周四隅アンバーL字枠）の視覚分離。
 */

import { isWaterSourceInfluence } from '../core/lake_rules.js';

export class AreaInfluenceVisualService {
    /**
     * 🏷️ セルに付与する範囲効果クラス名の配列を取得
     * @param {Object} params
     * @param {boolean} params.isLakeVic - 水源（湖・オアシス）影響圏フラグ
     * @param {boolean} params.isHQVic - 本営近郊影響圏フラグ
     * @returns {string[]} クラス名配列
     */
    static getInfluenceClasses({ isLakeVic = false, isHQVic = false } = {}) {
        const classes = [];
        if (isLakeVic) classes.push("influence-lake");
        if (isHQVic) classes.push("influence-hq-vicinity");
        return classes;
    }

    /**
     * 🗺️ Presentation用 Influence Cell Set の構築 (Domain/State SSOT利用)
     * @param {Object} state - GameState
     * @param {number} size - 盤面サイズ
     * @returns {{ lakeInfluenceCells: Set<string>, hqInfluenceGameplayCells: Set<string>, hqInfluenceVisualCells: Set<string>, hqInfluenceCells: Set<string> }}
     */
    static buildInfluenceCellSets(state, size = 5) {
        const lakeInfluenceCells = new Set();
        const hqInfluenceGameplayCells = new Set();
        const hqInfluenceVisualCells = new Set();
        if (!state) {
            return {
                lakeInfluenceCells,
                hqInfluenceGameplayCells,
                hqInfluenceVisualCells,
                hqInfluenceCells: hqInfluenceVisualCells
            };
        }

        const center = Math.floor(size / 2);
        for (let r = 0; r < size; r++) {
            for (let c = 0; c < size; c++) {
                const key = `${r},${c}`;
                // 🌊 湖水源影響圏 (lake_rules.js / state SSOT)
                const isLake = (typeof state.isWaterSourceInfluence === "function")
                    ? state.isWaterSourceInfluence(r, c)
                    : isWaterSourceInfluence(state, r, c);
                if (isLake) {
                    lakeInfluenceCells.add(key);
                }

                // 🏰 本営近郊 Gameplay (周囲8マスのみ・HQ自身は効果対象外)
                const isHqVic = (typeof state.isHQVicinity === "function")
                    ? state.isHQVicinity(r, c)
                    : false;
                if (isHqVic) {
                    hqInfluenceGameplayCells.add(key);
                    hqInfluenceVisualCells.add(key);
                } else if (r === center && c === center) {
                    // 🏰 本営自身: 表示専用 Visual Set にのみ追加し、3x3のひとまとまり外周として描画
                    hqInfluenceVisualCells.add(key);
                }
            }
        }

        return {
            lakeInfluenceCells,
            hqInfluenceGameplayCells,
            hqInfluenceVisualCells,
            // 下位互換性
            hqInfluenceCells: hqInfluenceVisualCells
        };
    }

    /**
     * 📐 各セルDOMの実測バウンディングボックスを取得（JSDOM fallback対応）
     * @param {HTMLElement} boardEl - グリッド盤面コンテナ (#gridBoard)
     * @param {number} size - 盤面サイズ
     * @returns {Map<string, { left: number, top: number, right: number, bottom: number, width: number, height: number }>}
     */
    static getCellRectsFromDom(boardEl, size = 5) {
        const rectsMap = new Map();

        const boardRect = (boardEl && typeof boardEl.getBoundingClientRect === "function")
            ? boardEl.getBoundingClientRect()
            : { left: 0, top: 0, width: 0, height: 0 };

        const cellElements = (boardEl && boardEl.querySelectorAll) ? boardEl.querySelectorAll(".cell[data-r][data-c]") : [];
        let hasValidDomRects = false;

        if (cellElements.length > 0) {
            cellElements.forEach(cell => {
                const r = cell.getAttribute("data-r");
                const c = cell.getAttribute("data-c");
                if (r !== null && c !== null && typeof cell.getBoundingClientRect === "function") {
                    const cRect = cell.getBoundingClientRect();
                    if (cRect.width > 0 && cRect.height > 0) {
                        hasValidDomRects = true;
                        const left = cRect.left - boardRect.left;
                        const top = cRect.top - boardRect.top;
                        rectsMap.set(`${r},${c}`, {
                            left,
                            top,
                            right: left + cRect.width,
                            bottom: top + cRect.height,
                            width: cRect.width,
                            height: cRect.height
                        });
                    }
                }
            });
        }

        // 🧪 JSDOMやヘッドレス環境でDOMレイアウト座標が取れない場合の synthetic rects fallback
        if (!hasValidDomRects) {
            const cellSize = (size >= 9) ? 80 : 104;
            const headerSize = (size >= 9) ? 38 : 44;
            const gap = 4;
            const padding = 4;

            for (let r = 0; r < size; r++) {
                for (let c = 0; c < size; c++) {
                    const left = padding + headerSize + gap + c * (cellSize + gap);
                    const top = padding + headerSize + gap + r * (cellSize + gap);
                    rectsMap.set(`${r},${c}`, {
                        left,
                        top,
                        right: left + cellSize,
                        bottom: top + cellSize,
                        width: cellSize,
                        height: cellSize
                    });
                }
            }
        }

        return rectsMap;
    }

    /**
     * 🧩 影響圏集合から重複のない正規境界エッジ（Canonical Boundary Edges）を一意抽出する純粋ヘルパー
     * @param {Set<string>} cellSet - 影響圏セルのキー集合 Set<"r,c">
     * @param {number} size - 盤面サイズ
     * @returns {Map<string, { id: string, orientation: string, r: number, c: number, side: string, insideCell: string, outsideCell: string|null }>}
     */
    static extractBoundaryEdges(cellSet, size = 5) {
        const edgesMap = new Map();
        if (!cellSet || cellSet.size === 0) return edgesMap;

        // 1. 水平エッジ (Horizontal Edges): 行 r と r+1 の境界 (r は -1 から size-1)
        // r = -1: 盤面上端 (行0の上辺)
        // r = 0..size-2: 内部の行間
        // r = size-1: 盤面下端 (行 size-1 の下辺)
        for (let r = -1; r < size; r++) {
            for (let c = 0; c < size; c++) {
                const upperIn = (r >= 0) ? cellSet.has(`${r},${c}`) : false;
                const lowerIn = (r + 1 < size) ? cellSet.has(`${r + 1},${c}`) : false;

                if (upperIn !== lowerIn) {
                    const id = `H:${r}:${c}`;
                    edgesMap.set(id, {
                        id,
                        orientation: "horizontal",
                        r,
                        c,
                        side: upperIn ? "bottom" : "top",
                        insideCell: upperIn ? `${r},${c}` : `${r + 1},${c}`,
                        outsideCell: upperIn ? (r + 1 < size ? `${r + 1},${c}` : null) : (r >= 0 ? `${r},${c}` : null)
                    });
                }
            }
        }

        // 2. 垂直エッジ (Vertical Edges): 列 c と c+1 の境界 (c は -1 から size-1)
        // c = -1: 盤面左端 (列0の左辺)
        // c = 0..size-2: 内部の列間
        // c = size-1: 盤面右端 (列 size-1 の右辺)
        for (let r = 0; r < size; r++) {
            for (let c = -1; c < size; c++) {
                const leftIn = (c >= 0) ? cellSet.has(`${r},${c}`) : false;
                const rightIn = (c + 1 < size) ? cellSet.has(`${r},${c + 1}`) : false;

                if (leftIn !== rightIn) {
                    const id = `V:${r}:${c}`;
                    edgesMap.set(id, {
                        id,
                        orientation: "vertical",
                        r,
                        c,
                        side: leftIn ? "right" : "left",
                        insideCell: leftIn ? `${r},${c}` : `${r},${c + 1}`,
                        outsideCell: leftIn ? (c + 1 < size ? `${r},${c + 1}` : null) : (c >= 0 ? `${r},${c}` : null)
                    });
                }
            }
        }

        return edgesMap;
    }

    /**
     * 📐 実測セルRectからグリッド境界線（Grid Lines）の gap 中心座標を算出する純粋ヘルパー
     * @param {Map<string, Object>} cellRectsMap - セル矩形Map
     * @param {number} size - 盤面サイズ
     * @returns {{ gridLinesX: Object, gridLinesY: Object, measuredGapX: number, measuredGapY: number }}
     */
    static resolveBoundaryCoordinates(cellRectsMap, size = 5) {
        const gridLinesX = {};
        const gridLinesY = {};

        if (!cellRectsMap || cellRectsMap.size === 0) {
            return { gridLinesX, gridLinesY, measuredGapX: 4, measuredGapY: 4 };
        }

        // --- 縦境界 (X 座標) の実測 ---
        let totalGapX = 0;
        let gapCountX = 0;

        for (let c = 0; c < size - 1; c++) {
            let selectedCenter = null;
            for (let r = 0; r < size; r++) {
                const leftRect = cellRectsMap.get(`${r},${c}`);
                const rightRect = cellRectsMap.get(`${r},${c + 1}`);
                if (!leftRect || !rightRect) continue;
                const gap = rightRect.left - leftRect.right;
                // マージ負marginによる拡張を排除（gap > 0 の非結合行を最優先）
                if (gap > 0) {
                    selectedCenter = (leftRect.right + rightRect.left) / 2;
                    totalGapX += gap;
                    gapCountX++;
                    break;
                } else if (selectedCenter === null) {
                    selectedCenter = (leftRect.right + rightRect.left) / 2;
                }
            }
            gridLinesX[c] = selectedCenter !== null ? selectedCenter : 0;
        }

        const measuredGapX = gapCountX > 0 ? (totalGapX / gapCountX) : 4;

        // 盤面左端 (c = -1)
        const leftRef = cellRectsMap.get(`0,0`) || cellRectsMap.get(`1,0`);
        gridLinesX[-1] = leftRef ? (leftRef.left - measuredGapX / 2) : 0;

        // 盤面右端 (c = size - 1)
        const rightRef = cellRectsMap.get(`0,${size - 1}`) || cellRectsMap.get(`1,${size - 1}`);
        gridLinesX[size - 1] = rightRef ? (rightRef.right + measuredGapX / 2) : 0;

        // --- 横境界 (Y 座標) の実測 ---
        let totalGapY = 0;
        let gapCountY = 0;

        for (let r = 0; r < size - 1; r++) {
            let selectedCenter = null;
            for (let c = 0; c < size; c++) {
                const topRect = cellRectsMap.get(`${r},${c}`);
                const bottomRect = cellRectsMap.get(`${r + 1},${c}`);
                if (!topRect || !bottomRect) continue;
                const gap = bottomRect.top - topRect.bottom;
                // マージ負marginによる拡張を排除（gap > 0 の非結合列を最優先）
                if (gap > 0) {
                    selectedCenter = (topRect.bottom + bottomRect.top) / 2;
                    totalGapY += gap;
                    gapCountY++;
                    break;
                } else if (selectedCenter === null) {
                    selectedCenter = (topRect.bottom + bottomRect.top) / 2;
                }
            }
            gridLinesY[r] = selectedCenter !== null ? selectedCenter : 0;
        }

        const measuredGapY = gapCountY > 0 ? (totalGapY / gapCountY) : 4;

        // 盤面上端 (r = -1)
        const topRef = cellRectsMap.get(`0,0`) || cellRectsMap.get(`0,1`);
        gridLinesY[-1] = topRef ? (topRef.top - measuredGapY / 2) : 0;

        // 盤面下端 (r = size - 1)
        const bottomRef = cellRectsMap.get(`${size - 1},0`) || cellRectsMap.get(`${size - 1},1`);
        gridLinesY[size - 1] = bottomRef ? (bottomRef.bottom + measuredGapY / 2) : 0;

        return { gridLinesX, gridLinesY, measuredGapX, measuredGapY };
    }

    /**
     * 🏁 エッジと実測GridLineから線分セグメントを構築する純粋ヘルパー（レーン分離 ＆ 角Snap対応）
     * @param {Object} params
     * @param {Map<string, Object>} params.edgesMap - 描画対象エッジ
     * @param {Map<string, Object>} [params.otherEdgesMap] - 他方の影響圏エッジ（重複時レーン分離判定用）
     * @param {Object} params.gridLinesX - 実測縦GridLine
     * @param {Object} params.gridLinesY - 実測横GridLine
     * @param {boolean} [params.isLake=false] - 湖かどうか（重複時のオフセット方向決定用）
     * @returns {Array<{ id: string, type: string, r: number, c: number, x1: number, y1: number, x2: number, y2: number }>}
     */
    static buildBoundarySegments({ edgesMap, otherEdgesMap = null, gridLinesX, gridLinesY, isLake = false }) {
        const segments = [];
        if (!edgesMap || edgesMap.size === 0) return segments;

        for (const edge of edgesMap.values()) {
            // 同一エッジが他方の影響圏にも存在する場合のみ ±1px のレーン分離を行う
            const isShared = otherEdgesMap ? otherEdgesMap.has(edge.id) : false;
            const laneOffset = isShared ? (isLake ? -1 : 1) : 0;

            if (edge.orientation === "horizontal") {
                const y = (gridLinesY[edge.r] !== undefined ? gridLinesY[edge.r] : 0) + laneOffset;
                const x1 = gridLinesX[edge.c - 1] !== undefined ? gridLinesX[edge.c - 1] : 0;
                const x2 = gridLinesX[edge.c] !== undefined ? gridLinesX[edge.c] : 0;

                const [rStr, cStr] = edge.insideCell.split(",");
                segments.push({
                    id: edge.id,
                    type: edge.side,
                    r: parseInt(rStr, 10),
                    c: parseInt(cStr, 10),
                    x1,
                    y1: y,
                    x2,
                    y2: y
                });
            } else if (edge.orientation === "vertical") {
                const x = (gridLinesX[edge.c] !== undefined ? gridLinesX[edge.c] : 0) + laneOffset;
                const y1 = gridLinesY[edge.r - 1] !== undefined ? gridLinesY[edge.r - 1] : 0;
                const y2 = gridLinesY[edge.r] !== undefined ? gridLinesY[edge.r] : 0;

                const [rStr, cStr] = edge.insideCell.split(",");
                segments.push({
                    id: edge.id,
                    type: edge.side,
                    r: parseInt(rStr, 10),
                    c: parseInt(cStr, 10),
                    x1: x,
                    y1,
                    x2: x,
                    y2
                });
            }
        }

        return segments;
    }

    /**
     * 🧩 外周境界セグメントおよびSVG Pathを計算する純粋 Presentation ヘルパー (新アーキテクチャ統合)
     * @param {Set<string>} cellSet - 影響圏セルのキー集合 Set<"r,c">
     * @param {Map<string, Object>} cellRectsMap - セル矩形Map
     * @param {Object} [options]
     * @param {Set<string>} [options.otherCellSet] - 他方の影響圏セル（重複レーン分離用）
     * @param {boolean} [options.isLake=false]
     * @param {number} [options.size=5]
     * @returns {{ segments: Array<Object>, pathData: string }}
     */
    static generateBoundaryGeometry(cellSet, cellRectsMap, { otherCellSet = null, isLake = false, size = 5 } = {}) {
        if (!cellSet || cellSet.size === 0 || !cellRectsMap || cellRectsMap.size === 0) {
            return { segments: [], pathData: "" };
        }

        const edgesMap = this.extractBoundaryEdges(cellSet, size);
        const otherEdgesMap = otherCellSet ? this.extractBoundaryEdges(otherCellSet, size) : null;
        const { gridLinesX, gridLinesY } = this.resolveBoundaryCoordinates(cellRectsMap, size);

        const segments = this.buildBoundarySegments({
            edgesMap,
            otherEdgesMap,
            gridLinesX,
            gridLinesY,
            isLake
        });

        const pathCommands = segments.map(s => `M ${s.x1} ${s.y1} L ${s.x2} ${s.y2}`);

        return {
            segments,
            pathData: pathCommands.join(" ")
        };
    }

    /**
     * 🎨 グリッド盤面全体に重ねる Board-Level Influence Overlay を生成・更新
     * @param {HTMLElement} boardEl - グリッド盤面コンテナ (#gridBoard)
     * @param {Object} state - GameState
     * @param {number} size - 盤面サイズ
     */
    static renderBoardOverlay(boardEl, state, size = 5) {
        if (!boardEl || !state) return;

        // 既存オーバーレイコンテナの取得または生成（毎renderで安全に再構築）
        let overlayEl = boardEl.querySelector ? boardEl.querySelector("#areaInfluenceBoardOverlay") : null;
        if (!overlayEl) {
            if (typeof document !== "undefined" && typeof document.createElement === "function") {
                overlayEl = document.createElement("div");
            } else {
                overlayEl = { id: "areaInfluenceBoardOverlay", className: "", innerHTML: "" };
            }
            overlayEl.id = "areaInfluenceBoardOverlay";
            overlayEl.className = "area-influence-board-overlay";
            if (typeof boardEl.appendChild === "function") {
                boardEl.appendChild(overlayEl);
            }
        }

        const { lakeInfluenceCells, hqInfluenceVisualCells } = this.buildInfluenceCellSets(state, size);
        if (lakeInfluenceCells.size === 0 && hqInfluenceVisualCells.size === 0) {
            overlayEl.innerHTML = "";
            return;
        }

        const cellRectsMap = this.getCellRectsFromDom(boardEl, size);

        // 🌊 湖水源 ＆ 🏰 本営近郊: 正規エッジ抽出 ＆ 実測gap中心 ＆ 重複時のみ2レーン分離
        const lakeEdges = this.extractBoundaryEdges(lakeInfluenceCells, size);
        const hqEdges = this.extractBoundaryEdges(hqInfluenceVisualCells, size);
        const { gridLinesX, gridLinesY } = this.resolveBoundaryCoordinates(cellRectsMap, size);

        const lakeSegments = this.buildBoundarySegments({
            edgesMap: lakeEdges,
            otherEdgesMap: hqEdges,
            gridLinesX,
            gridLinesY,
            isLake: true
        });

        const hqSegments = this.buildBoundarySegments({
            edgesMap: hqEdges,
            otherEdgesMap: lakeEdges,
            gridLinesX,
            gridLinesY,
            isLake: false
        });

        const lakePathData = lakeSegments.map(s => `M ${s.x1} ${s.y1} L ${s.x2} ${s.y2}`).join(" ");
        const hqPathData = hqSegments.map(s => `M ${s.x1} ${s.y1} L ${s.x2} ${s.y2}`).join(" ");

        let svgContent = "";

        if (lakePathData) {
            svgContent += `
                <g class="lake-influence-boundary-group">
                    <path d="${lakePathData}" class="lake-boundary-path-glow" />
                    <path d="${lakePathData}" class="lake-boundary-path-core" />
                </g>
            `;
        }

        if (hqPathData) {
            svgContent += `
                <g class="hq-influence-boundary-group">
                    <path d="${hqPathData}" class="hq-boundary-path-glow" />
                    <path d="${hqPathData}" class="hq-boundary-path-core" />
                </g>
            `;
        }

        overlayEl.innerHTML = `
            <svg class="area-influence-board-svg" width="100%" height="100%">
                ${svgContent}
            </svg>
        `;
    }

    /**
     * 🎨 セル単体内部用オーバーレイ（下位互換性用）
     */
    static createInfluenceOverlayHtml({ isLakeVic = false, isHQVic = false } = {}) {
        return "";
    }
}

if (typeof window !== "undefined") {
    window.AreaInfluenceVisualService = AreaInfluenceVisualService;
}
if (typeof globalThis !== "undefined") {
    globalThis.AreaInfluenceVisualService = AreaInfluenceVisualService;
}
