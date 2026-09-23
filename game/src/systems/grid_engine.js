/* =============================================================
   game/src/systems/grid_engine.js
   盤面初期化・ソケット配置・配置検証・マージ判定専用独立ドメインモジュール
   ============================================================= */

import {
    areTerrainsZoneCompatible,
    getZoneCategory,
    getMergeLinkKey,
    haveDifferentMergeTerrainAttributes,
    isTrueMergedCell
} from '../core/merge_rules.js';
import {
    isWithinWetlandExclusionRange,
    isWetlandTerrain
} from '../core/lake_rules.js';
import {
    isIrrigationSourceCell,
    isIrrigationInfluence,
    isLegacyIrrigationResource
} from '../core/irrigation_rules.js';
import {
    LAND_PRODUCTION_STATUS,
    findContractCellYields,
    normalizeProductionContract
} from '../core/land_production_contract.js';
import {
    isCanonicalTerrainId,
    resolveCanonicalTerrainSemantic
} from '../data/land_system.js';
import {
    getPlacementAttributeTerrainId,
    hasMultiplePlacementTerrainAttributes,
    resolveRepresentativePlacementTerrainId,
    validatePlacementAttributeMap
} from '../core/placement_geometry.js';
import { isBoardCellOccupied } from '../core/board_cell_occupancy.js';
function coordinateKey(r, c) {
    return `${r}:${c}`;
}

function cloneTerrainSemantic(terrain) {
    if (!terrain || typeof terrain !== "object") return terrain || null;
    return {
        ...terrain,
        ...(terrain.yields ? { yields: { ...terrain.yields } } : {}),
        ...(terrain.baseYieldsPerTile ? { baseYieldsPerTile: { ...terrain.baseYieldsPerTile } } : {})
    };
}

function resolveAttributeTerrain(attributeCell, fallbackTerrain) {
    if (!attributeCell) return fallbackTerrain;

    const sourceSemantic = attributeCell.terrain && typeof attributeCell.terrain === "object"
        ? attributeCell.terrain
        : attributeCell;
    const {
        r: _r,
        c: _c,
        dr: _dr,
        dc: _dc,
        sourceR: _sourceR,
        sourceC: _sourceC,
        ...semantic
    } = sourceSemantic;

    const terrainId = semantic.terrainId || semantic.id || null;
    if (terrainId) {
        return cloneTerrainSemantic(resolveCanonicalTerrainSemantic(terrainId, semantic));
    }

    const hasSemantic = Object.keys(semantic).length > 0;
    return hasSemantic ? cloneTerrainSemantic(semantic) : fallbackTerrain;
}

function findPlacementAttributeCell(attributeCells, localR, localC) {
    if (!Array.isArray(attributeCells)) return null;
    return attributeCells.find(cell => {
        const r = Number.isInteger(cell?.r) ? cell.r : cell?.dr;
        const c = Number.isInteger(cell?.c) ? cell.c : cell?.dc;
        return r === localR && c === localC;
    }) || null;
}

function createPlacementSemanticResolver(shapeMatrix, fallbackTerrain, attributeCells = null) {
    const byLocalCell = new Map();
    for (const cell of attributeCells || []) {
        const r = Number.isInteger(cell?.r) ? cell.r : cell?.dr;
        const c = Number.isInteger(cell?.c) ? cell.c : cell?.dc;
        if (!Number.isInteger(r) || !Number.isInteger(c)) continue;
        byLocalCell.set(coordinateKey(r, c), cell);
    }

    return (dr, dc) => {
        if (shapeMatrix?.[dr]?.[dc] !== 1) return null;
        return resolveAttributeTerrain(byLocalCell.get(coordinateKey(dr, dc)), fallbackTerrain);
    };
}


class GridEngine {
    constructor(gameState, engine = null) {
        this.state = gameState;
        this.engine = engine;
    }

    _nextGameplayFloat() {
        return this.engine?.gameplayRandom?.nextFloat?.()
            ?? ((this.state && typeof this.state.rng === "function") ? this.state.rng() : Math.random());
    }

