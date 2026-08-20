import { I18n } from './i18n.js';
import { GridEngine } from './systems/grid_engine.js';
import { DeckManager } from './systems/deck_manager.js';
import { DirectiveSystem } from './systems/directive_system.js';
import { ProductionCalculator } from './systems/production_calculator.js';

class GameState {
    constructor(dependencies = {}) {
        this.engine = dependencies.engine || null;
        this.turn = dependencies.turn !== undefined ? dependencies.turn : 1;
        this.ember = dependencies.ember !== undefined ? dependencies.ember : 20;
        this.food = dependencies.food !== undefined ? dependencies.food : 30;
        this.wood = dependencies.wood !== undefined ? dependencies.wood : 30;
        this.defense = dependencies.defense !== undefined ? dependencies.defense : 10;
        this.mystic = dependencies.mystic !== undefined ? dependencies.mystic : 0;

        this.stage = dependencies.stage || { id: 1, name: "Stage 1", size: 5, bonusMultiplier: 1.0 };
        
        // 🧩 GridEngine の初期化と委譲 (DI対応 ＆ 直接参照)
        if (dependencies.gridEngine) {
            this.gridEngine = dependencies.gridEngine;
        } else if (GridEngine) {
            this.gridEngine = new GridEngine(this, this.engine);
        } else {
            this.gridEngine = null;
        }

        // 🎴 DeckManager の初期化と委譲 (DI対応 ＆ 直接参照)
        if (dependencies.deckManager) {
            this.deckManager = dependencies.deckManager;
        } else if (DeckManager) {
            this.deckManager = new DeckManager(this, this.engine);
        } else {
            this.deckManager = null;
        }

        // 🏛️ DirectiveSystem の初期化 (DI対応 ＆ 直接参照)
        if (dependencies.directiveSystem) {
            this.directiveSystem = dependencies.directiveSystem;
        } else if (DirectiveSystem) {
            this.directiveSystem = new DirectiveSystem(this, this.engine);
        } else {
            this.directiveSystem = null;
        }

        this.grid = this.initGrid(5);
        this.handOffering = [];
            this.reserveSlots = [null, null, null];
            this.gameLogs = [];
            this.toastQueue = [];
            this.hasPickedThisTurn = false;
            this.hasMulliganedThisTurn = false;
            this.mergeGroupCounter = 1;
            this.placementGroupCounter = 1;
            this.mergedBlocks = {};
            this.grantedConnectionPairs = new Set();

            this.stage = { id: 1, name: "Stage 1", size: 5, maxTiles: 24 };
        
            // ⚔️ 3大試練スケジュール（±3前後ランダム決定 ＆ 5T前アナウンス）
            const randomOffset1 = Math.floor(Math.random() * 7) - 3; // -3 to +3
            const randomOffset2 = Math.floor(Math.random() * 7) - 3; // -3 to +3
            this.trialSchedule = {
                trial1: Math.max(12, Math.min(18, 15 + randomOffset1)), // Turn 12〜18
                trial2: Math.max(27, Math.min(33, 30 + randomOffset2)), // Turn 27〜33
                trial3: 50,                                            // Turn 50 固定
                warningDuration: 5
            };
            this.nextTrialTurn = this.trialSchedule.trial1;

            this.usedUniqueCards = [];
            this.handOfferingSize = 3;
            this.nextTrialDamageMitigation = 1.0;
            this.nextTrialMultiplier = 1.0;
            this.reserveFeeWaivedTurns = 0;
            this.activeConstructionProjects = [];
            this.permanentPlainsFoodBonus = 0;
            this.permanentVicinityDefenseBonus = 0;
            this.activeDrawBias = null;
        }

        getAllBuffs() {
            if (this.buffSystem && typeof this.buffSystem.getDisplayBuffs === 'function') {
                return this.buffSystem.getDisplayBuffs();
            }
            return [];
        }

        addBuff(buffDef) {
            if (this.buffSystem && typeof this.buffSystem.addBuff === 'function') {
                return this.buffSystem.addBuff(buffDef);
            }
            return false;
        }

        removeBuff(buffId) {
            if (this.buffSystem && typeof this.buffSystem.removeBuff === 'function') {
                return this.buffSystem.removeBuff(buffId);
            }
            return false;
        }

        initGrid(size = 5) {
            if (this.gridEngine) return this.gridEngine.initGrid(size);
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
            return grid;
        }

        addLog(msg) {
            let finalMsg = msg;
            if (typeof msg === "string" && msg.startsWith("LOG_") && typeof I18n !== "undefined" && typeof I18n.t === "function") {
                finalMsg = I18n.t(msg);
            }
            this.gameLogs.unshift(finalMsg);
            if (this.gameLogs.length > 50) this.gameLogs.pop();

            // 📜 LogComponent (UI) への自動連携
            const logComp = (typeof globalThis !== 'undefined' && globalThis.LogComponent) ? globalThis.LogComponent : (typeof window !== 'undefined' ? window.LogComponent : null);
            if (logComp && typeof logComp.addLog === "function") {
                logComp.addLog(finalMsg, this.turn || 1);
            }
        }

