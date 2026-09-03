/**
 * 🌐 StateSerializer (ゲームステート決定論的直列化モジュール)
 * 
 * 責務:
 * 1. GameState から UI セッション情報・循環参照・関数・DOM参照を完全に排除した
 *    「純粋なゲーム世界データ」のみを正規化・直列化する。
 * 2. Undo の完全性検証 (Deep Equality)、Save/Load、Replay、テストに共通利用可能。
 */

export function serializeGameState(state) {
    if (!state) return null;

    const defenseSnapshot = state.defenseSystem && typeof state.defenseSystem.reconcileWithMax === "function"
        ? state.defenseSystem.reconcileWithMax()
        : {
            currentDefense: state.currentDefense !== undefined ? state.currentDefense : 10,
            maxDefense: state.maxDefense !== undefined ? state.maxDefense : (state.defense !== undefined ? state.defense : 10)
        };

    // 1. 盤面グリッドの正規化
    const serializedGrid = [];
    if (Array.isArray(state.grid)) {
        for (let r = 0; r < state.grid.length; r++) {
            serializedGrid[r] = [];
            for (let c = 0; c < state.grid[r].length; c++) {
                const cell = state.grid[r][c];
                if (!cell) {
                    serializedGrid[r][c] = null;
                    continue;
                }
                serializedGrid[r][c] = {
                    r: cell.r,
                    c: cell.c,
                    isHQ: !!cell.isHQ,
                    placed: !!cell.placed,
                    hasSocket: !!cell.hasSocket,
                    searched: !!cell.searched,
                    placementGroupId: cell.placementGroupId || null,
                    mergeGroupId: cell.mergeGroupId || null,
                    cachedSocketSeeds: cell.cachedSocketSeeds
                        ? JSON.parse(JSON.stringify(cell.cachedSocketSeeds))
                        : {},
                    terrain: cell.terrain ? {
                        id: cell.terrain.id || null,
                        terrainId: cell.terrain.terrainId || null,
                        nameKey: cell.terrain.nameKey || null,
                        category: cell.terrain.category || null,
                        shape: cell.terrain.shape ? JSON.parse(JSON.stringify(cell.terrain.shape)) : null,
                        yields: cell.terrain.yields ? { ...cell.terrain.yields } : null,
                        baseYieldsPerTile: cell.terrain.baseYieldsPerTile ? { ...cell.terrain.baseYieldsPerTile } : null
                    } : null,
                    socketResource: cell.socketResource ? {
                        id: cell.socketResource.id || null,
                        nameKey: cell.socketResource.nameKey || null,
                        category: cell.socketResource.category || null,
                        icon: cell.socketResource.icon || null,
                        yields: cell.socketResource.yields ? { ...cell.socketResource.yields } : null,
                        bonusFood: cell.socketResource.bonusFood || 0,
                        bonusWood: cell.socketResource.bonusWood || 0,
                        bonusMaterial: cell.socketResource.bonusMaterial || 0,
                        bonusDefense: cell.socketResource.bonusDefense || 0,
                        bonusMystic: cell.socketResource.bonusMystic || 0,
                        isLake: !!cell.socketResource.isLake
                    } : null
                };
            }
        }
    }

    // 2. 手札オファリングの正規化
    const serializedOffering = Array.isArray(state.handOffering)
        ? state.handOffering.map(card => (card && !card.isBlank) ? {
            id: card.id,
            category: card.category || "LAND",
            rarity: card.rarity || "COMMON",
            terrainId: card.terrainId || (card.terrain ? card.terrain.terrainId : null),
            nameKey: card.nameKey || (card.terrain ? card.terrain.nameKey : null),
            shape: card.shape ? JSON.parse(JSON.stringify(card.shape)) : (card.terrain && card.terrain.shape ? JSON.parse(JSON.stringify(card.terrain.shape)) : null),
            yields: card.yields ? { ...card.yields } : (card.terrain && card.terrain.yields ? { ...card.terrain.yields } : null),
            cyclePolicy: card.cyclePolicy || null
        } : null)
        : [];

    // 3. リザーブ保留枠の正規化
    const serializedReserve = Array.isArray(state.reserveSlots)
        ? state.reserveSlots.map(card => card ? {
            id: card.id,
            category: card.category || "LAND",
            rarity: card.rarity || "COMMON",
            terrainId: card.terrainId || (card.terrain ? card.terrain.terrainId : null),
            nameKey: card.nameKey || (card.terrain ? card.terrain.nameKey : null),
            shape: card.shape ? JSON.parse(JSON.stringify(card.shape)) : (card.terrain && card.terrain.shape ? JSON.parse(JSON.stringify(card.terrain.shape)) : null),
            yields: card.yields ? { ...card.yields } : (card.terrain && card.terrain.yields ? { ...card.terrain.yields } : null),
            cyclePolicy: card.cyclePolicy || null
        } : null)
        : [];

    // 4. クールダウン・UNIQUE消費の正規化
    const serializedCooldowns = {};
    if (state.cardCooldowns && typeof state.cardCooldowns === "object") {
        for (const [key, val] of Object.entries(state.cardCooldowns)) {
            serializedCooldowns[key] = val;
        }
    }
    const serializedConsumedUniques = Array.isArray(state.consumedUniqueCards)
        ? [...state.consumedUniqueCards].sort()
        : [];

    // 5. ステージ情報
    const serializedStage = state.stage ? {
        id: state.stage.id,
        name: state.stage.name,
        size: state.stage.size,
        maxTiles: state.stage.maxTiles
    } : { id: 1, name: "Stage 1", size: 5, maxTiles: 24 };

    // 6. 純粋ゲームステート集約オブジェクト
    return {
        turn: state.turn || 1,
        ember: state.ember !== undefined ? state.ember : 20,
        food: state.food !== undefined ? state.food : 50,
        wood: state.wood !== undefined ? state.wood : 30,
        defense: state.defense !== undefined ? state.defense : 10,
        defenseCapacityBonus: state.defenseCapacityBonus !== undefined ? state.defenseCapacityBonus : 0,
        currentDefense: defenseSnapshot.currentDefense,
        maxDefense: defenseSnapshot.maxDefense,
        mystic: state.mystic !== undefined ? state.mystic : 0,
        hasPickedThisTurn: !!state.hasPickedThisTurn,
        hasMulliganedThisTurn: !!state.hasMulliganedThisTurn,
        permanentPlainsFoodBonus: state.permanentPlainsFoodBonus || 0,
        grid: serializedGrid,
        handOffering: serializedOffering,
        reserveSlots: serializedReserve,
        cardCooldowns: serializedCooldowns,
        consumedUniqueCards: serializedConsumedUniques,
        stage: serializedStage
    };
}
