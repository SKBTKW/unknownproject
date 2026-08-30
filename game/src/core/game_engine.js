import { I18n } from '../i18n.js';
import { LAND_SYSTEM_DATA } from '../data/land_system.js';
import { DIRECTIVES, DirectiveSystem } from '../systems/directive_system.js';
import { DeckManager } from '../systems/deck_manager.js';
import { ProductionCalculator } from '../systems/production_calculator.js';
import { UndoLandSystem } from '../systems/undo_land_system.js';
import { GridEngine } from '../systems/grid_engine.js';
import { BuffSystem } from '../systems/buff_system.js';
import { ChronicleSystem } from '../systems/chronicle_system.js';
import { GlobalEventManager } from '../systems/global_event_system.js';
import { EmberSystem } from '../systems/ember_system.js';
import { CardCycleSystem } from '../systems/card_cycle_system.js';
import { CellViewDataService } from '../services/cell_view_data_service.js';
import { ActionTransactionManager } from './transaction_manager.js';
import { GameState } from '../v2_unity_ready_main.js';

class GameEngine {
    /**
     * @param {Object} [dependencies={}] - 注入するサブシステム依存群
     */
    constructor(dependencies = {}) {
        // 1. 外部サービス / 共通モジュールの解決
        this.i18n = dependencies.i18n || I18n;
        this.productionCalculator = dependencies.productionCalculator || ProductionCalculator;
        this.landData = dependencies.landData || LAND_SYSTEM_DATA;
        this.cellViewDataService = dependencies.cellViewDataService || new CellViewDataService(this.productionCalculator);
        this.transactionManager = dependencies.transactionManager || new ActionTransactionManager(this);

        // 2. GameState (データストア) の初期化
        if (dependencies.state) {
            this.state = dependencies.state;
        } else {
            const GameStateClass = dependencies.GameStateClass || GameState;
            this.state = GameStateClass ? new GameStateClass({ engine: this }) : { turn: 1, ember: 20, food: 50, wood: 30, defense: 10, mystic: 0, handOffering: [], reserveSlots: [null] };
        }

        // 3. ドメインサブシステムの初期化と注入
        const GridEngineClass = dependencies.GridEngineClass || GridEngine;
        this.gridEngine = dependencies.gridEngine || (GridEngineClass ? new GridEngineClass(this.state, this) : null);

        const DeckManagerClass = dependencies.DeckManagerClass || DeckManager;
        this.deckManager = dependencies.deckManager || (DeckManagerClass ? new DeckManagerClass(this.state, this) : null);

        const DirectiveSystemClass = dependencies.DirectiveSystemClass || DirectiveSystem;
        this.directiveSystem = dependencies.directiveSystem || (DirectiveSystemClass ? new DirectiveSystemClass(this.state, this) : null);

        const BuffSystemClass = dependencies.BuffSystemClass || BuffSystem;
        this.buffSystem = dependencies.buffSystem || (BuffSystemClass ? new BuffSystemClass(this.state, this) : null);

        const UndoLandSystemClass = dependencies.UndoLandSystemClass || UndoLandSystem;
        this.undoSystem = dependencies.undoSystem || (UndoLandSystemClass ? new UndoLandSystemClass(this.state) : null);

        const ChronicleSystemClass = dependencies.ChronicleSystemClass || ChronicleSystem;
        this.chronicleSystem = dependencies.chronicleSystem || (ChronicleSystemClass ? new ChronicleSystemClass(this.state) : null);

        const GlobalEventManagerClass = dependencies.GlobalEventManagerClass || GlobalEventManager;
        this.globalEventManager = dependencies.globalEventManager || (GlobalEventManagerClass ? new GlobalEventManagerClass(this.state, this) : null);

        const EmberSystemClass = dependencies.EmberSystemClass || EmberSystem;
        this.emberSystem = dependencies.emberSystem || (EmberSystemClass ? new EmberSystemClass(this.state, this) : null);

        const CardCycleSystemClass = dependencies.CardCycleSystemClass || CardCycleSystem;
        this.cardCycleSystem = dependencies.cardCycleSystem || (CardCycleSystemClass ? new CardCycleSystemClass(this.state, this) : null);

        // 4. GameState への双方向リンク確立
        if (this.state) {
            this.state.engine = this;
            if (this.gridEngine) this.state.gridEngine = this.gridEngine;
            if (this.deckManager) this.state.deckManager = this.deckManager;
            if (this.directiveSystem) this.state.directiveSystem = this.directiveSystem;
            if (this.buffSystem) this.state.buffSystem = this.buffSystem;
            if (this.chronicleSystem) this.state.chronicleSystem = this.chronicleSystem;
            if (this.globalEventManager) this.state.globalEventManager = this.globalEventManager;
            if (this.emberSystem) this.state.emberSystem = this.emberSystem;
            if (this.cardCycleSystem) this.state.cardCycleSystem = this.cardCycleSystem;
        }

        // 5. ゲーム開始時の初期オファリング生成 (UIではなくEngineの責務)
        if (this.deckManager && (!this.state.handOffering || this.state.handOffering.length === 0)) {
            this.deckManager.generateOfferingCards();
        }
    }

