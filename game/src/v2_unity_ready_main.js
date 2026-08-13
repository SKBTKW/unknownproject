// Trial of Ages : Last Ember Engine (V2 Unity-Ready Main Engine with Single Block Merge Update)
(function(exports) {

    class GameState {
        constructor() {
            this.turn = 1;
            this.ember = 20;
            this.food = 30;
            this.wood = 30;
            this.defense = 10;
            this.mystic = 0;

            this.stage = { id: 1, name: "Stage 1", size: 5, bonusMultiplier: 1.0 };
            this.grid = this.initGrid(5);
            this.handOffering = [];
            this.reserveSlots = [null, null, null];
            this.gameLogs = [];
            this.toastQueue = [];
            this.hasPickedThisTurn = false;
            this.mergeGroupCounter = 1;

            this.addLog("[T1] ゲーム開始: 5x5 盤面が初期化されました。");
        }

        initGrid(size) {
            const grid = [];
            for (let r = 0; r < size; r++) {
                const row = [];
                for (let c = 0; c < size; c++) {
                    const isHQ = (r === 2 && c === 2);
                    row.push({
                        r, c,
                        placed: isHQ,
                        isHQ: isHQ,
                        merged: false,
                        mergeGroupId: null,
                        mergeType: null,
                        terrain: isHQ ? { id: "HQ", name: "本営", food: 10, wood: 10, defense: 10, mystic: 1 } : null,
                        searched: false,
                        hasSocket: false,
                        socketResource: null
                    });
                }
                grid.push(row);
            }

            grid[0][1].hasSocket = true;
            grid[1][3].hasSocket = true;
            grid[3][1].hasSocket = true;

            return grid;
        }

        addLog(msg) {
            this.gameLogs.unshift(msg);
            if (this.gameLogs.length > 20) this.gameLogs.pop();
        }

        isHQVicinity(r, c) {
            if (r === 2 && c === 2) return false;
            return Math.abs(r - 2) <= 1 && Math.abs(c - 2) <= 1;
        }

        countPlacedTiles() {
            let count = 0;
            for (let r = 0; r < 5; r++) {
                for (let c = 0; c < 5; c++) {
                    if (this.grid[r][c].placed && !this.grid[r][c].isHQ) count++;
                }
            }
            return count;
        }

        countH2HillsOnBoard() {
            let count = 0;
            for (let r = 0; r < 5; r++) {
                for (let c = 0; c < 5; c++) {
                    const cell = this.grid[r][c];
                    if (cell.placed && cell.terrain && cell.terrain.id === "H2_HILL") {
                        count++;
                    }
                }
            }
            return count;
        }

        canPlaceShape(startR, startC, shapeMatrix) {
            const rows = shapeMatrix.length;
            const cols = shapeMatrix[0].length;
            const size = this.stage.size;

            for (let dr = 0; dr < rows; dr++) {
                for (let dc = 0; dc < cols; dc++) {
                    if (shapeMatrix[dr][dc] === 1) {
                        const r = startR + dr;
                        const c = startC + dc;
                        if (r >= size || c >= size) return { can: false, reason: "盤面外には配置できません" };
                        if (this.grid[r][c].placed) return { can: false, reason: "既に土地が配置されています" };
                    }
                }
            }

            let isAdjacent = false;
            for (let dr = 0; dr < rows; dr++) {
                for (let dc = 0; dc < cols; dc++) {
                    if (shapeMatrix[dr][dc] === 1) {
                        const r = startR + dr;
                        const c = startC + dc;
                        const neighbors = [
                            [r-1, c], [r+1, c], [r, c-1], [r, c+1]
                        ];
                        for (let [nr, nc] of neighbors) {
                            if (nr >= 0 && nr < size && nc >= 0 && nc < size) {
                                if (this.grid[nr][nc].placed) {
                                    isAdjacent = true;
                                    break;
                                }
                            }
                        }
                    }
                    if (isAdjacent) break;
                }
            }

            if (!isAdjacent) return { can: false, reason: "既存の配置済み土地に隣接させる必要があります" };
            return { can: true };
        }

        placeShape(startR, startC, shapeMatrix, terrain) {
            const check = this.canPlaceShape(startR, startC, shapeMatrix);
            if (!check.can) return check;

            const rows = shapeMatrix.length;
            const cols = shapeMatrix[0].length;

            for (let dr = 0; dr < rows; dr++) {
                for (let dc = 0; dc < cols; dc++) {
                    if (shapeMatrix[dr][dc] === 1) {
                        const r = startR + dr;
                        const c = startC + dc;
                        const cell = this.grid[r][c];
                        cell.placed = true;
                        cell.terrain = terrain;

                        this.checkConnectionBonus(r, c, terrain);
                    }
                }
            }

            this.addLog(`土地配置: (${String.fromCharCode(65+startC)}${startR+1}) に ${terrain.name} を配置。`);
            return { success: true };
        }

        checkConnectionBonus(r, c, terrain) {
            const neighbors = [
                [r-1, c], [r+1, c], [r, c-1], [r, c+1]
            ];
            
            const mult = 1;

            const bonusTable = {
                "GL0_DESERT":      { food: 0, wood: 0, mystic: 5 },
                "GL1_PLAINS":      { food: 5, wood: 0, mystic: 0 },
                "GL2_FOREST":      { food: 2, wood: 3, mystic: 0 },
                "GL3_DEEP_FOREST": { food: 0, wood: 3, mystic: 2 },
                "H2_DESERT":       { food: 0, wood: 3, mystic: 2 },
                "H2_HILL":         { food: 3, wood: 2, mystic: 0 },
                "H2_FOREST_HILL":  { food: 1, wood: 4, mystic: 0 },
                "H2_DEEP_HILL":    { food: 0, wood: 5, mystic: 2 },
                "H3_MOUNTAIN":     { food: 0, wood: 5, mystic: 2 }
            };

            const bonus = bonusTable[terrain.id] || { food: 2, wood: 2, mystic: 0 };

            for (let [nr, nc] of neighbors) {
                if (nr >= 0 && nr < 5 && nc >= 0 && nc < 5) {
                    const adjCell = this.grid[nr][nc];
                    if (adjCell.placed && !adjCell.isHQ && adjCell.terrain && adjCell.terrain.id === terrain.id) {
                        const earnedFood = bonus.food * mult;
                        const earnedWood = bonus.wood * mult;
                        const earnedMystic = bonus.mystic * mult;

                        this.food += earnedFood;
                        this.wood += earnedWood;
                        this.mystic += earnedMystic;

                        let textParts = [];
                        if (earnedFood > 0) textParts.push(`🌾+${earnedFood}`);
                        if (earnedWood > 0) textParts.push(`🧱+${earnedWood}`);
                        if (earnedMystic > 0) textParts.push(`✨+${earnedMystic}`);

                        const toastText = `⚡ 連結ボーナス! ${textParts.join(" ")}`;
                        this.addLog(`連結成立: ${terrain.name} ✕ 同種接続で ${toastText} 獲得!`);
                        this.toastQueue.push({ r, c, text: toastText });
                    }
                }
            }
        }

        // 🧩 4マス マージ合体判定 ＆ 単一ブロックID付与
        checkMergePatterns() {
            const size = 5;

            // 2x2 正方形マージ
            for (let r = 0; r < size - 1; r++) {
                for (let c = 0; c < size - 1; c++) {
                    const c1 = this.grid[r][c];
                    const c2 = this.grid[r][c+1];
                    const c3 = this.grid[r+1][c];
                    const c4 = this.grid[r+1][c+1];

                    const cells = [c1, c2, c3, c4];
                    const allPlaced = cells.every(cell => cell.placed && !cell.isHQ && !cell.merged);
                    if (allPlaced) {
                        const firstTerrainId = c1.terrain.id;
                        const sameTerrain = cells.every(cell => cell.terrain && cell.terrain.id === firstTerrainId);

                        if (sameTerrain) {
                            const groupId = `merge_${this.mergeGroupCounter++}`;
                            cells.forEach(cell => {
                                cell.merged = true;
                                cell.mergeGroupId = groupId;
                                cell.mergeType = "2x2";
                            });

                            this.ember = Math.min(20, this.ember + 1);
                            const tName = c1.terrain.name;
                            this.addLog(`🎉 2x2 マージ大土地完成! (${tName}) 持続産出1.2倍 ＆ 🔥+1 即時回復!`);
                            this.toastQueue.push({ r, c, text: `🎉 2x2大土地完成! 🔥+1` });
                        }
                    }
                }
            }
        }

        executeExploration(r, c) {
            const cell = this.grid[r][c];
            if (!cell.placed || cell.isHQ) return { success: false, reason: "未配置または本営マスは探索できません" };
            if (cell.searched) return { success: false, reason: "既に探索済みです" };
            if (cell.merged) return { success: false, reason: "マージ合体済みの土地は探索できません" };
            if (this.ember <= 1) return { success: false, reason: "🔥 生命力が不足しています" };

            this.ember -= 1;
            cell.searched = true;

            const d1 = Math.floor(Math.random() * 6) + 1;
            const d2 = Math.floor(Math.random() * 6) + 1;
            const totalRoll = d1 + d2;

            let resultMsg = "";
            if (totalRoll >= 9) {
                if (cell.hasSocket && !cell.socketResource) {
                    const socketDef = { name: "野麦 🌾+3/T", bonusFood: 3, bonusWood: 0 };
                    cell.socketResource = socketDef;
                    resultMsg = `🎲 出目${totalRoll}: ★ ${socketDef.name} 開花露出!`;
                    this.toastQueue.push({ r, c, text: `★ ${socketDef.name} 開花!` });
                } else {
                    this.food += 3;
                    this.wood += 3;
                    resultMsg = `🎲 出目${totalRoll}: 発掘成功! 🌾+3 🧱+3 即時獲得!`;
                    this.toastQueue.push({ r, c, text: "発掘! 🌾🧱+3" });
                }
            } else if (totalRoll >= 5) {
                this.food += 2;
                resultMsg = `🎲 出目${totalRoll}: 小規模成果 🌾+2 即時獲得`;
                this.toastQueue.push({ r, c, text: "成果 🌾+2" });
            } else {
                this.food += 1;
                resultMsg = `🎲 出目${totalRoll}: 控えめな成果 🌾+1`;
                this.toastQueue.push({ r, c, text: "成果 🌾+1" });
            }

            this.addLog(`探索判定: 位置(${String.fromCharCode(65+c)}${r+1}) ${resultMsg}`);
            return { success: true };
        }

        calculateTotalProduction() {
            let foodTiles = 0;
            let woodTiles = 0;
            let mysticTiles = 0;

            let foodSockets = 0;
            let woodSockets = 0;

            let foodVicinity = 0;
            let woodVicinity = 0;

            const groupSums = {};

            for (let r = 0; r < 5; r++) {
                for (let c = 0; c < 5; c++) {
                    const cell = this.grid[r][c];
                    if (cell.placed && !cell.isHQ && cell.terrain) {
                        const tf = cell.terrain.food || 0;
                        const tw = cell.terrain.wood || 0;
                        const tm = cell.terrain.mystic || 0;

                        if (cell.merged && cell.mergeGroupId) {
                            if (!groupSums[cell.mergeGroupId]) {
                                groupSums[cell.mergeGroupId] = { food: 0, wood: 0, mystic: 0, count: 0 };
                            }
                            groupSums[cell.mergeGroupId].food += tf;
                            groupSums[cell.mergeGroupId].wood += tw;
                            groupSums[cell.mergeGroupId].mystic += tm;
                            groupSums[cell.mergeGroupId].count += 1;
                        } else {
                            foodTiles += tf;
                            woodTiles += tw;
                            mysticTiles += tm;
                        }

                        if (cell.socketResource) {
                            foodSockets += cell.socketResource.bonusFood || 0;
                            woodSockets += cell.socketResource.bonusWood || 0;
                        }

                        if (this.isHQVicinity(r, c)) {
                            foodVicinity += 1;
                            woodVicinity += 1;
                        }
                    }
                }
            }

            for (let gId in groupSums) {
                const g = groupSums[gId];
                foodTiles += Math.ceil(g.food * 1.2);
                woodTiles += Math.ceil(g.wood * 1.2);
                mysticTiles += Math.ceil(g.mystic * 1.2);
            }

            const totalFood = 10 + foodTiles + foodSockets + foodVicinity;
            const totalWood = 10 + woodTiles + woodSockets + woodVicinity;
            const totalMystic = 1 + mysticTiles;

            return { totalFood, totalWood, totalMystic };
        }

        calculateTotalDefense() {
            let def = 10;
            for (let r = 0; r < 5; r++) {
                for (let c = 0; c < 5; c++) {
                    const cell = this.grid[r][c];
                    if (cell.placed && !cell.isHQ && cell.terrain) {
                        def += cell.terrain.defense || 0;
                    }
                }
            }
            return def;
        }

        getResourceBreakdown() {
            let foodTiles = 0;
            let woodTiles = 0;
            let foodSockets = 0;
            let woodSockets = 0;
            let foodVicinity = 0;
            let woodVicinity = 0;

            const groupSums = {};

            for (let r = 0; r < 5; r++) {
                for (let c = 0; c < 5; c++) {
                    const cell = this.grid[r][c];
                    if (cell.placed && !cell.isHQ && cell.terrain) {
                        const tf = cell.terrain.food || 0;
                        const tw = cell.terrain.wood || 0;

                        if (cell.merged && cell.mergeGroupId) {
                            if (!groupSums[cell.mergeGroupId]) {
                                groupSums[cell.mergeGroupId] = { food: 0, wood: 0 };
                            }
                            groupSums[cell.mergeGroupId].food += tf;
                            groupSums[cell.mergeGroupId].wood += tw;
                        } else {
                            foodTiles += tf;
                            woodTiles += tw;
                        }

                        if (cell.socketResource) {
                            foodSockets += cell.socketResource.bonusFood || 0;
                            woodSockets += cell.socketResource.bonusWood || 0;
                        }

                        if (this.isHQVicinity(r, c)) {
                            foodVicinity += 1;
                            woodVicinity += 1;
                        }
                    }
                }
            }

            for (let gId in groupSums) {
                const g = groupSums[gId];
                foodTiles += Math.ceil(g.food * 1.2);
                woodTiles += Math.ceil(g.wood * 1.2);
            }

            return {
                food: { total: 10 + foodTiles + foodSockets + foodVicinity, tiles: foodTiles, sockets: foodSockets, vicinity: foodVicinity },
                wood: { total: 10 + woodTiles + woodSockets + woodVicinity, tiles: woodTiles, sockets: woodSockets, vicinity: woodVicinity }
            };
        }

        getTrialNotice() {
            const nextTrialTurn = 15;
            const remaining = nextTrialTurn - this.turn;
            return {
                active: remaining <= 5 && remaining >= 0,
                remaining
            };
        }

        processTurnEndMaintenance() {
            const foodCost = 20;
            this.food -= foodCost;
            let isGameOver = false;

            if (this.food < 0) {
                const deficit = Math.abs(this.food);
                this.food = 0;
                this.ember -= 2;
                this.addLog(`⚠️ 食料不足ペナルティ! 食料維持費未払いで生命力 🔥 -2 ダメージ (残り火: ${this.ember})`);

                if (this.ember <= 0) {
                    this.ember = 0;
                    isGameOver = true;
                }
            }

            const isGameClear = (this.turn >= 50 && this.ember > 0);
            return { foodCost, isGameOver, isGameClear };
        }

        moveToReserve(cardIdx) {
            const card = this.handOffering[cardIdx];
            if (!card) return false;

            const emptyIdx = this.reserveSlots.findIndex(slot => slot === null);
            if (emptyIdx === -1) return false;

            this.reserveSlots[emptyIdx] = card;
            this.handOffering[cardIdx] = null;
            this.addLog(`保留登録: ${card.name} を保留スロット ${emptyIdx+1} へ移動。`);
            return true;
        }
    }

    class Step1DrawSystem {
        constructor(gameState) {
            this.state = gameState;
        }

        generateOfferingCards() {
            const candidates = [
                { id: "GL1_PLAINS", name: "草原", food: 4, wood: 0, defense: 0, weight: 0.320 },
                { id: "GL2_FOREST", name: "森", food: 2, wood: 2, defense: 2, weight: 0.224 },
                { id: "H2_HILL", name: "丘陵", food: 0, wood: 4, defense: 3, weight: 0.250 },
                { id: "H3_MOUNTAIN", name: "山岳", food: 0, wood: 5, defense: 5, mystic: 1, weight: 0.110 }
            ];

            const h2Count = this.state.countH2HillsOnBoard();
            const filtered = candidates.filter(c => {
                if (c.id === "H3_MOUNTAIN") {
                    return h2Count >= 3;
                }
                return true;
            });

            let totalW = filtered.reduce((acc, c) => acc + c.weight, 0);

            const pickedTerrainDefs = [];
            for (let i = 0; i < 3; i++) {
                let rand = Math.random() * totalW;
                let sum = 0;
                let chosen = filtered[0];

                for (let c of filtered) {
                    sum += c.weight;
                    if (rand <= sum) {
                        chosen = c;
                        break;
                    }
                }
                pickedTerrainDefs.push(chosen);
            }

            this.state.handOffering = pickedTerrainDefs.map((tDef, idx) => {
                const shapeRoll = Math.random();
                let shape = [[1]];
                if (shapeRoll >= 0.80) {
                    shape = Math.random() > 0.5 ? [[1, 1]] : [[1], [1]];
                }

                return {
                    id: `card_${this.state.turn}_${idx}`,
                    name: tDef.name,
                    terrain: tDef,
                    currentShape: shape
                };
            });
        }
    }

    function rotateShapeMatrix(matrix) {
        const rows = matrix.length;
        const cols = matrix[0].length;
        const rotated = [];
        for (let c = 0; c < cols; c++) {
            const newRow = [];
            for (let r = rows - 1; r >= 0; r--) {
                newRow.push(matrix[r][c]);
            }
            rotated.push(newRow);
        }
        return rotated;
    }

    exports.Step1Engine = {
        GameState,
        Step1DrawSystem,
        rotateShapeMatrix
    };

})(typeof exports !== 'undefined' ? exports : window);
