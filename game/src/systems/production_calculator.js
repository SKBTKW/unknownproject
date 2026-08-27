/* =============================================================
   game/src/systems/production_calculator.js
   リソース産出（食料/資材/防衛/神秘）＆詳細内訳計算専用独立コンポーネント
   ============================================================= */

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
                    if (cell && cell.placed && cell.socketResource && (cell.socketResource.id === "SOCKET_LAKE" || cell.socketResource.nameKey === "SOCKET_LAKE")) {
                        lakeCoords.push({ r, c });
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

                        // 🌊 清湖 (Lake) 周囲8マスの灌漑バフ (+50% 食料産出ブースト)
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
            let vicinityCount = 0;
            for (let r = 0; r < size; r++) {
                for (let c = 0; c < size; c++) {
                    const cell = state.grid[r][c];
                    if (cell && cell.placed && !cell.isHQ && cell.terrain) {
                        const tid = cell.terrain.terrainId || cell.terrain.id || "";
                        if (tid.includes("PLAINS")) plainsCount++;
                        if (state.isHQVicinity(r, c)) vicinityCount++;
                    }
                }
            }

            const grandCultivationBonus = (state.grandCultivationTurns && state.grandCultivationTurns > 0) ? (1 * plainsCount) : 0;
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

            // 🔥 残り火ステッピングに基づく食料維持費 (rules/02_resources_and_ember.md 準拠)
            const ember = (state.ember !== undefined) ? state.ember : 20;
            let foodCost = 20;
            if (ember >= 24) {
                foodCost = 25; // 🔥 旺盛状態 (維持費増)
            } else if (ember <= 9) {
                foodCost = 15; // 🔥 微火・危機 (省エネ復興)
            } else {
                foodCost = 20; // 🔥 標準状態
            }

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
            const totalFood = netFood; // 🌾 毎ターンの純収支 (Net Balance)
            const totalWood = Math.floor((hqWood + woodTiles + woodSockets + woodVicinity) * woodMult * buffWoodMult);
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

            // 🛡️ 警戒態勢バフ (2ターンの間、毎ターンの防衛力産出に+3ボーナス)
            if (state.vigilanceTurns && state.vigilanceTurns > 0) {
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