    /**
     * 🏭 新規ゲーム作成ファクトリ
     */
    static createGame(options = {}) {
        return new GameEngine(options);
    }

    /**
     * 🔄 ターン送り
     */
    nextTurn() {
        if (this.transactionManager) this.transactionManager.clearHistory();
        if (this.undoSystem) this.undoSystem.clearSnapshot();

        // 1. 資源産出の加算
        if (this.state && typeof this.state.calculateTotalProduction === 'function') {
            const prods = this.state.calculateTotalProduction();
            this.state.food += (prods.totalFood || 0);
            this.state.wood += (prods.totalWood || 0);
            this.state.mystic += (prods.totalMystic || 1);
        }

        // 2. ターン終了維持費（食料-20等）
        if (this.state && typeof this.state.processTurnEndMaintenance === 'function') {
            this.state.processTurnEndMaintenance();
        }

        // 🌍 2.5. グローバルイベントのターン経過処理 (持続減衰・失効)
        if (this.globalEventManager) {
            this.globalEventManager.tickTurn();
        }

        // 3. 手札オファリング再生成 ＆ マリガン権回復
        if (this.deckManager) {
            this.deckManager.onNextTurn();
        } else if (this.state) {
            this.state.turn++;
            this.state.hasPickedThisTurn = false;
            this.state.hasMulliganedThisTurn = false;
        }

        // 🌍 3.5. 新ターン開始時のグローバルイベント発生判定
        if (this.globalEventManager) {
            this.globalEventManager.onTurnStart();
        }

        // ⚔️ 4. 試練到達チェック ＆ テスト用自動ステージ昇格（5x5 ➔ 7x7 拡大）
        if (this.state && this.state.trialSchedule) {
            const currentTurn = this.state.turn;
            if (this.state.stage && this.state.stage.id === 1 && currentTurn >= this.state.trialSchedule.trial1) {
                // 第1試練 到達 ➔ Stage 2 (7x7) へ昇格
                this.state.stage = { id: 2, name: "Stage 2", size: 7, maxTiles: 48 };
                this.state.nextTrialTurn = this.state.trialSchedule.trial2;
                if (this.gridEngine) {
                    this.gridEngine.expandGrid(7);
                }
                if (this.state.addLog) {
                    const I18n = (typeof globalThis !== 'undefined' && globalThis.I18n) ? globalThis.I18n : (typeof window !== 'undefined' ? window.I18n : { t: k => k });
                    const logMsg = I18n ? I18n.t("LOG_STAGE_EXPAND", { stage: 2, size: 7 }) : `⚔️ Stage 2 (7x7)`;
                    this.state.addLog(logMsg);
                }
            } else if (this.state.stage && this.state.stage.id === 2 && currentTurn >= this.state.trialSchedule.trial2) {
                // 第2試練 到達 ➔ Stage 3 (9x9) へ昇格
                this.state.stage = { id: 3, name: "Stage 3", size: 9, maxTiles: 80 };
                this.state.nextTrialTurn = this.state.trialSchedule.trial3;
                if (this.gridEngine) {
                    this.gridEngine.expandGrid(9);
                }
                if (this.state.addLog) {
                    const I18n = (typeof globalThis !== 'undefined' && globalThis.I18n) ? globalThis.I18n : (typeof window !== 'undefined' ? window.I18n : { t: k => k });
                    const logMsg = I18n ? I18n.t("LOG_STAGE_EXPAND", { stage: 3, size: 9 }) : `⚔️ Stage 3 (9x9)`;
                    this.state.addLog(logMsg);
                }
            }
        }

        // 5. ログ出力
        if (this.state && typeof this.state.addLog === 'function') {
            const I18n = (typeof globalThis !== 'undefined' && globalThis.I18n) ? globalThis.I18n : (typeof window !== 'undefined' ? window.I18n : { t: k => k });
            const logMsg = I18n ? I18n.t("LOG_TURN_START", { turn: this.state.turn }) : `Turn ${this.state.turn} started.`;
            this.state.addLog(logMsg);
        }

        return this.state ? this.state.turn : 1;
    }

