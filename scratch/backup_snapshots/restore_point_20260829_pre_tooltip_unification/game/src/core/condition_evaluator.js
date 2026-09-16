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
        const targetCategory = params.category; // "LIVESTOCK", "WOOD", "STONE", "IRON", "HORSE", "MYSTIC", or specific socket id
        for (let r = 0; r < context.state.grid.length; r++) {
            for (let c = 0; c < context.state.grid[r].length; c++) {
                const cell = context.state.grid[r][c];
                if (cell && cell.placed && cell.socketResource) {
                    const sid = (cell.socketResource.id || cell.socketResource.nameKey || "").toUpperCase();
                    if (targetCategory === "LIVESTOCK") {
                        if (sid.includes("COW") || sid.includes("SHEEP") || sid.includes("GOAT") || sid.includes("HORSE") || sid.includes("CATTLE")) return true;
                    } else if (targetCategory === "HORSE") {
                        if (sid.includes("HORSE")) return true;
                    } else if (targetCategory === "STONE") {
                        if (sid.includes("LIMESTONE") || sid.includes("GRANITE") || sid.includes("QUARRY") || sid.includes("SLATE") || sid.includes("SANDSTONE") || sid.includes("STONE")) return true;
                    } else if (targetCategory === "WOOD") {
                        if (sid.includes("WOOD") || sid.includes("OAK") || sid.includes("CEDAR") || sid.includes("LUMBER") || sid.includes("TIMBER") || sid.includes("FOREST")) return true;
                    } else if (targetCategory === "IRON") {
                        if (sid.includes("HEMATITE") || sid.includes("IRON") || sid.includes("MAGNETITE")) return true;
                    } else if (targetCategory === "MYSTIC") {
                        if (sid.includes("CRYSTAL") || sid.includes("GEM") || sid.includes("GOLD") || sid.includes("SILVER") || sid.includes("HERB") || sid.includes("MUSHROOM") || sid.includes("RELIC")) return true;
                    } else if (sid.includes(targetCategory.toUpperCase())) {
                        return true;
                    }
                }
            }
        }
        return false;
    },

    // 💎 発見済みユニーク資源数判定
    DISCOVERED_RESOURCES_COUNT: (params, context) => {
        if (!context || !context.state || !context.state.grid) return false;
        const requiredCount = params.value || 2;
        const discovered = new Set();
        for (let r = 0; r < context.state.grid.length; r++) {
            for (let c = 0; c < context.state.grid[r].length; c++) {
                const cell = context.state.grid[r][c];
                if (cell && cell.placed && cell.socketResource) {
                    const sid = cell.socketResource.id || cell.socketResource.nameKey;
                    if (sid) discovered.add(sid);
                }
            }
        }
        return discovered.size >= requiredCount;
    },

    // ✨ 発見済み神秘系資源数判定
    DISCOVERED_MYSTIC_RESOURCES_COUNT: (params, context) => {
        if (!context || !context.state || !context.state.grid) return false;
        const requiredCount = params.value || 2;
        const discovered = new Set();
        for (let r = 0; r < context.state.grid.length; r++) {
            for (let c = 0; c < context.state.grid[r].length; c++) {
                const cell = context.state.grid[r][c];
                if (cell && cell.placed && cell.socketResource) {
                    const sid = (cell.socketResource.id || cell.socketResource.nameKey || "").toUpperCase();
                    if (sid.includes("CRYSTAL") || sid.includes("GEM") || sid.includes("GOLD") || sid.includes("SILVER") || sid.includes("HERB") || sid.includes("MUSHROOM") || sid.includes("RELIC") || sid.includes("MYSTIC") || (cell.socketResource.bonusMystic && cell.socketResource.bonusMystic > 0)) {
                        discovered.add(sid);
                    }
                }
            }
        }
        return discovered.size >= requiredCount;
    },

    // ⚠️ 試練予告中判定 (<= 5T または notice.active)
    TRIAL_NOTICE: (params, context) => {
        if (!context || !context.state) return false;
        const notice = (typeof context.state.getTrialNotice === 'function') ? context.state.getTrialNotice() : { active: false };
        if (notice && notice.active) return true;
        const nextTrialTurn = context.state.nextTrialTurn || 20;
        const currentTurn = context.state.turn || 1;
        return (nextTrialTurn - currentTurn) <= 5;
    },

    // ⏳ 試練までのターン数判定 (<= N)
    TRIAL_WITHIN: (params, context) => {
        if (!context || !context.state) return false;
        const nextTrialTurn = context.state.nextTrialTurn || 20;
        const currentTurn = context.state.turn || 1;
        return (nextTrialTurn - currentTurn) <= (params.value || 5);
    },

    // 🗺️ 盤面に丘陵または山岳が存在するか判定
    HAS_HILL_OR_MOUNTAIN: (params, context) => {
        if (!context || !context.state || !context.state.grid) return false;
        for (let r = 0; r < context.state.grid.length; r++) {
            for (let c = 0; c < context.state.grid[r].length; c++) {
                const cell = context.state.grid[r][c];
                if (cell && cell.placed && cell.terrain) {
                    const tid = cell.terrain.terrainId || cell.terrain.id || "";
                    if (tid.includes("HILL") || tid.includes("MOUNTAIN")) return true;
                }
            }
        }
        return false;
    },

    // 💧 盤面に湿原または湖が存在するか判定
    HAS_WETLAND_OR_LAKE: (params, context) => {
        if (!context || !context.state || !context.state.grid) return false;
        for (let r = 0; r < context.state.grid.length; r++) {
            for (let c = 0; c < context.state.grid[r].length; c++) {
                const cell = context.state.grid[r][c];
                if (cell && cell.placed && cell.terrain) {
                    const tid = cell.terrain.terrainId || cell.terrain.id || "";
                    if (tid.includes("WETLAND") || tid.includes("LAKE")) return true;
                }
            }
        }
        return false;
    },

    // 🌲 盤面に森が存在するか判定
    HAS_FOREST: (params, context) => {
        if (!context || !context.state || !context.state.grid) return false;
        const minCount = params.value || 1;
        let count = 0;
        for (let r = 0; r < context.state.grid.length; r++) {
            for (let c = 0; c < context.state.grid[r].length; c++) {
                const cell = context.state.grid[r][c];
                if (cell && cell.placed && cell.terrain) {
                    const tid = cell.terrain.terrainId || cell.terrain.id || "";
                    if (tid.includes("FOREST")) count++;
                }
            }
        }
        return count >= minCount;
    },

    // 🔗 連結した指定地形の最大マス数判定
    CONNECTED_TERRAIN_AT_LEAST: (params, context) => {
        if (!context || !context.state || !context.state.grid) return false;
        const targetType = params.terrainType; // "PLAINS", "HILL_OR_FOREST"
        const requiredCount = params.value || 1;
        const grid = context.state.grid;
        const rows = grid.length;
        const cols = grid[0].length;
        const visited = Array(rows).fill(null).map(() => Array(cols).fill(false));

        const matches = (cell) => {
            if (!cell || !cell.placed || cell.isHQ || !cell.terrain) return false;
            const tid = cell.terrain.terrainId || cell.terrain.id || "";
            if (targetType === "PLAINS") return tid.includes("PLAINS");
            if (targetType === "HILL_OR_FOREST") return tid.includes("HILL") || tid.includes("FOREST");
            return tid.includes(targetType);
        };

        let maxConnected = 0;
        for (let r = 0; r < rows; r++) {
            for (let c = 0; c < cols; c++) {
                if (!visited[r][c] && matches(grid[r][c])) {
                    let count = 0;
                    const queue = [{ r, c }];
                    visited[r][c] = true;
                    while (queue.length > 0) {
                        const curr = queue.shift();
                        count++;
                        const neighbors = [
                            { r: curr.r - 1, c: curr.c },
                            { r: curr.r + 1, c: curr.c },
                            { r: curr.r, c: curr.c - 1 },
                            { r: curr.r, c: curr.c + 1 }
                        ];
                        for (const n of neighbors) {
                            if (n.r >= 0 && n.r < rows && n.c >= 0 && n.c < cols && !visited[n.r][n.c] && matches(grid[n.r][n.c])) {
                                visited[n.r][n.c] = true;
                                queue.push(n);
                            }
                        }
                    }
                    if (count > maxConnected) maxConnected = count;
                }
            }
        }
        return maxConnected >= requiredCount;
    },

    // 🌲 盤面に森または森丘陵が存在するか判定 (指定マス数以上)
    HAS_FOREST_OR_HILL_FOREST: (params, context) => {
        if (!context || !context.state || !context.state.grid) return false;
        const minCount = params.value || 1;
        let count = 0;
        for (let r = 0; r < context.state.grid.length; r++) {
            for (let c = 0; c < context.state.grid[r].length; c++) {
                const cell = context.state.grid[r][c];
                if (cell && cell.placed && cell.terrain) {
                    const tid = cell.terrain.terrainId || cell.terrain.id || "";
                    if (tid.includes("FOREST") || (tid.includes("HILL") && tid.includes("FOREST"))) count++;
                }
            }
        }
        return count >= minCount;
    },

    // 💧 盤面に湿原が存在するか判定 (指定マス数以上)
    HAS_WETLAND: (params, context) => {
        if (!context || !context.state || !context.state.grid) return false;
        const minCount = params.value || 1;
        let count = 0;
        for (let r = 0; r < context.state.grid.length; r++) {
            for (let c = 0; c < context.state.grid[r].length; c++) {
                const cell = context.state.grid[r][c];
                if (cell && cell.placed && cell.terrain) {
                    const tid = cell.terrain.terrainId || cell.terrain.id || "";
                    if (tid.includes("WETLAND")) count++;
                }
            }
        }
        return count >= minCount;
    },

    // 🔲 盤面の空きマス数判定
    EMPTY_CELLS_AT_LEAST: (params, context) => {
        if (!context || !context.state || !context.state.grid) return false;
        const minCount = params.value || 1;
        let count = 0;
        for (let r = 0; r < context.state.grid.length; r++) {
            for (let c = 0; c < context.state.grid[r].length; c++) {
                const cell = context.state.grid[r][c];
                if (!cell || !cell.placed) count++;
            }
        }
        return count >= minCount;
    },

    // 🏜️ 未マージの砂漠または山岳が存在するか判定
    HAS_UNMERGED_DESERT_OR_MOUNTAIN: (params, context) => {
        if (!context || !context.state || !context.state.grid) return false;
        for (let r = 0; r < context.state.grid.length; r++) {
            for (let c = 0; c < context.state.grid[r].length; c++) {
                const cell = context.state.grid[r][c];
                if (cell && cell.placed && cell.terrain && !cell.merged) {
                    const tid = cell.terrain.terrainId || cell.terrain.id || "";
                    if (tid.includes("DESERT") || tid.includes("MOUNTAIN")) return true;
                }
            }
        }
        return false;
    },

    // 🗼 前哨塔または丘陵/山岳が存在するか判定
    HAS_OUTPOST_OR_HIGH_GROUND: (params, context) => {
        if (!context || !context.state || !context.state.grid) return false;
        if (context.state.hasOutpost || (context.state.facilities && context.state.facilities.some(f => f.id && f.id.includes("OUTPOST")))) {
            return true;
        }
        for (let r = 0; r < context.state.grid.length; r++) {
            for (let c = 0; c < context.state.grid[r].length; c++) {
                const cell = context.state.grid[r][c];
                if (cell && cell.placed && cell.terrain) {
                    const tid = cell.terrain.terrainId || cell.terrain.id || "";
                    if (tid.includes("HILL") || tid.includes("MOUNTAIN")) return true;
                }
            }
        }
        return false;
    },

    // 📦 盤面に配置済みのブロック数判定 (<= maxCount)
    PLACED_BLOCKS_AT_MOST: (params, context) => {
        if (!context || !context.state) return false;
        const maxCount = params.value || 5;
        const count = context.state.placedBlocksCount || (context.state.placedCards ? context.state.placedCards.length : 0);
        return count <= maxCount;
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
    },

    // ⛰️ 本営周囲に丘陵・山岳が1個以上ある判定
    HILL_OR_MOUNTAIN_AROUND_HQ: (params, context) => {
        if (!context || !context.state || !context.state.grid) return false;
        const size = context.state.grid.length;
        const center = Math.floor(size / 2);
        for (let dr = -1; dr <= 1; dr++) {
            for (let dc = -1; dc <= 1; dc++) {
                if (dr === 0 && dc === 0) continue;
                const r = center + dr;
                const cCol = center + dc;
                if (r >= 0 && r < size && cCol >= 0 && cCol < size) {
                    const cell = context.state.grid[r][cCol];
                    if (cell && cell.placed && cell.terrain) {
                        const tid = cell.terrain.terrainId || cell.terrain.id;
                        if (tid === "E2_HILL" || tid === "E3_MOUNTAIN") return true;
                    }
                }
            }
        }
        return false;
    },

    // 🛡️ 本営周囲に丘陵・山岳が「0個」である判定 (否定条件)
    NO_HILL_OR_MOUNTAIN_AROUND_HQ: (params, context) => {
        if (!context || !context.state || !context.state.grid) return true;
        const size = context.state.grid.length;
        const center = Math.floor(size / 2);
        let countHM = 0;
        for (let dr = -1; dr <= 1; dr++) {
            for (let dc = -1; dc <= 1; dc++) {
                if (dr === 0 && dc === 0) continue;
                const r = center + dr;
                const cCol = center + dc;
                if (r >= 0 && r < size && cCol >= 0 && cCol < size) {
                    const cell = context.state.grid[r][cCol];
                    if (cell && cell.placed && cell.terrain) {
                        const tid = cell.terrain.terrainId || cell.terrain.id;
                        if (tid === "E2_HILL" || tid === "E3_MOUNTAIN") countHM++;
                    }
                }
            }
        }
        return countHM === 0;
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
     * ⛰️ 本営周囲に丘陵・山岳が「ない（0個）」か判定するヘルパー
     * @param {Object} state - gameState
     * @returns {boolean}
     */
    static checkNoHillOrMountainAroundHQ(state) {
        return CONDITION_HANDLERS.NO_HILL_OR_MOUNTAIN_AROUND_HQ({}, { state });
    }

    /**
     * ⛰️ 本営周囲に丘陵・山岳が「1個以上ある」か判定するヘルパー
     * @param {Object} state - gameState
     * @returns {boolean}
     */
    static checkHillOrMountainAroundHQ(state) {
        return CONDITION_HANDLERS.HILL_OR_MOUNTAIN_AROUND_HQ({}, { state });
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
