// Trial of Ages : Last Ember Engine (V2 Unity-Ready Main Engine - AGENTS.md Rule 2 Spec 01 Synchronized)
(function(exports) {

    const I18n = (typeof window !== 'undefined' && window.I18n) ? window.I18n : { t: (k, p) => k };

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
            this.placementGroupCounter = 1;

            this.addLog(I18n.t("LOG_INIT_5X5"));
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
                        placementGroupId: null,
                        terrain: isHQ ? { id: "HQ", nameKey: "TERRAIN_HQ", food: 10, wood: 10, defense: 10, mystic: 1 } : null,
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
                        if (r < 0 || r >= size || c < 0 || c >= size) return { can: false, reason: "OUT_OF_BOUNDS" };
                        if (this.grid[r][c].placed) return { can: false, reason: "ALREADY_PLACED" };
                    }
                }
            }

            // 🛡️ 再発防止策: クリック始点セル (startR, startC) 自体が配置済みマス (本営含む) と上下左右4方向で直交接合しているか検証
            let isAdjacent = false;
            const startNeighbors = [
                [startR - 1, startC], [startR + 1, startC], [startR, startC - 1], [startR, startC + 1]
            ];
            for (let [nr, nc] of startNeighbors) {
                if (nr >= 0 && nr < size && nc >= 0 && nc < size) {
                    if (this.grid[nr][nc].placed) {
                        isAdjacent = true;
                        break;
                    }
                }
            }

            if (!isAdjacent) return { can: false, reason: "NOT_ADJACENT" };
            return { can: true };
        }

        placeShape(startR, startC, shapeMatrix, terrain, handIdx = -1) {
            if (this.hasPickedThisTurn) return { can: false, reason: "ALREADY_PICKED_THIS_TURN" };

            const check = this.canPlaceShape(startR, startC, shapeMatrix);
            if (!check.can) return check;

            const rows = shapeMatrix.length;
            const cols = shapeMatrix[0].length;
            const pGroupId = `place_${this.placementGroupCounter++}`;

            let activeCellCount = 0;
            for (let dr = 0; dr < rows; dr++) {
                for (let dc = 0; dc < cols; dc++) {
                    if (shapeMatrix[dr][dc] === 1) activeCellCount++;
                }
            }

            const terrainName = I18n.t(terrain.nameKey);

            for (let dr = 0; dr < rows; dr++) {
                for (let dc = 0; dc < cols; dc++) {
                    if (shapeMatrix[dr][dc] === 1) {
                        const r = startR + dr;
                        const c = startC + dc;
                        const cell = this.grid[r][c];
                        cell.placed = true;
                        cell.terrain = terrain;

                        if (activeCellCount > 1) {
                            cell.placementGroupId = pGroupId;
                        }

                        // ★ソケットマス上への土地配置時対応資源即時湧出
                        if (cell.hasSocket && !cell.socketResource) {
                            const socketMap = {
                                "GL1_PLAINS":      { nameKey: "SOCKET_WILD_WHEAT", bonusFood: 3, bonusWood: 0, bonusMystic: 0 },
                                "GL2_FOREST":      { nameKey: "SOCKET_APPLES", bonusFood: 3, bonusWood: 0, bonusMystic: 0 },
                                "H2_HILL":         { nameKey: "SOCKET_QUARRY", bonusFood: 0, bonusWood: 3, bonusMystic: 0 },
                                "H3_MOUNTAIN":     { nameKey: "SOCKET_IRON_DEPOSIT", bonusFood: 0, bonusWood: 2, bonusMystic: 1 },
                                "GL0_DESERT":      { nameKey: "SOCKET_DATES", bonusFood: 1, bonusWood: 0, bonusMystic: 0 }
                            };
                            const spawnedSocket = socketMap[terrain.id] || { nameKey: "SOCKET_WILD_WHEAT", bonusFood: 3, bonusWood: 0, bonusMystic: 0 };
                            cell.socketResource = spawnedSocket;

                            const posStr = `(${String.fromCharCode(65+c)}${r+1})`;
                            const sName = I18n.t(spawnedSocket.nameKey);
                            this.addLog(I18n.t("LOG_SOCKET_SPAWNED", { pos: posStr, terrainName, socketName: sName }));
                            this.toastQueue.push({ r, c, text: I18n.t("TOAST_SOCKET_SPAWNED", { name: sName }) });
                        }

                        this.checkConnectionBonus(r, c, terrain);
                    }
                }
            }

            // 🛡️ 再発防止策: コスト減算・手札消滅・配置ロックをエンジン内部で全自動完全一元化
            this.ember = Math.max(0, this.ember - 1);
            this.hasPickedThisTurn = true;

            if (handIdx >= 0 && handIdx < this.handOffering.length && this.handOffering[handIdx]) {
                this.handOffering[handIdx] = { isBlank: true };
            }

            const posStr = `(${String.fromCharCode(65+startC)}${startR+1})`;
            this.addLog(I18n.t("LOG_LAND_PLACED", { pos: posStr, name: terrainName }));
            return { can: true, success: true };
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
            const terrainName = I18n.t(terrain.nameKey);

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

                        const bText = textParts.join(" ");
                        const toastText = I18n.t("TOAST_CONNECTION_BONUS", { text: bText });
                        this.addLog(I18n.t("LOG_CONNECTION_BONUS", { name: terrainName, bonus: bText }));
                        this.toastQueue.push({ r, c, text: toastText });
                    }
                }
            }
        }

        checkMergePatterns() {
            const size = 5;

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
                            const tName = I18n.t(c1.terrain.nameKey);
                            this.addLog(I18n.t("LOG_MERGE_2X2_COMPLETE", { name: tName }));
                            this.toastQueue.push({ r, c, text: I18n.t("TOAST_MERGE_2X2") });
                        }
                    }
                }
            }
        }

        executeExploration(r, c) {
            const cell = this.grid[r][c];
            if (!cell.placed || cell.isHQ) return { success: false, reason: "INVALID_CELL" };
            if (cell.searched) return { success: false, reason: "ALREADY_SEARCHED" };
            if (cell.merged) return { success: false, reason: "MERGED_CELL" };
            if (this.ember <= 1) return { success: false, reason: "LOW_EMBER" };

            this.ember -= 1;
            cell.searched = true;

            const d1 = Math.floor(Math.random() * 6) + 1;
            const d2 = Math.floor(Math.random() * 6) + 1;
            const totalRoll = d1 + d2;
            const posStr = `(${String.fromCharCode(65+c)}${r+1})`;

            let resultMsg = "";
            if (totalRoll >= 9) {
                if (!cell.socketResource) {
                    const socketDef = { nameKey: "SOCKET_WILD_WHEAT", bonusFood: 3, bonusWood: 0, bonusMystic: 0 };
                    cell.socketResource = socketDef;
                    const sName = I18n.t(socketDef.nameKey);
                    resultMsg = `🎲 Roll ${totalRoll}: ★ ${sName}`;
                    this.toastQueue.push({ r, c, text: I18n.t("TOAST_SOCKET_SPAWNED", { name: sName }) });
                } else {
                    this.food += 3;
                    this.wood += 3;
                    resultMsg = `🎲 Roll ${totalRoll}: Success 🌾+3 🧱+3`;
                    this.toastQueue.push({ r, c, text: I18n.t("TOAST_EXPLORATION_SUCCESS") });
                }
            } else if (totalRoll >= 5) {
                this.food += 2;
                resultMsg = `🎲 Roll ${totalRoll}: Result 🌾+2`;
                this.toastQueue.push({ r, c, text: I18n.t("TOAST_EXPLORATION_MED") });
            } else {
                this.food += 1;
                resultMsg = `🎲 Roll ${totalRoll}: Result 🌾+1`;
                this.toastQueue.push({ r, c, text: I18n.t("TOAST_EXPLORATION_LOW") });
            }

            this.addLog(I18n.t("LOG_EXPLORATION_RESULT", { pos: posStr, result: resultMsg }));
            return { success: true };
        }

        calculateTotalProduction() {
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
                            mysticSockets += cell.socketResource.bonusMystic || 0;
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
            const totalMystic = 1 + mysticTiles + mysticSockets;

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
                this.addLog(I18n.t("LOG_FOOD_DEFICIT_PENALTY", { ember: this.ember }));

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
            if (!card || card.isBlank) return false;

            const emptyIdx = this.reserveSlots.findIndex(slot => slot === null);
            if (emptyIdx === -1) return false;

            card.originalHandIdx = cardIdx;
            this.reserveSlots[emptyIdx] = card;

            // 手札の抜け部分はカード裏表示 (isBlank: true)
            this.handOffering[cardIdx] = {
                isBlank: true,
                originalCard: card,
                id: `blank_${cardIdx}`
            };

            const cName = I18n.t(card.terrain.nameKey);
            this.addLog(I18n.t("LOG_RESERVE_ADDED", { name: cName, slot: emptyIdx + 1 }));
            return true;
        }

        returnFromReserve(reserveIdx) {
            const card = this.reserveSlots[reserveIdx];
            if (!card) return false;

            const origIdx = card.originalHandIdx;
            if (origIdx !== undefined && this.handOffering[origIdx] && this.handOffering[origIdx].isBlank) {
                this.handOffering[origIdx] = card;
                delete card.originalHandIdx;
                this.reserveSlots[reserveIdx] = null;
                const cName = I18n.t(card.terrain.nameKey);
                this.addLog(I18n.t("LOG_RESERVE_RETURNED", { name: cName }));
                return true;
            }
            return false;
        }
    }

    class Step1DrawSystem {
        constructor(gameState) {
            this.state = gameState;
        }

        // 🎴 Single Source of Truth: game/src/data/land_cards.json マスターデータベース直参照
        // Spec 01 verification patterns:
        // id: "GL1_PLAINS", food: 4, wood: 0, defense: 0, mystic: 0
        // id: "GL2_FOREST", food: 2, wood: 2, defense: 2, mystic: 0
        // id: "H2_HILL", food: 2, wood: 1, defense: 1, mystic: 0
        // id: "H3_MOUNTAIN", food: 0, wood: 3, defense: 5, mystic: 1
        getLandCardMaster() {
            if (this._landCardMasterCache && this._landCardMasterCache.length > 0) {
                return this._landCardMasterCache;
            }
            if (typeof window !== "undefined" && Array.isArray(window.LAND_CARDS_DATA) && window.LAND_CARDS_DATA.length > 0) {
                this._landCardMasterCache = window.LAND_CARDS_DATA;
                return this._landCardMasterCache;
            }

            // デフォルトフォールバック (100% クラッシュゼロ保証)
            this._landCardMasterCache = [
                { id: "CARD_PLAINS_1X1", terrainId: "GL1_PLAINS", nameKey: "TERRAIN_PLAINS", gl: 1, h: 1, food: 4, wood: 0, def: 0, mystic: 0, shape: [[1]], minStage: 1, reqH2: 0, rarity: "C", weight: 0.80 },
                { id: "CARD_PLAINS_1X2", terrainId: "GL1_PLAINS", nameKey: "TERRAIN_PLAINS", gl: 1, h: 1, food: 4, wood: 0, def: 0, mystic: 0, shape: [[1, 1]], minStage: 1, reqH2: 0, rarity: "C", weight: 0.20 },
                { id: "CARD_PLAINS_1X3_L", terrainId: "GL1_PLAINS", nameKey: "TERRAIN_PLAINS", gl: 1, h: 1, food: 4, wood: 0, def: 0, mystic: 0, shape: [[1, 0], [1, 1]], minStage: 2, reqH2: 0, rarity: "UC", weight: 0.05 },
                { id: "CARD_PLAINS_1X3_S", terrainId: "GL1_PLAINS", nameKey: "TERRAIN_PLAINS", gl: 1, h: 1, food: 4, wood: 0, def: 0, mystic: 0, shape: [[1, 1, 1]], minStage: 2, reqH2: 0, rarity: "UC", weight: 0.05 },
                { id: "CARD_PLAINS_1X4_T", terrainId: "GL1_PLAINS", nameKey: "TERRAIN_PLAINS", gl: 1, h: 1, food: 4, wood: 0, def: 0, mystic: 0, shape: [[0, 1, 0], [1, 1, 1]], minStage: 3, reqH2: 0, rarity: "R", weight: 0.02 },
                { id: "CARD_PLAINS_1X4_L", terrainId: "GL1_PLAINS", nameKey: "TERRAIN_PLAINS", gl: 1, h: 1, food: 4, wood: 0, def: 0, mystic: 0, shape: [[1, 0, 0], [1, 1, 1]], minStage: 3, reqH2: 0, rarity: "R", weight: 0.02 },
                { id: "CARD_PLAINS_2X2", terrainId: "GL1_PLAINS", nameKey: "TERRAIN_PLAINS", gl: 1, h: 1, food: 4, wood: 0, def: 0, mystic: 0, shape: [[1, 1], [1, 1]], minStage: 3, reqH2: 0, rarity: "UR", weight: 0.02 },
                { id: "CARD_PLAINS_1X4_Z", terrainId: "GL1_PLAINS", nameKey: "TERRAIN_PLAINS", gl: 1, h: 1, food: 4, wood: 0, def: 0, mystic: 0, shape: [[0, 1, 1], [1, 1, 0]], minStage: 3, reqH2: 0, rarity: "R", weight: 0.02 },
                { id: "CARD_PLAINS_1X4_S", terrainId: "GL1_PLAINS", nameKey: "TERRAIN_PLAINS", gl: 1, h: 1, food: 4, wood: 0, def: 0, mystic: 0, shape: [[1, 1, 1, 1]], minStage: 3, reqH2: 0, rarity: "R", weight: 0.02 },
                { id: "CARD_FOREST_1X1", terrainId: "GL2_FOREST", nameKey: "TERRAIN_FOREST", gl: 2, h: 1, food: 2, wood: 2, def: 2, mystic: 0, shape: [[1]], minStage: 1, reqH2: 0, rarity: "C", weight: 0.70 },
                { id: "CARD_FOREST_1X2", terrainId: "GL2_FOREST", nameKey: "TERRAIN_FOREST", gl: 2, h: 1, food: 2, wood: 2, def: 2, mystic: 0, shape: [[1, 1]], minStage: 1, reqH2: 0, rarity: "UC", weight: 0.30 },
                { id: "CARD_DEEP_FOREST_1X1", terrainId: "GL3_DEEP_FOREST", nameKey: "TERRAIN_DEEP_FOREST", gl: 3, h: 1, food: 1, wood: 3, def: 3, mystic: 1, shape: [[1]], minStage: 1, reqH2: 0, rarity: "R", weight: 0.07 },
                { id: "CARD_DEEP_FOREST_1X2", terrainId: "GL3_DEEP_FOREST", nameKey: "TERRAIN_DEEP_FOREST", gl: 3, h: 1, food: 1, wood: 3, def: 3, mystic: 1, shape: [[1, 1]], minStage: 1, reqH2: 0, rarity: "R", weight: 0.03 },
                { id: "CARD_HILL_1X2", terrainId: "H2_HILL", nameKey: "TERRAIN_HILL", gl: 1, h: 2, food: 2, wood: 1, def: 1, mystic: 0, shape: [[1, 1]], minStage: 1, reqH2: 0, rarity: "UC", weight: 0.60 },
                { id: "CARD_HILL_1X3_L", terrainId: "H2_HILL", nameKey: "TERRAIN_HILL", gl: 1, h: 2, food: 2, wood: 1, def: 1, mystic: 0, shape: [[1, 0], [1, 1]], minStage: 1, reqH2: 0, rarity: "UC", weight: 0.30 },
                { id: "CARD_HILL_1X4_L", terrainId: "H2_HILL", nameKey: "TERRAIN_HILL", gl: 1, h: 2, food: 2, wood: 1, def: 1, mystic: 0, shape: [[1, 0, 0], [1, 1, 1]], minStage: 1, reqH2: 0, rarity: "R", weight: 0.10 },
                { id: "CARD_MOUNTAIN_1X3_S", terrainId: "H3_MOUNTAIN", nameKey: "TERRAIN_MOUNTAIN", gl: 2, h: 3, food: 0, wood: 3, def: 5, mystic: 1, shape: [[1, 1, 1]], minStage: 1, reqH2: 3, rarity: "UC", weight: 0.60 },
                { id: "CARD_MOUNTAIN_1X4_T", terrainId: "H3_MOUNTAIN", nameKey: "TERRAIN_MOUNTAIN", gl: 2, h: 3, food: 0, wood: 3, def: 5, mystic: 1, shape: [[0, 1, 0], [1, 1, 1]], minStage: 1, reqH2: 3, rarity: "R", weight: 0.30 },
                { id: "CARD_MOUNTAIN_1X4_S", terrainId: "H3_MOUNTAIN", nameKey: "TERRAIN_MOUNTAIN", gl: 2, h: 3, food: 0, wood: 3, def: 5, mystic: 1, shape: [[1, 1, 1, 1]], minStage: 1, reqH2: 3, rarity: "R", weight: 0.10 },
                { id: "CARD_DESERT_1X1", terrainId: "GL0_DESERT", nameKey: "TERRAIN_DESERT", gl: 0, h: 1, food: 0, wood: 0, def: 0, mystic: 5, shape: [[1]], minStage: 1, reqH2: 0, rarity: "R", weight: 0.70 },
                { id: "CARD_DESERT_1X2", terrainId: "GL0_DESERT", nameKey: "TERRAIN_DESERT", gl: 0, h: 1, food: 0, wood: 0, def: 0, mystic: 5, shape: [[1, 1]], minStage: 1, reqH2: 0, rarity: "UR", weight: 0.30 },
                { id: "CARD_DESERT_HILL_1X2", terrainId: "H2_DESERT_HILL", nameKey: "TERRAIN_DESERT_HILL", gl: 0, h: 2, food: 0, wood: 1, def: 1, mystic: 2, shape: [[1, 1]], minStage: 1, reqH2: 0, rarity: "R", weight: 0.15 },
                { id: "CARD_FOREST_HILL_1X2", terrainId: "H2_FOREST_HILL", nameKey: "TERRAIN_FOREST_HILL", gl: 2, h: 2, food: 1, wood: 4, def: 4, mystic: 0, shape: [[1, 1]], minStage: 1, reqH2: 0, rarity: "R", weight: 0.15 },
                { id: "CARD_DEEP_HILL_1X2", terrainId: "H2_DEEP_HILL", nameKey: "TERRAIN_DEEP_HILL", gl: 3, h: 2, food: 1, wood: 5, def: 6, mystic: 1, shape: [[1, 1]], minStage: 1, reqH2: 0, rarity: "UR", weight: 0.05 }
            ];
            return this._landCardMasterCache;
        }

        drawSingleCard() {
            const master = this.getLandCardMaster();
            const stage = (this.state && this.state.stage) ? (typeof this.state.stage === 'object' ? (this.state.stage.id || 1) : this.state.stage) : 1;
            const h2Count = (this.state && typeof this.state.countH2HillsOnBoard === 'function') ? this.state.countH2HillsOnBoard() : 0;

            let eligible = master.filter(c => stage >= (c.minStage || 1) && h2Count >= (c.reqH2 || 0));
            if (eligible.length === 0) eligible = master.filter(c => (c.reqH2 || 0) === 0);

            let totalW = eligible.reduce((acc, c) => acc + (c.weight || 0.1), 0);
            let rand = Math.random() * totalW;
            let chosen = eligible[0];

            for (let c of eligible) {
                if (rand <= c.weight) {
                    chosen = c;
                    break;
                }
                rand -= c.weight;
            }
            if (!chosen) chosen = eligible[0] || master[0];

            return {
                id: `card_${(this.state && this.state.turn) || 1}_${Date.now()}_${Math.floor(Math.random()*1000)}`,
                cardMasterId: chosen.id,
                nameKey: chosen.nameKey,
                terrain: chosen,
                currentShape: chosen.shape
            };
        }

        generateOfferingCards() {
            const master = this.getLandCardMaster();
            const stage = (this.state && this.state.stage) ? (typeof this.state.stage === 'object' ? (this.state.stage.id || 1) : this.state.stage) : 1;
            const h2Count = (this.state && typeof this.state.countH2HillsOnBoard === 'function') ? this.state.countH2HillsOnBoard() : 0;

            let eligible = master.filter(c => stage >= (c.minStage || 1) && h2Count >= (c.reqH2 || 0));
            if (eligible.length === 0) eligible = master.filter(c => (c.reqH2 || 0) === 0);

            let totalW = eligible.reduce((acc, c) => acc + (c.weight || 0.1), 0);

            const pickedCards = [];
            for (let i = 0; i < 3; i++) {
                let rand = Math.random() * totalW;
                let chosen = eligible[0];

                for (let c of eligible) {
                    if (rand <= c.weight) {
                        chosen = c;
                        break;
                    }
                    rand -= c.weight;
                }
                if (!chosen) chosen = eligible[0] || master[0];
                pickedCards.push(chosen);
            }

            if (this.state) {
                this.state.handOffering = pickedCards.map((c, idx) => ({
                    id: `card_${this.state.turn}_${idx}_${Date.now()}`,
                    cardMasterId: c ? c.id : "CARD_PLAINS_1X1",
                    nameKey: c ? c.nameKey : "TERRAIN_PLAINS",
                    terrain: c || master[0],
                    currentShape: c ? c.shape : [[1]]
                }));
            }
            if (typeof this.render === "function") {
                this.render();
            }
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

    if (typeof window !== 'undefined') {
        window.GameState = GameState;
        window.Step1DrawSystem = Step1DrawSystem;
        window.GameEngine = Step1DrawSystem;
        window.rotateShapeMatrix = rotateShapeMatrix;
    }

    exports.Step1Engine = {
        GameState,
        Step1DrawSystem,
        GameEngine: Step1DrawSystem,
        rotateShapeMatrix
    };

})(typeof exports !== 'undefined' ? exports : (typeof window !== 'undefined' ? window : this));
