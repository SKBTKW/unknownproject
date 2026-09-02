/* =============================================================
   game/src/systems/production_calculator.js
   リソース産出（食料/資材/防衛/神秘）＆詳細内訳計算専用独立コンポーネント
   ============================================================= */

import { MaintenanceFallbackSystem } from './maintenance_fallback_system.js';

(function() {
    class ProductionCalculator {
        static calculateTotalProduction(state) {
            let foodTiles = 0;
            let woodTiles = 0;
            let mysticTiles = 0;

            let foodSockets = 0;
            let woodSockets = 0;
            let mysticSockets = 0;

            let foodVicinity = 0;
            let woodVicinity = 0;
            let mysticVicinity = 0;
            let foodLakeIrrigation = 0;

            const size = (state && state.grid && state.grid.length) ? state.grid.length : 5;

            const lakeCoords = [];
            for (let r = 0; r < size; r++) {
                for (let c = 0; c < size; c++) {
                    const cell = state.grid[r][c];
                    if (cell && cell.placed && cell.socketResource) {
                        const sid = cell.socketResource.id || cell.socketResource.nameKey || "";
                        if (sid === "SOCKET_LAKE" || sid === "SOCKET_OASIS") {
                            lakeCoords.push({ r, c });
                        }
                    }
                }
            }

            const isNearLake = (r, c) => {
                return lakeCoords.some(l => Math.abs(l.r - r) <= 1 && Math.abs(l.c - c) <= 1 && !(l.r === r && l.c === c));
            };

            const groupSums = {};

            for (let r = 0; r < size; r++) {
                for (let c = 0; c < size; c++) {
                    const cell = state.grid[r][c];
                    if (cell && cell.placed && !cell.isHQ && cell.terrain) {
                        const t = cell.terrain;
                        const tf = (t.food !== undefined) ? t.food : ((t.baseYieldsPerTile && t.baseYieldsPerTile.food) || (t.yields && t.yields.food) || 0);
                        const tw = (t.material !== undefined) ? t.material : ((t.wood !== undefined) ? t.wood : ((t.baseYieldsPerTile && (t.baseYieldsPerTile.material || t.baseYieldsPerTile.wood)) || (t.yields && (t.yields.material || t.yields.wood)) || 0));
                        const tm = (t.mystic !== undefined) ? t.mystic : ((t.baseYieldsPerTile && t.baseYieldsPerTile.mystic) || (t.yields && t.yields.mystic) || 0);

                        if (cell.mergeGroupId) {
                            const gid = cell.mergeGroupId;
                            if (!groupSums[gid]) groupSums[gid] = { food: 0, wood: 0, material: 0, mystic: 0 };
                            groupSums[gid].food += tf;
                            groupSums[gid].wood += tw;
                            groupSums[gid].material += tw;
                            groupSums[gid].mystic += tm;
                        } else {
                            foodTiles += tf;
                            woodTiles += tw;
                            mysticTiles += tm;
                        }

                        if (cell.socketResource) {
                            foodSockets += cell.socketResource.bonusFood || 0;
                            woodSockets += (cell.socketResource.bonusMaterial !== undefined ? cell.socketResource.bonusMaterial : (cell.socketResource.bonusWood || 0));
                            mysticSockets += cell.socketResource.bonusMystic || 0;
                        }

                        if (state.isHQVicinity(r, c)) {
                            if (tf > 0) foodVicinity += 1;
                            if (tw > 0) woodVicinity += 1;
                            if (tm > 0) mysticVicinity += 1;
                        }

                        // 🌊 湖 (Lake) 周囲8マスの灌漑バフ (+50% 食料産出ブースト)
                        if (isNearLake(r, c) && tf > 0) {
                            foodLakeIrrigation += Math.max(1, Math.floor(tf * 0.5));
                        }
                    }
                }
            }

            for (let gid in groupSums) {
                const g = groupSums[gid];
                foodTiles += Math.ceil(g.food * 1.2);
                woodTiles += Math.ceil(g.wood * 1.2);
                mysticTiles += Math.ceil(g.mystic * 1.2);
            }

            // 📜 コマンドカード・バフ効果加算
            let plainsCount = 0;
            let forestCount = 0;
            let vicinityCount = 0;
            for (let r = 0; r < size; r++) {
                for (let c = 0; c < size; c++) {
                    const cell = state.grid[r][c];
                    if (cell && cell.placed && !cell.isHQ && cell.terrain) {
                        const tid = cell.terrain.terrainId || cell.terrain.id || "";
                        if (tid.includes("PLAINS")) plainsCount++;
                        if (tid.includes("FOREST")) forestCount++;
                        if (state.isHQVicinity(r, c)) vicinityCount++;
                    }
                }
            }

            const grandCultivationBonus = (state.grandCultivationTurns && state.grandCultivationTurns > 0 && !state.grandCultivationStartsNextTurn) ? (1 * plainsCount) : 0;
            const systematicLoggingPenalty = (state.systematicLoggingTurns && state.systematicLoggingTurns > 0 && !state.systematicLoggingStartsNextTurn) ? (1 * forestCount) : 0;
            const plainsBuffBonus = ((state.permanentPlainsFoodBonus || 0) * plainsCount) + grandCultivationBonus;
            const vicinityDefBonus = (state.permanentVicinityDefenseBonus || 0) * vicinityCount;

            let foodMult = 1.0, woodMult = 1.0, mysticMult = 1.0;
            if (state.directiveSystem) {
                foodMult = state.directiveSystem.getResourceMultiplier("food");
                woodMult = state.directiveSystem.getResourceMultiplier("wood");
                mysticMult = state.directiveSystem.getResourceMultiplier("mystic");
            }

            // ✨ BuffSystem モジュールからの一元バフ倍率 ＆ 固定加算取得
            let buffFoodMult = 1.0, buffWoodMult = 1.0, buffMysticMult = 1.0;
            let flatMysticBonus = 0;
            if (state.buffSystem) {
                const bMults = state.buffSystem.getProductionMultipliers();
                buffFoodMult = bMults.foodMult;
                buffWoodMult = bMults.woodMult;
                buffMysticMult = bMults.mysticMult;
                flatMysticBonus = state.buffSystem.getFlatMysticBonus();
            } else if (state.ember !== undefined) {
                if (state.ember >= 20) { buffFoodMult = 1.20; buffWoodMult = 1.20; buffMysticMult = 1.20; flatMysticBonus = 2; }
                else if (state.ember >= 12) { buffFoodMult = 1.10; buffWoodMult = 1.10; buffMysticMult = 1.10; flatMysticBonus = 1; }
            }

            // 🌍 グローバルイベントによる産出補正の適用 (寒波・旱魃・豊穣など)
            let plainsFoodMultiplier = 1.0;
            if (state.globalEventManager && typeof state.globalEventManager.applyProductionEffects === "function") {
                const prodsContext = { multipliers: {} };
                state.globalEventManager.applyProductionEffects(prodsContext);
                if (prodsContext.multipliers["PLAINS_FOOD"]) {
                    plainsFoodMultiplier = prodsContext.multipliers["PLAINS_FOOD"];
                }
            }

            // 表示予測も実決済も同じ最終維持費 resolver を参照する。
            const foodCost = MaintenanceFallbackSystem.resolveFoodMaintenanceCost(state).foodCost;

            // 🏰 本営 (HQ) 基礎産出の動的解決 (Stage 1: 10/10/10/1, Stage 2: 14/14/14/2)
            const center = Math.floor(size / 2);
            const hqTerrain = (state.grid && state.grid[center] && state.grid[center][center] && state.grid[center][center].terrain) 
                ? state.grid[center][center].terrain 
                : { food: 10, wood: 10, defense: 10, mystic: 1 };
            const hqFood = (hqTerrain.food !== undefined) ? hqTerrain.food : 10;
            const hqWood = (hqTerrain.wood !== undefined) ? (hqTerrain.material !== undefined ? hqTerrain.material : hqTerrain.wood) : 10;
            const hqMystic = (hqTerrain.mystic !== undefined) ? hqTerrain.mystic : 1;

            const adjustedPlainsFood = Math.floor((foodTiles + plainsBuffBonus) * plainsFoodMultiplier);
            const grossFood = Math.floor((hqFood + adjustedPlainsFood + foodSockets + foodVicinity + foodLakeIrrigation) * foodMult * buffFoodMult);
            const netFood = grossFood - foodCost;
            const totalFood = netFood; // 表示互換用。実state加算は必ずgrossFoodを使用する。
            const totalWood = Math.max(0, Math.floor((hqWood + woodTiles + woodSockets + woodVicinity - systematicLoggingPenalty) * woodMult * buffWoodMult));
            const totalMaterial = totalWood;
            const totalMystic = Math.floor((hqMystic + mysticTiles + mysticSockets + mysticVicinity + flatMysticBonus) * mysticMult * buffMysticMult);

            return { totalFood, netFood, grossFood, foodCost, totalWood, totalMaterial, totalMystic, foodLakeIrrigation, hqFood, hqWood, hqMystic };
        }

        static calculateTotalDefense(state) {
            const size = (state && state.grid && state.grid.length) ? state.grid.length : 5;
            const center = Math.floor(size / 2);
            const hqTerrain = (state.grid && state.grid[center] && state.grid[center][center] && state.grid[center][center].terrain) 
                ? state.grid[center][center].terrain 
                : { food: 10, wood: 10, defense: 10, mystic: 1 };
            const hqDef = (hqTerrain.defense !== undefined) ? hqTerrain.defense : 10;

            let def = hqDef;
            let vicinityCount = 0;
            for (let r = 0; r < size; r++) {
                for (let c = 0; c < size; c++) {
                    const cell = state.grid[r][c];
                    if (cell && cell.placed && !cell.isHQ && cell.terrain) {
                        const t = cell.terrain;
                        const td = (t.defense !== undefined) ? t.defense : ((t.baseYieldsPerTile && t.baseYieldsPerTile.defense) || (t.yields && t.yields.defense) || 0);
                        def += td;
                        if (cell.socketResource) {
                            def += cell.socketResource.bonusDefense || 0;
                        }
                        if (state.isHQVicinity(r, c)) vicinityCount++;
                    }
                }
            }
            def += (state.permanentVicinityDefenseBonus || 0) * vicinityCount;
            if (state.defense) def += (state.defense - 10); // 直接加算された防衛力

            // 🛡️ 警戒バフ (次のターンから2ターンの間、毎ターンの防衛力産出に+3ボーナス)
            if (state.vigilanceTurns && state.vigilanceTurns > 0 && !state.vigilanceStartsNextTurn) {
                def += 3;
            }

            if (state.directiveSystem) {
                def = Math.floor(def * state.directiveSystem.getResourceMultiplier("defense"));
            }
            return def;
        }

        static getResourceBreakdown(state) {
            let foodTiles = 0, woodTiles = 0, defenseTiles = 0, mysticTiles = 0;
            let foodSockets = 0, woodSockets = 0, defenseSockets = 0, mysticSockets = 0;
            let foodVicinity = 0, woodVicinity = 0;
            const groupSums = {};
            const size = (state && state.grid && state.grid.length) ? state.grid.length : 5;
            const center = Math.floor(size / 2);
            const hqTerrain = (state.grid && state.grid[center] && state.grid[center][center] && state.grid[center][center].terrain) 
                ? state.grid[center][center].terrain 
                : { food: 10, wood: 10, defense: 10, mystic: 1 };
            const hqFood = (hqTerrain.food !== undefined) ? hqTerrain.food : 10;
            const hqWood = (hqTerrain.wood !== undefined) ? (hqTerrain.material !== undefined ? hqTerrain.material : hqTerrain.wood) : 10;
            const hqDefense = (hqTerrain.defense !== undefined) ? hqTerrain.defense : 10;
            const hqMystic = (hqTerrain.mystic !== undefined) ? hqTerrain.mystic : 1;

            for (let r = 0; r < size; r++) {
                for (let c = 0; c < size; c++) {
                    const cell = state.grid[r][c];
                    if (cell && cell.placed && !cell.isHQ && cell.terrain) {
                        const t = cell.terrain;
                        const tf = (t.food !== undefined) ? t.food : ((t.baseYieldsPerTile && t.baseYieldsPerTile.food) || (t.yields && t.yields.food) || 0);
                        const tw = (t.material !== undefined) ? t.material : ((t.wood !== undefined) ? t.wood : ((t.baseYieldsPerTile && (t.baseYieldsPerTile.material || t.baseYieldsPerTile.wood)) || (t.yields && (t.yields.material || t.yields.wood)) || 0));
                        const td = (t.defense !== undefined) ? t.defense : ((t.baseYieldsPerTile && t.baseYieldsPerTile.defense) || (t.yields && t.yields.defense) || 0);
                        const tm = (t.mystic !== undefined) ? t.mystic : ((t.baseYieldsPerTile && t.baseYieldsPerTile.mystic) || (t.yields && t.yields.mystic) || 0);

                        if (cell.mergeGroupId) {
                            const gid = cell.mergeGroupId;
                            if (!groupSums[gid]) groupSums[gid] = { food: 0, wood: 0, material: 0, defense: 0, mystic: 0 };
                            groupSums[gid].food += tf;
                            groupSums[gid].wood += tw;
                            groupSums[gid].material += tw;
                            groupSums[gid].defense += td;
                            groupSums[gid].mystic += tm;
                        } else {
                            foodTiles += tf;
                            woodTiles += tw;
                            defenseTiles += td;
                            mysticTiles += tm;
                        }

                        if (cell.socketResource) {
                            foodSockets += cell.socketResource.bonusFood || 0;
                            woodSockets += (cell.socketResource.bonusMaterial !== undefined ? cell.socketResource.bonusMaterial : (cell.socketResource.bonusWood || 0));
                            defenseSockets += cell.socketResource.bonusDefense || 0;
                            mysticSockets += cell.socketResource.bonusMystic || 0;
                        }

                        if (state.isHQVicinity(r, c)) {
                            if (tf > 0) foodVicinity += 1;
                            if (tw > 0) woodVicinity += 1;
                            if (tm > 0) mysticVicinity += 1;
                        }
                    }
                }
            }

            for (let gid in groupSums) {
                const g = groupSums[gid];
                foodTiles += Math.ceil(g.food * 1.2);
                woodTiles += Math.ceil(g.wood * 1.2);
                defenseTiles += Math.ceil(g.defense * 1.2);
                mysticTiles += Math.ceil(g.mystic * 1.2);
            }

            const prods = this.calculateTotalProduction(state);
            const defTotal = this.calculateTotalDefense(state);

            let emberPct = 0;
            let emberMystic = 0;
            if (state.ember !== undefined) {
                if (state.ember >= 20) { emberPct = 20; emberMystic = 2; }
                else if (state.ember >= 12) { emberPct = 10; emberMystic = 1; }
            }

            return {
                food: { hqBase: hqFood, tiles: foodTiles, sockets: foodSockets, vicinity: foodVicinity, lakeIrrigation: prods.foodLakeIrrigation || 0, emberPct, gross: prods.grossFood, foodCost: prods.foodCost, net: prods.netFood, total: prods.totalFood },
                wood: { hqBase: hqWood, tiles: woodTiles, sockets: woodSockets, vicinity: woodVicinity, emberPct, total: prods.totalWood },
                defense: { hqBase: hqDefense, tiles: defenseTiles, sockets: defenseSockets, total: defTotal },
                mystic: { hqBase: hqMystic, tiles: mysticTiles, sockets: mysticSockets, emberMystic, emberPct, total: prods.totalMystic }
            };
        }

        /**
         * 🔬 単一マスの正式な産出・補正内訳 (Single Source of Truth)
         * @param {Object} state - GameState
         * @param {number} r - 行
         * @param {number} c - 列
         * @returns {Object} { baseYields, modifiers, totalYields }
         */
        static calculateCellYieldBreakdown(state, r, c) {
            const emptyResult = {
                baseYields: { food: 0, wood: 0, defense: 0, mystic: 0 },
                modifiers: [],
                totalYields: { food: 0, wood: 0, defense: 0, mystic: 0 }
            };
            if (!state || !state.grid || !state.grid[r] || !state.grid[r][c]) {
                return emptyResult;
            }

            const cell = state.grid[r][c];
            if (!cell || !cell.placed) return emptyResult;

            // 1. 本営マスの場合
            if (cell.isHQ) {
                const hqTerrain = cell.terrain || { food: 10, wood: 10, defense: 10, mystic: 1 };
                const hqFood = (hqTerrain.food !== undefined) ? hqTerrain.food : 10;
                const hqWood = (hqTerrain.wood !== undefined) ? (hqTerrain.material !== undefined ? hqTerrain.material : hqTerrain.wood) : 10;
                const hqDefense = (hqTerrain.defense !== undefined) ? hqTerrain.defense : 10;
                const hqMystic = (hqTerrain.mystic !== undefined) ? hqTerrain.mystic : 1;
                return {
                    baseYields: { food: hqFood, wood: hqWood, defense: hqDefense, mystic: hqMystic },
                    modifiers: [],
                    totalYields: { food: hqFood, wood: hqWood, defense: hqDefense, mystic: hqMystic }
                };
            }

            // 2. 通常配置土地の場合
            const t = cell.terrain;
            if (!t) return emptyResult;

            const baseFood = (t.food !== undefined) ? t.food : ((t.baseYieldsPerTile && t.baseYieldsPerTile.food) || (t.yields && t.yields.food) || 0);
            const baseWood = (t.material !== undefined) ? t.material : ((t.wood !== undefined) ? t.wood : ((t.baseYieldsPerTile && (t.baseYieldsPerTile.material || t.baseYieldsPerTile.wood)) || (t.yields && (t.yields.material || t.yields.wood)) || 0));
            const baseDefense = (t.defense !== undefined) ? t.defense : ((t.baseYieldsPerTile && t.baseYieldsPerTile.defense) || (t.yields && t.yields.defense) || 0);
            const baseMystic = (t.mystic !== undefined) ? t.mystic : ((t.baseYieldsPerTile && t.baseYieldsPerTile.mystic) || (t.yields && t.yields.mystic) || 0);

            const baseYields = { food: baseFood, wood: baseWood, defense: baseDefense, mystic: baseMystic };
            const modifiers = [];
            let totalFood = baseFood;
            let totalWood = baseWood;
            let totalDefense = baseDefense;
            let totalMystic = baseMystic;

            // ① ソケット資源ボーナス
            if (cell.socketResource) {
                const s = cell.socketResource;
                const sf = s.bonusFood || 0;
                const sw = (s.bonusMaterial !== undefined ? s.bonusMaterial : (s.bonusWood || 0));
                const sd = s.bonusDefense || 0;
                const sm = s.bonusMystic || 0;
                if (sf > 0) { modifiers.push({ type: "SOCKET", resource: "food", amount: sf }); totalFood += sf; }
                if (sw > 0) { modifiers.push({ type: "SOCKET", resource: "wood", amount: sw }); totalWood += sw; }
                if (sd > 0) { modifiers.push({ type: "SOCKET", resource: "defense", amount: sd }); totalDefense += sd; }
                if (sm > 0) { modifiers.push({ type: "SOCKET", resource: "mystic", amount: sm }); totalMystic += sm; }
            }

            // ② 本営近郊ボーナス (HQ Vicinity: 基礎産出がある資源に+1)
            const isHQVic = (typeof state.isHQVicinity === "function") ? state.isHQVicinity(r, c) : false;
            if (isHQVic) {
                if (baseFood > 0) { modifiers.push({ type: "HQ_VICINITY", resource: "food", amount: 1 }); totalFood += 1; }
                if (baseWood > 0) { modifiers.push({ type: "HQ_VICINITY", resource: "wood", amount: 1 }); totalWood += 1; }
                if (baseMystic > 0) { modifiers.push({ type: "HQ_VICINITY", resource: "mystic", amount: 1 }); totalMystic += 1; }
            }

            // ③ 湖/オアシス灌漑ボーナス (+50% 食料、最低+1)
            const size = state.grid.length;
            let isNearLake = false;
            for (let lr = Math.max(0, r - 1); lr <= Math.min(size - 1, r + 1); lr++) {
                for (let lc = Math.max(0, c - 1); lc <= Math.min(size - 1, c + 1); lc++) {
                    if (lr === r && lc === c) continue;
                    const neighbor = state.grid[lr][lc];
                    if (neighbor && neighbor.placed && neighbor.socketResource) {
                        const sid = neighbor.socketResource.id || neighbor.socketResource.nameKey || "";
                        if (sid === "SOCKET_LAKE" || sid === "SOCKET_OASIS") {
                            isNearLake = true;
                            break;
                        }
                    }
                }
                if (isNearLake) break;
            }
            if (isNearLake && baseFood > 0) {
                const lakeIrrigation = Math.max(1, Math.floor(baseFood * 0.5));
                modifiers.push({ type: "LAKE_IRRIGATION", resource: "food", amount: lakeIrrigation });
                totalFood += lakeIrrigation;
            }

            // ④ 永続平地強化バフ
            const tid = t.terrainId || t.id || "";
            if (state.permanentPlainsFoodBonus && tid.includes("PLAINS")) {
                modifiers.push({ type: "PERMANENT_PLAINS", resource: "food", amount: state.permanentPlainsFoodBonus });
                totalFood += state.permanentPlainsFoodBonus;
            }

            // ⑤ 永続近郊防衛バフ
            if (state.permanentVicinityDefenseBonus && isHQVic) {
                modifiers.push({ type: "PERMANENT_VICINITY_DEFENSE", resource: "defense", amount: state.permanentVicinityDefenseBonus });
                totalDefense += state.permanentVicinityDefenseBonus;
            }

            return {
                baseYields,
                modifiers,
                totalYields: { food: totalFood, wood: totalWood, defense: totalDefense, mystic: totalMystic }
            };
        }
    }

    if (typeof window !== "undefined") {
        window.ProductionCalculator = ProductionCalculator;
    }
    if (typeof globalThis !== "undefined") {
        globalThis.ProductionCalculator = ProductionCalculator;
    }
})();

const ProductionCalculator = (typeof globalThis !== "undefined" && globalThis.ProductionCalculator) ? globalThis.ProductionCalculator : null;
export { ProductionCalculator };
export default ProductionCalculator;