        isHQVicinity(r, c) {
            if (this.gridEngine) return this.gridEngine.isHQVicinity(r, c);
            if (r === 2 && c === 2) return false;
            return Math.abs(r - 2) <= 1 && Math.abs(c - 2) <= 1;
        }

        countPlacedTiles() {
            if (this.gridEngine) return this.gridEngine.countPlacedTiles();
            let count = 0;
            for (let r = 0; r < 5; r++) {
                for (let c = 0; c < 5; c++) {
                    if (this.grid[r][c].placed && !this.grid[r][c].isHQ) count++;
                }
            }
            return count;
        }

        getResourceBreakdown() {
            if (ProductionCalculator && typeof ProductionCalculator.getResourceBreakdown === "function") {
                return ProductionCalculator.getResourceBreakdown(this);
            }
            return null;
        }

        countH2HillsOnBoard() {
            if (this.gridEngine) return this.gridEngine.countH2HillsOnBoard();
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
            if (this.gridEngine) return this.gridEngine.canPlaceShape(startR, startC, shapeMatrix);
            return { can: false, reason: "NO_GRID_ENGINE" };
        }

        placeShape(startR, startC, shapeMatrix, terrain, handIdx = -1) {
            if (this.gridEngine) return this.gridEngine.placeShape(startR, startC, shapeMatrix, terrain, handIdx);
            return { can: false, reason: "NO_GRID_ENGINE" };
        }

        checkConnectionBonus(r, c, terrain) {
            if (this.gridEngine) return this.gridEngine.checkConnectionBonus(r, c, terrain);
        }

        checkMergePatterns() {
            if (this.gridEngine) return this.gridEngine.checkMergePatterns();
        }

        playCommandCard(cardObj, targetTile = null) {
            if (this.deckManager) return this.deckManager.playCommandCard(cardObj, targetTile);
            return { success: false, reason: "NO_DECK_MANAGER" };
        }

        executeExploration(r, c) {
            if (this.deckManager) return this.deckManager.executeExploration(r, c);
            return { success: false, reason: "NO_DECK_MANAGER" };
        }

        calculateTotalProduction() {
            if (ProductionCalculator && typeof ProductionCalculator.calculateTotalProduction === "function") {
                return ProductionCalculator.calculateTotalProduction(this);
            }
            return { totalFood: 10, totalWood: 10, totalMystic: 1 };
        }

        calculateTotalDefense() {
            if (ProductionCalculator && typeof ProductionCalculator.calculateTotalDefense === "function") {
                return ProductionCalculator.calculateTotalDefense(this);
            }
            return this.defense || 10;
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
            if (this.deckManager) return this.deckManager.moveToReserve(cardIdx);
            return false;
        }

        returnFromReserve(reserveIdx) {
            if (this.deckManager) return this.deckManager.returnFromReserve(reserveIdx);
            return false;
        }

        mulligan() {
            if (this.deckManager) return this.deckManager.mulligan();
            return { success: false, reason: "NO_DECK_MANAGER" };
        }
    }

    // 🎴 Step1DrawSystem 互換エイリアス
    const Step1DrawSystem = (typeof globalThis !== 'undefined' && globalThis.DeckManager) ? globalThis.DeckManager : ((typeof window !== 'undefined' && window.DeckManager) ? window.DeckManager : class {
        constructor(state) { this.state = state; }
        generateOfferingCards() { return (this.state && this.state.deckManager) ? this.state.deckManager.generateOfferingCards() : []; }
        drawSingleCard() { return (this.state && this.state.deckManager) ? this.state.deckManager.drawSingleCard() : null; }
    });

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

    const engineExports = {
        GameState,
        Step1DrawSystem: DeckManager,
        DeckManager,
        GameEngine: DeckManager,
        rotateShapeMatrix
    };

    if (typeof window !== 'undefined') {
        window.GameState = GameState;
        window.Step1DrawSystem = DeckManager;
        window.rotateShapeMatrix = rotateShapeMatrix;
        window.Step1Engine = engineExports;
    }
    if (typeof globalThis !== 'undefined') {
        globalThis.GameState = GameState;
        globalThis.Step1DrawSystem = DeckManager;
        globalThis.rotateShapeMatrix = rotateShapeMatrix;
        globalThis.Step1Engine = engineExports;
    }

const Step1Engine = engineExports;

export { Step1Engine, GameState, rotateShapeMatrix };
export default GameState;
