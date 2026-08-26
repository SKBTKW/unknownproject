/* =============================================================
   game/src/core/condition_evaluator.js
   ゲームルールの条件判定を処理する汎用Registry型評価エンジン (Pure & Unity Ready)
   ============================================================= */

/**
 * 🔍 条件判定ハンドラ Registry
 */
const CONDITION_HANDLERS = {
    // 🗺️ 指定地形のマス数判定
    TERRAIN_COUNT_AT_LEAST: (params, context) => {
        if (!context || !context.state) return false;
        const targetTerrain = params.terrain; // "GL1_PLAINS" or "PLAINS"
        const requiredValue = params.value || 1;
        let count = 0;
        if (context.state.grid) {
            for (let r = 0; r < context.state.grid.length; r++) {
                for (let c = 0; c < context.state.grid[r].length; c++) {
                    const cell = context.state.grid[r][c];
                    if (cell && cell.placed && cell.terrain) {
                        const tid = cell.terrain.terrainId || cell.terrain.id || "";
                        if (targetTerrain === "PLAINS" || targetTerrain === "GL1_PLAINS") {
                            if (tid.includes("PLAINS")) count++;
                        } else if (tid.includes(targetTerrain)) {
                            count++;
                        }
                    }
                }
            }
        }
        return count >= requiredValue;
    },

    // 💰 資源量の下限判定 (>=)
    RESOURCE_AT_LEAST: (params, context) => {
        if (!context || !context.state) return false;
        const resKey = (params.resource || "food").toLowerCase();
        const currentVal = context.state[resKey] !== undefined ? context.state[resKey] : 0;
        return currentVal >= (params.value || 0);
    },

    // 📉 資源量の上限・不足判定 (<= または <)
    RESOURCE_BELOW: (params, context) => {
        if (!context || !context.state) return false;
        const resKey = (params.resource || "food").toLowerCase();
        const currentVal = context.state[resKey] !== undefined ? context.state[resKey] : 0;
        return currentVal <= (params.value || 0);
    },

    // 🏛️ Stage番号の下限判定 (>=)
    STAGE_AT_LEAST: (params, context) => {
        if (!context || !context.state) return false;
        const currentStage = (typeof context.state.stage === "object") ? (context.state.stage.id || 1) : (context.state.stage || 1);
        return currentStage >= (params.value || 1);
    },

    // ⏳ 試練までの残りターン判定 (>)
    TRIAL_DISTANCE_ABOVE: (params, context) => {
        if (!context || !context.state) return false;
        const nextTrialTurn = context.state.nextTrialTurn || 20;
        const currentTurn = context.state.turn || 1;
        const dist = nextTrialTurn - currentTurn;
        return dist > (params.value || 0);
    },

    // 💎 ソケット資源の発見済み判定
    SOCKET_FOUND: (params, context) => {
        if (!context || !context.state || !context.state.grid) return false;
        const targetCategory = params.category; // "LIVESTOCK", "WOOD", "STONE", "MYSTIC", or specific socket id
        for (let r = 0; r < context.state.grid.length; r++) {
            for (let c = 0; c < context.state.grid[r].length; c++) {
                const cell = context.state.grid[r][c];
                if (cell && cell.placed && cell.socketResource) {
                    const sid = cell.socketResource.id || cell.socketResource.nameKey || "";
                    if (targetCategory === "LIVESTOCK") {
                        if (sid.includes("COW") || sid.includes("SHEEP") || sid.includes("GOAT") || sid.includes("HORSE")) return true;
                    } else if (targetCategory === "STONE") {
                        if (sid.includes("LIMESTONE") || sid.includes("GRANITE") || sid.includes("QUARRY")) return true;
                    } else if (targetCategory === "IRON") {
                        if (sid.includes("HEMATITE") || sid.includes("IRON")) return true;
                    } else if (sid.includes(targetCategory)) {
                        return true;
                    }
                }
            }
        }
        return false;
    },

    // 📜 履歴・フラグ判定 (直近Nターンで食料不足がないか等)
    HISTORY_CHECK: (params, context) => {
        if (!context || !context.state) return false;
        if (params.checkType === "NO_FOOD_DEFICIT_RECENT") {
            const recentTurns = params.turns || 3;
            const history = context.state.deficitHistory || [];
            const currentTurn = context.state.turn || 1;
            const recentDeficit = history.some(t => t >= currentTurn - recentTurns);
            return !recentDeficit;
        }
        if (params.checkType === "TRIAL_DAMAGE_TAKEN") {
            return !!(context.state.lastTrialDamageTaken && context.state.lastTrialDamageTaken > 0);
        }
        return true;
    }
};

export class ConditionEvaluator {
    /**
     * 🔍 単一条件の評価
     * @param {Object} condition - { type, ...params }
     * @param {Object} context - { state, engine, ... }
     * @returns {boolean}
     */
    static evaluate(condition, context) {
        if (!condition || !condition.type) return true;
        const handler = CONDITION_HANDLERS[condition.type];
        if (!handler) {
            console.warn(`[ConditionEvaluator] Unrecognized condition type: ${condition.type}`);
            return true;
        }
        return handler(condition, context);
    }

    /**
     * 🔍 複数条件の全件評価 (AND判定)
     * @param {Array<Object>} conditions
     * @param {Object} context
     * @returns {boolean}
     */
    static evaluateAll(conditions, context) {
        if (!Array.isArray(conditions) || conditions.length === 0) return true;
        return conditions.every(c => ConditionEvaluator.evaluate(c, context));
    }

    /**
     * ➕ 新規条件ハンドラの登録 (Registry拡張)
     */
    static registerHandler(type, handlerFn) {
        if (typeof handlerFn === "function") {
            CONDITION_HANDLERS[type] = handlerFn;
        }
    }
}

if (typeof window !== "undefined") {
    window.ConditionEvaluator = ConditionEvaluator;
}
if (typeof globalThis !== "undefined") {
    globalThis.ConditionEvaluator = ConditionEvaluator;
}

export default ConditionEvaluator;