    /**
     * 🛡️ Action トランザクション実行 (G3: Validate ➔ Snapshot ➔ Execute ➔ Derived Effects ➔ Commit ➔ Rollback ➔ History)
     * @param {string} actionType - アクション識別子 ("PLACE_LAND", "RESERVE_CARD", etc.)
     * @param {Object|Function} pipeline - パイプライン定義または実行関数
     * @param {Object} [payload={}] - アクション引数コンテキスト
     * @returns {Object} { success: boolean, ... }
     */
    executeAction(actionType, pipeline, payload = {}) {
        if (!this.state) return { success: false, reason: "NO_STATE" };

        if (this.transactionManager && typeof this.transactionManager.execute === "function") {
            const p = typeof pipeline === "function" ? { execute: pipeline } : pipeline;
            return this.transactionManager.execute(actionType, p, payload);
        }

        // フォールバック
        return { success: false, reason: "NO_TRANSACTION_MANAGER" };
    }

    /**
     * 🗺️ 土地配置 Action API (トランザクションパイプライン)
     * @param {number} r - 行
     * @param {number} c - 列
     * @param {Object} card - カードオブジェクト
     * @param {number} [rotation=0] - 回転角度
     * @param {Object} [source={ type: "OFFERING", index: 0 }] - 出現元情報
     */
    placeLand(r, c, card, rotation = 0, source = { type: "OFFERING", index: 0 }) {
        if (!card) return { success: false, reason: "NO_CARD" };

        const shape = card.shape || (card.terrain && card.terrain.shape) || [[1]];
        const terrain = card.terrain || card;
        const currentIdx = source.type === "OFFERING" ? source.index : -1;

        const placedCoords = [];
        if (shape && Array.isArray(shape)) {
            for (let dr = 0; dr < shape.length; dr++) {
                for (let dc = 0; dc < shape[dr].length; dc++) {
                    if (shape[dr][dc] === 1) {
                        placedCoords.push({ r: r + dr, c: c + dc });
                    }
                }
            }
        } else {
            placedCoords.push({ r, c });
        }

        return this.executeAction("PLACE_LAND", {
            // 1. 🔍 Validate (事前バリデーション: 失敗時は一切ステートに触れず拒絶)
            validate: (state) => {
                if (!state) return { can: false, reason: "NO_STATE" };
                if (state.hasPickedThisTurn) return { can: false, reason: "ALREADY_PICKED" };
                if (typeof state.canPlaceShape === "function") {
                    const check = state.canPlaceShape(r, c, shape);
                    if (!check || !check.can) return check || { can: false, reason: "CANNOT_PLACE" };
                }
                return { can: true };
            },
            // 2. ⚙️ Execute (コア変更: 土地配置と保留枠消化)
            execute: (state) => {
                const res = (typeof state.placeShape === "function")
                    ? state.placeShape(r, c, shape, terrain, currentIdx)
                    : { can: false };

                if (!res || (!res.can && !res.success)) {
                    return { success: false, reason: res ? res.reason : "CANNOT_PLACE" };
                }

                if (source.type === "RESERVE" && source.index !== -1 && state.reserveSlots) {
                    state.reserveSlots[source.index] = null;
                }

                return { success: true, result: res };
            },
            // 3. 🌟 Derived Effects (派生効果: UNIQUEカード消費、マージチェック)
            applyDerivedEffects: (state) => {
                if (this.cardCycleSystem && typeof this.cardCycleSystem.consumeUnique === "function") {
                    this.cardCycleSystem.consumeUnique(card);
                }
                if (typeof state.checkMergePatterns === "function") {
                    state.checkMergePatterns();
                }
                return { success: true };
            }
        }, { r, c, card, shape, rotation, source, placedCoords });
    }

    /**
     * 🃏 手札オファリングから保留枠へのカード移動 Action API
     * @param {number} offeringIdx - オファリング枠インデックス
     * @param {number} [targetReserveIdx=0] - 保留枠インデックス
     */
    reserveOfferingCard(offeringIdx, targetReserveIdx = 0) {
        return this.executeAction("RESERVE_CARD", () => {
            if (this.deckManager && typeof this.deckManager.moveToReserve === "function") {
                const ok = this.deckManager.moveToReserve(offeringIdx);
                return { success: !!ok, reason: ok ? null : "MOVE_TO_RESERVE_FAILED" };
            }
            if (typeof this.state.moveToReserve === "function") {
                const ok = this.state.moveToReserve(offeringIdx);
                return { success: !!ok, reason: ok ? null : "MOVE_TO_RESERVE_FAILED" };
            }
            return { success: false, reason: "NO_RESERVE_LOGIC" };
        });
    }

    returnReservedCard(reserveIdx = 0, targetHandIdx = -1) {
        return this.executeAction("RETURN_RESERVE_CARD", () => {
            if (this.deckManager && typeof this.deckManager.returnFromReserve === "function") {
                const ok = this.deckManager.returnFromReserve(reserveIdx, targetHandIdx);
                return { success: !!ok, reason: ok ? null : "RETURN_FROM_RESERVE_FAILED" };
            }
            if (typeof this.state.returnFromReserve === "function") {
                const ok = this.state.returnFromReserve(reserveIdx, targetHandIdx);
                return { success: !!ok, reason: ok ? null : "RETURN_FROM_RESERVE_FAILED" };
            }
            return { success: false, reason: "NO_RETURN_LOGIC" };
        });
    }