    _shuffle(items) {
        if (this.engine?.gameplayRandom?.shuffle) {
            return this.engine.gameplayRandom.shuffle(items);
        }
        for (let i = items.length - 1; i > 0; i--) {
            const j = Math.floor(this._nextGameplayFloat() * (i + 1));
            [items[i], items[j]] = [items[j], items[i]];
        }
        return items;
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
                    specialBlock: null,
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

        this._shuffle(candidates);

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
     * 🌾 灌漑影響圏判定。
     * 旧 public API 名は既存 Presentation 互換のため維持する。
     */
    isWaterSourceInfluence(r, c) {
        if (!this.state || !this.state.grid) return false;
        return isIrrigationInfluence(this.state, r, c);
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
     * 📦 配置済みBlock数。placementGroupIdをcanonical block identityとして数える。
     */
    getPlacedBlockCount() {
        if (!this.state) return 0;
        if (Number.isInteger(this.state.placedBlockCount)) return this.state.placedBlockCount;
        if (!Array.isArray(this.state.grid)) return 0;

        const seen = new Set();
        let anonymous = 0;
        for (const row of this.state.grid) {
            for (const cell of row || []) {
                if (!cell?.placed || cell.isHQ) continue;
                if (cell.placementGroupId != null) seen.add(String(cell.placementGroupId));
                else anonymous++;
            }
        }
        return seen.size + anonymous;
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
                const terrainId = cell?.terrain?.terrainId || cell?.terrain?.id || null;
                if (cell?.placed && terrainId === "E2_HILL") {
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
                        specialBlock: null,
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
                if (isPerimeter && !isBoardCellOccupied(newGrid[r][c]) && !newGrid[r][c].hasSocket) {
                    perimeterCandidates.push({ r, c });
                }
            }
        }

        this._shuffle(perimeterCandidates);

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
                if (!isBoardCellOccupied(cell) && !isHQ && !isNearHQ && !cell.hasSocket) {
                    allCandidates.push({ r, c });
                }
            }
        }

        this._shuffle(allCandidates);

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

        if (this.state.defenseSystem && typeof this.state.defenseSystem.reconcileWithMax === "function") {
            this.state.defenseSystem.reconcileWithMax();
        }

