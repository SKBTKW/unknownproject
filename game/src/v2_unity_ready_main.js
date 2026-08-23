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
        this.food = dependencies.food !== undefined ? dependencies.food : 50; // 🌾 初期食料 50 (戦略的猶予確保)
        this.wood = dependencies.material !== undefined ? dependencies.material : (dependencies.wood !== undefined ? dependencies.wood : 30);
        this.material = this.wood;
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
        this.reserveSlots = [null];
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

            // 📈 配置ブロック数カウンタ ＆ 守備的・節約コマンド用バフ管理
            this.placedBlockCount = dependencies.placedBlockCount !== undefined ? dependencies.placedBlockCount : 0;
            this.emberConsumptionReducedTurns = 0; // 残火の節約 (次ターンの🔥消費-1軽減)
            this.foodCostHalvedTurns = 0;          // 節約配給 (食料維持費50%カット)
            this.vigilanceTurns = 0;               // 警戒態勢 (2ターンの間、全🛡️獲得+3)
            this.temporaryDefense = 0;             // 後方互換用
            this.temporaryDefenseTurns = 0;
        }

        getTerritoryTileCount() {
            if (this.gridEngine && typeof this.gridEngine.getPlacedTileCount === 'function') {
                return this.gridEngine.getPlacedTileCount();
            }
            if (this.grid) {
                let count = 0;
                for (let r = 0; r < this.grid.length; r++) {
                    for (let c = 0; c < this.grid[r].length; c++) {
                        if (this.grid[r][c] && this.grid[r][c].placed) count++;
                    }
                }
                return count;
            }
            return 0;
        }

        getStageEmberThresholds() {
            const stageNum = (this.stage && this.stage.id) ? this.stage.id : 1;
            if (stageNum === 1) return { decayStop: 8, autoHeat: 20 };
            if (stageNum === 2) return { decayStop: 24, autoHeat: 40 };
            return { decayStop: 48, autoHeat: 68 };
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

        canPlaceShape(startR, startC, shapeMatrix, terrain = null) {
            if (this.gridEngine) return this.gridEngine.canPlaceShape(startR, startC, shapeMatrix, terrain);
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
            let def = this.defense || 10;
            if (this.vigilanceTurns && this.vigilanceTurns > 0) {
                def += 3;
            }
            return def;
        }

        gainDefense(baseAmount, reason = "") {
            if (baseAmount <= 0) return 0;
            let finalAmount = baseAmount;
            let bonusText = "";
            if (this.vigilanceTurns && this.vigilanceTurns > 0) {
                finalAmount += 3;
                bonusText = " (🛡️警戒態勢ボーナス +3)";
            }
            this.defense = (this.defense || 10) + finalAmount;
            if (reason) {
                this.addLog(`🛡️ 防衛力獲得: +${finalAmount}${bonusText} [${reason}] (現在: 🛡️${this.calculateTotalDefense()})`);
            }
            return finalAmount;
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
            // 1. 🔥 残り火ステッピングに基づく毎ターンの 🌾 食料維持費
            let foodCost = 20;
            if (this.ember >= 24) {
                foodCost = 25; // 🔥 旺盛状態 (維持費増)
            } else if (this.ember <= 9) {
                foodCost = 15; // 🔥 微火・危機 (省エネ復興)
            } else {
                foodCost = 20; // 🔥 標準状態
            }

            // 🌾 節約配給 (食料維持費 50% 軽減)
            if (this.foodCostHalvedTurns && this.foodCostHalvedTurns > 0) {
                foodCost = Math.floor(foodCost / 2);
                this.foodCostHalvedTurns -= 1;
                this.addLog(`🌾 節約配給適用中: 食料維持費が ${foodCost} に軽減されました。`);
            }

            this.food -= foodCost;
            let isGameOver = false;

            // 2. 🌾 食料不足時のペナルティ (🔥-2)
            if (this.food < 0) {
                this.food = 0;
                this.ember -= 2;
                this.addLog(`⚠️ 食料不足！ ペナルティとして 🔥-2 (現在: 🔥${this.ember})`);
            }

            // 3. 🗺️ 領土マス数 ＆ Stage連動による 🔥 自動減衰・自家発熱ルール
            const tileCount = this.getTerritoryTileCount();
            const thresholds = this.getStageEmberThresholds();
            let emberDelta = -1; // 領土不足時: 標準燃焼減衰 (-1 🔥/T)

            if (tileCount >= thresholds.autoHeat) {
                emberDelta = 1;  // 自家発熱 (+1 🔥/T)
                this.addLog(`🔥 領土大繁栄 (${tileCount} >= ${thresholds.autoHeat}マス)！ 自家発熱により 🔥+1 回復！`);
            } else if (tileCount >= thresholds.decayStop) {
                emberDelta = 0;  // 減衰ストップ (0 🔥/T)
                this.addLog(`🛡️ 領土定着 (${tileCount} >= ${thresholds.decayStop}マス)！ 🔥の自然減衰がストップしました。`);
            }

            // 🔥 残火の節約 (次ターンの🔥消費を 1 軽減)
            if (this.emberConsumptionReducedTurns && this.emberConsumptionReducedTurns > 0) {
                if (emberDelta < 0) {
                    emberDelta += 1; // -1 ➔ 0
                    this.addLog(`🔥 残火の節約適用中: 自然減衰が 1 軽減 (消費 0) されました。`);
                }
                this.emberConsumptionReducedTurns -= 1;
            }

            this.ember += emberDelta;

            // 4. 📥 保留スロット維持費 (🔥-1/T, 免除ターン考慮)
            const hasReservedCard = this.reserveSlots && this.reserveSlots.some(s => s !== null && !s.isBlank);
            if (hasReservedCard) {
                if (this.reserveFeeWaivedTurns && this.reserveFeeWaivedTurns > 0) {
                    this.reserveFeeWaivedTurns -= 1;
                } else {
                    this.ember -= 1;
                    this.addLog(`📥 保留スロット維持費: 🔥-1 (現在: 🔥${this.ember})`);
                }
            }

            // 5. 🛡️ 警戒態勢バフのターン経過 (全🛡️獲得+3)
            if (this.vigilanceTurns && this.vigilanceTurns > 0) {
                this.vigilanceTurns -= 1;
                if (this.vigilanceTurns <= 0) {
                    this.addLog(`🛡️ 警戒態勢の効果（全🛡️獲得+3ボーナス）が終了しました。`);
                }
            }
            if (this.temporaryDefenseTurns && this.temporaryDefenseTurns > 0) {
                this.temporaryDefenseTurns -= 1;
                if (this.temporaryDefenseTurns <= 0) {
                    this.temporaryDefense = 0;
                }
            }

            // 5. 🎯 ドロー偏向バフのターン経過
            if (this.activeDrawBias && this.activeDrawBias.type === "TURNS") {
                this.activeDrawBias.remainingTurns -= 1;
                if (this.activeDrawBias.remainingTurns <= 0) {
                    this.activeDrawBias = null;
                }
            }

            // 6. 💀 ゲームオーバー ＆ 🏆 クリア判定
            if (this.ember <= 0) {
                this.ember = 0;
                isGameOver = true;
            }

            const isGameClear = (this.turn >= 50 && this.ember > 0);
            return { foodCost, emberDelta, isGameOver, isGameClear };
        }

        moveToReserve(cardIdx) {
            if (this.deckManager) return this.deckManager.moveToReserve(cardIdx);
            return false;
        }

        returnFromReserve(reserveIdx) {
            if (this.deckManager) return this.deckManager.returnFromReserve(reserveIdx);
            return false;
        }

        playCommandCard(cardObj, targetTile = null, handIdx = -1, reserveIdx = -1) {
            if (this.deckManager) return this.deckManager.playCommandCard(cardObj, targetTile, handIdx, reserveIdx);
            return { success: false, reason: "NO_DECK_MANAGER" };
        }

        mulligan() {
            if (this.deckManager) return this.deckManager.mulligan();
            return { success: false, reason: "NO_DECK_MANAGER" };
        }

        addBuff(buffDef) {
            if (this.buffSystem && typeof this.buffSystem.addBuff === "function") {
                return this.buffSystem.addBuff(buffDef);
            }
            if (!this.activeBuffs) this.activeBuffs = [];
            const idx = this.activeBuffs.findIndex(b => b.id === buffDef.id);
            if (idx !== -1) {
                this.activeBuffs[idx] = Object.assign({}, this.activeBuffs[idx], buffDef);
            } else {
                this.activeBuffs.push(Object.assign({}, buffDef));
            }
            return true;
        }

        removeBuff(buffId) {
            if (this.buffSystem && typeof this.buffSystem.removeBuff === "function") {
                return this.buffSystem.removeBuff(buffId);
            }
            if (!this.activeBuffs) return false;
            const initLen = this.activeBuffs.length;
            this.activeBuffs = this.activeBuffs.filter(b => b.id !== buffId);
            return this.activeBuffs.length < initLen;
        }

        getAllBuffs() {
            if (this.buffSystem && typeof this.buffSystem.getDisplayBuffs === "function") {
                return this.buffSystem.getDisplayBuffs();
            }
            return this.activeBuffs || [];
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