    discardReservedCard(reserveIdx = 0) {
        return this.executeAction("DISCARD_RESERVE_CARD", () => {
            if (this.deckManager && typeof this.deckManager.discardFromReserve === "function") {
                const ok = this.deckManager.discardFromReserve(reserveIdx);
                return { success: !!ok, reason: ok ? null : "DISCARD_FROM_RESERVE_FAILED" };
            }
            if (typeof this.state.discardFromReserve === "function") {
                const ok = this.state.discardFromReserve(reserveIdx);
                return { success: !!ok, reason: ok ? null : "DISCARD_FROM_RESERVE_FAILED" };
            }
            return { success: false, reason: "NO_DISCARD_LOGIC" };
        });
    }

    playCommandCard(card, source = { type: "OFFERING", index: -1 }) {
        return this.executeAction("PLAY_COMMAND_CARD", () => {
            if (this.deckManager && typeof this.deckManager.playCommandCard === "function") {
                const cardObj = card.terrain || card;
                const offeringIdx = source.type === "OFFERING" ? source.index : -1;
                const reserveIdx = source.type === "RESERVE" ? source.index : -1;
                const ok = this.deckManager.playCommandCard(cardObj, null, offeringIdx, reserveIdx);
                return { success: ok !== false, card };
            }
            if (typeof this.state.playCommandCard === "function") {
                const cardObj = card.terrain || card;
                const offeringIdx = source.type === "OFFERING" ? source.index : -1;
                const reserveIdx = source.type === "RESERVE" ? source.index : -1;
                const ok = this.state.playCommandCard(cardObj, null, offeringIdx, reserveIdx);
                return { success: ok !== false, card };
            }
            return { success: false, reason: "NO_COMMAND_LOGIC" };
        });
    }

    /**
     * 🎲 マリガン Action API
     */
    mulligan() {
        return this.executeAction("MULLIGAN", () => {
            if (!this.state) return { success: false, reason: "NO_STATE" };
            if (this.state.hasPickedThisTurn || this.state.hasMulliganedThisTurn || this.state.ember < 1) {
                return { success: false, reason: "MULLIGAN_BLOCKED" };
            }

            this.state.ember -= 1;
            this.state.hasMulliganedThisTurn = true;

            if (this.deckManager && typeof this.deckManager.drawOffering === "function") {
                this.deckManager.drawOffering();
            } else if (typeof this.state.drawOffering === "function") {
                this.state.drawOffering();
            }

            if (typeof this.state.addLog === "function") {
                const I18n = (typeof globalThis !== 'undefined' && globalThis.I18n) ? globalThis.I18n : (typeof window !== 'undefined' ? window.I18n : { t: k => k });
                this.state.addLog(I18n.t("LOG_MULLIGAN_EXECUTED") || "🎲 マリガン実行: 🔥 -1 を消費して手札を再抽選しました。");
            }

            return { success: true };
        });
    }

    /**
     * ↩️ 直前 Action の巻き戻し API
     */
    undoLastAction() {
        if (this.transactionManager && typeof this.transactionManager.undo === "function") {
            return this.transactionManager.undo();
        }
        if (this.undoSystem && typeof this.undoSystem.undo !== "function") {
            return { success: false, reason: "NO_UNDO_SYSTEM" };
        }
        const success = this.undoSystem.undo();
        return { success };
    }

    /**
     * 🍞 トーストキューの一括引き抜き (UI 表示用ドレイン)
     * @returns {Array<Object>}
     */
    drainToasts() {
        if (!this.state || !Array.isArray(this.state.toastQueue) || this.state.toastQueue.length === 0) {
            return [];
        }
        const toasts = [...this.state.toastQueue];
        this.state.toastQueue = [];
        return toasts;
    }

    /**
     * 🏁 ターン終了 API (nextTurn のエイリアス)
     */
    endTurn() {
        return this.nextTurn();
    }

    /**
     * 🗺️ 単一マスの表示用純粋事実データ取得 (Facade API)
     * @param {number} r - 行
     * @param {number} c - 列
     * @returns {Object|null}
     */
    getCellViewData(r, c) {
        if (!this.cellViewDataService || typeof this.cellViewDataService.getCellViewData !== "function") {
            return null;
        }
        return this.cellViewDataService.getCellViewData(this.state, r, c);
    }
}

if (typeof window !== "undefined") {
    window.GameEngine = GameEngine;
}
if (typeof globalThis !== "undefined") {
    globalThis.GameEngine = GameEngine;
}

export { GameEngine };
export default GameEngine;

