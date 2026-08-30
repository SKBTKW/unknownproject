/**
 * 🗺️ CellViewDataService (セル表示用クエリ・プレゼンテーションサービス)
 * 
 * 責務:
 * 1. 盤面マスの表示に必要な純粋な事実データ (ViewModel) を提供する。
 * 2. 産出計算は自前で行わず、必ず ProductionCalculator.calculateCellYieldBreakdown を利用する。
 * 3. 絵文字 (🌾, 🧱) や HTML、日本語テキストを含めず、純粋な Enum と数値のみを返す (Mobile & Unity Ready)。
 */

import { ProductionCalculator } from '../systems/production_calculator.js';

export class CellViewDataService {
    /**
     * @param {Object} [calculator=null] - 産出計算機 (DI可能)
     */
    constructor(calculator = null) {
        this.calculator = calculator || ProductionCalculator;
    }

    /**
     * 🔍 単一マスの表示用純粋事実データを取得
     * @param {Object} state - GameState
     * @param {number} r - 行
     * @param {number} c - 列
     * @returns {Object|null}
     */
    getCellViewData(state, r, c) {
        if (!state || !state.grid || !state.grid[r] || !state.grid[r][c]) {
            return null;
        }

        const cell = state.grid[r][c];
        if (!cell) return null;

        // 1. 未配置マスの ViewModel
        if (!cell.placed) {
            return {
                r,
                c,
                placed: false,
                isHQ: false,
                terrainId: null,
                category: null,
                nameKey: null,
                hasSocket: !!cell.hasSocket,
                socketResource: cell.socketResource ? {
                    id: cell.socketResource.id || null,
                    nameKey: cell.socketResource.nameKey || null
                } : null,
                yields: { food: 0, wood: 0, defense: 0, mystic: 0 },
                primaryYield: null,
                modifiers: [],
                placementGroupId: null,
                mergeGroupId: null
            };
        }

        // 2. 正式な産出・補正内訳を ProductionCalculator から取得
        const breakdown = this.calculator && typeof this.calculator.calculateCellYieldBreakdown === "function"
            ? this.calculator.calculateCellYieldBreakdown(state, r, c)
            : { baseYields: {}, modifiers: [], totalYields: {} };

        const totalYields = breakdown.totalYields || { food: 0, wood: 0, defense: 0, mystic: 0 };
        const modifiers = breakdown.modifiers || [];

        // 3. 最大産出資源 (primaryYield) の決定論的選定
        let primaryYield = null;
        let maxVal = 0;
        const resourcePriority = ["food", "wood", "defense", "mystic"];
        for (const res of resourcePriority) {
            const val = totalYields[res] || 0;
            if (val > maxVal) {
                maxVal = val;
                primaryYield = { resource: res, amount: val };
            }
        }

        // 4. 純粋な事実 ViewModel
        const t = cell.terrain || {};
        return {
            r,
            c,
            placed: true,
            isHQ: !!cell.isHQ,
            terrainId: t.terrainId || t.id || (cell.isHQ ? "HQ" : null),
            category: t.category || (cell.isHQ ? "HQ" : "LAND"),
            nameKey: t.nameKey || (cell.isHQ ? "TERRAIN_HQ_NAME" : null),
            hasSocket: !!cell.hasSocket,
            socketResource: cell.socketResource ? {
                id: cell.socketResource.id || null,
                nameKey: cell.socketResource.nameKey || null,
                yields: cell.socketResource.yields ? { ...cell.socketResource.yields } : null
            } : null,
            yields: totalYields,
            baseYields: breakdown.baseYields || { food: 0, wood: 0, defense: 0, mystic: 0 },
            primaryYield,
            modifiers,
            placementGroupId: cell.placementGroupId || null,
            mergeGroupId: cell.mergeGroupId || null
        };
    }
}

if (typeof window !== "undefined") {
    window.CellViewDataService = CellViewDataService;
}
if (typeof globalThis !== "undefined") {
    globalThis.CellViewDataService = CellViewDataService;
}
