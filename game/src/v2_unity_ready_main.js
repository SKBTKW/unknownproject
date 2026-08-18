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
            this.mergedBlocks = {};
            this.mergeGroupCounter = 1;
            this.grantedConnectionPairs = new Set();

            this.defense = 0;
            this.mystic = 0;
            this.usedUniqueCards = [];
            this.handOfferingSize = 3;
            this.nextTrialDamageMitigation = 1.0;
            this.nextTrialMultiplier = 1.0;
            this.reserveFeeWaivedTurns = 0;
            this.activeConstructionProjects = [];
            this.permanentPlainsFoodBonus = 0;
            this.permanentVicinityDefenseBonus = 0;
            this.activeDrawBias = null;

            if (typeof window !== 'undefined' && window.DirectiveSystem) {
                this.directiveSystem = new window.DirectiveSystem(this);
            } else if (typeof DirectiveSystem !== 'undefined') {
                this.directiveSystem = new DirectiveSystem(this);
            } else {
                this.directiveSystem = null;
            }

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

            // 🎲 ソケット位置のランダム選定（本営(2,2)および直近周囲を除く外周候補から3マス抽出）
            const candidates = [];
            for (let r = 0; r < size; r++) {
                for (let c = 0; c < size; c++) {
                    const isHQ = (r === 2 && c === 2);
                    const isNearHQ = (Math.abs(r - 2) <= 1 && Math.abs(c - 2) <= 1);
                    if (!isHQ && !isNearHQ) {
                        candidates.push({ r, c });
                    }
                }
            }

            // Fisher-Yates シャッフル
            for (let i = candidates.length - 1; i > 0; i--) {
                const j = Math.floor(Math.random() * (i + 1));
                [candidates[i], candidates[j]] = [candidates[j], candidates[i]];
            }

            // 🚫 ソケット同士の隣接禁止ルール（縦・横・斜めで接しないマスを順次選定）
            const selectedSockets = [];
            for (let candidate of candidates) {
                if (selectedSockets.length >= 3) break;
                const isAdjacent = selectedSockets.some(s =>
                    Math.abs(s.r - candidate.r) <= 1 && Math.abs(s.c - candidate.c) <= 1
                );
                if (!isAdjacent) {
                    selectedSockets.push(candidate);
                }
            }

            for (let pos of selectedSockets) {
                grid[pos.r][pos.c].hasSocket = true;
            }

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

        getResourceBreakdown() {
            if (typeof window !== "undefined" && window.ProductionCalculator) {
                return window.ProductionCalculator.getResourceBreakdown(this);
            }
            return null;
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

            // 🛡️ 配置ロジック正常化: ブロックを構成する全マスのうち、いずれか1マスでも既存配置領域 (本営含む) と上下左右で接していれば配置許可
            let isAdjacent = false;
            for (let dr = 0; dr < rows; dr++) {
                for (let dc = 0; dc < cols; dc++) {
                    if (shapeMatrix[dr][dc] === 1) {
                        const r = startR + dr;
                        const c = startC + dc;
                        const neighbors = [
                            [r - 1, c], [r + 1, c], [r, c - 1], [r, c + 1]
                        ];
                        for (let [nr, nc] of neighbors) {
                            if (nr >= 0 && nr < size && nc >= 0 && nc < size) {
                                if (this.grid[nr][nc].placed) {
                                    isAdjacent = true;
                                    break;
                                }
                            }
                        }
                        if (isAdjacent) break;
                    }
                }
                if (isAdjacent) break;
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

                        cell.placementGroupId = pGroupId;

                        if (cell.hasSocket && !cell.socketResource) {
                            const baseTerrainId = terrain.terrainId || terrain.id;
                            const sysMaster = (typeof window !== "undefined" && window.LAND_SYSTEM_DATA && window.LAND_SYSTEM_DATA.sockets) ? window.LAND_SYSTEM_DATA.sockets : null;
                            
                            let spawnedSocket = null;
                            if (baseTerrainId === "GL0_DESERT") {
                                if (Math.random() < 0.25) {
                                    spawnedSocket = { nameKey: "SOCKET_DATES", bonusFood: 1, bonusWood: 0, bonusMystic: 0 };
                                }
                            } else if (sysMaster && sysMaster[baseTerrainId]) {
                                const candidates = sysMaster[baseTerrainId];
                                const chosen = candidates[Math.floor(Math.random() * candidates.length)];
                                spawnedSocket = {
                                    nameKey: chosen.nameKey,
                                    bonusFood: chosen.bonusYields.food || 0,
                                    bonusWood: chosen.bonusYields.wood || 0,
                                    bonusDefense: chosen.bonusYields.defense || 0,
                                    bonusMystic: chosen.bonusYields.mystic || 0
                                };
                            } else {
                                spawnedSocket = { nameKey: "SOCKET_WILD_WHEAT", bonusFood: 3, bonusWood: 0, bonusMystic: 0 };
                            }

                            if (spawnedSocket) {
                                cell.socketResource = spawnedSocket;
                                const posStr = `(${String.fromCharCode(65+c)}${r+1})`;
                                const sName = I18n.t(spawnedSocket.nameKey);
                                this.addLog(I18n.t("LOG_SOCKET_SPAWNED", { pos: posStr, terrainName, socketName: sName }));
                                this.toastQueue.push({ r, c, text: I18n.t("TOAST_SOCKET_SPAWNED", { name: sName }) });
                            }
                        }
                    }
                }
            }

            // ⚠️ 全セルの配置と placementGroupId の割当が完了した後に、隣接およびマージ判定を一括実行！
            for (let dr = 0; dr < rows; dr++) {
                for (let dc = 0; dc < cols; dc++) {
                    if (shapeMatrix[dr][dc] === 1) {
                        const r = startR + dr;
                        const c = startC + dc;
                        this.checkConnectionBonus(r, c, terrain);
                    }
                }
            }
            this.checkMergePatterns();

            this.ember = Math.max(0, this.ember - 1);
            this.hasPickedThisTurn = true;

            if (handIdx >= 0 && handIdx < this.handOffering.length && this.handOffering[handIdx]) {
                this.handOffering[handIdx] = { isBlank: true };
            }

            const posStr = `(${String.fromCharCode(65+startC)}${startR+1})`;
            
            let dimSuffix = "";
            if (rows > 1 || cols > 1) {
                const totalCells = activeCellCount;
                if (rows === 1 || cols === 1) {
                    dimSuffix = ` (1x${totalCells})`;
                } else {
                    dimSuffix = ` (${cols}x${rows})`;
                }
            }
            const logTerrainName = `${terrainName}${dimSuffix}`;

            this.addLog(I18n.t("LOG_LAND_PLACED", { pos: posStr, name: logTerrainName }));
            return { can: true, success: true };
        }

        checkConnectionBonus(r, c, terrain) {
            const baseTerrainId = terrain.terrainId || terrain.id;
            const terrainName = I18n.t(terrain.nameKey);
            const neighbors = [
                [r - 1, c], [r + 1, c], [r, c - 1], [r, c + 1]
            ];

            // 1x2 連結即時ボーナス (1マス基礎産出 x 0.80 切り捨て / rules/00_master_handover_specification.md 確定構造)
            const bonus1x2Table = {
                "GL0_DESERT":      { food: 0, wood: 0, mystic: 1 },
                "GL1_PLAINS":      { food: 3, wood: 0, mystic: 0 },
                "GL2_FOREST":      { food: 1, wood: 1, mystic: 0 },
                "GL3_DEEP_FOREST": { food: 0, wood: 2, mystic: 1 },
                "H2_DESERT":       { food: 0, wood: 1, mystic: 1 },
                "H2_DESERT_HILL":  { food: 0, wood: 1, mystic: 1 },
                "H2_HILL":         { food: 2, wood: 1, mystic: 0 },
                "H2_FOREST_HILL":  { food: 0, wood: 3, mystic: 0 },
                "H2_DEEP_HILL":    { food: 0, wood: 4, mystic: 1 },
                "H3_MOUNTAIN":     { food: 0, wood: 4, mystic: 1 }
            };

            // 1x3 直線連結即時ボーナス (1マス基礎産出 x 1.50 繰り上げ / rules/00_master_handover_specification.md 確定構造)
            const bonus1x3Table = {
                "GL0_DESERT":      { food: 0, wood: 0, mystic: 3 },
                "GL1_PLAINS":      { food: 6, wood: 0, mystic: 0 },
                "GL2_FOREST":      { food: 3, wood: 3, mystic: 0 },
                "GL3_DEEP_FOREST": { food: 0, wood: 5, mystic: 3 },
                "H2_DESERT":       { food: 0, wood: 3, mystic: 3 },
                "H2_DESERT_HILL":  { food: 0, wood: 3, mystic: 3 },
                "H2_HILL":         { food: 5, wood: 3, mystic: 0 },
                "H2_FOREST_HILL":  { food: 2, wood: 6, mystic: 0 },
                "H2_DEEP_HILL":    { food: 0, wood: 8, mystic: 3 },
                "H3_MOUNTAIN":     { food: 0, wood: 8, mystic: 3 }
            };

            // 1x3 連結判定 (直線または L字 の 3マス以上同属性連結)
            const isMatch = (nr, nc) => {
                if (nr < 0 || nr >= 5 || nc < 0 || nc >= 5) return false;
                const cell = this.grid[nr][nc];
                if (!cell.placed || cell.isHQ || !cell.terrain) return false;
                
                // 同一カード内のマス同士 (同じ placementGroupId) は自己連結から除外
                const currentCell = this.grid[r][c];
                if (currentCell.placementGroupId && cell.placementGroupId && currentCell.placementGroupId === cell.placementGroupId) {
                    return false;
                }

                const tid = cell.terrain.terrainId || cell.terrain.id;
                return tid === baseTerrainId;
            };

            const matchingNeighbors = neighbors.filter(([nr, nc]) => isMatch(nr, nc));

            // 直線判定 (水平・垂直 3連)
            let isLinear1x3 = (
                (isMatch(r, c - 1) && isMatch(r, c + 1)) ||
                (isMatch(r, c - 2) && isMatch(r, c - 1)) ||
                (isMatch(r, c + 1) && isMatch(r, c + 2)) ||
                (isMatch(r - 1, c) && isMatch(r + 1, c)) ||
                (isMatch(r - 2, c) && isMatch(r - 1, c)) ||
                (isMatch(r + 1, c) && isMatch(r + 2, c))
            );

            // 隣接セルに既存のマージグループがあるかチェック
            let hasExistingGroup = false;
            let existingGroupId = null;
            for (let [nr, nc] of matchingNeighbors) {
                const adjCell = this.grid[nr][nc];
                if (adjCell.mergeGroupId) {
                    hasExistingGroup = true;
                    existingGroupId = adjCell.mergeGroupId;
                    break;
                }
            }

            // 2つ以上の同属性隣接、または既存グループへの接続、または直線3連なら 1x3 連結
            let is1x3 = isLinear1x3 || matchingNeighbors.length >= 2 || hasExistingGroup;

            // 既に対象隣接セルとの間でボーナス付与済みかチェック
            let newPairFound = false;
            for (let [nr, nc] of matchingNeighbors) {
                const pairKey = [`${r},${c}`, `${nr},${nc}`].sort().join("_");
                if (!this.grantedConnectionPairs.has(pairKey)) {
                    newPairFound = true;
                    this.grantedConnectionPairs.add(pairKey);
                }
            }

            if (!newPairFound) {
                // すべての隣接セルと過去に接続ボーナス獲得済みの場合は重複加算・重複ログを完全にスキップ
                return;
            }

            const targetTable = is1x3 ? bonus1x3Table : bonus1x2Table;
            const bonus = targetTable[baseTerrainId] || targetTable[terrain.id] || (is1x3 ? { food: 3, wood: 3, mystic: 1 } : { food: 1, wood: 1, mystic: 0 });

            // 隣接判定チェックおよび融合グループ（mergeGroupId）統合アタッチ
            if (matchingNeighbors.length > 0) {
                const currentCell = this.grid[r][c];
                const groupId = existingGroupId || currentCell.mergeGroupId || `merge_${this.mergeGroupCounter++}`;

                currentCell.merged = true;
                currentCell.mergeGroupId = groupId;
                currentCell.mergeType = is1x3 ? "1x3" : "1x2";

                // 全隣接同属性セルのグループIDとマージフラグを統一・拡張
                for (let [nr, nc] of matchingNeighbors) {
                    const adjCell = this.grid[nr][nc];
                    adjCell.merged = true;
                    adjCell.mergeGroupId = groupId;
                    adjCell.mergeType = is1x3 ? "1x3" : "1x2";
                }

                // 統合ブロックオブジェクトの登録・更新
                if (!this.mergedBlocks[groupId]) {
                    this.mergedBlocks[groupId] = {
                        groupId: groupId,
                        terrainId: baseTerrainId,
                        nameKey: terrain.nameKey,
                        mergeType: is1x3 ? "1x3" : "1x2",
                        cells: [{ r, c }, ...matchingNeighbors.map(([nr, nc]) => ({ r: nr, c: nc }))],
                        yieldMultiplier: 1.0,
                        createdTurn: this.turn
                    };
                } else {
                    const blockObj = this.mergedBlocks[groupId];
                    blockObj.mergeType = is1x3 ? "1x3" : blockObj.mergeType;
                    if (!blockObj.cells.some(cell => cell.r === r && cell.c === c)) {
                        blockObj.cells.push({ r, c });
                    }
                }

                const earnedFood = bonus.food || 0;
                const earnedWood = bonus.wood || 0;
                const earnedMystic = bonus.mystic || 0;

                if (earnedFood > 0 || earnedWood > 0 || earnedMystic > 0) {
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

        checkMergePatterns() {
            const size = 5;

            for (let r = 0; r < size - 1; r++) {
                for (let c = 0; c < size - 1; c++) {
                    const c1 = this.grid[r][c];
                    const c2 = this.grid[r][c+1];
                    const c3 = this.grid[r+1][c];
                    const c4 = this.grid[r+1][c+1];

                    const cells = [c1, c2, c3, c4];
                    const allPlaced = cells.every(cell => cell.placed && !cell.isHQ && (!cell.merged || cell.mergeType !== "2x2"));
                    if (allPlaced) {
                        const firstBaseId = c1.terrain ? (c1.terrain.terrainId || c1.terrain.id) : null;
                        const sameTerrain = cells.every(cell => cell.terrain && (cell.terrain.terrainId || cell.terrain.id) === firstBaseId);

                        if (sameTerrain && firstBaseId) {
                            const groupId = `merge_${this.mergeGroupCounter++}`;
                            cells.forEach(cell => {
                                cell.merged = true;
                                cell.mergeGroupId = groupId;
                                cell.mergeType = "2x2";
                            });

                            this.mergedBlocks[groupId] = {
                                groupId: groupId,
                                terrainId: firstBaseId,
                                nameKey: c1.terrain.nameKey,
                                mergeType: "2x2",
                                cells: cells.map(cell => ({ r: cell.r, c: cell.c })),
                                yieldMultiplier: 1.20,
                                createdTurn: this.turn
                            };

                            // 地形属性に応じた即時ボーナス給付計算
                            const tid = firstBaseId.toUpperCase();
                            let bonusFood = 0, bonusWood = 0, bonusMystic = 0;

                            if (tid.includes("PLAINS")) {
                                bonusFood = 10;
                            } else if (tid.includes("HILL")) {
                                bonusWood = 8;
                                bonusFood = 4;
                            } else if (tid.includes("MOUNTAIN")) {
                                bonusWood = 10;
                                bonusMystic = 5;
                            } else {
                                bonusFood = 5;
                            }

                            this.food += bonusFood;
                            this.wood += bonusWood;
                            this.mystic += bonusMystic;
                            this.ember = Math.min(20, this.ember + 1);

                            let textParts = [];
                            if (bonusFood > 0) textParts.push(`🌾+${bonusFood}`);
                            if (bonusWood > 0) textParts.push(`🧱+${bonusWood}`);
                            if (bonusMystic > 0) textParts.push(`✨+${bonusMystic}`);
                            const bText = textParts.join(" ");

                            const tName = I18n.t(c1.terrain.nameKey);
                            const toastMsg = I18n.t("TOAST_MERGE_2X2", { text: bText });
                            this.addLog(I18n.t("LOG_MERGE_2X2_COMPLETE", { name: tName, bonus: bText }));
                            this.toastQueue.push({ r, c, text: toastMsg });
                        }
                    }
                }
            }
        }

        playCommandCard(cardObj, targetTile = null) {
            if (!cardObj || !cardObj.category || cardObj.category === "LAND") return { success: false, reason: "NOT_A_COMMAND_CARD" };

            // コストチェック
            const cost = cardObj.cost || {};
            if (cost.food && this.food < cost.food) return { success: false, reason: "NOT_ENOUGH_FOOD" };
            if (cost.wood && this.wood < cost.wood) return { success: false, reason: "NOT_ENOUGH_WOOD" };
            if (cost.mystic && this.mystic < cost.mystic) return { success: false, reason: "NOT_ENOUGH_MYSTIC" };

            // コスト消費
            if (cost.food) this.food -= cost.food;
            if (cost.wood) this.wood -= cost.wood;
            if (cost.mystic) this.mystic -= cost.mystic;

            const cId = cardObj.id;
            const cName = (typeof I18n !== "undefined" ? I18n.t(cardObj.nameKey) : null) || cardObj.id;

            if (cId === "CMD_AGRICULTURAL_POLICY") {
                this.wood += 20;
                this.permanentPlainsFoodBonus += 1;
                this.addLog(I18n.t("LOG_CMD_AGRICULTURAL_POLICY", { wood: 20 }) || `📜 ${cName}を発動！ 🧱+20 ＆ 全平地産出 🌾+1/T！`);
            } else if (cId === "CMD_BLACK_MARKET") {
                this.wood += 35;
                this.mystic += 10;
                this.addLog(I18n.t("LOG_CMD_BLACK_MARKET") || `📜 ${cName}を発動！ 🧱+35 ＆ ✨+10 を獲得！`);
            } else if (cId === "CMD_IRON_RAMPART") {
                this.defense += 25;
                this.permanentVicinityDefenseBonus += 2;
                this.addLog(I18n.t("LOG_CMD_IRON_RAMPART") || `🛡️ ${cName}を発動！ グローバル防衛力 🛡️+25 獲得！`);
            } else if (cId === "CMD_BALLISTA_SET") {
                this.defense += 40;
                this.nextTrialDamageMitigation = 0.5;
                this.addLog(I18n.t("LOG_CMD_BALLISTA_SET") || `🛡️ ${cName}を発動！ 🛡️+40 ＆ 次試練被ダメ50%軽減！`);
            } else if (cId === "CMD_REKINDLE_EMBER") {
                this.ember = Math.min(20, this.ember + 3);
                this.reserveFeeWaivedTurns = 3;
                this.addLog(I18n.t("LOG_CMD_REKINDLE_EMBER") || `✨ ${cName}を発動！ 残り火 🔥+3 回復 ＆ 保留費3T無料化！`);
            } else if (cId === "CMD_TRANSMUTE_GOLDEN") {
                if (targetTile && targetTile.r !== undefined && targetTile.c !== undefined) {
                    const cell = this.grid[targetTile.r][targetTile.c];
                    cell.socketResource = { nameKey: "SOCKET_SACRED_VEIN", bonusMystic: 5, bonusEmber: 1 };
                    this.addLog(I18n.t("LOG_CMD_TRANSMUTE_GOLDEN") || `✨ ${cName}を発動！ 土地を聖なる光脈 (✨+5 🔥+1/T) へ変容！`);
                } else {
                    this.mystic += 10;
                    this.addLog(I18n.t("LOG_CMD_TRANSMUTE_GOLDEN") || `✨ ${cName}を発動！ ✨+10 獲得！`);
                }
            } else if (cId === "FAC_GREAT_WINDMILL") {
                this.activeConstructionProjects.push({ name: "FAC_GREAT_WINDMILL", remainingTurns: 3, woodCostPerTurn: 4 });
                this.addLog(I18n.t("LOG_FAC_GREAT_WINDMILL") || `🏛️ ${cName}の建設を開始！ 3T継続投資へ`);
            } else if (cId === "LGD_DESPERATE_PACT") {
                this.ember = Math.min(20, this.ember + 5);
                this.handOfferingSize = 4;
                this.nextTrialMultiplier = 1.5;
                this.addLog(I18n.t("LOG_LGD_DESPERATE_PACT") || `📜 ${cName}を発動！ 🔥+5 ＆ 手札オファリング枠が永久に4枚へ拡張！`);
            } else if (cId === "CMD_LAND_FOCUS") {
                this.activeDrawBias = { targetCategory: "LAND", type: "UNTIL_BLOCKS", untilValue: 6 };
                this.addLog(I18n.t("LOG_CMD_LAND_FOCUS") || `📜 ${cName}を発動！ 盤面6ブロック到達まで土地出現率2倍！`);
            } else if (cId === "CMD_MILITARY_FOCUS") {
                this.activeDrawBias = { targetCategory: "MILITARY", type: "UNTIL_DEFENSE", untilValue: 20 };
                this.addLog(I18n.t("LOG_CMD_MILITARY_FOCUS") || `🛡️ ${cName}を発動！ 防衛力20到達まで軍事出現率2倍！`);
            } else if (cId === "CMD_MYSTIC_FOCUS") {
                this.activeDrawBias = { targetCategory: "MYSTIC", type: "TURNS", remainingTurns: 3 };
                this.addLog(I18n.t("LOG_CMD_MYSTIC_FOCUS") || `✨ ${cName}を発動！ 3ターンの間神秘出現率2倍！`);
            } else if (cId === "CMD_LAND_EXPLORATION") {
                // 探索対象マスの選定（配置済み・未探索・非HQ・非マージ）
                const candidates = [];
                for (let r = 0; r < 5; r++) {
                    for (let c = 0; c < 5; c++) {
                        const cell = this.grid[r][c];
                        if (cell.placed && !cell.isHQ && !cell.searched && !cell.merged) {
                            candidates.push({ r, c });
                        }
                    }
                }

                if (candidates.length === 0) {
                    return { success: false, reason: "NO_EXPLORABLE_TILES" };
                }

                // ランダムに対象マスを選定して 2D6 判定を発動
                const chosen = candidates[Math.floor(Math.random() * candidates.length)];
                this.addLog(`📜 ${cName}を発動！ コスト (🌾-30 🧱-30 🔥-1) を払い位置 (${String.fromCharCode(65+chosen.c)}${chosen.r+1}) で2D6探索を開始！`);
                const expRes = this.executeExploration(chosen.r, chosen.c);
                return { success: expRes.success };
            }

            if (cardObj.isUnique) {
                this.usedUniqueCards.push(cId);
            }

            this.hasPickedThisTurn = true;
            return { success: true };
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
                const isNearHQ = Math.abs(r - 2) <= 1 && Math.abs(c - 2) <= 1;
                if (!cell.socketResource && !isNearHQ) {
                    const baseTerrainId = cell.terrain ? (cell.terrain.terrainId || cell.terrain.id) : "GL1_PLAINS";
                    const sysMaster = (typeof window !== "undefined" && window.LAND_SYSTEM_DATA && window.LAND_SYSTEM_DATA.sockets) ? window.LAND_SYSTEM_DATA.sockets : null;
                    
                    let socketDef = null;
                    if (sysMaster && sysMaster[baseTerrainId]) {
                        const candidates = sysMaster[baseTerrainId];
                        const chosen = candidates[Math.floor(Math.random() * candidates.length)];
                        socketDef = {
                            nameKey: chosen.nameKey,
                            bonusFood: chosen.bonusYields.food || 0,
                            bonusWood: chosen.bonusYields.wood || 0,
                            bonusDefense: chosen.bonusYields.defense || 0,
                            bonusMystic: chosen.bonusYields.mystic || 0
                        };
                    } else {
                        socketDef = { nameKey: "SOCKET_WILD_WHEAT", bonusFood: 3, bonusWood: 0, bonusMystic: 0 };
                    }

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
            if (typeof window !== "undefined" && window.ProductionCalculator) {
                return window.ProductionCalculator.calculateTotalProduction(this);
            }
            return { totalFood: 10, totalWood: 10, totalMystic: 1 };
        }

        calculateTotalDefense() {
            if (typeof window !== "undefined" && window.ProductionCalculator) {
                return window.ProductionCalculator.calculateTotalDefense(this);
            }
            return 10;
        }

        getResourceBreakdown() {
            if (typeof window !== "undefined" && window.ProductionCalculator) {
                return window.ProductionCalculator.getResourceBreakdown(this);
            }
            return null;
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

            if (this.activeDrawBias && this.activeDrawBias.type === "TURNS") {
                this.activeDrawBias.remainingTurns -= 1;
                if (this.activeDrawBias.remainingTurns <= 0) {
                    this.activeDrawBias = null;
                }
            }

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

            // rules/09_card_list.md 仕様書完全準拠のフォールバックデータ
            this._landCardMasterCache = [
                { id: "CARD_PLAINS_1X1", terrainId: "GL1_PLAINS", nameKey: "TERRAIN_PLAINS", gl: 1, h: 1, yields: { food: 4, wood: 0, defense: 0, mystic: 0 }, shape: [[1]], minStage: 1, reqH2: 0, rarity: "C", weight: 1.0 },
                { id: "CARD_PLAINS_1X2", terrainId: "GL1_PLAINS", nameKey: "TERRAIN_PLAINS", gl: 1, h: 1, yields: { food: 4, wood: 0, defense: 0, mystic: 0 }, shape: [[1, 1]], minStage: 1, reqH2: 0, rarity: "C", weight: 0.8 },
                { id: "CARD_PLAINS_1X3_S", terrainId: "GL1_PLAINS", nameKey: "TERRAIN_PLAINS", gl: 1, h: 1, yields: { food: 4, wood: 0, defense: 0, mystic: 0 }, shape: [[1, 1, 1]], minStage: 2, reqH2: 0, rarity: "R", weight: 0.18 },
                { id: "CARD_PLAINS_1X3_L", terrainId: "GL1_PLAINS", nameKey: "TERRAIN_PLAINS", gl: 1, h: 1, yields: { food: 4, wood: 0, defense: 0, mystic: 0 }, shape: [[1, 0], [1, 1]], minStage: 2, reqH2: 0, rarity: "R", weight: 0.14 },
                { id: "CARD_FOREST_1X1", terrainId: "GL2_FOREST", nameKey: "TERRAIN_FOREST", gl: 2, h: 1, yields: { food: 2, wood: 2, defense: 2, mystic: 0 }, shape: [[1]], minStage: 1, reqH2: 0, rarity: "C", weight: 1.0 },
                { id: "CARD_FOREST_1X2", terrainId: "GL2_FOREST", nameKey: "TERRAIN_FOREST", gl: 2, h: 1, yields: { food: 2, wood: 2, defense: 2, mystic: 0 }, shape: [[1, 1]], minStage: 1, reqH2: 0, rarity: "UC", weight: 0.6 },
                { id: "CARD_DEEP_FOREST_1X1", terrainId: "GL3_DEEP_FOREST", nameKey: "TERRAIN_DEEP_FOREST", gl: 3, h: 1, yields: { food: 1, wood: 3, defense: 3, mystic: 1 }, shape: [[1]], minStage: 1, reqH2: 0, rarity: "R", weight: 0.15 },
                { id: "CARD_DEEP_FOREST_1X2", terrainId: "GL3_DEEP_FOREST", nameKey: "TERRAIN_DEEP_FOREST", gl: 3, h: 1, yields: { food: 1, wood: 3, defense: 3, mystic: 1 }, shape: [[1, 1]], minStage: 2, reqH2: 0, rarity: "R", weight: 0.05 },
                { id: "CARD_HILL_1X1", terrainId: "H2_HILL", nameKey: "TERRAIN_HILL", gl: 1, h: 2, yields: { food: 2, wood: 1, defense: 1, mystic: 0 }, shape: [[1]], minStage: 1, reqH2: 0, rarity: "UC", weight: 0.50 },
                { id: "CARD_HILL_1X2", terrainId: "H2_HILL", nameKey: "TERRAIN_HILL", gl: 1, h: 2, yields: { food: 2, wood: 1, defense: 1, mystic: 0 }, shape: [[1, 1]], minStage: 1, reqH2: 0, rarity: "UC", weight: 0.35 },
                { id: "CARD_HILL_1X3_L", terrainId: "H2_HILL", nameKey: "TERRAIN_HILL", gl: 1, h: 2, yields: { food: 2, wood: 1, defense: 1, mystic: 0 }, shape: [[1, 0], [1, 1]], minStage: 2, reqH2: 0, rarity: "R", weight: 0.12 },
                { id: "CARD_MOUNTAIN_1X1", terrainId: "H3_MOUNTAIN", nameKey: "TERRAIN_MOUNTAIN", gl: 2, h: 3, yields: { food: 0, wood: 3, defense: 5, mystic: 1 }, shape: [[1]], minStage: 2, reqH2: 3, rarity: "R", weight: 0.20 },
                { id: "CARD_MOUNTAIN_1X2", terrainId: "H3_MOUNTAIN", nameKey: "TERRAIN_MOUNTAIN", gl: 2, h: 3, yields: { food: 0, wood: 3, defense: 5, mystic: 1 }, shape: [[1, 1]], minStage: 2, reqH2: 3, rarity: "R", weight: 0.15 },
                { id: "CARD_MOUNTAIN_1X3_S", terrainId: "H3_MOUNTAIN", nameKey: "TERRAIN_MOUNTAIN", gl: 2, h: 3, yields: { food: 0, wood: 3, defense: 5, mystic: 1 }, shape: [[1, 1, 1]], minStage: 2, reqH2: 3, rarity: "R", weight: 0.03 },
                { id: "CARD_DESERT_1X1", terrainId: "GL0_DESERT", nameKey: "TERRAIN_DESERT", gl: 0, h: 1, yields: { food: 0, wood: 0, defense: 0, mystic: 5 }, shape: [[1]], minStage: 1, reqH2: 0, rarity: "R", weight: 0.15 },
                { id: "CARD_DESERT_1X2", terrainId: "GL0_DESERT", nameKey: "TERRAIN_DESERT", gl: 0, h: 1, yields: { food: 0, wood: 0, defense: 0, mystic: 5 }, shape: [[1, 1]], minStage: 2, reqH2: 0, rarity: "UR", weight: 0.03 },

                // コマンドカード 『土地探索』 (ドロー条件: 盤面にソケットが存在しない時)
                { id: "CMD_LAND_EXPLORATION", category: "COMMAND", nameKey: "CMD_LAND_EXPLORATION_NAME", descriptionKey: "CMD_LAND_EXPLORATION_DESC", cost: { food: 30, wood: 30, ember: 1 }, noSocketsOnBoard: true, minStage: 1, rarity: "R", weight: 0.40 }
            ];
            return this._landCardMasterCache;
        }

        isCardEligible(c, stageNum, h2Count) {
            if (stageNum < (c.minStage || 1)) return false;
            if (h2Count < (c.reqH2 || 0)) return false;

            if (!this.state) return (c.category === "LAND" || !c.category);

            // 盤面動的上限・ドロー提示条件チェック
            if (c.maxPlacedBlocks && typeof this.state.countPlacedTiles === 'function') {
                if (this.state.countPlacedTiles() > c.maxPlacedBlocks) return false;
            }
            if (c.maxDefense && typeof this.state.calculateTotalDefense === 'function') {
                if (this.state.calculateTotalDefense() > c.maxDefense) return false;
            }
            if (c.maxMystic && this.state.mystic > c.maxMystic) return false;
            if (c.maxEmber && this.state.ember > c.maxEmber) return false;

            // 盤面条件チェック
            if (c.reqPlains) {
                let plainsCount = 0;
                for (let r = 0; r < 5; r++) {
                    for (let cCol = 0; cCol < 5; cCol++) {
                        const cell = this.state.grid[r][cCol];
                        if (cell.placed && cell.terrain && (cell.terrain.terrainId || cell.terrain.id) === "GL1_PLAINS") plainsCount++;
                    }
                }
                if (plainsCount < c.reqPlains) return false;
            }

            if (c.reqHillOrMountain) {
                let countHM = 0;
                for (let r = 0; r < 5; r++) {
                    for (let cCol = 0; cCol < 5; cCol++) {
                        const cell = this.state.grid[r][cCol];
                        if (cell.placed && cell.terrain) {
                            const tid = cell.terrain.terrainId || cell.terrain.id;
                            if (tid === "H2_HILL" || tid === "H3_MOUNTAIN") countHM++;
                        }
                    }
                }
                if (countHM === 0) return false;
            }

            if (c.reqUnmergedDesertOrMountain) {
                let found = false;
                for (let r = 0; r < 5; r++) {
                    for (let cCol = 0; cCol < 5; cCol++) {
                        const cell = this.state.grid[r][cCol];
                        if (cell.placed && !cell.merged && cell.terrain) {
                            const tid = cell.terrain.terrainId || cell.terrain.id;
                            if (tid === "GL0_DESERT" || tid === "H3_MOUNTAIN") { found = true; break; }
                        }
                    }
                }
                if (!found) return false;
            }

            if (c.reqStage2End) {
                if (this.state.turn < 20) return false;
            }

            if (c.maxPlacedBlocks !== undefined && typeof this.state.countPlacedTiles === 'function') {
                if (this.state.countPlacedTiles() > c.maxPlacedBlocks) return false;
            }
            if (c.maxDefense !== undefined && typeof this.state.calculateTotalDefense === 'function') {
                if (this.state.calculateTotalDefense() > c.maxDefense) return false;
            }
            if (c.maxMystic !== undefined && this.state.mystic !== undefined) {
                if (this.state.mystic > c.maxMystic) return false;
            }

            if (c.noSocketsOnBoard) {
                let hasSocket = false;
                for (let r = 0; r < 5; r++) {
                    for (let cCol = 0; cCol < 5; cCol++) {
                        const cell = this.state.grid[r][cCol];
                        if (cell.socketResource) {
                            hasSocket = true;
                            break;
                        }
                    }
                    if (hasSocket) break;
                }
                if (hasSocket) return false;
            }

            // ユニーク重複チェック
            if (c.isUnique && this.state.usedUniqueCards && this.state.usedUniqueCards.includes(c.id)) {
                return false;
            }

            return true;
        }

        drawSingleCard() {
            const master = this.getLandCardMaster();
            const stageNum = (this.state && this.state.stage) ? (typeof this.state.stage === 'object' ? (this.state.stage.id || 1) : this.state.stage) : 1;
            const h2Count = (this.state && typeof this.state.countH2HillsOnBoard === 'function') ? this.state.countH2HillsOnBoard() : 0;

            let eligible = master.filter(c => this.isCardEligible(c, stageNum, h2Count));
            if (eligible.length === 0) eligible = master.filter(c => (c.category === "LAND" || !c.category) && (c.minStage || 1) <= stageNum);

            // 🎴 2段階カテゴリ抽選 ✕ 方針バイアス乗算
            let getCardWeight = (c) => {
                let baseW = c.weight || 0.1;
                let cat = c.category || "LAND";
                let dirMult = 1.0;
                if (this.state && this.state.directiveSystem) {
                    dirMult = this.state.directiveSystem.getCategoryWeightMultiplier(cat);
                }
                let biasMult = 1.0;
                if (this.state && this.state.activeDrawBias === cat) {
                    biasMult = 2.0;
                }
                return baseW * dirMult * biasMult;
            };

            let totalW = eligible.reduce((acc, c) => acc + getCardWeight(c), 0);
            let rand = Math.random() * totalW;
            let chosen = eligible[0];

            for (let c of eligible) {
                let w = getCardWeight(c);
                if (rand <= w) {
                    chosen = c;
                    break;
                }
                rand -= w;
            }
            if (!chosen) chosen = eligible[0] || master[0];

            return {
                id: `card_${(this.state && this.state.turn) || 1}_${Date.now()}_${Math.floor(Math.random()*1000)}`,
                cardMasterId: chosen.id,
                nameKey: chosen.nameKey,
                terrain: chosen,
                currentShape: chosen.shape || [[1]]
            };
        }

        generateOfferingCards() {
            const master = this.getLandCardMaster();
            let stageNum = 1;
            if (this.state && this.state.stage !== undefined) {
                if (typeof this.state.stage === 'number') stageNum = this.state.stage;
                else if (typeof this.state.stage === 'object' && this.state.stage !== null) stageNum = Number(this.state.stage.id || 1);
            }
            const h2Count = (this.state && typeof this.state.countH2HillsOnBoard === 'function') ? this.state.countH2HillsOnBoard() : 0;

            // バイアスの自動評価
            if (this.state && this.state.activeDrawBias) {
                const bias = this.state.activeDrawBias;
                let isActive = true;
                if (bias.type === "UNTIL_BLOCKS" && typeof this.state.countPlacedTiles === 'function') {
                    if (this.state.countPlacedTiles() >= bias.untilValue) isActive = false;
                } else if (bias.type === "UNTIL_DEFENSE" && typeof this.state.calculateTotalDefense === 'function') {
                    if (this.state.calculateTotalDefense() >= bias.untilValue) isActive = false;
                } else if (bias.type === "TURNS") {
                    if (bias.remainingTurns <= 0) isActive = false;
                }
                if (!isActive) this.state.activeDrawBias = null;
            }

            let eligible = master.filter(c => this.isCardEligible(c, stageNum, h2Count));
            if (eligible.length === 0) eligible = master.filter(c => (c.category === "LAND" || !c.category) && (c.minStage || 1) <= stageNum);

            const activeBiasCategory = (this.state && this.state.activeDrawBias) ? this.state.activeDrawBias.targetCategory : null;

            let totalW = eligible.reduce((acc, c) => {
                let w = c.weight || 0.1;
                const cat = c.category || "LAND";
                if (activeBiasCategory && cat === activeBiasCategory) {
                    w *= 2.0; // Boost weight by +100% for active draw bias
                }
                return acc + w;
            }, 0);

            const pickedCards = [];
            for (let i = 0; i < 3; i++) {
                let rand = Math.random() * totalW;
                let chosen = eligible[0];

                for (let c of eligible) {
                    let w = c.weight || 0.1;
                    const cat = c.category || "LAND";
                    if (activeBiasCategory && cat === activeBiasCategory) {
                        w *= 2.0;
                    }
                    if (rand <= w) {
                        chosen = c;
                        break;
                    }
                    rand -= w;
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
