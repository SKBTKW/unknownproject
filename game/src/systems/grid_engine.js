/* =============================================================
   game/src/systems/grid_engine.js
   盤面初期化・ソケット配置・配置検証・マージ判定専用独立ドメインモジュール
   ============================================================= */

class GridEngine {
    constructor(gameState, engine = null) {
        this.state = gameState;
        this.engine = engine;
    }

    /**
     * 🌐 盤面グリッド初期化（本営中央配置 ＆ ソケット非隣接ランダム配置）
     * @param {number} size - グリッドサイズ（デフォルト 5）
     * @returns {Array<Array<Object>>}
     */
    initGrid(size = 5) {
        const grid = [];
        const center = Math.floor(size / 2); // 5x5 の場合は (2, 2)

        for (let r = 0; r < size; r++) {
            const row = [];
            for (let c = 0; c < size; c++) {
                const isHQ = (r === center && c === center);
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
                    socketResource: null,
                    cachedSocketSeeds: {}
                });
            }
            grid.push(row);
        }

        // 🎲 ソケット位置のランダム選定（本営および直近周囲を除く外周候補から3マス抽出）
        const candidates = [];
        for (let r = 0; r < size; r++) {
            for (let c = 0; c < size; c++) {
                const isHQ = (r === center && c === center);
                const isNearHQ = (Math.abs(r - center) <= 1 && Math.abs(c - center) <= 1);
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

    /**
     * 🏰 本営近郊判定（本営周囲8マス・可変グリッド対応）
     */
    isHQVicinity(r, c) {
        if (!this.state || !this.state.grid) return false;
        const size = this.state.grid.length;
        const center = Math.floor(size / 2);
        if (r === center && c === center) return false;
        return Math.abs(r - center) <= 1 && Math.abs(c - center) <= 1;
    }

    /**
     * 📊 盤面上の配置済み土地数集計（本営除く・可変グリッド対応）
     */
    countPlacedTiles() {
        if (!this.state || !this.state.grid) return 0;
        const size = this.state.grid.length;
        let count = 0;
        for (let r = 0; r < size; r++) {
            for (let c = 0; c < size; c++) {
                const cell = this.state.grid[r][c];
                if (cell && cell.placed && !cell.isHQ) count++;
            }
        }
        return count;
    }

    /**
     * ⛰️ 盤面上の丘陵 (E2_HILL) 数集計（可変グリッド対応）
     */
    countE2HillsOnBoard() {
        if (!this.state || !this.state.grid) return 0;
        const size = this.state.grid.length;
        let count = 0;
        for (let r = 0; r < size; r++) {
            for (let c = 0; c < size; c++) {
                const cell = this.state.grid[r][c];
                if (cell && cell.placed && cell.terrain && cell.terrain.id === "E2_HILL") {
                    count++;
                }
            }
        }
        return count;
    }

    /**
     * 🗺️ 盤面拡張（5x5 ➔ 7x7 ➔ 9x9）
     * 既存の配置状態（本営・配置済み土地・ソケット）を中心へ保持したまま外周を均等拡大
     * @param {number} newSize - 拡張後の盤面サイズ（7 または 9）
     * @returns {Array<Array<Object>>}
     */
    expandGrid(newSize = 7) {
        if (!this.state || !this.state.grid) {
            return this.initGrid(newSize);
        }
        const oldGrid = this.state.grid;
        const oldSize = oldGrid.length;
        if (newSize <= oldSize) return oldGrid;

        const offset = Math.floor((newSize - oldSize) / 2); // 5x5 -> 7x7 の場合 offset = 1
        const newGrid = [];
        const newCenter = Math.floor(newSize / 2);

        for (let r = 0; r < newSize; r++) {
            const row = [];
            for (let c = 0; c < newSize; c++) {
                const oldR = r - offset;
                const oldC = c - offset;
                if (oldR >= 0 && oldR < oldSize && oldC >= 0 && oldC < oldSize) {
                    const oldCell = oldGrid[oldR][oldC];
                    row.push({
                        ...oldCell,
                        r, c
                    });
                } else {
                    // 新設外周マス（未配置・ソケットなし）
                    row.push({
                        r, c,
                        placed: false,
                        isHQ: false,
                        merged: false,
                        mergeGroupId: null,
                        mergeType: null,
                        placementGroupId: null,
                        terrain: null,
                        searched: false,
                        hasSocket: false,
                        socketResource: null
                    });
                }
            }
            newGrid.push(row);
        }

        this.state.grid = newGrid;
        return newGrid;
    }

    /**
     * 🔍 形状配置可否チェック（地勢レベルGL隣接制限: GL0砂漠 と GL2+森林/山岳の直接隣接禁止）
     * @param {number} startR - 配置開始行
     * @param {number} startC - 配置開始列
     * @param {Array<Array<number>>} shapeMatrix - 形状マトリクス
     * @param {Object} [terrain] - 配置対象の地勢データ (GL判定用)
     * @returns {{ can: boolean, reason?: string }}
     */
    canPlaceShape(startR, startC, shapeMatrix, terrain = null) {
        if (!this.state || !this.state.grid) return { can: false, reason: "NO_GRID" };

        const rows = shapeMatrix.length;
        const cols = shapeMatrix[0].length;
        const size = (this.state.stage && this.state.stage.size) ? this.state.stage.size : 5;

        const targetGL = terrain ? (terrain.gl !== undefined ? terrain.gl : (terrain.terrain ? terrain.terrain.gl : null)) : null;
        const targetE = terrain ? (terrain.e !== undefined ? terrain.e : (terrain.terrain ? terrain.terrain.e : 1)) : null;

        // 1. 盤外および既配置マスとの重複判定
        for (let dr = 0; dr < rows; dr++) {
            for (let dc = 0; dc < cols; dc++) {
                if (shapeMatrix[dr][dc] === 1) {
                    const r = startR + dr;
                    const c = startC + dc;
                    if (r < 0 || r >= size || c < 0 || c >= size) return { can: false, reason: "OUT_OF_BOUNDS" };
                    if (this.state.grid[r][c].placed) return { can: false, reason: "ALREADY_PLACED" };
                }
            }
        }

        // 2. 隣接接続判定 ＆ 地勢レベル(GL) / 標高(E) 不適合チェック
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
                            const neighborCell = this.state.grid[nr][nc];
                            if (neighborCell.placed) {
                                isAdjacent = true;

                                if (!neighborCell.isHQ && neighborCell.terrain) {
                                    // 🛡️ 気候断絶ルール: 砂漠(GL0) と 森林/深林/山岳(GL2以上) は直接隣接不可 (本営HQは全地勢接続可能)
                                    if (targetGL !== null) {
                                        const placedGL = neighborCell.terrain.gl !== undefined ? neighborCell.terrain.gl : 1;
                                        if ((targetGL === 0 && placedGL >= 2) || (targetGL >= 2 && placedGL === 0)) {
                                            return { can: false, reason: "INVALID_GL_NEIGHBOR" };
                                        }
                                    }

                                    // ⛰️ 高度断絶ルール (断崖): 標高 E1 (平地/森/砂漠) と 標高 E3 (山岳/霊峰) は直接隣接不可 (|E差| >= 2 は禁止)
                                    if (targetE !== null) {
                                        const placedE = neighborCell.terrain.e !== undefined ? neighborCell.terrain.e : 1;
                                        if (Math.abs(targetE - placedE) >= 2) {
                                            return { can: false, reason: "INVALID_ELEVATION_NEIGHBOR" };
                                        }
                                    }
                                }
                            }
                        }
                    }
                }
            }
        }

        if (!isAdjacent) return { can: false, reason: "NOT_ADJACENT" };
        return { can: true };
    }

    /**
     * 🧩 土地ブロックの配置実行
     */
    placeShape(startR, startC, shapeMatrix, terrain, handIdx = -1) {
        if (!this.state) return { can: false, reason: "NO_STATE" };
        if (this.state.hasPickedThisTurn) return { can: false, reason: "ALREADY_PICKED_THIS_TURN" };

        const check = this.canPlaceShape(startR, startC, shapeMatrix, terrain);
        if (!check.can) return check;

        const rows = shapeMatrix.length;
        const cols = shapeMatrix[0].length;
        const pGroupId = `place_${this.state.placementGroupCounter++}`;

        let activeCellCount = 0;
        for (let dr = 0; dr < rows; dr++) {
            for (let dc = 0; dc < cols; dc++) {
                if (shapeMatrix[dr][dc] === 1) activeCellCount++;
            }
        }

        const I18n = (typeof globalThis !== 'undefined' && globalThis.I18n) ? globalThis.I18n : (typeof window !== 'undefined' && window.I18n ? window.I18n : { t: k => k });
        const terrainName = I18n.t((terrain && (terrain.nameKey || terrain.id)) || "TERRAIN_PLAINS");

        for (let dr = 0; dr < rows; dr++) {
            for (let dc = 0; dc < cols; dc++) {
                if (shapeMatrix[dr][dc] === 1) {
                    const r = startR + dr;
                    const c = startC + dc;
                    const cell = this.state.grid[r][c];
                    cell.placed = true;
                    cell.terrain = terrain;
                    cell.placementGroupId = pGroupId;
                    cell.isHQVicinity = (Math.abs(r - 2) <= 1 && Math.abs(c - 2) <= 1 && !(r === 2 && c === 2));

                    // ★ ソケット開花判定 (決定論的固定化: アンドゥリセマラを完全根絶)
                    if (cell.hasSocket && !cell.socketResource) {
                        const baseTerrainId = terrain.terrainId || terrain.id;
                        const is1x1 = (rows === 1 && cols === 1 && shapeMatrix[0][0] === 1);
                        const seedKey = is1x1 ? `${baseTerrainId}_1X1` : baseTerrainId;
                        const sysMaster = (typeof globalThis !== 'undefined' && globalThis.LAND_SYSTEM_DATA && globalThis.LAND_SYSTEM_DATA.sockets) ? globalThis.LAND_SYSTEM_DATA.sockets : null;
                        
                        if (!cell.cachedSocketSeeds) {
                            cell.cachedSocketSeeds = {};
                        }

                        let spawnedSocket = cell.cachedSocketSeeds[seedKey] || null;

                        if (!spawnedSocket) {
                            // 🌊 水脈ソケット開花 ✕ 💧 清湖 (Lake) ＆ 🌴 オアシス (Oasis) 確定仕様 (1x1限定 25%確率)
                            if (baseTerrainId === "GL1_PLAINS" && is1x1 && Math.random() < 0.25) {
                                spawnedSocket = { id: "SOCKET_LAKE", nameKey: "SOCKET_LAKE", category: "水脈", icon: "💧", bonusFood: 2, bonusWood: 0, bonusDefense: 0, bonusMystic: 0 };
                            } else if (baseTerrainId === "GL0_DESERT" && is1x1 && Math.random() < 0.25) {
                                spawnedSocket = { id: "SOCKET_OASIS", nameKey: "SOCKET_OASIS", category: "水脈", icon: "🌴", bonusFood: 1, bonusWood: 0, bonusDefense: 0, bonusMystic: 0 };
                            } else if (sysMaster && sysMaster[baseTerrainId]) {
                                // 通常の特産品候補（非1x1、または25%抽選から外れた場合: 清湖・オアシスを除外した通常プールから均等抽選）
                                const baseCandidates = sysMaster[baseTerrainId].filter(c => c.id !== "SOCKET_LAKE" && c.id !== "SOCKET_OASIS");
                                const candidates = baseCandidates.length > 0 ? baseCandidates : sysMaster[baseTerrainId];
                                const chosen = candidates[Math.floor(Math.random() * candidates.length)];
                                spawnedSocket = {
                                    id: chosen.id,
                                    nameKey: chosen.nameKey,
                                    category: chosen.category,
                                    icon: chosen.icon,
                                    bonusFood: chosen.bonusYields.food || 0,
                                    bonusWood: chosen.bonusYields.wood || 0,
                                    bonusDefense: chosen.bonusYields.defense || 0,
                                    bonusMystic: chosen.bonusYields.mystic || 0
                                };
                            } else {
                                spawnedSocket = { id: "SOCKET_WILD_WHEAT", nameKey: "SOCKET_WILD_WHEAT", bonusFood: 3, bonusWood: 0, bonusDefense: 0, bonusMystic: 0 };
                            }

                            if (spawnedSocket) {
                                cell.cachedSocketSeeds[seedKey] = spawnedSocket;
                            }
                        }

                        if (spawnedSocket) {
                            cell.socketResource = { ...spawnedSocket };
                            const posStr = `(${String.fromCharCode(65+c)}${r+1})`;
                            const sName = I18n.t(spawnedSocket.nameKey);
                            if (typeof this.state.addLog === 'function') {
                                this.state.addLog(I18n.t("LOG_SOCKET_SPAWNED", { pos: posStr, terrainName, socketName: sName }));
                            }
                            if (this.state.toastQueue) {
                                this.state.toastQueue.push({ r, c, text: I18n.t("TOAST_SOCKET_SPAWNED", { name: sName }) });
                            }
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

        this.state.ember = Math.max(0, this.state.ember - 1);
        this.state.hasPickedThisTurn = true;

        if (handIdx >= 0 && this.state.handOffering && handIdx < this.state.handOffering.length && this.state.handOffering[handIdx]) {
            this.state.handOffering[handIdx] = { isBlank: true };
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

        if (typeof this.state.addLog === 'function') {
            this.state.addLog(I18n.t("LOG_LAND_PLACED", { pos: posStr, name: logTerrainName }));
        }
        return { can: true, success: true };
    }

    /**
     * ⚡ 1x2 / 1x3 連結即時ボーナス判定 ＆ マージグループ統合
     */
    checkConnectionBonus(r, c, terrain) {
        if (!this.state || !this.state.grid) return;
        const baseTerrainId = terrain.terrainId || terrain.id;
        const I18n = (typeof globalThis !== 'undefined' && globalThis.I18n) ? globalThis.I18n : (typeof window !== 'undefined' && window.I18n ? window.I18n : { t: k => k });
        const terrainName = I18n.t(terrain.nameKey);
        const neighbors = [
            [r - 1, c], [r + 1, c], [r, c - 1], [r, c + 1]
        ];

        const bonus1x2Table = {
            "GL0_DESERT":      { food: 0, wood: 0, mystic: 1 },
            "GL1_PLAINS":      { food: 3, wood: 0, mystic: 0 },
            "GL2_FOREST":      { food: 1, wood: 1, mystic: 0 },
            "GL3_DEEP_FOREST": { food: 0, wood: 2, mystic: 1 },
            "E2_DESERT":       { food: 0, wood: 1, mystic: 1 },
            "E2_DESERT_HILL":  { food: 0, wood: 1, mystic: 1 },
            "E2_HILL":         { food: 2, wood: 1, mystic: 0 },
            "E2_FOREST_HILL":  { food: 0, wood: 3, mystic: 0 },
            "E2_DEEP_HILL":    { food: 0, wood: 4, mystic: 1 },
            "E3_MOUNTAIN":     { food: 0, wood: 4, mystic: 1 }
        };

        const bonus1x3Table = {
            "GL0_DESERT":      { food: 0, wood: 0, mystic: 3 },
            "GL1_PLAINS":      { food: 6, wood: 0, mystic: 0 },
            "GL2_FOREST":      { food: 3, wood: 3, mystic: 0 },
            "GL3_DEEP_FOREST": { food: 0, wood: 5, mystic: 3 },
            "E2_DESERT":       { food: 0, wood: 3, mystic: 3 },
            "E2_DESERT_HILL":  { food: 0, wood: 3, mystic: 3 },
            "E2_HILL":         { food: 5, wood: 3, mystic: 0 },
            "E2_FOREST_HILL":  { food: 2, wood: 6, mystic: 0 },
            "E2_DEEP_HILL":    { food: 0, wood: 8, mystic: 3 },
            "E3_MOUNTAIN":     { food: 0, wood: 8, mystic: 3 }
        };

        const isMatch = (nr, nc) => {
            if (nr < 0 || nr >= this.state.grid.length || nc < 0 || nc >= this.state.grid.length) return false;
            const cell = this.state.grid[nr][nc];
            if (!cell.placed || cell.isHQ || !cell.terrain) return false;
            
            const currentCell = this.state.grid[r][c];
            if (currentCell.placementGroupId && cell.placementGroupId && currentCell.placementGroupId === cell.placementGroupId) {
                return false;
            }

            // ⚠️ 連結上限4マス制限: 既存グループがすでに4マスに達している場合は連結不可
            if (cell.mergeGroupId && this.state.mergedBlocks && this.state.mergedBlocks[cell.mergeGroupId]) {
                const groupObj = this.state.mergedBlocks[cell.mergeGroupId];
                if (groupObj.cells && groupObj.cells.length >= 4) {
                    return false;
                }
            }

            const tid = cell.terrain.terrainId || cell.terrain.id;
            return tid === baseTerrainId;
        };

        const matchingNeighbors = neighbors.filter(([nr, nc]) => isMatch(nr, nc));

        let isLinear1x3 = (
            (isMatch(r, c - 1) && isMatch(r, c + 1)) ||
            (isMatch(r, c - 2) && isMatch(r, c - 1)) ||
            (isMatch(r, c + 1) && isMatch(r, c + 2)) ||
            (isMatch(r - 1, c) && isMatch(r + 1, c)) ||
            (isMatch(r - 2, c) && isMatch(r - 1, c)) ||
            (isMatch(r + 1, c) && isMatch(r + 2, c))
        );

        let hasExistingGroup = false;
        let existingGroupId = null;
        for (let [nr, nc] of matchingNeighbors) {
            const adjCell = this.state.grid[nr][nc];
            if (adjCell.mergeGroupId) {
                const groupObj = (this.state.mergedBlocks && this.state.mergedBlocks[adjCell.mergeGroupId]);
                if (!groupObj || (groupObj.cells && groupObj.cells.length < 4)) {
                    hasExistingGroup = true;
                    existingGroupId = adjCell.mergeGroupId;
                    break;
                }
            }
        }

        let is1x3 = isLinear1x3 || matchingNeighbors.length >= 2 || hasExistingGroup;

        if (!this.state.grantedConnectionPairs) {
            this.state.grantedConnectionPairs = new Set();
        }

        let newPairFound = false;
        for (let [nr, nc] of matchingNeighbors) {
            const pairKey = [`${r},${c}`, `${nr},${nc}`].sort().join("_");
            if (!this.state.grantedConnectionPairs.has(pairKey)) {
                newPairFound = true;
                this.state.grantedConnectionPairs.add(pairKey);
            }
        }

        if (!newPairFound) return;

        const targetTable = is1x3 ? bonus1x3Table : bonus1x2Table;
        const bonus = targetTable[baseTerrainId] || targetTable[terrain.id] || (is1x3 ? { food: 3, wood: 3, mystic: 1 } : { food: 1, wood: 1, mystic: 0 });

        if (matchingNeighbors.length > 0) {
            const currentCell = this.state.grid[r][c];
            const groupId = existingGroupId || currentCell.mergeGroupId || `merge_${this.state.mergeGroupCounter++}`;

            currentCell.merged = true;
            currentCell.mergeGroupId = groupId;
            currentCell.mergeType = is1x3 ? "1x3" : "1x2";

            for (let [nr, nc] of matchingNeighbors) {
                const adjCell = this.state.grid[nr][nc];
                adjCell.merged = true;
                adjCell.mergeGroupId = groupId;
                adjCell.mergeType = is1x3 ? "1x3" : "1x2";
            }

            if (!this.state.mergedBlocks) this.state.mergedBlocks = {};
            if (!this.state.mergedBlocks[groupId]) {
                this.state.mergedBlocks[groupId] = {
                    groupId: groupId,
                    terrainId: baseTerrainId,
                    nameKey: terrain.nameKey,
                    mergeType: is1x3 ? "1x3" : "1x2",
                    cells: [{ r, c }, ...matchingNeighbors.map(([nr, nc]) => ({ r: nr, c: nc }))].slice(0, 4),
                    yieldMultiplier: 1.0,
                    createdTurn: this.state.turn
                };
            } else {
                const blockObj = this.state.mergedBlocks[groupId];
                blockObj.mergeType = is1x3 ? "1x3" : blockObj.mergeType;
                if (!blockObj.cells.some(cell => cell.r === r && cell.c === c) && blockObj.cells.length < 4) {
                    blockObj.cells.push({ r, c });
                }
            }

            const earnedFood = bonus.food || 0;
            const earnedMaterial = bonus.material !== undefined ? bonus.material : (bonus.wood || 0);
            const earnedWood = earnedMaterial;
            const earnedMystic = bonus.mystic || 0;

            if (earnedFood > 0 || earnedMaterial > 0 || earnedMystic > 0) {
                this.state.food += earnedFood;
                this.state.wood = (this.state.wood || 0) + earnedMaterial;
                this.state.material = this.state.wood;
                this.state.mystic += earnedMystic;

                let textParts = [];
                if (earnedFood > 0) textParts.push(`🌾+${earnedFood}`);
                if (earnedWood > 0) textParts.push(`🧱+${earnedWood}`);
                if (earnedMystic > 0) textParts.push(`✨+${earnedMystic}`);

                const bText = textParts.join(" ");
                const toastText = I18n.t("TOAST_CONNECTION_BONUS", { text: bText });
                if (typeof this.state.addLog === 'function') {
                    this.state.addLog(I18n.t("LOG_CONNECTION_BONUS", { name: terrainName, bonus: bText }));
                }
                if (this.state.toastQueue) {
                    this.state.toastQueue.push({ r, c, text: toastText });
                }
            }
        }
    }

    /**
     * 🎉 2x2 正方形マージ判定 ＆ 1.2倍産出グループ化
     */
    checkMergePatterns() {
        if (!this.state || !this.state.grid) return;
        const size = 5;
        const I18n = (typeof globalThis !== 'undefined' && globalThis.I18n) ? globalThis.I18n : (typeof window !== 'undefined' && window.I18n ? window.I18n : { t: k => k });

        for (let r = 0; r < size - 1; r++) {
            for (let c = 0; c < size - 1; c++) {
                const c1 = this.state.grid[r][c];
                const c2 = this.state.grid[r][c+1];
                const c3 = this.state.grid[r+1][c];
                const c4 = this.state.grid[r+1][c+1];

                const cells = [c1, c2, c3, c4];
                const allPlaced = cells.every(cell => cell.placed && !cell.isHQ && (!cell.merged || cell.mergeType !== "2x2"));
                if (allPlaced) {
                    const firstBaseId = c1.terrain ? (c1.terrain.terrainId || c1.terrain.id) : null;
                    const sameTerrain = cells.every(cell => cell.terrain && (cell.terrain.terrainId || cell.terrain.id) === firstBaseId);

                    if (sameTerrain && firstBaseId) {
                        const groupId = `merge_${this.state.mergeGroupCounter++}`;
                        cells.forEach(cell => {
                            cell.merged = true;
                            cell.mergeGroupId = groupId;
                            cell.mergeType = "2x2";
                        });

                        if (!this.state.mergedBlocks) this.state.mergedBlocks = {};
                        this.state.mergedBlocks[groupId] = {
                            groupId: groupId,
                            terrainId: firstBaseId,
                            nameKey: c1.terrain.nameKey,
                            mergeType: "2x2",
                            cells: cells.map(cell => ({ r: cell.r, c: cell.c })),
                            yieldMultiplier: 1.20,
                            createdTurn: this.state.turn
                        };

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

                        this.state.food += bonusFood;
                        this.state.wood += bonusWood;
                        this.state.mystic += bonusMystic;
                        this.state.ember = Math.min(20, this.state.ember + 1);

                        let textParts = [];
                        if (bonusFood > 0) textParts.push(`🌾+${bonusFood}`);
                        if (bonusWood > 0) textParts.push(`🧱+${bonusWood}`);
                        if (bonusMystic > 0) textParts.push(`✨+${bonusMystic}`);
                        const bText = textParts.join(" ");

                        const tName = I18n.t(c1.terrain.nameKey);
                        const toastMsg = I18n.t("TOAST_MERGE_2X2", { text: bText });
                        if (typeof this.state.addLog === 'function') {
                            this.state.addLog(I18n.t("LOG_MERGE_2X2_COMPLETE", { name: tName, bonus: bText }));
                        }
                        if (this.state.toastQueue) {
                            this.state.toastQueue.push({ r, c, text: toastMsg });
                        }
                    }
                }
            }
        }
    }
}

if (typeof window !== "undefined") {
    window.GridEngine = GridEngine;
}
if (typeof globalThis !== "undefined") {
    globalThis.GridEngine = GridEngine;
}

export { GridEngine };
export default GridEngine;

