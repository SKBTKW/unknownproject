/**
 * 🗺️ CellViewDataService (セル表示用クエリ・プレゼンテーションサービス)
 * 
 * 責務:
 * 1. 盤面マスの表示に必要な純粋な事実データ (ViewModel) を提供する。
 * 2. 産出計算は自前で行わず、必ず ProductionCalculator.calculateCellYieldBreakdown を利用する。
 * 3. 絵文字 (🌾, 🧱) や HTML、日本語テキストを含めず、純粋な Enum と数値のみを返す (Mobile & Unity Ready)。
 */

import { ProductionCalculator } from '../systems/production_calculator.js';
import { resolvePlacedBlockProduction } from '../core/land_production_contract.js';

function isPlacementProductionPrimary(state, r, c, placementGroupId) {
    if (!placementGroupId || !Array.isArray(state?.grid)) return false;
    for (let row = 0; row < state.grid.length; row++) {
        for (let col = 0; col < (state.grid[row]?.length || 0); col++) {
            const cell = state.grid[row][col];
            if (!cell?.placed || cell.placementGroupId !== placementGroupId) continue;
            if (cell.socketResource) continue;
            return row === r && col === c;
        }
    }
    return false;
}

function normalizeSocketResource(socket) {
    if (!socket) return null;
    const declaredYields = socket.yields || {};
    return {
        id: socket.id || null,
        nameKey: socket.nameKey || null,
        category: socket.category || null,
        yields: {
            food: declaredYields.food ?? socket.bonusFood ?? 0,
            wood: declaredYields.wood ?? declaredYields.material ?? socket.bonusMaterial ?? socket.bonusWood ?? 0,
            defense: declaredYields.defense ?? socket.bonusDefense ?? 0,
            mystic: declaredYields.mystic ?? socket.bonusMystic ?? 0
        }
    };
}

export class CellViewDataService {
    constructor(calculator = null) {
        this.calculator = calculator || ProductionCalculator;
    }

    getCellViewData(state, r, c) {
        if (!state || !state.grid || !state.grid[r] || !state.grid[r][c]) {
            return null;
        }

        const cell = state.grid[r][c];
        if (!cell) return null;

        if (!cell.placed) {
            return {
                r,
                c,
                placed: false,
                isHQ: false,
                terrainId: null,
                category: null,
                nameKey: null,
                elevation: null,
                greenery: null,
                hasSocket: !!cell.hasSocket,
                socketResource: normalizeSocketResource(cell.socketResource),
                yields: { food: 0, wood: 0, defense: 0, mystic: 0 },
                productionStatus: null,
                productionScope: null,
                blockProduction: null,
                blockProductionPrimary: false,
                primaryYield: null,
                modifiers: [],
                placementGroupId: null,
                mergeGroupId: null
            };
        }

        const breakdown = this.calculator && typeof this.calculator.calculateCellYieldBreakdown === "function"
            ? this.calculator.calculateCellYieldBreakdown(state, r, c)
            : { baseYields: {}, modifiers: [], totalYields: {} };

        const totalYields = breakdown.totalYields || { food: 0, wood: 0, defense: 0, mystic: 0 };
        const modifiers = breakdown.modifiers || [];

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

        const t = cell.terrain || {};
        const blockProduction = resolvePlacedBlockProduction(state, cell.placementGroupId);
        const blockProductionPrimary = blockProduction.defined
            && isPlacementProductionPrimary(state, r, c, cell.placementGroupId);
        return {
            r,
            c,
            placed: true,
            isHQ: !!cell.isHQ,
            terrainId: t.terrainId || t.id || (cell.isHQ ? "HQ" : null),
            category: t.category || (cell.isHQ ? "HQ" : "LAND"),
            nameKey: t.nameKey || (cell.isHQ ? "TERRAIN_HQ_NAME" : null),
            elevation: Number.isInteger(t.e) ? t.e : null,
            greenery: Number.isInteger(t.gl) ? t.gl : null,
            hasSocket: !!cell.hasSocket,
            socketResource: normalizeSocketResource(cell.socketResource),
            yields: totalYields,
            baseYields: breakdown.baseYields || { food: 0, wood: 0, defense: 0, mystic: 0 },
            productionStatus: breakdown.productionStatus || null,
            productionScope: breakdown.productionScope || null,
            blockProduction: blockProductionPrimary ? blockProduction.yields : null,
            blockProductionPrimary,
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
