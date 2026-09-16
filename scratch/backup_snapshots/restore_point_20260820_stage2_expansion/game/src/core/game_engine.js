import { I18n } from '../i18n.js';
import { LAND_SYSTEM_DATA } from '../data/land_system.js';
import { DIRECTIVES, DirectiveSystem } from '../systems/directive_system.js';
import { DeckManager } from '../systems/deck_manager.js';
import { ProductionCalculator } from '../systems/production_calculator.js';
import { UndoLandSystem } from '../systems/undo_land_system.js';
import { GridEngine } from '../systems/grid_engine.js';
import { BuffSystem } from '../systems/buff_system.js';
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

        // 2. GameState (データストア) の初期化
        if (dependencies.state) {
            this.state = dependencies.state;
        } else {
            const GameStateClass = dependencies.GameStateClass || GameState;
            this.state = GameStateClass ? new GameStateClass({ engine: this }) : { turn: 1, ember: 20, food: 30, wood: 30, defense: 10, mystic: 0, handOffering: [], reserveSlots: [null,null,null] };
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

        // 4. GameState への双方向リンク確立
        if (this.state) {
            this.state.engine = this;
            if (this.gridEngine) this.state.gridEngine = this.gridEngine;
            if (this.deckManager) this.state.deckManager = this.deckManager;
            if (this.directiveSystem) this.state.directiveSystem = this.directiveSystem;
            if (this.buffSystem) this.state.buffSystem = this.buffSystem;
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

        // 3. 手札オファリング再生成 ＆ マリガン権回復
        if (this.deckManager) {
            this.deckManager.onNextTurn();
        } else if (this.state) {
            this.state.turn++;
            this.state.hasPickedThisTurn = false;
            this.state.hasMulliganedThisTurn = false;
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
                    this.state.addLog(`⚔️ [第1試練 到達] テストモードにより試練をスキップし、Stage 2 (7×7 盤面 / 48マス) へ拡張しました！`);
                }
            } else if (this.state.stage && this.state.stage.id === 2 && currentTurn >= this.state.trialSchedule.trial2) {
                // 第2試練 到達 ➔ Stage 3 (9x9) へ昇格
                this.state.stage = { id: 3, name: "Stage 3", size: 9, maxTiles: 80 };
                this.state.nextTrialTurn = this.state.trialSchedule.trial3;
                if (this.gridEngine) {
                    this.gridEngine.expandGrid(9);
                }
                if (this.state.addLog) {
                    this.state.addLog(`⚔️ [第2試練 到達] テストモードにより試練をスキップし、Stage 3 (9×9 盤面 / 80マス) へ拡張しました！`);
                }
            }
        }

        // 5. ログ出力
        if (this.state && typeof this.state.addLog === 'function') {
            this.state.addLog(`ターン ${this.state.turn} を開始しました。手札オファリングを補充しました。`);
        }

        return this.state ? this.state.turn : 1;
    }

    /**
     * 🎲 マリガン
     */
    mulligan() {
        if (this.deckManager) return this.deckManager.mulligan();
        return { success: false, reason: "NO_DECK_MANAGER" };
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

