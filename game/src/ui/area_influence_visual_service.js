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
     * 🧩 外周境界セグメントおよびSVG Pathを計算する純粋 Presentation ヘルパー
     * @param {Set<string>} cellSet - 影響圏セルのキー集合 Set<"r,c">
     * @param {Map<string, Object>} cellRectsMap - セル矩形Map
     * @param {Object} options
     * @param {number} options.gapOffset - 4px gap内のオフセット (湖: 1px, HQ: 3px)
     * @returns {{ segments: Array<Object>, pathData: string }}
     */
    static generateBoundaryGeometry(cellSet, cellRectsMap, { gapOffset = 1 } = {}) {
        if (!cellSet || cellSet.size === 0 || !cellRectsMap || cellRectsMap.size === 0) {
            return { segments: [], pathData: "" };
        }

        const segments = [];
        const pathCommands = [];

        for (const key of cellSet) {
            const [rStr, cStr] = key.split(",");
            const r = parseInt(rStr, 10);
            const c = parseInt(cStr, 10);
            const rect = cellRectsMap.get(key);
            if (!rect) continue;

            const hasTop = cellSet.has(`${r - 1},${c}`);
            const hasBottom = cellSet.has(`${r + 1},${c}`);
            const hasLeft = cellSet.has(`${r},${c - 1}`);
            const hasRight = cellSet.has(`${r},${c + 1}`);

            // 外周上辺 (Top Outer Edge)
            if (!hasTop) {
                const x1 = rect.left - (hasLeft ? 0 : gapOffset);
                const x2 = rect.right + (hasRight ? 0 : gapOffset);
                const y = rect.top - gapOffset;
                segments.push({ type: "top", r, c, x1, y1: y, x2, y2: y });
                pathCommands.push(`M ${x1} ${y} L ${x2} ${y}`);
            }

            // 外周右辺 (Right Outer Edge)
            if (!hasRight) {
                const y1 = rect.top - (hasTop ? 0 : gapOffset);
                const y2 = rect.bottom + (hasBottom ? 0 : gapOffset);
                const x = rect.right + gapOffset;
                segments.push({ type: "right", r, c, x1: x, y1, x2: x, y2 });
                pathCommands.push(`M ${x} ${y1} L ${x} ${y2}`);
            }

            // 外周下辺 (Bottom Outer Edge)
            if (!hasBottom) {
                const x1 = rect.left - (hasLeft ? 0 : gapOffset);
                const x2 = rect.right + (hasRight ? 0 : gapOffset);
                const y = rect.bottom + gapOffset;
                segments.push({ type: "bottom", r, c, x1, y1: y, x2, y2: y });
                pathCommands.push(`M ${x1} ${y} L ${x2} ${y}`);
            }

            // 外周左辺 (Left Outer Edge)
            if (!hasLeft) {
                const y1 = rect.top - (hasTop ? 0 : gapOffset);
                const y2 = rect.bottom + (hasBottom ? 0 : gapOffset);
                const x = rect.left - gapOffset;
                segments.push({ type: "left", r, c, x1: x, y1, x2: x, y2 });
                pathCommands.push(`M ${x} ${y1} L ${x} ${y2}`);
            }
        }

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

        // 🌊 湖水源バフ: gapの内側寄り (offset: 1px)
        const lakeGeom = this.generateBoundaryGeometry(lakeInfluenceCells, cellRectsMap, { gapOffset: 1 });
        // 🏰 本営近郊バフ: gapの外側寄り (offset: 3px) で物理的分離 (HQ自身を含めた3x3外周描画)
        const hqGeom = this.generateBoundaryGeometry(hqInfluenceVisualCells, cellRectsMap, { gapOffset: 3 });

        let svgContent = "";

        if (lakeGeom.pathData) {
            svgContent += `
                <g class="lake-influence-boundary-group">
                    <path d="${lakeGeom.pathData}" class="lake-boundary-path-glow" />
                    <path d="${lakeGeom.pathData}" class="lake-boundary-path-core" />
                </g>
            `;
        }

        if (hqGeom.pathData) {
            svgContent += `
                <g class="hq-influence-boundary-group">
                    <path d="${hqGeom.pathData}" class="hq-boundary-path-glow" />
                    <path d="${hqGeom.pathData}" class="hq-boundary-path-core" />
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
