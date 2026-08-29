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
        
        // 🛑 サブシステムの new 生成を 100% 撤廃 (GameEngine に一元化)
        this._gridEngine = dependencies.gridEngine || null;
        this._deckManager = dependencies.deckManager || null;
        this._directiveSystem = dependencies.directiveSystem || null;
        this._buffSystem = dependencies.buffSystem || null;

        this.grid = this.initGrid(5);
        this.handOffering = [];
        this.reserveSlots = [null];
        this.gameLogs = [];
            this.toastQueue = [];
            this.hasPickedThisTurn = false;
            this.hasReservedThisTurn = false;
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
            this.consumedUniqueCards = []; // ⭐ 選択時消費された UNIQUE カード
            this.cardCooldowns = {};       // 🔄 転生サイクル: { [cardId]: availableTurn }
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
            this.emberConsumptionReducedTurns = 0; // 節約 (次ターンの🔥消費-1軽減)
            this.emberConsumptionStartsNextTurn = false;
            this.vigilanceTurns = 0;               // 警戒 (次のターンから2ターンの間、全🛡️獲得+3)
            this.vigilanceStartsNextTurn = false;  // 発動ターンは次ターン開始待ち
            this.grandCultivationTurns = 0;        // 耕作計画 (次のターンから4ターンの間、平地産出🌾+1/T)
            this.grandCultivationStartsNextTurn = false;
            this.systematicLoggingTurns = 0;       // 計画伐採 (次のターンから3ターンの間、森産出🧱-1/T)
            this.systematicLoggingStartsNextTurn = false;
            this.emergencyLevyTurns = 0;           // 緊急徴発 (次のターンの食料維持費+5)
            this.emergencyLevyStartsNextTurn = false;
            this.manifestMiracleTurns = 0;         // 顕現 (次のターンから3ターンの間、補填レート3→1)
            this.manifestMiracleStartsNextTurn = false;
            this.reserveFeeWaivedTurns = 0;        // 再燃 (次のターンから3ターンの間、手札保留維持費無料)
            this.reserveFeeWaivedStartsNextTurn = false;
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
            const center = Math.floor(size / 2);
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

            // 🎲 ソケット位置の選定（本営周囲を除く外周候補から非隣接 3 マス選定）
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

            for (let i = candidates.length - 1; i > 0; i--) {
                const j = Math.floor(Math.random() * (i + 1));
                [candidates[i], candidates[j]] = [candidates[j], candidates[i]];
            }

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

        getTerritoryBreakdown() {
            if (this.gridEngine && typeof this.gridEngine.getTerritoryBreakdown === "function") {
                return this.gridEngine.getTerritoryBreakdown();
            }
            const breakdown = { plains: 0, forest: 0, deepForest: 0, hill: 0, mountain: 0, desert: 0, total: 0 };
            if (!this.grid) return breakdown;
            const size = this.grid.length;
            for (let r = 0; r < size; r++) {
                for (let c = 0; c < size; c++) {
                    const cell = this.grid[r][c];
                    if (cell.placed && !cell.isHQ && cell.terrain) {
                        breakdown.total++;
                        const tid = (cell.terrain.terrainId || cell.terrain.id || "").toUpperCase();
                        if (tid.includes("PLAINS")) breakdown.plains++;
                        else if (tid.includes("DEEP_FOREST") || tid.includes("DEEP_HILL")) breakdown.deepForest++;
                        else if (tid.includes("FOREST")) breakdown.forest++;
                        else if (tid.includes("HILL")) breakdown.hill++;
                        else if (tid.includes("MOUNTAIN")) breakdown.mountain++;
                        else if (tid.includes("DESERT")) breakdown.desert++;
                        else breakdown.plains++;
                    }
                }
            }
            return breakdown;
        }

        getResourceBreakdown() {
            if (ProductionCalculator && typeof ProductionCalculator.getResourceBreakdown === "function") {
                return ProductionCalculator.getResourceBreakdown(this);
            }
            return null;
        }

        countPlacedBlocks() {
            if (this.gridEngine && typeof this.gridEngine.getPlacedBlockCount === "function") {
                return this.gridEngine.getPlacedBlockCount();
            }
            if (!this.grid) return 0;
            const seenBlocks = new Set();
            let count = 0;
            for (let r = 0; r < this.grid.length; r++) {
                for (let c = 0; c < this.grid[r].length; c++) {
                    const cell = this.grid[r][c];
                    if (cell.placed && !cell.isHQ && cell.terrain) {
                        const bId = cell.blockId || `${r}_${c}`;
                        if (!seenBlocks.has(bId)) {
                            seenBlocks.add(bId);
                            count++;
                        }
                    }
                }
            }
            return count;
        }

        checkConditionalBuffs() {
            // 1. 📜 CMD_LAND_FOCUS: 盤面ブロック数 >= 6 で自動解除
            if (this.activeDrawBias && this.activeDrawBias.type === "UNTIL_BLOCKS") {
                const blocks = this.countPlacedBlocks();
                if (blocks >= (this.activeDrawBias.untilValue || 6)) {
                    this.activeDrawBias = null;
                    this.removeBuff("CMD_LAND_FOCUS");
                }
            }

            // 2. 🛡️ CMD_MILITARY_FOCUS: 防衛力 🛡️ >= 20 で自動解除
            if (this.activeDrawBias && this.activeDrawBias.type === "UNTIL_DEFENSE") {
                const totalDef = (typeof this.calculateTotalDefense === "function") ? this.calculateTotalDefense() : (this.defense || 0);
                if (totalDef >= (this.activeDrawBias.untilValue || 20)) {
                    this.activeDrawBias = null;
                    this.removeBuff("CMD_MILITARY_FOCUS");
                }
            }
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

        checkMergePatterns(placedCoords = []) {
            if (this.gridEngine) return this.gridEngine.checkMergePatterns(placedCoords);
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
            if (this.vigilanceTurns && this.vigilanceTurns > 0 && !this.vigilanceStartsNextTurn) {
                def += 3;
            }
            return def;
        }

        gainDefense(baseAmount, reason = "") {
            if (baseAmount <= 0) return 0;
            let finalAmount = baseAmount;
            let bonusText = "";
            const I18n = (typeof globalThis !== 'undefined' && globalThis.I18n) ? globalThis.I18n : (typeof window !== 'undefined' ? window.I18n : { t: k => k });
            if (this.vigilanceTurns && this.vigilanceTurns > 0 && !this.vigilanceStartsNextTurn) {
                finalAmount += 3;
                bonusText = I18n ? I18n.t("LOG_VIGILANCE_BONUS") : " (+3)";
            }
            this.defense = (this.defense || 10) + finalAmount;
            if (reason) {
                this.addLog(I18n ? I18n.t("LOG_DEFENSE_GAINED", { amount: finalAmount, bonus: bonusText, reason: reason, total: this.calculateTotalDefense() }) : `🛡️ +${finalAmount}`);
            }
            return finalAmount;
        }

        getTrialNotice() {
            const nextTrialTurn = this.nextTrialTurn || (this.trialSchedule ? this.trialSchedule.trial1 : 15);
            const remaining = nextTrialTurn - this.turn;
            return {
                active: remaining <= (this.trialSchedule ? this.trialSchedule.warningDuration : 5) && remaining >= 0,
                remaining
            };
        }

        processTurnEndMaintenance() {
            const I18n = (typeof globalThis !== 'undefined' && globalThis.I18n) ? globalThis.I18n : (typeof window !== 'undefined' ? window.I18n : { t: k => k });

            // 1. 🔥 残り火ステッピングに基づく毎ターンの 🌾 食料維持費
            let foodCost = 20;
            if (this.emberSystem && typeof this.emberSystem.getFoodMaintenanceCost === 'function') {
                foodCost = this.emberSystem.getFoodMaintenanceCost();
            } else if (this.ember >= 24) {
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
                this.addLog(I18n ? I18n.t("LOG_RATIONING_APPLIED", { cost: foodCost }) : `🌾 ${foodCost}`);
            }

            // ⚠️ 緊急徴発 (次ターンの食料維持費 +5)
            if (this.emergencyLevyTurns && this.emergencyLevyTurns > 0) {
                if (this.emergencyLevyStartsNextTurn) {
                    this.emergencyLevyStartsNextTurn = false; // 発動ターン終了時はスキップ
                } else {
                    foodCost += 5; // 次のターンの終了時に +5
                    this.emergencyLevyTurns -= 1;
                }
            }

            this.food -= foodCost;
            let isGameOver = false;

            // 2. ⚠️ 食料不足ペナルティ (生命力 🔥 -1 ダメージ)
            if (this.food < 0) {
                this.food = 0;
                if (this.emberSystem && typeof this.emberSystem.applyDamage === 'function') {
                    this.emberSystem.applyDamage(1);
                } else {
                    this.ember -= 1;
                }
                this.addLog(I18n ? I18n.t("LOG_FOOD_DEFICIT_PENALTY", { ember: this.ember }) : `⚠️ -1`);
            }

            // 3. 🗺️ 領土マス数 ＆ Stage連動による 🔥 自動減衰・自家発熱ルール
            const tileCount = this.getTerritoryTileCount();
            const thresholds = this.getStageEmberThresholds();
            let emberDelta = -1; // 領土不足時: 標準燃焼減衰 (-1 🔥/T)

            if (tileCount >= thresholds.autoHeat) {
                emberDelta = 1;  // 自家発熱 (+1 🔥/T)
                this.addLog(I18n ? I18n.t("LOG_TERRITORY_AUTO_HEAT", { count: tileCount, req: thresholds.autoHeat }) : `🔥 +1`);
            } else if (tileCount >= thresholds.decayStop) {
                emberDelta = 0;  // 減衰ストップ (0 🔥/T)
                this.addLog(I18n ? I18n.t("LOG_TERRITORY_DECAY_STOP", { count: tileCount, req: thresholds.decayStop }) : `🛡️ 0`);
            }

            // 🔥 節約 (次ターンの🔥消費を 1 軽減)
            if (this.emberConsumptionReducedTurns && this.emberConsumptionReducedTurns > 0) {
                if (this.emberConsumptionStartsNextTurn) {
                    this.emberConsumptionStartsNextTurn = false; // 発動ターン終了時はスキップ
                } else {
                    if (emberDelta < 0) {
                        emberDelta += 1; // -1 ➔ 0
                        this.addLog(I18n ? I18n.t("LOG_CONSERVE_EMBER_APPLIED") : `🔥 0`);
                    }
                    this.emberConsumptionReducedTurns -= 1;
                }
            }

            if (this.emberSystem && typeof this.emberSystem.getPassiveRegenTotal === 'function') {
                emberDelta += this.emberSystem.getPassiveRegenTotal();
            }

            if (this.emberSystem) {
                this.ember = Math.min(this.emberSystem.max, Math.max(0, this.ember + emberDelta));
            } else {
                this.ember += emberDelta;
            }

            // 4. 📥 保留スロット維持費 (🔥-1/T, 免除ターン考慮)
            const hasReservedCard = this.reserveSlots && this.reserveSlots.some(s => s !== null && !s.isBlank);
            if (hasReservedCard) {
                if (this.reserveFeeWaivedTurns && this.reserveFeeWaivedTurns > 0) {
                    if (this.reserveFeeWaivedStartsNextTurn) {
                        this.reserveFeeWaivedStartsNextTurn = false; // 発動ターン終了時は免除しつつ減算スキップ
                    } else {
                        this.reserveFeeWaivedTurns -= 1;
                    }
                } else {
                    this.ember -= 1;
                    this.addLog(I18n ? I18n.t("LOG_RESERVE_UPKEEP_PENALTY", { ember: this.ember }) : `📥 -1`);
                }
            }

            // 5. 🛡️ 警戒バフのターン経過 (次のターンから2ターンの間、全🛡️獲得+3)
            if (this.vigilanceTurns && this.vigilanceTurns > 0) {
                if (this.vigilanceStartsNextTurn) {
                    this.vigilanceStartsNextTurn = false; // 発動ターン終了: 次ターン開始時から2ターン有効
                } else {
                    this.vigilanceTurns -= 1;
                    if (this.vigilanceTurns <= 0) {
                        this.addLog(I18n ? I18n.t("LOG_VIGILANCE_EXPIRED") : `🛡️ End`);
                    }
                }
            }
            if (this.temporaryDefenseTurns && this.temporaryDefenseTurns > 0) {
                this.temporaryDefenseTurns -= 1;
                if (this.temporaryDefenseTurns <= 0) {
                    this.temporaryDefense = 0;
                }
            }

            // 6. 🎯 ドロー偏向バフのターン経過 (次ターン開始待ち考慮)
            if (this.activeDrawBias && this.activeDrawBias.type === "TURNS") {
                if (this.activeDrawBias.startsNextTurn) {
                    this.activeDrawBias.startsNextTurn = false; // 発動ターン終了時はスキップし次ターン開始時にドロー保証
                } else {
                    this.activeDrawBias.remainingTurns -= 1;
                    if (this.activeDrawBias.remainingTurns <= 0) {
                        this.activeDrawBias = null;
                    }
                }
            }

            // 7. ⏳ 新規持続バフのターン経過 ＆ 満了処理 (次のターンから開始待ち考慮)
            if (this.grandCultivationTurns && this.grandCultivationTurns > 0) {
                if (this.grandCultivationStartsNextTurn) {
                    this.grandCultivationStartsNextTurn = false; // 発動ターン終了時はスキップ
                } else {
                    this.grandCultivationTurns -= 1;
                    if (this.grandCultivationTurns <= 0) {
                        const bd = (typeof this.getTerritoryBreakdown === "function") ? this.getTerritoryBreakdown() : { plains: 0 };
                        if (bd.plains >= 12) {
                            this.ember += 1;
                            this.addLog(I18n ? I18n.t("LOG_CMD_ACTIVATED", { name: "耕作計画達成", desc: "🔥+1" }) : `🌾 🔥+1`);
                        }
                    }
                }
            }
            if (this.systematicLoggingTurns && this.systematicLoggingTurns > 0) {
                if (this.systematicLoggingStartsNextTurn) {
                    this.systematicLoggingStartsNextTurn = false;
                } else {
                    this.systematicLoggingTurns -= 1;
                }
            }
            if (this.manifestMiracleTurns && this.manifestMiracleTurns > 0) {
                if (this.manifestMiracleStartsNextTurn) {
                    this.manifestMiracleStartsNextTurn = false;
                } else {
                    this.manifestMiracleTurns -= 1;
                }
            }
            if (this.fillTheVoidTurns && this.fillTheVoidTurns > 0) {
                this.fillTheVoidTurns -= 1;
            }
            if (this.scorchedRetreatTurns && this.scorchedRetreatTurns > 0) {
                this.scorchedRetreatTurns -= 1;
            }

            // 8. ⏳ バフマネージャーのターン減衰同期
            if (this.buffSystem && typeof this.buffSystem.tickTurn === "function") {
                this.buffSystem.tickTurn();
            }

            // 9. 💀 ゲームオーバー ＆ 🏆 クリア判定
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

        returnFromReserve(reserveIdx = 0, specificTargetIdx = -1) {
            if (this.deckManager) return this.deckManager.returnFromReserve(reserveIdx, specificTargetIdx);
            return false;
        }

        discardFromReserve(reserveIdx = 0) {
            if (this.deckManager) return this.deckManager.discardFromReserve(reserveIdx);
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
            this.checkConditionalBuffs();
            if (this.buffSystem && typeof this.buffSystem.getDisplayBuffs === "function") {
                return this.buffSystem.getDisplayBuffs();
            }
            return this.activeBuffs || [];
        }

        // 🔗 下位互換 ＆ 透過的サブシステム参照アクセサ (GameState自体は生成責任を持たない)
        get gridEngine() { return this._gridEngine || (this.engine ? this.engine.gridEngine : null); }
        set gridEngine(v) { this._gridEngine = v; }
        get deckManager() { return this._deckManager || (this.engine ? this.engine.deckManager : null); }
        set deckManager(v) { this._deckManager = v; }
        get directiveSystem() { return this._directiveSystem || (this.engine ? this.engine.directiveSystem : null); }
        set directiveSystem(v) { this._directiveSystem = v; }
        get buffSystem() { return this._buffSystem || (this.engine ? this.engine.buffSystem : null); }
        set buffSystem(v) { this._buffSystem = v; }
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
