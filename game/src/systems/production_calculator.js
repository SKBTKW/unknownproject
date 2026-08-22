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

            const groupSums = {};

            for (let r = 0; r < 5; r++) {
                for (let c = 0; c < 5; c++) {
                    const cell = state.grid[r][c];
                    if (cell.placed && !cell.isHQ && cell.terrain) {
                        const t = cell.terrain;
                        const tf = (t.food !== undefined) ? t.food : ((t.baseYieldsPerTile && t.baseYieldsPerTile.food) || (t.yields && t.yields.food) || 0);
                        const tw = (t.wood !== undefined) ? t.wood : ((t.baseYieldsPerTile && t.baseYieldsPerTile.wood) || (t.yields && t.yields.wood) || 0);
                        const tm = (t.mystic !== undefined) ? t.mystic : ((t.baseYieldsPerTile && t.baseYieldsPerTile.mystic) || (t.yields && t.yields.mystic) || 0);

                        if (cell.mergeGroupId) {
                            const gid = cell.mergeGroupId;
                            if (!groupSums[gid]) groupSums[gid] = { food: 0, wood: 0, mystic: 0 };
                            groupSums[gid].food += tf;
                            groupSums[gid].wood += tw;
                            groupSums[gid].mystic += tm;
                        } else {
                            foodTiles += tf;
                            woodTiles += tw;
                            mysticTiles += tm;
                        }

                        if (cell.socketResource) {
                            foodSockets += cell.socketResource.bonusFood || 0;
                            woodSockets += cell.socketResource.bonusWood || 0;
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
                mysticTiles += Math.ceil(g.mystic * 1.2);
            }

            // 📜 コマンドカード・バフ効果加算
            let plainsCount = 0;
            let vicinityCount = 0;
            for (let r = 0; r < 5; r++) {
                for (let c = 0; c < 5; c++) {
                    const cell = state.grid[r][c];
                    if (cell.placed && !cell.isHQ && cell.terrain) {
                        const tid = cell.terrain.terrainId || cell.terrain.id || "";
                        if (tid.includes("PLAINS")) plainsCount++;
                        if (state.isHQVicinity(r, c)) vicinityCount++;
                    }
                }
            }

            const plainsBuffBonus = (state.permanentPlainsFoodBonus || 0) * plainsCount;
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

            const totalFood = Math.floor((10 + foodTiles + foodSockets + foodVicinity + plainsBuffBonus) * foodMult * buffFoodMult);
            const totalWood = Math.floor((10 + woodTiles + woodSockets + woodVicinity) * woodMult * buffWoodMult);
            const totalMystic = Math.floor((1 + mysticTiles + mysticSockets + mysticVicinity + flatMysticBonus) * mysticMult * buffMysticMult);

            return { totalFood, totalWood, totalMystic };
        }

        static calculateTotalDefense(state) {
            let def = 10;
            let vicinityCount = 0;
            for (let r = 0; r < 5; r++) {
                for (let c = 0; c < 5; c++) {
                    const cell = state.grid[r][c];
                    if (cell.placed && !cell.isHQ && cell.terrain) {
                        const t = cell.terrain;
                        const td = (t.defense !== undefined) ? t.defense : ((t.baseYieldsPerTile && t.baseYieldsPerTile.defense) || (t.yields && t.yields.defense) || 0);
                        def += td;
                        if (state.isHQVicinity(r, c)) vicinityCount++;
                    }
                }
            }
            def += (state.permanentVicinityDefenseBonus || 0) * vicinityCount;
            if (state.defense) def += (state.defense - 10); // 直接加算された防衛力

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

            for (let r = 0; r < 5; r++) {
                for (let c = 0; c < 5; c++) {
                    const cell = state.grid[r][c];
                    if (cell.placed && !cell.isHQ && cell.terrain) {
                        const t = cell.terrain;
                        const tf = (t.food !== undefined) ? t.food : ((t.baseYieldsPerTile && t.baseYieldsPerTile.food) || (t.yields && t.yields.food) || 0);
                        const tw = (t.wood !== undefined) ? t.wood : ((t.baseYieldsPerTile && t.baseYieldsPerTile.wood) || (t.yields && t.yields.wood) || 0);
                        const td = (t.defense !== undefined) ? t.defense : ((t.baseYieldsPerTile && t.baseYieldsPerTile.defense) || (t.yields && t.yields.defense) || 0);
                        const tm = (t.mystic !== undefined) ? t.mystic : ((t.baseYieldsPerTile && t.baseYieldsPerTile.mystic) || (t.yields && t.yields.mystic) || 0);

                        if (cell.mergeGroupId) {
                            const gid = cell.mergeGroupId;
                            if (!groupSums[gid]) groupSums[gid] = { food: 0, wood: 0, defense: 0, mystic: 0 };
                            groupSums[gid].food += tf;
                            groupSums[gid].wood += tw;
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
                            woodSockets += cell.socketResource.bonusWood || 0;
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
                food: { hqBase: 10, tiles: foodTiles, sockets: foodSockets, vicinity: foodVicinity, emberPct, total: prods.totalFood },
                wood: { hqBase: 10, tiles: woodTiles, sockets: woodSockets, vicinity: woodVicinity, emberPct, total: prods.totalWood },
                defense: { hqBase: 10, tiles: defenseTiles, sockets: defenseSockets, total: defTotal },
                mystic: { hqBase: 1, tiles: mysticTiles, sockets: mysticSockets, emberMystic, emberPct, total: prods.totalMystic }
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



