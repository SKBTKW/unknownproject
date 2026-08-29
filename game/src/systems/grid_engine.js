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
     * 📈 配置ブロック数に応じた土地配置コスト (🔥) の取得
     * 0〜5ブロック: 🔥0, 6〜15ブロック: 🔥1, 16〜30ブロック: 🔥2, 31ブロック〜: 🔥3
     * @returns {number}
     */
    getPlacementEmberCost() {
        const count = (this.state && this.state.placedBlockCount !== undefined) ? this.state.placedBlockCount : 0;
        if (count < 6) return 0;   // 0〜5 ブロック: 🔥 0 (完全無料)
        if (count < 16) return 1;  // 6〜15 ブロック: 🔥 1
        if (count < 31) return 2;  // 16〜30 ブロック: 🔥 2
        return 3;                  // 31 ブロック〜: 🔥 3
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

        // 🏰 1. 本営 (HQ) 産出の 1.4 倍強化 (Stage 2: 🌾14, 🧱14, 🛡️14, ✨2)
        if (newGrid[newCenter] && newGrid[newCenter][newCenter] && newGrid[newCenter][newCenter].isHQ) {
            newGrid[newCenter][newCenter].terrain = {
                id: "HQ",
                nameKey: "TERRAIN_HQ",
                food: 14,
                wood: 14,
                defense: 14,
                mystic: 2
            };
        }

        // 🎲 2. 資源ソケットの追加配置 (+4個: 最外周3マス + 全域未配置1マス)
        const existingSockets = [];
        for (let r = 0; r < newSize; r++) {
            for (let c = 0; c < newSize; c++) {
                if (newGrid[r][c].hasSocket) {
                    existingSockets.push({ r, c });
                }
            }
        }

        const isAdjacentToAnySocket = (r, c, socketList) => {
            return socketList.some(s => Math.abs(s.r - r) <= 1 && Math.abs(s.c - c) <= 1);
        };

        // (a) 最外周ブロックから 3 個抽出
        const perimeterCandidates = [];
        for (let r = 0; r < newSize; r++) {
            for (let c = 0; c < newSize; c++) {
                const isPerimeter = (r === 0 || r === newSize - 1 || c === 0 || c === newSize - 1);
                if (isPerimeter && !newGrid[r][c].placed && !newGrid[r][c].hasSocket) {
                    perimeterCandidates.push({ r, c });
                }
            }
        }

        // Fisher-Yates シャッフル
        for (let i = perimeterCandidates.length - 1; i > 0; i--) {
            const j = Math.floor(Math.random() * (i + 1));
            [perimeterCandidates[i], perimeterCandidates[j]] = [perimeterCandidates[j], perimeterCandidates[i]];
        }

        const addedSockets = [];
        for (const cand of perimeterCandidates) {
            if (addedSockets.length >= 3) break;
            if (!isAdjacentToAnySocket(cand.r, cand.c, existingSockets) &&
                !isAdjacentToAnySocket(cand.r, cand.c, addedSockets)) {
                addedSockets.push(cand);
            }
        }

        // (b) 全グリッド未配置ブロックからランダム 1 個抽出
        const allCandidates = [];
        for (let r = 0; r < newSize; r++) {
            for (let c = 0; c < newSize; c++) {
                const cell = newGrid[r][c];
                const isHQ = (r === newCenter && c === newCenter);
                const isNearHQ = (Math.abs(r - newCenter) <= 1 && Math.abs(c - newCenter) <= 1);
                if (!cell.placed && !isHQ && !isNearHQ && !cell.hasSocket) {
                    allCandidates.push({ r, c });
                }
            }
        }

        for (let i = allCandidates.length - 1; i > 0; i--) {
            const j = Math.floor(Math.random() * (i + 1));
            [allCandidates[i], allCandidates[j]] = [allCandidates[j], allCandidates[i]];
        }

        for (const cand of allCandidates) {
            if (addedSockets.length >= 4) break;
            if (!isAdjacentToAnySocket(cand.r, cand.c, existingSockets) &&
                !isAdjacentToAnySocket(cand.r, cand.c, addedSockets)) {
                addedSockets.push(cand);
            }
        }

        // ソケット配置の確定
        for (const pos of addedSockets) {
            newGrid[pos.r][pos.c].hasSocket = true;
        }

        return newGrid;
    }

    /**
     * 🔍 形状配置可否チェック（地勢レベルGL/標高E/本営近郊/全理由配列reasons収集対応）
     * @param {number} startR - 配置開始行
     * @param {number} startC - 配置開始列
     * @param {Array<Array<number>>} shapeMatrix - 形状マトリクス
     * @param {Object} [terrain] - 配置対象の地勢データ (GL/E判定用)
     * @returns {{ can: boolean, reason?: string, reasons: Array<string> }}
     */
    canPlaceShape(startR, startC, shapeMatrix, terrain = null) {
        if (!this.state || !this.state.grid) return { can: false, reason: "NO_GRID", reasons: ["NO_GRID"] };

        const rows = shapeMatrix.length;
        const cols = shapeMatrix[0].length;
        const size = (this.state.stage && this.state.stage.size) ? this.state.stage.size : 5;

        const targetGL = terrain ? (terrain.gl !== undefined ? terrain.gl : (terrain.terrain ? terrain.terrain.gl : null)) : null;
        const targetE = terrain ? (terrain.e !== undefined ? terrain.e : (terrain.terrain ? terrain.terrain.e : 1)) : null;
        const targetTid = terrain ? (terrain.terrainId || terrain.id || "") : "";
        const isMountain = targetE === 3 || targetTid.includes("MOUNTAIN");

        const reasons = [];

        let isOutOfBounds = false;
        let isAlreadyPlaced = false;
        let isMountainNearHQ = false;
        let isAdjacent = false;
        let hasInvalidGL = false;
        const elevationReasons = new Set();

        // 1. 盤外および既配置マスとの重複判定 ＆ 本営周囲山岳判定
        for (let dr = 0; dr < rows; dr++) {
            for (let dc = 0; dc < cols; dc++) {
                if (shapeMatrix[dr][dc] === 1) {
                    const r = startR + dr;
                    const c = startC + dc;
                    if (r < 0 || r >= size || c < 0 || c >= size) {
                        isOutOfBounds = true;
                    } else {
                        if (this.state.grid[r][c].placed) {
                            isAlreadyPlaced = true;
                        }
                        if (isMountain && this.isHQVicinity(r, c)) {
                            isMountainNearHQ = true;
                        }
                    }
                }
            }
        }

        if (isOutOfBounds) reasons.push("OUT_OF_BOUNDS");
        if (isAlreadyPlaced) reasons.push("ALREADY_PLACED");
        if (isMountainNearHQ) reasons.push("MOUNTAIN_NEAR_HQ_FORBIDDEN");

        // 2. 隣接接続判定 ＆ 地勢レベル(GL) / 標高(E) 不適合チェック
        if (!isOutOfBounds) {
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
                                                hasInvalidGL = true;
                                            }
                                        }

                                        // ⛰️ 高度断絶ルール (断崖): 標高 E0(湿原)/E1(平地) と 標高 E3(山岳) は直接隣接不可 (|E差| >= 2 は禁止)
                                        if (targetE !== null) {
                                            const placedE = neighborCell.terrain.e !== undefined ? neighborCell.terrain.e : 1;
                                            if (Math.abs(targetE - placedE) >= 2) {
                                                if ((targetE === 0 && placedE === 3) || (targetE === 3 && placedE === 0)) {
                                                    elevationReasons.add("WETLAND_MOUNTAIN_NEIGHBOR");
                                                } else if ((targetE === 0 && placedE === 2) || (targetE === 2 && placedE === 0)) {
                                                    elevationReasons.add("WETLAND_HILL_NEIGHBOR");
                                                } else {
                                                    elevationReasons.add("INVALID_ELEVATION_NEIGHBOR");
                                                }
                                            }
                                        }
                                    }
                                }
                            }
                        }
                    }
                }
            }

            if (!isAdjacent && !isAlreadyPlaced) {
                reasons.push("NOT_ADJACENT");
            }
            if (hasInvalidGL) {
                reasons.push("INVALID_GL_NEIGHBOR");
            }
            if (elevationReasons.size > 0) {
                elevationReasons.forEach(rKey => reasons.push(rKey));
            }

            // 🔒 3. 同属性 2×2 マージ直接面隣接禁止ルール
            if (!isOutOfBounds && !isAlreadyPlaced) {
                const targetTid = terrain ? (terrain.terrainId || terrain.id) : null;
                const placingCells = [];
                for (let dr = 0; dr < rows; dr++) {
                    for (let dc = 0; dc < cols; dc++) {
                        if (shapeMatrix[dr][dc] === 1) {
                            placingCells.push({ r: startR + dr, c: startC + dc });
                        }
                    }
                }

                const getVirtualCell = (vr, vc) => {
                    if (vr < 0 || vr >= size || vc < 0 || vc >= size) return null;
                    const isPlacing = placingCells.some(p => p.r === vr && p.c === vc);
                    if (isPlacing) {
                        return { placed: true, isHQ: false, terrainId: targetTid, isVirtualPlacing: true };
                    }
                    const realCell = this.state.grid[vr][vc];
                    if (realCell && realCell.placed && !realCell.isHQ && realCell.terrain) {
                        const tid = realCell.terrain.terrainId || realCell.terrain.id;
                        const isMerged = !!(realCell.merged || (realCell.mergeGroupId && this.state.mergedBlocks && this.state.mergedBlocks[realCell.mergeGroupId] && this.state.mergedBlocks[realCell.mergeGroupId].cells.length >= 4));
                        return { placed: true, isHQ: false, terrainId: tid, isMerged, mergeGroupId: realCell.mergeGroupId };
                    }
                    return null;
                };

                let hasMergedAdjacencyConflict = false;
                for (let topR = 0; topR < size - 1; topR++) {
                    for (let leftC = 0; leftC < size - 1; leftC++) {
                        const c00 = getVirtualCell(topR, leftC);
                        const c01 = getVirtualCell(topR, leftC + 1);
                        const c10 = getVirtualCell(topR + 1, leftC);
                        const c11 = getVirtualCell(topR + 1, leftC + 1);

                        if (c00 && c01 && c10 && c11 &&
                            c00.terrainId === targetTid &&
                            c01.terrainId === targetTid &&
                            c10.terrainId === targetTid &&
                            c11.terrainId === targetTid) {
                            
                            const includesNewPlacing = (c00.isVirtualPlacing || c01.isVirtualPlacing || c10.isVirtualPlacing || c11.isVirtualPlacing);
                            if (includesNewPlacing) {
                                const perimeterNeighbors = [
                                    [topR - 1, leftC], [topR - 1, leftC + 1],
                                    [topR + 2, leftC], [topR + 2, leftC + 1],
                                    [topR, leftC - 1], [topR + 1, leftC - 1],
                                    [topR, leftC + 2], [topR + 1, leftC + 2]
                                ];

                                for (let [pr, pc] of perimeterNeighbors) {
                                    if (pr >= 0 && pr < size && pc >= 0 && pc < size) {
                                        const realNeighbor = this.state.grid[pr][pc];
                                        if (realNeighbor && realNeighbor.placed && !realNeighbor.isHQ && realNeighbor.terrain) {
                                            const nTid = realNeighbor.terrain.terrainId || realNeighbor.terrain.id;
                                            const isNeighborMerged = !!(realNeighbor.merged || (realNeighbor.mergeGroupId && this.state.mergedBlocks && this.state.mergedBlocks[realNeighbor.mergeGroupId] && this.state.mergedBlocks[realNeighbor.mergeGroupId].cells.length >= 4));
                                            
                                            if (nTid === targetTid && isNeighborMerged) {
                                                hasMergedAdjacencyConflict = true;
                                                break;
                                            }
                                        }
                                    }
                                }
                            }
                        }
                        if (hasMergedAdjacencyConflict) break;
                    }
                    if (hasMergedAdjacencyConflict) break;
                }

                if (hasMergedAdjacencyConflict) {
                    reasons.push("SAME_TERRAIN_MERGED_NEIGHBOR_FORBIDDEN");
                }
            }
        }

        if (reasons.length > 0) {
            return { can: false, reason: reasons[0], reasons: reasons };
        }
        return { can: true, reasons: [] };
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

                    // ★ ソケット開花判定 (決定論的固定化 ✕ 相対 Weight 自然地理抽選: アンドゥリセマラを完全根絶)
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
                            const pool = (sysMaster && sysMaster[baseTerrainId]) ? sysMaster[baseTerrainId] : null;

                            if (pool && pool.length > 0) {
                                // 🌊 1. 特殊水系判定 (湿原60%清湖, 草原1x1 25%清湖, 砂漠1x1 25%オアシス)
                                if ((baseTerrainId === "E0_WETLAND" || baseTerrainId.includes("WETLAND")) && Math.random() < 0.60) {
                                    const lake = pool.find(s => s.id === "SOCKET_LAKE");
                                    if (lake) {
                                        spawnedSocket = {
                                            id: lake.id, nameKey: lake.nameKey, category: lake.category, icon: lake.icon,
                                            bonusFood: lake.bonusYields.food || 0, bonusWood: lake.bonusYields.wood || 0,
                                            bonusDefense: lake.bonusYields.defense || 0, bonusMystic: lake.bonusYields.mystic || 0
                                        };
                                    }
                                } else if (baseTerrainId === "GL1_PLAINS" && is1x1 && Math.random() < 0.25) {
                                    const lake = pool.find(s => s.id === "SOCKET_LAKE");
                                    if (lake) {
                                        spawnedSocket = {
                                            id: lake.id, nameKey: lake.nameKey, category: lake.category, icon: lake.icon,
                                            bonusFood: lake.bonusYields.food || 0, bonusWood: lake.bonusYields.wood || 0,
                                            bonusDefense: lake.bonusYields.defense || 0, bonusMystic: lake.bonusYields.mystic || 0
                                        };
                                    }
                                } else if (baseTerrainId === "GL0_DESERT" && is1x1 && Math.random() < 0.25) {
                                    const oasis = pool.find(s => s.id === "SOCKET_OASIS");
                                    if (oasis) {
                                        spawnedSocket = {
                                            id: oasis.id, nameKey: oasis.nameKey, category: oasis.category, icon: oasis.icon,
                                            bonusFood: oasis.bonusYields.food || 0, bonusWood: oasis.bonusYields.wood || 0,
                                            bonusDefense: oasis.bonusYields.defense || 0, bonusMystic: oasis.bonusYields.mystic || 0
                                        };
                                    }
                                }

                                // 🎲 2. 相対 Weight 重み付き自然地理抽選（特殊水系非当選時）
                                if (!spawnedSocket) {
                                    const candidates = pool.filter(s => !s.isSpecialWater && (s.weight || 0) > 0);
                                    const validPool = candidates.length > 0 ? candidates : pool;
                                    const totalWeight = validPool.reduce((sum, s) => sum + (s.weight || 1), 0);
                                    let rand = Math.random() * totalWeight;
                                    let chosen = validPool[0];
                                    for (const s of validPool) {
                                        const w = s.weight || 1;
                                        if (rand < w) {
                                            chosen = s;
                                            break;
                                        }
                                        rand -= w;
                                    }
                                    spawnedSocket = {
                                        id: chosen.id,
                                        nameKey: chosen.nameKey,
                                        category: chosen.category,
                                        icon: chosen.icon,
                                        bonusFood: (chosen.bonusYields && chosen.bonusYields.food) || 0,
                                        bonusWood: (chosen.bonusYields && (chosen.bonusYields.material !== undefined ? chosen.bonusYields.material : chosen.bonusYields.wood)) || 0,
                                        bonusDefense: (chosen.bonusYields && chosen.bonusYields.defense) || 0,
                                        bonusMystic: (chosen.bonusYields && chosen.bonusYields.mystic) || 0
                                    };
                                }
                            } else {
                                spawnedSocket = { id: "SOCKET_WILD_WHEAT", nameKey: "SOCKET_WILD_WHEAT", category: "CAT_GRAIN", icon: "🌾", bonusFood: 3, bonusWood: 0, bonusDefense: 0, bonusMystic: 0 };
                            }

                            if (spawnedSocket) {
                                cell.cachedSocketSeeds[seedKey] = spawnedSocket;
                            }
                        }

                        if (spawnedSocket) {
                            cell.socketResource = { ...spawnedSocket };
                            const posStr = `(${String.fromCharCode(65+c)}${r+1})`;
                            const sName = I18n.t(spawnedSocket.nameKey);
                            const sIcon = spawnedSocket.icon || "💎";
                            if (typeof this.state.addLog === 'function') {
                                this.state.addLog(I18n.t("LOG_SOCKET_SPAWNED", { pos: posStr, terrainName, socketName: sName, icon: sIcon }));
                            }
                            if (this.state.toastQueue) {
                                this.state.toastQueue.push({ r, c, text: I18n.t("TOAST_SOCKET_SPAWNED", { name: sName, icon: sIcon }) });
                            }
                        }
                    }
                }
            }
        }

        const placedCoords = [];
        for (let dr = 0; dr < rows; dr++) {
            for (let dc = 0; dc < cols; dc++) {
                if (shapeMatrix[dr][dc] === 1) {
                    const r = startR + dr;
                    const c = startC + dc;
                    placedCoords.push({ r, c });
                    this.checkConnectionBonus(r, c, terrain);
                }
            }
        }
        this.checkMergePatterns(placedCoords);

        const placementCost = this.getPlacementEmberCost();
        if (placementCost > 0) {
            if (this.state.emberSystem && typeof this.state.emberSystem.consume === 'function') {
                this.state.emberSystem.consume(placementCost);
            } else {
                this.state.ember = Math.max(0, this.state.ember - placementCost);
            }
        }
        this.state.placedBlockCount = (this.state.placedBlockCount || 0) + 1;
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
        if (typeof this.state.checkConditionalBuffs === 'function') {
            this.state.checkConditionalBuffs();
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
            const currPlaceId = currentCell.placementGroupId;
            const targetGroupId = existingGroupId || currentCell.mergeGroupId || `merge_${this.state.mergeGroupCounter++}`;
            const oldGroupIds = new Set();
            if (currentCell.mergeGroupId && currentCell.mergeGroupId !== targetGroupId) {
                oldGroupIds.add(currentCell.mergeGroupId);
            }

            const size = this.state.grid.length;

            // 1. 新規配置カードの全マス（同 placementGroupId）に targetGroupId を伝播
            for (let row = 0; row < size; row++) {
                for (let col = 0; col < size; col++) {
                    const cell = this.state.grid[row][col];
                    if (cell && currPlaceId && cell.placementGroupId === currPlaceId) {
                        cell.mergeGroupId = targetGroupId;
                        cell.mergeType = is1x3 ? "1x3" : "1x2";
                    }
                }
            }

            // 2. マッチした隣接マスおよび所属旧グループを収集
            for (let [nr, nc] of matchingNeighbors) {
                const adjCell = this.state.grid[nr][nc];
                if (adjCell.mergeGroupId && adjCell.mergeGroupId !== targetGroupId) {
                    oldGroupIds.add(adjCell.mergeGroupId);
                }
                adjCell.mergeGroupId = targetGroupId;
                adjCell.mergeType = is1x3 ? "1x3" : "1x2";
            }

            // 3. 旧グループに属していた全マスを targetGroupId に一括合流・統合
            if (oldGroupIds.size > 0) {
                for (let row = 0; row < size; row++) {
                    for (let col = 0; col < size; col++) {
                        const cell = this.state.grid[row][col];
                        if (cell && cell.mergeGroupId && oldGroupIds.has(cell.mergeGroupId)) {
                            cell.mergeGroupId = targetGroupId;
                            cell.mergeType = is1x3 ? "1x3" : "1x2";
                        }
                    }
                }
            }

            if (!this.state.mergedBlocks) this.state.mergedBlocks = {};
            if (!this.state.mergedBlocks[targetGroupId]) {
                this.state.mergedBlocks[targetGroupId] = {
                    groupId: targetGroupId,
                    terrainId: baseTerrainId,
                    nameKey: terrain.nameKey,
                    mergeType: is1x3 ? "1x3" : "1x2",
                    cells: [{ r, c }, ...matchingNeighbors.map(([nr, nc]) => ({ r: nr, c: nc }))].slice(0, 4),
                    yieldMultiplier: 1.0,
                    createdTurn: this.state.turn
                };
            } else {
                const blockObj = this.state.mergedBlocks[targetGroupId];
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
    checkMergePatterns(placedCoords = []) {
        if (!this.state || !this.state.grid) return;
        const size = this.state.grid.length;
        const I18n = (typeof globalThis !== 'undefined' && globalThis.I18n) ? globalThis.I18n : (typeof window !== 'undefined' && window.I18n ? window.I18n : { t: k => k });

        // 1. 2x2 正方形マージ判定（全地形共通）
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
                        let bonusFood = 0, bonusWood = 0, bonusMystic = 0, bonusEmber = 1;

                        if (tid.includes("PLAINS")) {
                            bonusFood = 10;
                            bonusEmber = 2; // 🔥 平地 2x2 マージ成立ボーナス: 🔥+2
                        } else if (tid.includes("HILL")) {
                            bonusWood = 8;
                            bonusFood = 4;
                            bonusEmber = 1;
                        } else if (tid.includes("MOUNTAIN")) {
                            bonusWood = 10;
                            bonusMystic = 5;
                            bonusEmber = 1;
                        } else {
                            bonusFood = 5;
                            bonusEmber = 1;
                        }

                        this.state.food += bonusFood;
                        this.state.wood += bonusWood;
                        this.state.mystic += bonusMystic;
                        if (this.state.emberSystem && typeof this.state.emberSystem.addBonus === 'function') {
                            this.state.emberSystem.addBonus(bonusEmber);
                        } else if (this.state.emberSystem && typeof this.state.emberSystem.recoverInstant === 'function') {
                            this.state.emberSystem.recoverInstant(bonusEmber, true);
                        } else {
                            this.state.ember += bonusEmber;
                        }

                        let textParts = [];
                        if (bonusFood > 0) textParts.push(`🌾+${bonusFood}`);
                        if (bonusWood > 0) textParts.push(`🧱+${bonusWood}`);
                        if (bonusMystic > 0) textParts.push(`✨+${bonusMystic}`);
                        textParts.push(`🔥+${bonusEmber}`);
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

        // 2. 🧱 丘陵（E2_HILL）限定：L字型 異形マージ判定（回転8パターン）
        const lOffsets = [
            // 2x3 横長パターン (4種)
            [[0,0], [0,1], [0,2], [1,0]],
            [[0,0], [0,1], [0,2], [1,2]],
            [[1,0], [1,1], [1,2], [0,0]],
            [[1,0], [1,1], [1,2], [0,2]],
            // 3x2 縦長パターン (4種)
            [[0,0], [1,0], [2,0], [0,1]],
            [[0,0], [1,0], [2,0], [2,1]],
            [[0,1], [1,1], [2,1], [0,0]],
            [[0,1], [1,1], [2,1], [2,0]]
        ];

        for (let r = 0; r < size; r++) {
            for (let c = 0; c < size; c++) {
                for (let offsets of lOffsets) {
                    const coords = offsets.map(([dr, dc]) => ({ r: r + dr, c: c + dc }));
                    if (coords.some(pt => pt.r < 0 || pt.r >= size || pt.c < 0 || pt.c >= size)) continue;

                    const cells = coords.map(pt => this.state.grid[pt.r][pt.c]);
                    const allPlaced = cells.every(cell => cell.placed && !cell.isHQ && !cell.merged);
                    if (allPlaced) {
                        const isAllHill = cells.every(cell => cell.terrain && (cell.terrain.terrainId || cell.terrain.id || "").includes("HILL"));
                        if (isAllHill) {
                            const groupId = `merge_${this.state.mergeGroupCounter++}`;
                            cells.forEach(cell => {
                                cell.merged = true;
                                cell.mergeGroupId = groupId;
                                cell.mergeType = "L_SHAPE";
                            });

                            // 最後の1マスを特定（直前の配置マスに含まれるもの、または終端マス）
                            const targetPt = coords.find(pt => placedCoords.some(p => p.r === pt.r && p.c === pt.c)) || coords[coords.length - 1];
                            const lastCell = this.state.grid[targetPt.r][targetPt.c];
                            lastCell.socketResource = {
                                id: "SOCKET_HIDDEN_DEPOSIT",
                                nameKey: "SOCKET_HIDDEN_DEPOSIT",
                                icon: "⛏️",
                                bonusMaterial: 2,
                                bonusWood: 2,
                                bonusDefense: 1,
                                bonusFood: 0,
                                bonusMystic: 0,
                                isAwakenedKeystone: true
                            };

                            if (!this.state.mergedBlocks) this.state.mergedBlocks = {};
                            this.state.mergedBlocks[groupId] = {
                                groupId: groupId,
                                terrainId: "E2_HILL",
                                nameKey: "TERRAIN_HILL",
                                mergeType: "L_SHAPE",
                                cells: coords,
                                yieldMultiplier: 1.20,
                                isInterceptionPoint: true,
                                keystoneCoord: { r: targetPt.r, c: targetPt.c },
                                createdTurn: this.state.turn
                            };

                            // 即時ボーナス: 🌾+4, 🧱+6, 🔥+1
                            this.state.food += 4;
                            this.state.wood += 6;
                            if (this.state.emberSystem && typeof this.state.emberSystem.addBonus === 'function') {
                                this.state.emberSystem.addBonus(1);
                            } else if (this.state.emberSystem && typeof this.state.emberSystem.recoverInstant === 'function') {
                                this.state.emberSystem.recoverInstant(1, true);
                            } else {
                                this.state.ember += 1;
                            }

                            const bText = "🌾+4 🧱+6 🔥+1";
                            const I18n = (typeof globalThis !== 'undefined' && globalThis.I18n) ? globalThis.I18n : (typeof window !== 'undefined' ? window.I18n : { t: k => k });
                            if (typeof this.state.addLog === 'function') {
                                const logMsg = I18n ? I18n.t("LOG_MERGE_L_COMPLETE", { bonus: bText }) : `🟨 L-Merge (${bText})`;
                                this.state.addLog(logMsg);
                            }
                            if (this.state.toastQueue) {
                                const toastMsg = I18n ? I18n.t("TOAST_MERGE_L", { bonus: bText }) : `🟨 L-Merge (${bText})`;
                                this.state.toastQueue.push({ r: coords[0].r, c: coords[0].c, text: toastMsg });
                            }
                        }
                    }
                }
            }
        }

        // 3. 🛡️ 山岳（E3_MOUNTAIN）限定：凸字型 異形マージ判定（回転4パターン）
        const tOffsets = [
            // 横3 ＋ 中央上
            [[0,1], [1,0], [1,1], [1,2]],
            // 横3 ＋ 中央下
            [[0,0], [0,1], [0,2], [1,1]],
            // 縦3 ＋ 中央左
            [[0,1], [1,0], [1,1], [2,1]],
            // 縦3 ＋ 中央右
            [[0,0], [1,0], [1,1], [2,0]]
        ];

        for (let r = 0; r < size; r++) {
            for (let c = 0; c < size; c++) {
                for (let offsets of tOffsets) {
                    const coords = offsets.map(([dr, dc]) => ({ r: r + dr, c: c + dc }));
                    if (coords.some(pt => pt.r < 0 || pt.r >= size || pt.c < 0 || pt.c >= size)) continue;

                    const cells = coords.map(pt => this.state.grid[pt.r][pt.c]);
                    const allPlaced = cells.every(cell => cell.placed && !cell.isHQ && !cell.merged);
                    if (allPlaced) {
                        const isAllMountain = cells.every(cell => cell.terrain && (cell.terrain.terrainId || cell.terrain.id || "").includes("MOUNTAIN"));
                        if (isAllMountain) {
                            const groupId = `merge_${this.state.mergeGroupCounter++}`;
                            cells.forEach(cell => {
                                cell.merged = true;
                                cell.mergeGroupId = groupId;
                                cell.mergeType = "T_SHAPE";
                            });

                            // 最後の1マスを特定
                            const targetPt = coords.find(pt => placedCoords.some(p => p.r === pt.r && p.c === pt.c)) || coords[coords.length - 1];
                            const lastCell = this.state.grid[targetPt.r][targetPt.c];
                            lastCell.socketResource = {
                                id: "SOCKET_SUMMIT_FORTRESS",
                                nameKey: "SOCKET_SUMMIT_FORTRESS",
                                icon: "🗼",
                                bonusDefense: 3,
                                bonusMystic: 2,
                                bonusFood: 0,
                                bonusWood: 0,
                                isAwakenedKeystone: true
                            };

                            if (!this.state.mergedBlocks) this.state.mergedBlocks = {};
                            this.state.mergedBlocks[groupId] = {
                                groupId: groupId,
                                terrainId: "E3_MOUNTAIN",
                                nameKey: "TERRAIN_MOUNTAIN",
                                mergeType: "T_SHAPE",
                                cells: coords,
                                yieldMultiplier: 1.20,
                                isInterceptionPoint: true,
                                keystoneCoord: { r: targetPt.r, c: targetPt.c },
                                createdTurn: this.state.turn
                            };

                            // 即時ボーナス: 🧱+8, ✨+4, 🔥+1
                            this.state.wood += 8;
                            this.state.mystic += 4;
                            if (this.state.emberSystem && typeof this.state.emberSystem.addBonus === 'function') {
                                this.state.emberSystem.addBonus(1);
                            } else if (this.state.emberSystem && typeof this.state.emberSystem.recoverInstant === 'function') {
                                this.state.emberSystem.recoverInstant(1, true);
                            } else {
                                this.state.ember += 1;
                            }

                            const bText = "🧱+8 ✨+4 🔥+1";
                            const I18n = (typeof globalThis !== 'undefined' && globalThis.I18n) ? globalThis.I18n : (typeof window !== 'undefined' ? window.I18n : { t: k => k });
                            if (typeof this.state.addLog === 'function') {
                                const logMsg = I18n ? I18n.t("LOG_MERGE_T_COMPLETE", { bonus: bText }) : `🛡️ T-Merge (${bText})`;
                                this.state.addLog(logMsg);
                            }
                            if (this.state.toastQueue) {
                                const toastMsg = I18n ? I18n.t("TOAST_MERGE_T", { bonus: bText }) : `🛡️ T-Merge (${bText})`;
                                this.state.toastQueue.push({ r: coords[0].r, c: coords[0].c, text: toastMsg });
                            }
                        }
                    }
                }
            }
        }
    }

    /**
     * 🗺️ 盤面上に開墾された土地属性ごとのマス数内訳を取得
     */
    getTerritoryBreakdown() {
        const breakdown = { plains: 0, forest: 0, deepForest: 0, hill: 0, mountain: 0, desert: 0, total: 0 };
        if (!this.state || !this.state.grid) return breakdown;
        const size = this.state.grid.length;
        for (let r = 0; r < size; r++) {
            for (let c = 0; c < size; c++) {
                const cell = this.state.grid[r][c];
                if (cell.placed && !cell.isHQ && cell.terrain) {
                    breakdown.total++;
                    const tid = (cell.terrain.terrainId || cell.terrain.id || "").toUpperCase();
                    if (tid.includes("PLAINS")) breakdown.plains++;
                    else if (tid.includes("DEEP_FOREST") || tid.includes("DEEP_HILL")) breakdown.deepForest++;
                    else if (tid.includes("FOREST")) breakdown.forest++;
                    else if (tid.includes("HILL")) breakdown.hill++;
                    else if (tid.includes("MOUNTAIN")) breakdown.mountain++;
                    else if (tid.includes("DESERT")) breakdown.desert++;
                    else breakdown.plains++; // フォールバック
                }
            }
        }
        return breakdown;
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

