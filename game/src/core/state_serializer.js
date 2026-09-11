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

    const cloneData = (value, fallback = null) => {
        if (value === undefined) return fallback;
        return JSON.parse(JSON.stringify(value));
    };

    const defenseSnapshot = state.defenseSystem && typeof state.defenseSystem.reconcileWithMax === "function"
        ? state.defenseSystem.reconcileWithMax()
        : {
            currentDefense: state.currentDefense !== undefined ? state.currentDefense : 10,
            maxDefense: state.maxDefense !== undefined ? state.maxDefense : (state.defense !== undefined ? state.defense : 10)
        };

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
                    merged: !!cell.merged,
                    mergeType: cell.mergeType || null,
                    cachedSocketSeeds: cell.cachedSocketSeeds
                        ? JSON.parse(JSON.stringify(cell.cachedSocketSeeds))
                        : {},
                    terrain: cell.terrain ? {
                        id: cell.terrain.id || null,
                        terrainId: cell.terrain.terrainId || null,
                        nameKey: cell.terrain.nameKey || null,
                        category: cell.terrain.category || null,
                        zoneCategory: cell.terrain.zoneCategory || null,
                        trialTerrainCategory: cell.terrain.trialTerrainCategory || null,
                        e: Number.isFinite(cell.terrain.e) ? cell.terrain.e : null,
                        gl: Number.isFinite(cell.terrain.gl) ? cell.terrain.gl : null,
                        food: Number.isFinite(cell.terrain.food) ? cell.terrain.food : null,
                        wood: Number.isFinite(cell.terrain.wood) ? cell.terrain.wood : null,
                        material: Number.isFinite(cell.terrain.material) ? cell.terrain.material : null,
                        defense: Number.isFinite(cell.terrain.defense) ? cell.terrain.defense : null,
                        mystic: Number.isFinite(cell.terrain.mystic) ? cell.terrain.mystic : null,
                        isSpecialBlock: !!cell.terrain.isSpecialBlock,
                        isArtificialTerrain: !!cell.terrain.isArtificialTerrain,
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

    const serializeCardInstance = (card) => {
        if (!card) return null;
        if (card.isBlank) {
            return {
                isBlank: true,
                id: card.id || null,
                originalHandIdx: Number.isInteger(card.originalHandIdx) ? card.originalHandIdx : null
            };
        }
        const master = card.terrain || card;
        return {
            id: card.id || null,
            cardMasterId: card.cardMasterId || master.id || null,
            category: master.category || card.category || "LAND",
            rarity: master.rarity || card.rarity || "COMMON",
            terrainId: master.terrainId || master.id || null,
            nameKey: master.nameKey || card.nameKey || null,
            currentShape: cloneData(card.currentShape || master.shape || [[1]], [[1]]),
            currentAnchor: cloneData(card.currentAnchor),
            cyclePolicy: master.cyclePolicy || card.cyclePolicy || null,
            originalHandIdx: Number.isInteger(card.originalHandIdx) ? card.originalHandIdx : null,
            reservedThisTurn: !!card.reservedThisTurn
        };
    };

    const serializedOffering = Array.isArray(state.handOffering)
        ? state.handOffering.map(serializeCardInstance)
        : [];

    const serializedReserve = Array.isArray(state.reserveSlots)
        ? state.reserveSlots.map(serializeCardInstance)
        : [];

    const serializedCooldowns = {};
    if (state.cardCooldowns && typeof state.cardCooldowns === "object") {
        for (const [key, val] of Object.entries(state.cardCooldowns)) {
            serializedCooldowns[key] = val;
        }
    }
    const serializedConsumedUniques = Array.isArray(state.consumedUniqueCards)
        ? [...state.consumedUniqueCards].sort()
        : [];
    const serializedUsedUniques = Array.isArray(state.usedUniqueCards)
        ? [...state.usedUniqueCards].sort()
        : [];

    const serializedStage = state.stage ? {
        id: state.stage.id,
        name: state.stage.name,
        size: state.stage.size,
        maxTiles: state.stage.maxTiles
    } : { id: 1, name: "Stage 1", size: 5, maxTiles: 24 };

    return {
        turn: state.turn || 1,
        ember: state.ember !== undefined ? state.ember : 20,
        maxEmber: state.maxEmber !== undefined ? state.maxEmber : 20,
        food: state.food !== undefined ? state.food : 50,
        wood: state.wood !== undefined ? state.wood : 30,
        defense: state.defense !== undefined ? state.defense : 10,
        defenseCapacityBonus: state.defenseCapacityBonus !== undefined ? state.defenseCapacityBonus : 0,
        currentDefense: defenseSnapshot.currentDefense,
        maxDefense: defenseSnapshot.maxDefense,
        mystic: state.mystic !== undefined ? state.mystic : 0,
        hasPickedThisTurn: !!state.hasPickedThisTurn,
        hasReservedThisTurn: !!state.hasReservedThisTurn,
        hasMulliganedThisTurn: !!state.hasMulliganedThisTurn,
        mergeGroupCounter: Number.isInteger(state.mergeGroupCounter) ? state.mergeGroupCounter : 1,
        placementGroupCounter: Number.isInteger(state.placementGroupCounter) ? state.placementGroupCounter : 1,
        grantedConnectionPairs: Array.from(state.grantedConnectionPairs || []).sort(),
        handOfferingSize: Number.isInteger(state.handOfferingSize) ? state.handOfferingSize : 3,
        nextTrialDamageMitigation: state.nextTrialDamageMitigation !== undefined ? state.nextTrialDamageMitigation : 1.0,
        nextTrialMultiplier: state.nextTrialMultiplier !== undefined ? state.nextTrialMultiplier : 1.0,
        trialSchedule: cloneData(state.trialSchedule),
        nextTrialTurn: state.nextTrialTurn !== undefined ? state.nextTrialTurn : null,
        activeConstructionProjects: cloneData(state.activeConstructionProjects, []),
        activeDrawBias: cloneData(state.activeDrawBias),
        placedBlockCount: Number.isFinite(state.placedBlockCount) ? state.placedBlockCount : 0,
        permanentPlainsFoodBonus: state.permanentPlainsFoodBonus || 0,
        permanentVicinityDefenseBonus: state.permanentVicinityDefenseBonus || 0,
        emberConsumptionReducedTurns: state.emberConsumptionReducedTurns || 0,
        emberConsumptionStartsNextTurn: !!state.emberConsumptionStartsNextTurn,
        vigilanceTurns: state.vigilanceTurns || 0,
        vigilanceStartsNextTurn: !!state.vigilanceStartsNextTurn,
        grandCultivationTurns: state.grandCultivationTurns || 0,
        grandCultivationStartsNextTurn: !!state.grandCultivationStartsNextTurn,
        systematicLoggingTurns: state.systematicLoggingTurns || 0,
        systematicLoggingStartsNextTurn: !!state.systematicLoggingStartsNextTurn,
        emergencyLevyTurns: state.emergencyLevyTurns || 0,
        emergencyLevyStartsNextTurn: !!state.emergencyLevyStartsNextTurn,
        manifestMiracleTurns: state.manifestMiracleTurns || 0,
        manifestMiracleStartsNextTurn: !!state.manifestMiracleStartsNextTurn,
        reserveFeeWaivedTurns: state.reserveFeeWaivedTurns || 0,
        reserveFeeWaivedStartsNextTurn: !!state.reserveFeeWaivedStartsNextTurn,
        temporaryDefense: state.temporaryDefense || 0,
        temporaryDefenseTurns: state.temporaryDefenseTurns || 0,
        grid: serializedGrid,
        handOffering: serializedOffering,
        reserveSlots: serializedReserve,
        cardCooldowns: serializedCooldowns,
        usedUniqueCards: serializedUsedUniques,
        consumedUniqueCards: serializedConsumedUniques,
        mergedBlocks: state.mergedBlocks
            ? JSON.parse(JSON.stringify(state.mergedBlocks))
            : {},
        mergeLinks: Array.from(state.mergeLinks || []).sort(),
        stage: serializedStage
    };
}