        return newGrid;
    }

    /**
     * 🔍 形状配置可否チェック（地勢レベルGL/標高E/本営近郊/全理由配列reasons収集対応）
     * @param {number} startR - 配置開始行
     * @param {number} startC - 配置開始列
     * @param {Array<Array<number>>} shapeMatrix - 形状マトリクス
     * @param {Object} [terrain] - uniform card用のfallback地勢データ
     * @param {Array<Object>|null} [attributeCells] - Multi-Attribute cardのlocal cell semantic
     * @returns {{ can: boolean, reason?: string, reasons: Array<string> }}
     */
    canPlaceShape(startR, startC, shapeMatrix, terrain = null, attributeCells = null) {
        if (!this.state || !this.state.grid) return { can: false, reason: "NO_GRID", reasons: ["NO_GRID"] };

        if (Array.isArray(attributeCells)) {
            const attributeValidation = validatePlacementAttributeMap(shapeMatrix, attributeCells);
            if (!attributeValidation.valid) {
                return {
                    can: false,
                    reason: "INVALID_ATTRIBUTE_MAP",
                    reasons: ["INVALID_ATTRIBUTE_MAP"],
                    attributeReasons: [...attributeValidation.reasons]
                };
            }

            const unknownTerrainId = attributeCells
                .map(getPlacementAttributeTerrainId)
                .find(terrainId => !isCanonicalTerrainId(terrainId));
            if (unknownTerrainId) {
                return {
                    can: false,
                    reason: "UNKNOWN_ATTRIBUTE_TERRAIN",
                    reasons: ["UNKNOWN_ATTRIBUTE_TERRAIN"],
                    terrainId: unknownTerrainId
                };
            }
        }

        const rows = shapeMatrix.length;
        const cols = shapeMatrix[0].length;
        const size = (this.state.stage && this.state.stage.size) ? this.state.stage.size : 5;
        const terrainAt = createPlacementSemanticResolver(shapeMatrix, terrain, attributeCells);
        const placingKeys = new Set();

        for (let dr = 0; dr < rows; dr++) {
            for (let dc = 0; dc < cols; dc++) {
                if (shapeMatrix[dr][dc] === 1) {
                    placingKeys.add(coordinateKey(startR + dr, startC + dc));
                }
            }
        }

        const reasons = [];
        let isOutOfBounds = false;
        let isAlreadyPlaced = false;
        let isMountainNearHQ = false;
        let isWetlandNearHQ = false;
        let isAdjacent = false;
        let hasInvalidGL = false;
        let isWetlandTooClose = false;
        const elevationReasons = new Set();

        // Card-internal edges are owned by the card definition. Only the board
        // outside the placement footprint participates in normal adjacency rules.
        for (let dr = 0; dr < rows; dr++) {
            for (let dc = 0; dc < cols; dc++) {
                if (shapeMatrix[dr][dc] !== 1) continue;
                const r = startR + dr;
                const c = startC + dc;
                const cellTerrain = terrainAt(dr, dc);
                const targetE = cellTerrain
                    ? (cellTerrain.e !== undefined ? cellTerrain.e : (cellTerrain.terrain?.e ?? 1))
                    : null;
                const targetTid = cellTerrain ? (cellTerrain.terrainId || cellTerrain.id || "") : "";
                const isMountain = targetE === 3 || targetTid.includes("MOUNTAIN");

                if (r < 0 || r >= size || c < 0 || c >= size) {
                    isOutOfBounds = true;
                    continue;
                }
                if (isBoardCellOccupied(this.state.grid[r][c])) isAlreadyPlaced = true;
                const isWetland = isWetlandTerrain(cellTerrain);
                if (this.isHQVicinity(r, c)) {
                    if (isMountain) isMountainNearHQ = true;
                    if (isWetland) isWetlandNearHQ = true;
                }
                if (isWetland && isWithinWetlandExclusionRange(this.state, r, c)) {
                    isWetlandTooClose = true;
                }
            }
        }

        if (isOutOfBounds) reasons.push("OUT_OF_BOUNDS");
        if (isAlreadyPlaced) reasons.push("ALREADY_PLACED");
        if (isMountainNearHQ) reasons.push("MOUNTAIN_NEAR_HQ_FORBIDDEN");
        if (isWetlandNearHQ) reasons.push("WETLAND_NEAR_HQ_FORBIDDEN");

        if (!isOutOfBounds) {
            for (let dr = 0; dr < rows; dr++) {
                for (let dc = 0; dc < cols; dc++) {
                    if (shapeMatrix[dr][dc] !== 1) continue;

                    const r = startR + dr;
                    const c = startC + dc;
                    const cellTerrain = terrainAt(dr, dc);
                    const targetGL = cellTerrain
                        ? (cellTerrain.gl !== undefined ? cellTerrain.gl : (cellTerrain.terrain?.gl ?? null))
                        : null;
                    const targetE = cellTerrain
                        ? (cellTerrain.e !== undefined ? cellTerrain.e : (cellTerrain.terrain?.e ?? 1))
                        : null;
                    const neighbors = [
                        [r - 1, c], [r + 1, c], [r, c - 1], [r, c + 1]
                    ];

                    for (const [nr, nc] of neighbors) {
                        if (nr < 0 || nr >= size || nc < 0 || nc >= size) continue;
                        const neighborCell = this.state.grid[nr][nc];
                        if (placingKeys.has(coordinateKey(nr, nc)) && !neighborCell.placed) continue;
                        if (!neighborCell.placed) continue;
                        isAdjacent = true;

                        if (!neighborCell.isHQ && neighborCell.terrain) {
                            if (targetGL !== null) {
                                const placedGL = neighborCell.terrain.gl !== undefined ? neighborCell.terrain.gl : 1;
                                if ((targetGL === 0 && placedGL >= 2) || (targetGL >= 2 && placedGL === 0)) {
                                    hasInvalidGL = true;
                                }
                            }

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

            if (!isAdjacent && !isAlreadyPlaced) reasons.push("NOT_ADJACENT");
            if (hasInvalidGL) reasons.push("INVALID_GL_NEIGHBOR");
            if (isWetlandTooClose) reasons.push("WETLAND_TOO_CLOSE");
            elevationReasons.forEach(reason => reasons.push(reason));

            // Existing "same true-zone adjacency forbidden" contract, evaluated
            // with each prospective cell's own zone semantic.
            if (!isAlreadyPlaced) {
                const getVirtualCell = (vr, vc) => {
                    if (vr < 0 || vr >= size || vc < 0 || vc >= size) return null;

                    const localR = vr - startR;
                    const localC = vc - startC;
                    if (localR >= 0 && localR < rows && localC >= 0 && localC < cols
                        && shapeMatrix[localR]?.[localC] === 1) {
                        const virtualTerrain = terrainAt(localR, localC);
                        return {
                            placed: true,
                            isHQ: false,
                            terrain: virtualTerrain,
                            terrainId: virtualTerrain?.terrainId || virtualTerrain?.id || null,
                            zoneCategory: getZoneCategory(virtualTerrain),
                            isVirtualPlacing: true
                        };
                    }

                    const realCell = this.state.grid[vr][vc];
                    if (realCell && realCell.placed && !realCell.isHQ && realCell.terrain) {
                        return {
                            placed: true,
                            isHQ: false,
                            terrain: realCell.terrain,
                            terrainId: realCell.terrain.terrainId || realCell.terrain.id,
                            zoneCategory: getZoneCategory(realCell.terrain),
                            isMerged: isTrueMergedCell(this.state, realCell),
                            mergeGroupId: realCell.mergeGroupId
                        };
                    }
                    return null;
                };

                let hasMergedAdjacencyConflict = false;
                for (let topR = 0; topR < size - 1; topR++) {
                    for (let leftC = 0; leftC < size - 1; leftC++) {
                        const cells = [
                            getVirtualCell(topR, leftC),
                            getVirtualCell(topR, leftC + 1),
                            getVirtualCell(topR + 1, leftC),
                            getVirtualCell(topR + 1, leftC + 1)
                        ];
                        if (cells.some(cell => !cell)) continue;

                        const targetZoneCategory = cells[0].zoneCategory;
                        if (!targetZoneCategory || cells.some(cell => cell.zoneCategory !== targetZoneCategory)) continue;
                        if (cells.some(cell => isWetlandTerrain(cell.terrain))) continue;
                        if (!cells.some(cell => cell.isVirtualPlacing)) continue;

                        const perimeterNeighbors = [
                            [topR - 1, leftC], [topR - 1, leftC + 1],
                            [topR + 2, leftC], [topR + 2, leftC + 1],
                            [topR, leftC - 1], [topR + 1, leftC - 1],
                            [topR, leftC + 2], [topR + 1, leftC + 2]
                        ];

                        for (const [pr, pc] of perimeterNeighbors) {
                            if (pr < 0 || pr >= size || pc < 0 || pc >= size) continue;
                            const realNeighbor = this.state.grid[pr][pc];
                            if (!realNeighbor?.placed || realNeighbor.isHQ || !realNeighbor.terrain) continue;
                            if (isTrueMergedCell(this.state, realNeighbor)
                                && getZoneCategory(realNeighbor.terrain) === targetZoneCategory) {
                                hasMergedAdjacencyConflict = true;
                                break;
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
            return { can: false, reason: reasons[0], reasons };
        }
        return { can: true, reasons: [] };
    }

    /**
     * 🧩 土地ブロックの配置実行
     */
    placeShape(startR, startC, shapeMatrix, terrain, handIdx = -1, attributeCells = null) {
        if (!this.state) return { can: false, reason: "NO_STATE" };
        if (this.state.hasPickedThisTurn) return { can: false, reason: "ALREADY_PICKED_THIS_TURN" };

        const check = this.canPlaceShape(startR, startC, shapeMatrix, terrain, attributeCells);
        if (!check.can) return check;

        const rows = shapeMatrix.length;
        const cols = shapeMatrix[0].length;
        const terrainAt = createPlacementSemanticResolver(shapeMatrix, terrain, attributeCells);
        const productionContract = normalizeProductionContract(terrain);
        const pGroupId = `place_${this.state.placementGroupCounter++}`;

        let activeCellCount = 0;
        for (let dr = 0; dr < rows; dr++) {
            for (let dc = 0; dc < cols; dc++) {
                if (shapeMatrix[dr][dc] === 1) activeCellCount++;
            }
        }

        const I18n = (typeof globalThis !== 'undefined' && globalThis.I18n) ? globalThis.I18n : (typeof window !== 'undefined' && window.I18n ? window.I18n : { t: k => k });
        const representativeTerrainId = resolveRepresentativePlacementTerrainId(terrain);
        const representativeTerrain = isCanonicalTerrainId(representativeTerrainId)
            ? resolveCanonicalTerrainSemantic(representativeTerrainId)
            : terrain;
        const representativeNameKey = representativeTerrain?.nameKey
            || terrain?.nameKey
            || representativeTerrainId
            || "TERRAIN_PLAINS";
        const baseTerrainName = I18n.t(representativeNameKey);
        const multiSuffixKey = "CARD_MULTI_ATTRIBUTE_SUFFIX";
        const translatedMultiSuffix = I18n.t(multiSuffixKey);
        const multiSuffix = hasMultiplePlacementTerrainAttributes(terrain)
            && translatedMultiSuffix
            && translatedMultiSuffix !== multiSuffixKey
            ? translatedMultiSuffix
            : "";
        const terrainName = `${baseTerrainName}${multiSuffix}`;

        let spawnedAnySocket = false;
        for (let dr = 0; dr < rows; dr++) {
            for (let dc = 0; dc < cols; dc++) {
                if (shapeMatrix[dr][dc] === 1) {
                    const r = startR + dr;
                    const c = startC + dc;
                    const cell = this.state.grid[r][c];
                    const cellTerrain = terrainAt(dr, dc);
                    cell.placed = true;
                    cell.terrain = cellTerrain;
                    cell.placementGroupId = pGroupId;
                    if (productionContract.status === LAND_PRODUCTION_STATUS.UNRESOLVED) {
                        cell.production = {
                            status: LAND_PRODUCTION_STATUS.UNRESOLVED,
                            scope: null,
                            cellYields: null
                        };
                    } else if (productionContract.status === LAND_PRODUCTION_STATUS.RESOLVED) {
                        cell.production = {
                            status: LAND_PRODUCTION_STATUS.RESOLVED,
                            scope: productionContract.scope,
                            cellYields: findContractCellYields(
                                productionContract,
                                dr,
                                dc,
                                findPlacementAttributeCell(attributeCells, dr, dc)
                            )
                        };
                    } else {
                        cell.production = null;
                    }
                    cell.isHQVicinity = (Math.abs(r - 2) <= 1 && Math.abs(c - 2) <= 1 && !(r === 2 && c === 2));

                    // ★ 水源・ソケット開花判定（失敗結果もキャッシュし、Undo再抽選を防ぐ）
                    if (!cell.socketResource && (cell.hasSocket || isWetlandTerrain(cellTerrain))) {
                        const seedKey = `${r}_${c}`;
                        let spawnedSocket = null;
                        const hasCachedOutcome = cell.cachedSocketSeeds
                            && Object.prototype.hasOwnProperty.call(cell.cachedSocketSeeds, seedKey);

                        if (hasCachedOutcome) {
                            spawnedSocket = cell.cachedSocketSeeds[seedKey] || null;
                        } else {
                            if (!cell.cachedSocketSeeds) cell.cachedSocketSeeds = {};
                            const baseTid = cellTerrain?.terrainId || cellTerrain?.id || "";
                            const getRng = () => this._nextGameplayFloat();
                            // 一般資源プール抽選。
                            // 湖・オアシスは新規Runでは生成しない。旧データ定義はセーブ互換のため残す。
                            const socketMaster = (typeof globalThis !== "undefined" && globalThis.SOCKET_RESOURCE_MASTER) ? globalThis.SOCKET_RESOURCE_MASTER : (typeof window !== "undefined" ? window.SOCKET_RESOURCE_MASTER : null);
                            if (!spawnedSocket && cell.hasSocket && socketMaster) {
                                const pool = socketMaster.filter(s =>
                                    !s.isSpecialWater
                                    && !isLegacyIrrigationResource(s)
                                    && s.reqTerrains
                                    && s.reqTerrains.some(t => baseTid.includes(t))
                                );
                                if (pool.length > 0) {
                                    const chosen = pool[Math.floor(getRng() * pool.length)];
                                    spawnedSocket = {
                                        id: chosen.id,
                                        nameKey: chosen.nameKey,
                                        category: chosen.category,
                                        icon: chosen.icon,
                                        bonusFood: (chosen.bonusYields && chosen.bonusYields.food) || 0,
                                        bonusWood: (chosen.bonusYields && (chosen.bonusYields.material !== undefined ? chosen.bonusYields.material : chosen.bonusYields.wood)) || 0,
                                        bonusDefense: (chosen.bonusYields && chosen.bonusYields.defense) || 0,
                                        bonusMystic: (chosen.bonusYields && chosen.bonusYields.mystic) || 0,
                                        capabilities: Array.isArray(chosen.capabilities)
                                            ? [...chosen.capabilities]
                                            : []
                                    };
                                }
                            }
                            if (!spawnedSocket && cell.hasSocket) {
                                spawnedSocket = { id: "SOCKET_WILD_WHEAT", nameKey: "SOCKET_WILD_WHEAT", category: "CAT_GRAIN", icon: "🌾", bonusFood: 3, bonusWood: 0, bonusDefense: 0, bonusMystic: 0 };
                            }
                            cell.cachedSocketSeeds[seedKey] = spawnedSocket ? { ...spawnedSocket } : null;
                        }

                        if (spawnedSocket) {
                            cell.socketResource = { ...spawnedSocket };
                            spawnedAnySocket = true;
                            const posStr = `(${String.fromCharCode(65+c)}${r+1})`;
                            const sName = I18n.t(spawnedSocket.nameKey);
                            const sIcon = spawnedSocket.icon || "💎";
                            if (typeof this.state.addLog === 'function') {
                                const cellTerrainName = I18n.t((cellTerrain && (cellTerrain.nameKey || cellTerrain.terrainId || cellTerrain.id)) || "TERRAIN_PLAINS");
                                this.state.addLog(I18n.t("LOG_SOCKET_SPAWNED", { pos: posStr, terrainName: cellTerrainName, socketName: sName, icon: sIcon }));
                            }
                            if (this.state.toastQueue) {
                                this.state.toastQueue.push({ r, c, text: I18n.t("TOAST_SOCKET_SPAWNED", { name: sName, icon: sIcon }) });
                            }
                        }
                    }
                }
            }
        }

        if (productionContract.status === LAND_PRODUCTION_STATUS.RESOLVED && productionContract.blockYields) {
            if (!this.state.placedBlockProduction || typeof this.state.placedBlockProduction !== "object") {
                this.state.placedBlockProduction = {};
            }
            this.state.placedBlockProduction[pGroupId] = {
                status: LAND_PRODUCTION_STATUS.RESOLVED,
                scope: productionContract.scope,
                yields: { ...productionContract.blockYields }
            };
        }

        const placementOutcome = {
            socketSpawned: spawnedAnySocket,
            connection1x2: false,
            connection1x3: false,
            merge2x2: false
        };

        const placedCoords = [];
        for (let dr = 0; dr < rows; dr++) {
            for (let dc = 0; dc < cols; dc++) {
                if (shapeMatrix[dr][dc] === 1) {
                    const r = startR + dr;
                    const c = startC + dc;
                    placedCoords.push({ r, c });
                    const connRes = this.checkConnectionBonus(r, c, this.state.grid[r][c].terrain);
                    if (connRes && connRes.connection1x3) placementOutcome.connection1x3 = true;
                    else if (connRes && connRes.connection1x2) placementOutcome.connection1x2 = true;
                }
            }
        }
        const mergeRes = this.checkMergePatterns(placedCoords);
        if (mergeRes && mergeRes.merge2x2) {
            placementOutcome.merge2x2 = true;
        }
        this.checkNewMergeLinks();

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

        if (this.engine && this.engine.deckManager) {
            this.engine.deckManager.consumeCardIfUnique(terrain);
        } else if (this.state && this.state.deckManager) {
            this.state.deckManager.consumeCardIfUnique(terrain);
        }

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
        if (this.state.defenseSystem && typeof this.state.defenseSystem.reconcileWithMax === "function") {
            this.state.defenseSystem.reconcileWithMax();
        }
        if (typeof this.state.checkConditionalBuffs === 'function') {
            this.state.checkConditionalBuffs();
        }
        return { can: true, success: true, placementOutcome };
    }

    /**
     * ⚡ 1x2 / 1x3 連結即時ボーナス判定 ＆ マージグループ統合
     */
    checkConnectionBonus(r, c, terrain) {
        if (!this.state || !this.state.grid) return;
        const currentCell = this.state.grid[r] && this.state.grid[r][c];
        if (!currentCell || isWetlandTerrain(terrain) || isIrrigationSourceCell(currentCell)) {
            return { connected: false };
        }
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
            if (isWetlandTerrain(cell.terrain) || isIrrigationSourceCell(cell)) return false;
            
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

            // 1. 新規配置カード内の同Zone互換セルだけに targetGroupId を伝播
            for (let row = 0; row < size; row++) {
                for (let col = 0; col < size; col++) {
                    const cell = this.state.grid[row][col];
                    if (cell
                        && currPlaceId
                        && cell.placementGroupId === currPlaceId
                        && areTerrainsZoneCompatible(cell.terrain, currentCell.terrain)
                        && !isWetlandTerrain(cell.terrain)
                        && !isIrrigationSourceCell(cell)) {
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
                        if (cell
                            && cell.mergeGroupId
                            && oldGroupIds.has(cell.mergeGroupId)
                            && !isWetlandTerrain(cell.terrain)
                            && !isIrrigationSourceCell(cell)) {
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
                return { connected: true, connection1x2: !is1x3, connection1x3: !!is1x3 };
            }
        }
        return { connected: false };
    }

    /**
     * 🎉 2x2 正方形マージ判定 ＆ 1.2倍産出グループ化
     */
    checkMergePatterns(placedCoords = []) {
        if (!this.state || !this.state.grid) return { merge2x2: false };
        let formedMerge2x2 = false;
        const size = this.state.grid.length;
        const I18n = (typeof globalThis !== 'undefined' && globalThis.I18n) ? globalThis.I18n : (typeof window !== 'undefined' && window.I18n ? window.I18n : { t: k => k });

        // 1. 2x2 正方形マージ判定（湿原・水源セルは地帯化対象外）
        for (let r = 0; r < size - 1; r++) {
            for (let c = 0; c < size - 1; c++) {
                const c1 = this.state.grid[r][c];
                const c2 = this.state.grid[r][c+1];
                const c3 = this.state.grid[r+1][c];
                const c4 = this.state.grid[r+1][c+1];

                const cells = [c1, c2, c3, c4];
                const allPlaced = cells.every(cell =>
                    cell.placed
                    && !cell.isHQ
                    && !isWetlandTerrain(cell.terrain)
                    && (!cell.merged || cell.mergeType !== "2x2")
                );
                if (allPlaced) {
                    const firstBaseId = c1.terrain ? (c1.terrain.terrainId || c1.terrain.id) : null;
                    const zoneCategory = getZoneCategory(c1.terrain);
                    const sameTerrain = cells.every(cell => areTerrainsZoneCompatible(cell.terrain, c1.terrain));

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
                            zoneCategory,
                            nameKey: zoneCategory === "PLAINS" ? "TERRAIN_PLAINS" : c1.terrain.nameKey,
                            mergeType: "2x2",
                            cells: cells.map(cell => ({ r: cell.r, c: cell.c })),
                            yieldMultiplier: 1.20,
                            createdTurn: this.state.turn
                        };

                        const tid = String(zoneCategory || firstBaseId).toUpperCase();
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

                        const tName = I18n.t(zoneCategory === "PLAINS" ? "TERRAIN_PLAINS" : c1.terrain.nameKey);
                        const toastMsg = I18n.t("TOAST_MERGE_2X2", { text: bText });
                        if (typeof this.state.addLog === 'function') {
                            this.state.addLog(I18n.t("LOG_MERGE_2X2_COMPLETE", { name: tName, bonus: bText }));
                        }
                        if (this.state.toastQueue) {
                            formedMerge2x2 = true;
                            this.state.toastQueue.push({
                                type: "MERGE_2X2",
                                r,
                                c,
                                text: toastMsg,
                                rewards: {
                                    food: bonusFood,
                                    wood: bonusWood,
                                    mystic: bonusMystic,
                                    ember: bonusEmber
                                }
                            });
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
                    const allPlaced = cells.every(cell =>
                        cell.placed && !cell.isHQ && !cell.merged && !isIrrigationSourceCell(cell)
                    );
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
                                const logMsg = I18n ? I18n.t("LOG_MERGE_L_COMPLETE", { bonus: bText }) : `🟨 L-Shape Zone Formed (${bText})`;
                                this.state.addLog(logMsg);
                            }
                            if (this.state.toastQueue) {
                                formedMerge2x2 = true;
                                const toastMsg = I18n ? I18n.t("TOAST_MERGE_L", { bonus: bText }) : `🟨 L-Shape Zone Formed (${bText})`;
                                this.state.toastQueue.push({
                                    type: "MERGE_L",
                                    r: coords[0].r,
                                    c: coords[0].c,
                                    text: toastMsg,
                                    rewards: { food: 4, wood: 6, ember: 1 }
                                });
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
            // 縦3 ＋ 中央右
            [[0,0], [1,0], [2,0], [1,1]],
            // 縦3 ＋ 中央左
            [[0,1], [1,1], [2,1], [1,0]]
        ];

        for (let r = 0; r < size - 2; r++) {
            for (let c = 0; c < size - 2; c++) {
                for (const offsets of tOffsets) {
                    const coords = offsets.map(([dr, dc]) => ({ r: r + dr, c: c + dc }));
                    const cells = coords.map(pt => this.state.grid[pt.r][pt.c]);
                    const allPlaced = cells.every(cell =>
                        cell.placed
                        && !cell.isHQ
                        && !isIrrigationSourceCell(cell)
                        && (!cell.merged || cell.mergeType !== "T_SHAPE")
                    );
                    if (allPlaced) {
                        const allMountain = cells.every(cell => {
                            const tid = cell.terrain ? (cell.terrain.terrainId || cell.terrain.id) : null;
                            return tid && (tid === "E3_MOUNTAIN" || tid.includes("MOUNTAIN"));
                        });

                        if (allMountain) {
                            const groupId = `merge_t_${this.state.mergeGroupCounter++}`;
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
                                const logMsg = I18n ? I18n.t("LOG_MERGE_T_COMPLETE", { bonus: bText }) : `🛡️ T-Shape Zone Formed (${bText})`;
                                this.state.addLog(logMsg);
                            }
                            if (this.state.toastQueue) {
                                const toastMsg = I18n ? I18n.t("TOAST_MERGE_T", { bonus: bText }) : `🛡️ T-Shape Zone Formed (${bText})`;
                                this.state.toastQueue.push({
                                    type: "MERGE_T",
                                    r: coords[0].r,
                                    c: coords[0].c,
                                    text: toastMsg,
                                    rewards: { wood: 8, mystic: 4, ember: 1 }
                                });
                            }
                        }
                    }
                }
            }
        }
        return { merge2x2: formedMerge2x2 };
    }

    /**
     * 🔗 異属性の真のMERGE同士が面隣接した新規LINKを登録する
     */
    checkNewMergeLinks() {
        if (!this.state || !this.state.grid) return { count: 0, links: [] };
        if (!(this.state.mergeLinks instanceof Set)) {
            this.state.mergeLinks = new Set(this.state.mergeLinks || []);
        }

        const size = this.state.grid.length;
        const newLinks = [];
        const newLinkCoords = [];
        const directions = [[0, 1], [1, 0]];

        for (let r = 0; r < size; r++) {
            for (let c = 0; c < size; c++) {
                const cell = this.state.grid[r][c];
                if (!isTrueMergedCell(this.state, cell)) continue;

                for (const [dr, dc] of directions) {
                    const nr = r + dr;
                    const nc = c + dc;
                    if (nr >= size || nc >= size) continue;

                    const neighbor = this.state.grid[nr][nc];
                    if (!isTrueMergedCell(this.state, neighbor)) continue;
                    if (cell.mergeGroupId === neighbor.mergeGroupId) continue;
                    if (!haveDifferentMergeTerrainAttributes(
                        this.state,
                        cell.mergeGroupId,
                        neighbor.mergeGroupId,
                        cell,
                        neighbor
                    )) continue;

                    const linkKey = getMergeLinkKey(cell.mergeGroupId, neighbor.mergeGroupId);
                    if (this.state.mergeLinks.has(linkKey)) continue;

                    this.state.mergeLinks.add(linkKey);
                    newLinks.push(linkKey);
                    newLinkCoords.push({ r, c, neighborR: nr, neighborC: nc });
                }
            }
        }

        const newLinkCount = newLinks.length;
        if (newLinkCount > 0) {
            const emberSystem = this.state.emberSystem;
            if (emberSystem && typeof emberSystem.expandMaxCapacity === 'function') {
                emberSystem.expandMaxCapacity(newLinkCount);
            } else {
                this.state.maxEmber = (this.state.maxEmber || 20) + newLinkCount;
            }

            if (emberSystem && typeof emberSystem.recoverInstant === 'function') {
                emberSystem.recoverInstant(newLinkCount);
            } else {
                this.state.ember = Math.min(this.state.maxEmber, (this.state.ember || 0) + newLinkCount);
            }

            const I18n = (this.engine && this.engine.i18n)
                || ((typeof globalThis !== 'undefined' && globalThis.I18n) ? globalThis.I18n : null)
                || ((typeof window !== 'undefined' && window.I18n) ? window.I18n : null);
            if (typeof this.state.addLog === 'function' && I18n && typeof I18n.t === 'function') {
                const logKey = newLinkCount === 1 ? "LOG_MERGE_LINK_COMPLETE" : "LOG_MERGE_LINKS_COMPLETE";
                this.state.addLog(I18n.t(logKey, { count: newLinkCount, bonus: newLinkCount }));
            }

            // 🌟 LINK成立専用 Toast (瞬間イベント通知 - 実際の接触辺セルをアンカーに発火)
            if (this.state.toastQueue && newLinkCoords.length > 0) {
                const anchor = newLinkCoords[0];
                const toastKey = newLinkCount === 1 ? "TOAST_MERGE_LINK_COMPLETE" : "TOAST_MERGE_LINKS_COMPLETE";
                const toastMsg = I18n && typeof I18n.t === 'function'
                    ? I18n.t(toastKey, { count: newLinkCount, bonus: newLinkCount })
                    : (newLinkCount === 1 ? "Cooperation (+1)" : `Cooperations (+${newLinkCount})`);
                this.state.toastQueue.push({
                    type: "LINK_COMPLETE",
                    r: anchor.r,
                    c: anchor.c,
                    text: toastMsg,
                    rewards: {
                        ember: newLinkCount,
                        maxEmber: newLinkCount
                    }
                });
            }
        }

        return { count: newLinkCount, links: newLinks };
    }

    getMergeLinkCount() {
        return this.state && this.state.mergeLinks instanceof Set
            ? this.state.mergeLinks.size
            : 0;
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
