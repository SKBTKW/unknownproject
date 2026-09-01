/**
 * 🌉 Legacy UI Bridge (レガシー HTML / グローバル互換境界モジュール)
 * 
 * 責務:
 * 1. UIController 本体から window へのグローバル露出を完全に隔離する。
 * 2. index.html 内のインライン onclick/oncontextmenu ハンドラや
 *    旧来のグローバル参照（window.selectCard 等）への下位互換性を提供する。
 * 3. 将来の完全モジュール化・モバイル/Unity 移植時に、このファイルごと切り離し可能とする。
 */

import { focusLayerManager } from './focus_layer_system.js';
import { I18n } from '../i18n.js';
import { LogComponent } from './log_component.js';
import { BuffPanelComponent } from './buff_panel_component.js';
import { TerritoryBadgeComponent } from './territory_badge_component.js';
import { UILayoutConfig } from './layout_config.js';
import { BlockPlacementSystem } from './block_placement_system.js';

export function attachLegacyUIBridge(ui) {
    if (typeof window === "undefined" || !ui) return;

    // 1. 🌐 グローバル参照境界
    window.uiController = ui;
    window.state = ui.state;
    window.drawSys = ui.drawSys;
    window.undoSys = ui.undoSys;
    window.I18n = I18n;
    window.LogComponent = LogComponent;
    window.BuffPanelComponent = BuffPanelComponent;
    window.TerritoryBadgeComponent = TerritoryBadgeComponent;
    window.UILayoutConfig = UILayoutConfig;
    window.BlockPlacementSystem = BlockPlacementSystem;

    // プロパティアクセサ
    Object.defineProperty(window, 'selectedCard', {
        get: () => ui.selectedCard,
        set: (val) => { ui.selectedCard = val; },
        configurable: true
    });
    Object.defineProperty(window, 'selectedCardIdx', {
        get: () => ui.selectedCardIdx,
        set: (val) => { ui.selectedCardIdx = val; },
        configurable: true
    });

    // 2. 🖱️ HTML インラインイベント用プロキシ関数
    window.selectCard = (idx) => ui.selectCard(idx);
    window.deselectCard = () => ui.deselectCard();
    window.rotateSelectedCard = (e, idx) => ui.rotateSelectedCard(e, idx);
    window.toggleHandMinimalMode = () => ui.toggleHandMinimalMode();
    window.onCellClick = (r, c) => ui.onCellClick(r, c);
    window.onCellMouseEnter = (e, r, c) => ui.onCellMouseEnter(e, r, c);
    window.onCellMouseMove = (e, r, c) => ui.onCellMouseMove(e, r, c);
    window.clearCellPreviews = () => ui.clearCellPreviews();
    window.mulligan = () => ui.mulligan();
    window.nextTurn = () => ui.nextTurn();
    window.reserveCard = (idx) => ui.reserveCard(idx);
    window.returnReserveCard = (idx) => ui.returnReserveCard(idx);
    window.discardReserveCard = (idx) => ui.discardReserveCard(idx);
    window.playReserveCard = (idx) => ui.playReserveCard(idx);
    window.toggleReservePopover = (idx) => ui.toggleReservePopover(idx);
    window.closeReservePopover = () => ui.closeReservePopover();
    window.playCommandCard = (card, idx) => ui.playCommandCard(card, idx);
    window.toggleDirectiveModal = () => ui.toggleDirectiveModal();
    window.closeDirectiveModal = () => ui.closeDirectiveModal();
    window.selectDirective = (id) => ui.selectDirective(id);
    window.toggleTileTextStyle = (e) => ui.toggleTileTextStyle(e);
    window.toggleBoardLabelMode = (e) => ui.toggleTileTextStyle(e);
    window.showDataPanelTooltip = (e) => ui.showDataPanelTooltip(e);
    window.hideDataPanelTooltip = () => ui.hideDataPanelTooltip();
    window.showDiceCheck = (event) => ui.showDiceCheck(event);

    // 🏇 Cavalry Charge Demo (5 + 6 -> 11)
    window.demoCavalryCharge = () => {
        ui.showDiceCheck({
            result: {
                checkId: "trial_intercept",
                checkSequence: 1,
                dice: { rolled: [5, 6], kept: [5, 6] },
                rawTotal: 11,
                modifierTotal: 0,
                finalTotal: 11,
                outcome: { id: "great_success", nameKey: "CHECK_OUTCOME_GREAT_SUCCESS" }
            },
            context: { sourceType: "TRIAL_TACTIC", sourceId: "cavalry_charge", tacticNameKey: "TACTIC_CAVALRY_CHARGE_NAME" },
            feedback: { importance: "CRITICAL" }
        });
    };

    // ⚔️ Intercept Tactic Demo (3 + 5 + 2 -> 10)
    window.demoTrialIntercept = () => {
        ui.showDiceCheck({
            result: {
                checkId: "trial_intercept",
                checkSequence: 1,
                dice: { rolled: [3, 5], kept: [3, 5] },
                rawTotal: 8,
                modifierTotal: 2,
                finalTotal: 10,
                outcome: { id: "success", nameKey: "CHECK_OUTCOME_SUCCESS" }
            },
            context: { sourceType: "TRIAL_TACTIC", sourceId: "defensive_barricade", tacticNameKey: "TACTIC_INTERCEPT_NAME" },
            feedback: { importance: "TACTICAL" }
        });
    };

    // 🌾🧱 Resource Delta Popup Demo (-5 Food, +10 Material)
    window.demoResourceDelta = () => {
        const FloatingFeedbackService = (typeof window !== "undefined" && window.FloatingFeedbackService) ? window.FloatingFeedbackService : null;
        if (FloatingFeedbackService) {
            FloatingFeedbackService.spawnOnElement("#valFood", -5);
            FloatingFeedbackService.spawnOnElement("#valWood", 10);
        }
    };

    // 🎲 Test Play Command Card: CMD_ABANDONED_SETTLEMENT (Expedition 2D6 roll)
    window.testPlayAbandonedSettlement = () => {
        if (!ui || !ui.engine) return;
        const testCard = {
            id: "CMD_ABANDONED_SETTLEMENT",
            category: "COMMAND",
            nameKey: "CMD_ABANDONED_SETTLEMENT_NAME",
            descriptionKey: "CMD_ABANDONED_SETTLEMENT_DESC",
            cost: { ember: 1 }
        };
        // Ensure at least 1 ember is available for test
        if (ui.state && (ui.state.ember === undefined || ui.state.ember < 1)) {
            ui.state.ember = 20;
        }
        ui.playCommandCard(testCard, -1);
    };

    window.render = () => ui.render();

    window.undoLandPlacement = () => {
        const undoSys = ui.undoSys || (typeof window !== "undefined" ? window.undoSys : null);
        if (undoSys) {
            undoSys.undo();
            ui.selectedCard = null;
            ui.selectedCardIdx = -1;
            ui.selectedReserveIdx = -1;
            if (focusLayerManager) focusLayerManager.onCardDeselect();
            ui.render();
            ui.highlightPlaceableCells();
        }
    };
}

if (typeof window !== "undefined") {
    window.attachLegacyUIBridge = attachLegacyUIBridge;
}
if (typeof globalThis !== "undefined") {
    globalThis.attachLegacyUIBridge = attachLegacyUIBridge;
}
