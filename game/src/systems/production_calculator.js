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

            const groupSums = {};

            for (let r = 0; r < 5; r++) {
                for (let c = 0; c < 5; c++) {
                    const cell = state.grid[r][c];
                    if (cell.placed && !cell.isHQ && cell.terrain) {
                        const tf = cell.terrain.food || 0;
                        const tw = cell.terrain.wood || 0;
                        const tm = cell.terrain.mystic || 0;

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

            let foodMult = 1.0, woodMult = 1.0, mysticMult = 1.0;
            if (state.directiveSystem) {
                foodMult = state.directiveSystem.getResourceMultiplier("food");
                woodMult = state.directiveSystem.getResourceMultiplier("wood");
                mysticMult = state.directiveSystem.getResourceMultiplier("mystic");
            }

            const totalFood = Math.floor((10 + foodTiles + foodSockets + foodVicinity) * foodMult);
            const totalWood = Math.floor((10 + woodTiles + woodSockets + woodVicinity) * woodMult);
            const totalMystic = Math.floor((1 + mysticTiles + mysticSockets) * mysticMult);

            return { totalFood, totalWood, totalMystic };
        }

        static calculateTotalDefense(state) {
            let def = 10;
            for (let r = 0; r < 5; r++) {
                for (let c = 0; c < 5; c++) {
                    const cell = state.grid[r][c];
                    if (cell.placed && !cell.isHQ && cell.terrain) {
                        def += cell.terrain.defense || 0;
                    }
                }
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

            for (let r = 0; r < 5; r++) {
                for (let c = 0; c < 5; c++) {
                    const cell = state.grid[r][c];
                    if (cell.placed && !cell.isHQ && cell.terrain) {
                        const tf = cell.terrain.food || 0;
                        const tw = cell.terrain.wood || 0;
                        const td = cell.terrain.defense || 0;
                        const tm = cell.terrain.mystic || 0;

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

            return {
                food: { hqBase: 10, tiles: foodTiles, sockets: foodSockets, vicinity: foodVicinity, total: prods.totalFood },
                wood: { hqBase: 10, tiles: woodTiles, sockets: woodSockets, vicinity: woodVicinity, total: prods.totalWood },
                defense: { hqBase: 10, tiles: defenseTiles, sockets: defenseSockets, total: defTotal },
                mystic: { hqBase: 1, tiles: mysticTiles, sockets: mysticSockets, total: prods.totalMystic }
            };
        }
    }

    if (typeof window !== "undefined") {
        window.ProductionCalculator = ProductionCalculator;
    }
})();
