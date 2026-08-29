import { I18n } from '../i18n.js';
import { LogComponent } from './log_component.js';
import { BuffPanelComponent } from './buff_panel_component.js';
import { TerritoryBadgeComponent } from './territory_badge_component.js';
import { UILayoutConfig } from './layout_config.js';
import { BlockPlacementSystem } from './block_placement_system.js';
import { ProductionCalculator } from '../systems/production_calculator.js';
import { ModalSystem } from './modal_system.js';
import { focusLayerManager } from './focus_layer_system.js';
import { boardCameraSystem } from './board_camera_system.js';
import { UndoLandSystem } from '../systems/undo_land_system.js';
import { EmberStatusComponent } from './ember_status_component.js';
import { HandCardsComponent } from './hand_cards_component.js';
import { ReserveSlotComponent } from './reserve_slot_component.js';
import { TopHeaderComponent } from './top_header_component.js';
import { BoardGridComponent } from './board_grid_component.js';
import { HqComponent } from './hq_component.js';
import { tooltipSystemInstance } from './tooltip_system.js';

class UIController {
    /**
     * @param {GameEngine|Object} engine - ゲームエンジンまたはGameState
     */
    constructor(engine) {
        this.engine = engine;
        this.state = (engine && engine.state) ? engine.state : engine;
        this.drawSys = (engine && engine.deckManager) ? engine.deckManager : (engine && engine.drawSys ? engine.drawSys : null);
        this.undoSys = (engine && engine.undoSys) ? engine.undoSys : (UndoLandSystem && this.state ? new UndoLandSystem(this.state) : null);
        this.emberStatusComponent = (typeof document !== 'undefined') ? new EmberStatusComponent() : null;
        this.hqComponent = (typeof document !== 'undefined') ? new HqComponent(this) : null;
        this.handCardsComponent = (typeof document !== 'undefined') ? new HandCardsComponent(this) : null;
        this.reserveSlotComponent = (typeof document !== 'undefined') ? new ReserveSlotComponent(this) : null;
        this.topHeaderComponent = (typeof document !== 'undefined') ? new TopHeaderComponent(this) : null;
        this.boardGridComponent = (typeof document !== 'undefined') ? new BoardGridComponent(this) : null;
        this.selectedCard = null;
        this.selectedCardIdx = -1;
        this.selectedReserveIdx = -1;
        this.isReservePopoverOpen = false;
        this.pinnedPreviewCard = null;

        let initialMinimal = false;
        if (typeof localStorage !== 'undefined') {
            const saved = localStorage.getItem("toa_hand_minimal_mode");
            if (saved !== null) {
                initialMinimal = (saved === "true");
            } else if (typeof window !== 'undefined' && window.gameSettings) {
                initialMinimal = (window.gameSettings.get("defaultHandMode") === "minimal");
            }
        }
        this.isMinimalMode = initialMinimal;

        if (typeof window !== "undefined" && this.undoSys) {
            window.undoSys = this.undoSys;
        }

        // グローバル参照および後方互換用プロキシバインド
        if (typeof window !== "undefined") {
            window.uiController = this;
            window.state = this.state;
            window.drawSys = this.drawSys;
            window.selectedCard = this.selectedCard;
            window.selectedCardIdx = this.selectedCardIdx;
            window.I18n = I18n;
            window.LogComponent = LogComponent;
            window.BuffPanelComponent = BuffPanelComponent;
            window.TerritoryBadgeComponent = TerritoryBadgeComponent;
            window.UILayoutConfig = UILayoutConfig;
            window.BlockPlacementSystem = BlockPlacementSystem;

            // HTML 内のインラインイベント用プロキシ
            window.selectCard = (idx) => this.selectCard(idx);
            window.deselectCard = () => this.deselectCard();
            window.rotateSelectedCard = (e, idx) => this.rotateSelectedCard(e, idx);
            window.toggleHandMinimalMode = () => this.toggleHandMinimalMode();
            window.onCellClick = (r, c) => this.onCellClick(r, c);
            window.onCellMouseEnter = (e, r, c) => this.onCellMouseEnter(e, r, c);
            window.onCellMouseMove = (e, r, c) => this.onCellMouseMove(e, r, c);
            window.clearCellPreviews = () => this.clearCellPreviews();
            window.mulligan = () => this.mulligan();
            window.nextTurn = () => this.nextTurn();
            window.reserveCard = (idx) => this.reserveCard(idx);
            window.returnReserveCard = (idx) => this.returnReserveCard(idx);
            window.discardReserveCard = (idx) => this.discardReserveCard(idx);
            window.playReserveCard = (idx) => this.playReserveCard(idx);
            window.toggleReservePopover = (idx) => this.toggleReservePopover(idx);
            window.closeReservePopover = () => this.closeReservePopover();
            window.playCommandCard = (card, idx) => this.playCommandCard(card, idx);
            window.toggleDirectiveModal = () => this.toggleDirectiveModal();
            window.closeDirectiveModal = () => this.closeDirectiveModal();
            window.selectDirective = (id) => this.selectDirective(id);
            window.toggleTileTextStyle = (e) => this.toggleTileTextStyle(e);
            window.toggleBoardLabelMode = (e) => this.toggleTileTextStyle(e);
            window.showDataPanelTooltip = (e) => this.showDataPanelTooltip(e);
            window.hideDataPanelTooltip = () => this.hideDataPanelTooltip();
            window.undoLandPlacement = () => {
                const undoSys = this.undoSys || (typeof window !== "undefined" ? window.undoSys : null);
                if (undoSys) {
                    undoSys.undo();
                    this.selectedCard = null;
                    this.selectedCardIdx = -1;
                    this.selectedReserveIdx = -1;
                    if (focusLayerManager) focusLayerManager.onCardDeselect();
                    this.render();
                    this.highlightPlaceableCells();
                }
            };
            window.render = () => this.render();

            const dataPanelEl = document.getElementById("headerDataPanel");
            if (dataPanelEl) {
                dataPanelEl.addEventListener("mouseenter", (e) => this.showDataPanelTooltip(e));
                dataPanelEl.addEventListener("mouseleave", () => this.hideDataPanelTooltip());
            }
        }
    }

    /**
     * 🚀 UI の初期化とマウント
     */
    init() {
        this.initModularUIComponents();
        this.initStaticI18nLabels();
        this.initGlobalCancelListeners();
        if (tooltipSystemInstance) {
            tooltipSystemInstance.init(I18n);
        }
        if (this.drawSys && (!this.state.handOffering || this.state.handOffering.length === 0)) {
            this.drawSys.generateOfferingCards();
        }
        this.render();
    }

    /**
     * 🛑 土地カード選択のキャンセル（解除）
     */
    deselectCard() {
        if (!this.selectedCard && this.selectedCardIdx === -1) return;
        this.selectedCard = null;
        this.selectedCardIdx = -1;
        this.selectedReserveIdx = -1;
        if (focusLayerManager) focusLayerManager.onCardDeselect();
        this.clearCellPreviews();
        this.render();
        this.highlightPlaceableCells();
        this.updateFloatingPreview(null);
    }

    /**
     * 🎯 盤面外クリック / Esc キー / 盤面外右クリックによる配置キャンセル検知
     */
    initGlobalCancelListeners() {
        if (typeof document === "undefined") return;

        // 1. 盤面外・背景クリックでキャンセル ＆ 保留ポップオーバー閉じ
        document.addEventListener("click", (e) => {
            if (this.isReservePopoverOpen && !e.target.closest(".reserve-popover-menu") && !e.target.closest(".reserve-card-hold")) {
                this.closeReservePopover();
            }

            if (!this.selectedCard) return;
            // クリック先がマス目(.cell)、手札カード、保留枠、手札トレイ全体、マリガンボタン、モーダル内の場合は除外
            if (e.target.closest(".cell") || 
                e.target.closest(".card-frame-tcg") || 
                e.target.closest(".card-slot-box") || 
                e.target.closest(".reserve-slot-empty") || 
                e.target.closest(".reserve-slot-single-box") || 
                e.target.closest(".offering-section") || 
                e.target.closest("#cardRow") || 
                e.target.closest("#btnMulligan") || 
                e.target.closest(".modal-container") || 
                e.target.closest("#directiveModal")) {
                return;
            }
            this.deselectCard();
        });

        // 2. Esc キーで即時キャンセル ＆ 保留ポップオーバー閉じ
        document.addEventListener("keydown", (e) => {
            if (e.key === "Escape" || e.key === "Esc") {
                if (this.isReservePopoverOpen) {
                    this.closeReservePopover();
                }
                if (this.selectedCard) {
                    this.deselectCard();
                }
            }
        });

        // 3. 右クリックによる選択解除（土地カードはセル・カード上回転/盤面外キャンセル、コマンドカードはどこでも右クリック即時キャンセル）
        document.addEventListener("contextmenu", (e) => {
            if (this.selectedCard) {
                const tObj = this.selectedCard.terrain || this.selectedCard;
                const category = this.selectedCard.category || tObj.category || "LAND";
                
                // コマンドカードの場合は、盤面内外を問わず右クリックで即座にキャンセル
                if (category !== "LAND") {
                    e.preventDefault();
                    this.deselectCard();
                    return;
                }

                // 土地カードの場合は、盤面セル・カード・保留・手札枠以外をクリックでキャンセル
                if (!e.target.closest(".cell") && 
                    !e.target.closest(".card-frame-tcg") && 
                    !e.target.closest(".reserve-slot-empty") && 
                    !e.target.closest(".reserve-slot-single-box") && 
                    !e.target.closest(".offering-section")) {
                    e.preventDefault();
                    this.deselectCard();
                }
            }
        });

        // 4. 🖱️ ドラッグ中の禁止カーソル (赤丸斜線 🚫) 抑止
        document.addEventListener("dragover", (e) => {
            e.preventDefault();
            if (e.dataTransfer) e.dataTransfer.dropEffect = "move";
        });
    }

    initModularUIComponents() {
        if (UILayoutConfig && typeof UILayoutConfig.applyLayout === "function") {
            UILayoutConfig.applyLayout();
        }
        if (typeof document === "undefined") return;

        const logContainer = document.getElementById("logComponentContainer");
        if (LogComponent && logContainer && !logContainer.hasChildNodes()) {
            LogComponent.mount(logContainer, this.state);
        }

        const buffContainer = document.getElementById("buffComponentContainer");
        if (BuffPanelComponent && buffContainer && !buffContainer.hasChildNodes()) {
            BuffPanelComponent.mount(buffContainer);
        }

        const badgeContainer = document.getElementById("territoryBadgeFooterSlot") || document.getElementById("territoryBadgeContainer");
        const badgeComp = (typeof TerritoryBadgeComponent !== "undefined" && TerritoryBadgeComponent) ? TerritoryBadgeComponent : (typeof window !== "undefined" ? window.TerritoryBadgeComponent : null);
        if (badgeComp && badgeContainer) {
            if (typeof badgeComp.mount === "function") {
                badgeComp.mount(badgeContainer);
            }
        }

        // 🌟 2層レイヤー監視初期化 (手札フォーカス ✕ 盤面暗転ブラー)
        const boardEl = document.getElementById("layerWorldBoard") || document.querySelector(".layer-world-board") || document.querySelector(".board-container");
        const offeringEl = document.querySelector(".offering-section");
        if (focusLayerManager && typeof focusLayerManager.mount === "function") {
            focusLayerManager.mount(boardEl, offeringEl);
        }

        // 🎡 盤面マウスホイール可変ズーム初期化 (Civ6 スタイル)
        const boardWrapperEl = document.querySelector(".board-container-wrapper") || document.getElementById("gridBoard");
        if (boardCameraSystem && typeof boardCameraSystem.mount === "function") {
            boardCameraSystem.mount(boardWrapperEl, boardEl);
        }

        // ⚙️ 環境設定モーダル ＆ ヘッダーボタン初期化
        const settingsSys = (typeof settingsModalInstance !== "undefined" && settingsModalInstance) ? settingsModalInstance : (typeof window !== "undefined" ? window.settingsModalInstance : null);
        if (settingsSys && typeof settingsSys.mount === "function") {
            settingsSys.mount();
        }
    }

    initStaticI18nLabels() {
        if (typeof document === "undefined") return;
        const I18n = (typeof globalThis !== 'undefined' && globalThis.I18n) ? globalThis.I18n : (typeof window !== 'undefined' ? window.I18n : null);
        if (!I18n) return;

        document.title = I18n.t("UI_TITLE");
        this.setElementText("lblAppTitle", I18n.t("UI_TITLE"));
        this.setElementText("lblRoleAvatar", I18n.t("UI_ROLE_AVATAR"));
        this.setElementText("lblTurnHeader", I18n.t("UI_TURN_LABEL"));
        this.setElementText("lblOfferingTitle", I18n.t("UI_OFFERING_TITLE") || "手札オファリング");
        this.setElementText("lblReserveTitle", I18n.t("UI_RESERVE_TITLE"));
        this.setElementText("lblMainBadge", I18n.t("UI_MAIN_AREA_BADGE"));
        this.setElementText("lblDataPanelTitle", I18n.t("UI_DATA_PANEL_TITLE"));
        this.setElementText("lblBuffPanelTitle", I18n.t("UI_BUFF_PANEL_TITLE"));
        this.setElementText("lblFood", I18n.t("UI_FOOD"));
        this.setElementText("lblWood", I18n.t("UI_WOOD"));
        this.setElementText("lblDefense", I18n.t("UI_DEFENSE"));
        this.setElementText("lblMystic", I18n.t("UI_MYSTIC"));
        this.setElementText("lblLogTitle", I18n.t("UI_LOG_TITLE"));
        this.setElementText("btnLogToggle", "▼");
        this.setElementText("btnTurnEnd", I18n.t("UI_TURN_END_BTN"));
        this.setElementText("lblLogSub", I18n.t("UI_LOG_SUB_HINT"));

        // 🌐 全 data-i18n 要素の自動多言語翻訳
        document.querySelectorAll("[data-i18n]").forEach(el => {
            const key = el.getAttribute("data-i18n");
            if (key) el.innerHTML = I18n.t(key);
        });
    }

    setElementText(id, text) {
        if (typeof document === "undefined") return;
        const el = document.getElementById(id);
        if (el) el.innerText = text;
    }

    /**
     * 🖥️ 画面全体の描画更新 (Render)
     */
    render() {
        if (!this.state || typeof document === "undefined") return;
        const I18n = (typeof globalThis !== 'undefined' && globalThis.I18n) ? globalThis.I18n : (typeof window !== 'undefined' ? window.I18n : { t: k => k });

        // 1. ログ描画（最優先・絶対に失敗させない）
        try {
            this.renderLogs();
        } catch (e) {
            console.error("Log render error:", e);
        }

        try {
            // 🏛️ 最上部HUDヘッダー (資源・ターン数・領土バッジ・試練予告) - TopHeaderComponent へ委譲
            if (this.topHeaderComponent) {
                this.topHeaderComponent.render(I18n);
            }

            // 🗺️ 盤面グリッド描画 (本営C3セル含む)
            this.renderBoardGrid(I18n);

            // 🔥 本営 (C3) 残り火変動差分検知 ＆ フロートポップアップ演出 (盤面描画直後に実行することでDOM消失を完全防止)
            if (this.hqComponent && typeof this.hqComponent.checkAndTriggerDeltaPopup === "function") {
                this.hqComponent.checkAndTriggerDeltaPopup(this.state.ember);
            }

            this.renderOfferingCards(I18n);
            this.renderBuffPanel();
            this.updateMulliganButton();
            this.updateFloatingPreview(null);
        } catch (err) {
            console.error("UIController Render Error:", err);
        }
    }

    renderLogs() {
        if (typeof window !== "undefined" && window.LogComponent && typeof window.LogComponent.renderLogs === "function") {
            window.LogComponent.renderLogs();
        }
    }

    renderBoardGrid(I18n) {
        if (this.boardGridComponent && typeof this.boardGridComponent.render === "function") {
            this.boardGridComponent.render(I18n);
        }
    }

    renderOfferingHeader(I18n) {
        const offeringSection = document.querySelector(".offering-section");
        if (!offeringSection) return;

        let headerEl = offeringSection.querySelector(".section-title-offering");
        if (!headerEl) {
            headerEl = document.createElement("div");
            headerEl.className = "section-title-offering section-title-offering-header";
            offeringSection.insertBefore(headerEl, offeringSection.firstChild);
        }

        const canMulligan = !this.state.hasPickedThisTurn && !this.state.hasMulliganedThisTurn && this.state.ember >= 1;
        const reserveCostText = I18n ? (I18n.t("RESERVE_HEADER_COST") || "ターン終了時 🔥-1") : "ターン終了時 🔥-1";
        const mulliganBtnLabel = I18n ? (I18n.t("UI_MULLIGAN_BTN_LABEL") || "🔄 マリガン") : "🔄 マリガン";
        const reserveCostTooltip = I18n ? (I18n.t("RESERVE_HEADER_COST_TOOLTIP") || "⚠️ 保留枠にカードをキープしたままターンを終了すると、維持費として 🔥-1 を消費します") : "⚠️ 保留枠にカードをキープしたままターンを終了すると、維持費として 🔥-1 を消費します";

        headerEl.innerHTML = `
            <div class="offering-header-hand-col">
                <button class="btn-mulligan-compact" id="btnMulligan" ${canMulligan ? "" : "disabled style='opacity:0.45; cursor:not-allowed; filter:grayscale(0.8);'"}>
                    <span>${mulliganBtnLabel}</span> <span class="btn-mulligan-ember-cost">🔥-1</span>
                </button>
            </div>
            <div class="offering-header-separator-space"></div>
            <div class="offering-header-reserve-col">
                <span class="reserve-header-cost-badge" data-tooltip="${reserveCostTooltip}">
                    ${reserveCostText}
                </span>
            </div>
        `;

        const btnMulligan = headerEl.querySelector("#btnMulligan");
        if (btnMulligan && canMulligan) {
            btnMulligan.onclick = () => this.handleMulliganClick(btnMulligan);
        }
    }

    handleMulliganClick(btnMulligan) {
        const settings = (typeof window !== "undefined" && window.gameSettings) ? window.gameSettings : null;
        const confirmRequired = settings ? settings.get("mulliganConfirm") : true;

        const executeMulligan = () => {
            if (typeof window.mulligan === "function") {
                window.mulligan();
            } else if (this.engine && typeof this.engine.mulligan === "function") {
                this.engine.mulligan();
            }
        };

        if (!confirmRequired) {
            executeMulligan();
            return;
        }

        const I18n = (typeof globalThis !== 'undefined' && globalThis.I18n) ? globalThis.I18n : (typeof window !== 'undefined' ? window.I18n : { t: k => k });
        const dlgTitle = I18n ? I18n.t("UI_DIALOG_MULLIGAN_TITLE") : "手札を引き直しますか？";
        const dlgDesc = I18n ? I18n.t("UI_DIALOG_MULLIGAN_DESC") : "🔥 残り火を 1 消費して新カード 3 枚を引き直します。";
        const dlgConfirm = I18n ? I18n.t("UI_DIALOG_MULLIGAN_CONFIRM") : "引き直す (🔥 -1)";
        const dlgCancel = I18n ? I18n.t("UI_DIALOG_MULLIGAN_CANCEL") : "やめる";
        const dlgDontAsk = I18n ? I18n.t("UI_DIALOG_DONT_ASK_AGAIN") : "次回から確認しない";

        if (typeof ModalSystem !== "undefined" && typeof ModalSystem.showConfirmDialog === "function") {
            ModalSystem.showConfirmDialog({
                title: `🔄 ${dlgTitle}`,
                descText: dlgDesc,
                costText: "🔥 -1",
                checkboxLabel: dlgDontAsk,
                confirmLabel: dlgConfirm,
                cancelLabel: dlgCancel,
                onConfirm: (dontAskAgain) => {
                    if (dontAskAgain && settings) {
                        settings.set("mulliganConfirm", false);
                    }
                    executeMulligan();
                }
            });
            return;
        }

        // フォールバック
        executeMulligan();
    }

    /**
     * 📐 手札表示モード（標準 260x390px ⇄ ミニマル 64x80px + ホバー拡大）切替
     */
    toggleHandMinimalMode() {
        if (typeof window !== "undefined" && window.tooltipSystemInstance && typeof window.tooltipSystemInstance.hide === "function") {
            window.tooltipSystemInstance.hide();
        }
        this.isMinimalMode = !this.isMinimalMode;
        if (typeof localStorage !== 'undefined') {
            localStorage.setItem("toa_hand_minimal_mode", this.isMinimalMode ? "true" : "false");
        }
        this.render();
        const I18n = (typeof globalThis !== 'undefined' && globalThis.I18n) ? globalThis.I18n : (typeof window !== 'undefined' ? window.I18n : { t: k => k });
        if (typeof window.showToast === "function") {
            const toastMsg = this.isMinimalMode ? (I18n ? I18n.t("UI_TOAST_MINIMAL_MODE_ON") : "手札をミニマル表示（ホバー拡大）に切り替えました") : (I18n ? I18n.t("UI_TOAST_MINIMAL_MODE_OFF") : "手札を標準表示に切り替えました");
            window.showToast(toastMsg);
        }
    }

    renderOfferingCards(I18n) {
        const offeringSection = document.querySelector(".offering-section");
        if (offeringSection) {
            // 既存の古い独立ヘッダーがあれば削除
            const oldHeader = offeringSection.querySelector(".section-title-offering");
            if (oldHeader) oldHeader.remove();

            // 🚀 保留ポップオーバー展開時は手札トレイ全体を最前面化 (z-index: 2500)
            offeringSection.classList.toggle("has-popover-open", !!this.isReservePopoverOpen);
            offeringSection.classList.toggle("is-minimal", !!this.isMinimalMode);
        }

        const cardRowEl = document.getElementById("cardRow");
        if (!cardRowEl || !this.state.handOffering) return;
        cardRowEl.innerHTML = "";
        cardRowEl.classList.toggle("is-minimal", !!this.isMinimalMode);

        const canMulligan = !this.state.hasPickedThisTurn && !this.state.hasMulliganedThisTurn && this.state.ember >= 1;
        const reserveCostText = I18n ? (I18n.t("RESERVE_HEADER_COST") || "ターン終了時 🔥-1") : "ターン終了時 🔥-1";
        const reserveCostTooltip = I18n ? (I18n.t("RESERVE_HEADER_COST_TOOLTIP") || "⚠️ 保留枠にカードをキープしたままターンを終了すると、維持費として 🔥-1 を消費します") : "⚠️ 保留枠にカードをキープしたままターンを終了すると、維持費として 🔥-1 を消費します";
        const mulliganTooltip = I18n ? (I18n.t("UI_MULLIGAN_HELP_TOOLTIP") || "🔥 残り火を 1 消費して手札 3 枚を破棄し、新たに 3 枚引き直します (1ターン1回のみ)") : "🔥 残り火を 1 消費して手札 3 枚を破棄し、新たに 3 枚引き直します (1ターン1回のみ)";
        const mulliganTitle = I18n ? (I18n.t("UI_MULLIGAN_BTN_LABEL") || "🔄 マリガン") : "🔄 マリガン";
        const mulliganBtnLabel = I18n ? (I18n.t("UI_MULLIGAN_BTN_LABEL") || "🔄 マリガン") : "🔄 マリガン";
        const minimalToggleTitle = I18n ? (I18n.t("TOOLTIP_MINIMAL_TOGGLE_TITLE") || "📐 縮小表示切替") : "📐 縮小表示切替";
        const minimalToggleDesc = I18n ? (I18n.t("TOOLTIP_MINIMAL_TOGGLE_DESC") || "手札の表示サイズ（標準 ⇄ 縮小）を切り替えます") : "手札の表示サイズ（標準 ⇄ 縮小）を切り替えます";

        // 🃏 ミニマルモード時 (完全1段 3ブロック・センタリング構造)
        if (this.isMinimalMode) {
            // 1. 左端: 正方形ボタングループ (46×46px 2段)
            const btnGroup = document.createElement("div");
            btnGroup.className = "minimal-btn-group";
            btnGroup.innerHTML = `
                <button class="btn-minimal-toggle is-active" id="btnMinimalToggle" onclick="window.toggleHandMinimalMode()" data-tooltip-title="${minimalToggleTitle}" data-tooltip="${minimalToggleDesc}">
                    <span>⤢</span>
                </button>
                <button class="btn-minimal-mulligan" id="btnMulligan" data-tooltip-title="${mulliganTitle}" data-tooltip="${mulliganTooltip}" ${canMulligan ? "" : "disabled style='opacity:0.45; cursor:not-allowed; filter:grayscale(0.8);'"}>
                    <span>🔄</span>
                </button>
            `;
            const btnMulligan = btnGroup.querySelector("#btnMulligan");
            if (btnMulligan && canMulligan) {
                btnMulligan.onclick = () => this.handleMulliganClick(btnMulligan);
            }
            cardRowEl.appendChild(btnGroup);

            // 2. 第1セパレーター (ボタンと手札を区切る縦線)
            const separator1 = document.createElement("div");
            separator1.className = "offering-tray-separator";
            cardRowEl.appendChild(separator1);

            // 3. 中央: 手札カード 3枚 (各 80×120px)
            const handContainer = this.handCardsComponent ? this.handCardsComponent.render(I18n) : document.createElement("div");
            cardRowEl.appendChild(handContainer);

            // 4. 第2セパレーター (手札と保留を区切る縦線)
            const separator2 = document.createElement("div");
            separator2.className = "offering-tray-separator";
            cardRowEl.appendChild(separator2);

            // 5. 右端: 保留スロット (80×120px / 手札と完全同一サイズ)
            const reserveContainer = this.reserveSlotComponent ? this.reserveSlotComponent.render(I18n) : document.createElement("div");
            cardRowEl.appendChild(reserveContainer);
            return;
        }

        // 🃏 標準モード時 (260x390px 左右2グループ完全規格レイアウト)
        // 🃏 1. 左側: 手札グループ (ヘッダー ＋ 手札3枚)
        const handGroup = document.createElement("div");
        handGroup.className = "offering-hand-group";

        const handHeader = document.createElement("div");
        handHeader.className = "offering-header-hand-col";
        handHeader.style.display = "flex";
        handHeader.style.alignItems = "center";
        handHeader.style.justifyContent = "flex-start";
        handHeader.style.gap = "8px";

        handHeader.innerHTML = `
            <button class="btn-minimal-toggle" id="btnMinimalToggle" onclick="window.toggleHandMinimalMode()" data-tooltip-title="${minimalToggleTitle}" data-tooltip="${minimalToggleDesc}">
                <span>⤢</span>
            </button>
            <button class="btn-mulligan-compact" id="btnMulligan" data-tooltip-title="${mulliganTitle}" data-tooltip="${mulliganTooltip}" ${canMulligan ? "" : "disabled style='opacity:0.45; cursor:not-allowed; filter:grayscale(0.8);'"}>
                <span>${mulliganBtnLabel}</span> <span class="btn-mulligan-ember-cost">🔥-1</span>
            </button>
        `;
        const btnMulligan = handHeader.querySelector("#btnMulligan");
        if (btnMulligan && canMulligan) {
            btnMulligan.onclick = () => this.handleMulliganClick(btnMulligan);
        }
        handGroup.appendChild(handHeader);

        const handContainer = this.handCardsComponent ? this.handCardsComponent.render(I18n) : document.createElement("div");
        handGroup.appendChild(handContainer);
        cardRowEl.appendChild(handGroup);

        // ⚡ 2. 中央: 縦セパレーター (上から下まで垂直貫通)
        const separator = document.createElement("div");
        separator.className = "offering-reserve-separator";
        cardRowEl.appendChild(separator);

        // 📦 3. 右側: 保留グループ (ヘッダー ＋ 保留スロット)
        const reserveGroup = document.createElement("div");
        reserveGroup.className = "offering-reserve-group";

        const reserveHeader = document.createElement("div");
        reserveHeader.className = "offering-header-reserve-col";
        reserveHeader.innerHTML = `
            <span class="reserve-header-cost-badge" data-tooltip="RESERVE_HEADER_COST_TOOLTIP">
                ${reserveCostText}
            </span>
        `;
        reserveGroup.appendChild(reserveHeader);

        const reserveContainer = this.reserveSlotComponent ? this.reserveSlotComponent.render(I18n) : document.createElement("div");
        reserveGroup.appendChild(reserveContainer);
        cardRowEl.appendChild(reserveGroup);
    }

    selectReserveCard(reserveIdx = 0) {
        if (!this.state || this.state.hasPickedThisTurn) return;
        if (!this.state.reserveSlots || !this.state.reserveSlots[reserveIdx]) return;

        const resCard = this.state.reserveSlots[reserveIdx];
        const tObj = resCard.terrain || resCard;
        const category = resCard.category || tObj.category || "LAND";

        // 🔄 選択中の保留カードを再度クリックした場合: 常に選択解除
        if (this.selectedReserveIdx === reserveIdx) {
            this.selectedCard = null;
            this.selectedCardIdx = -1;
            this.selectedReserveIdx = -1;
            if (focusLayerManager) focusLayerManager.onCardDeselect();
            this.clearCellPreviews();
            this.render();
            this.highlightPlaceableCells();
            return;
        }

        // ⚡ コマンドカードの場合: 発動確認ダイアログを開く
        if (category !== "LAND") {
            this.triggerCommandCardPlay(resCard, -1, reserveIdx);
            return;
        }

        // 🌱 土地カードの場合: 選択状態にする (盤面ハイライト)
        this.selectedCard = resCard;
        this.selectedCardIdx = -1;
        this.selectedReserveIdx = reserveIdx;
        if (focusLayerManager) focusLayerManager.onCardSelect();
        this.render();
        this.highlightPlaceableCells();
    }

    rotateReserveCard(e, reserveIdx = 0) {
        if (!this.state || this.state.hasPickedThisTurn) return;
        const card = this.state.reserveSlots[reserveIdx];
        if (!card) return;

        const currentShape = card.currentShape || (card.terrain ? card.terrain.shape : [[1]]);
        const rotated = rotateShapeMatrix(currentShape);
        card.currentShape = rotated;
        this.render();
        if (this.selectedReserveIdx === reserveIdx) {
            this.highlightPlaceableCells();
        }
    }

    renderBuffPanel() {
        const buffComp = (typeof BuffPanelComponent !== "undefined" && BuffPanelComponent) ? BuffPanelComponent : (typeof window !== "undefined" ? window.BuffPanelComponent : null);
        if (!buffComp || typeof buffComp.update !== "function") return;

        const buffs = (this.state && typeof this.state.getAllBuffs === "function") ? this.state.getAllBuffs() : [];
        buffComp.update(buffs);
    }

    updateMulliganButton() {
        const btnMulligan = document.getElementById("btnMulligan");
        if (btnMulligan && this.state) {
            const isMulliganBlocked = this.state.hasPickedThisTurn || this.state.hasMulliganedThisTurn || this.state.ember < 1;
            btnMulligan.disabled = isMulliganBlocked;
            btnMulligan.style.opacity = isMulliganBlocked ? "0.45" : "1.0";
            btnMulligan.style.cursor = isMulliganBlocked ? "not-allowed" : "pointer";
        }
    }

    triggerCommandCardPlay(card, idx = -1, reserveIdx = -1) {
        if (!this.state || this.state.hasPickedThisTurn) return;
        const tObj = card.terrain || card;
        const I18n = (typeof globalThis !== 'undefined' && globalThis.I18n) ? globalThis.I18n : (typeof window !== 'undefined' ? window.I18n : { t: k => k });
        const cName = tObj.nameKey ? I18n.t(tObj.nameKey) : (tObj.id || "Card");
        const cDesc = tObj.descriptionKey ? I18n.t(tObj.descriptionKey) : "";

        let costBadgeText = "";
        if (tObj.cost) {
            const c = tObj.cost;
            const parts = [];
            if (c.food) parts.push(`🌾-${c.food}`);
            if (c.wood) parts.push(`🧱-${c.wood}`);
            if (c.mystic) parts.push(`✨-${c.mystic}`);
            if (c.ember) parts.push(`🔥-${c.ember}`);
            costBadgeText = parts.join(" ");
        }

        if (typeof window !== "undefined" && window.ModalSystem) {
            const I18n = (typeof globalThis !== 'undefined' && globalThis.I18n) ? globalThis.I18n : (typeof window !== 'undefined' ? window.I18n : { t: k => k });
            const titleStr = I18n ? I18n.t("UI_CMD_CONFIRM_TITLE", { name: cName }) : `📜 ${cName}`;
            const confirmStr = I18n ? I18n.t("UI_ACTIVATE_CMD") : "⚡ 発動する";
            const cancelStr = I18n ? I18n.t("UI_CANCEL") : "✖ キャンセル";

            window.ModalSystem.showConfirmDialog({
                title: titleStr,
                descText: cDesc,
                costText: costBadgeText,
                confirmLabel: confirmStr,
                cancelLabel: cancelStr,
                onConfirm: () => {
                    this.playCommandCard(card, idx);
                    if (reserveIdx !== -1 && this.state.reserveSlots) {
                        this.state.reserveSlots[reserveIdx] = null;
                    }
                    this.selectedCard = null;
                    this.selectedCardIdx = -1;
                    this.selectedReserveIdx = -1;
                    if (focusLayerManager) focusLayerManager.onCardDeselect();
                    this.render();
                },
                onCancel: () => {
                    this.selectedCard = null;
                    this.selectedCardIdx = -1;
                    this.selectedReserveIdx = -1;
                    if (focusLayerManager) focusLayerManager.onCardDeselect();
                    this.render();
                    this.highlightPlaceableCells();
                }
            });
        }
    }

    selectCard(idx) {
        if (!this.state || this.state.hasPickedThisTurn) return;
        const card = this.state.handOffering[idx];
        if (!card || card.isBlank) return;

        const tObj = card.terrain || card;
        const category = card.category || tObj.category || "LAND";

        // 🔄 選択中のカードを再度クリックした場合:
        // コマンドカードなら発動確認ダイアログを開く、土地カードなら選択解除
        if (this.selectedCardIdx === idx) {
            if (category !== "LAND") {
                this.triggerCommandCardPlay(card, idx, -1);
                return;
            }
            this.selectedCard = null;
            this.selectedCardIdx = -1;
            this.selectedReserveIdx = -1;
            if (focusLayerManager) focusLayerManager.onCardDeselect();
            this.render();
            this.highlightPlaceableCells();
            return;
        }

        // 1回目のクリック: 純粋な選択状態にする (保留可能にする)
        this.selectedCard = card;
        this.selectedCardIdx = idx;
        this.selectedReserveIdx = -1;
        if (focusLayerManager) focusLayerManager.onCardSelect();
        this.render();
        this.highlightPlaceableCells();
    }

    rotateSelectedCard(e, idx) {
        if (e && typeof e.stopPropagation === "function") e.stopPropagation();
        if (e && typeof e.preventDefault === "function") e.preventDefault();
        if (!this.state || !this.state.handOffering) return;
        const card = this.state.handOffering[idx];
        if (!card || card.isBlank) return;

        const currentShape = card.currentShape || (card.terrain ? card.terrain.shape : (card.shape || [[1]]));
        const rows = currentShape.length;
        const cols = currentShape[0].length;
        const newShape = [];
        for (let c = 0; c < cols; c++) {
            const newRow = [];
            for (let r = rows - 1; r >= 0; r--) {
                newRow.push(currentShape[r][c]);
            }
            newShape.push(newRow);
        }
        card.currentShape = newShape;
        if (this.selectedCard && (this.selectedCardIdx === idx || this.selectedCard === card)) {
            this.selectedCard.currentShape = newShape;
        }

        this.render();
        if (this.selectedCardIdx === idx || (this.selectedCard && this.selectedCard === card)) {
            this.highlightPlaceableCells();
        } else if (this.selectedCardIdx === -1 && this.selectedReserveIdx === -1) {
            // 未選択時の手札ホバー中回転 ➔ 盤面候補ハイライトとヒントポップオーバーを即時更新
            if (typeof window !== "undefined" && window.BlockPlacementSystem) {
                window.BlockPlacementSystem.highlightPlaceableCandidates(card, this.state);
            }
            if (typeof document !== "undefined") {
                const cardElements = document.querySelectorAll(".cards-hand-container .card-frame-tcg");
                if (cardElements && cardElements[idx]) {
                    this.showCardActionHintPopover(cardElements[idx], card);
                }
            }
        }
    }

    onCellClick(r, c) {
        if (!this.state) return;
        const I18n = (typeof globalThis !== 'undefined' && globalThis.I18n) ? globalThis.I18n : (typeof window !== 'undefined' ? window.I18n : { t: k => k });
        const undoSys = this.undoSys || (typeof window !== "undefined" ? window.undoSys : null);

        // ↩️ 当ターン配置済みマスをクリックした場合は配置取り消し（Undo）
        if (undoSys && undoSys.isCellPlacedThisTurn(r, c)) {
            this.hideTileTooltip();
            undoSys.undo();
            this.selectedCard = null;
            this.selectedCardIdx = -1;
            this.selectedReserveIdx = -1;
            if (focusLayerManager) focusLayerManager.onCardDeselect();
            this.render();
            this.highlightPlaceableCells();
            return;
        }

        if (!this.selectedCard || this.state.hasPickedThisTurn) return;
        this.hideTileTooltip();

        const tObjCheck = this.selectedCard.terrain || this.selectedCard;
        const catCheck = this.selectedCard.category || tObjCheck.category || "LAND";
        if (catCheck !== "LAND") {
            this.triggerCommandCardPlay(this.selectedCard, this.selectedCardIdx, this.selectedReserveIdx);
            return;
        }

        const shape = this.selectedCard.currentShape || this.selectedCard.shape || [[1]];
        const terrain = this.selectedCard.terrain || this.selectedCard;

        if (undoSys) {
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
            undoSys.captureSnapshot(placedCoords);
        }

        const currentIdx = this.selectedCardIdx !== -1 ? this.selectedCardIdx : this.state.handOffering.indexOf(this.selectedCard);
        const res = (typeof this.state.placeShape === "function") ? this.state.placeShape(r, c, shape, terrain, currentIdx) : { can: false };

        if (res === true || (res && (res.can || res.success))) {
            if (this.selectedReserveIdx !== -1 && this.state.reserveSlots) {
                this.state.reserveSlots[this.selectedReserveIdx] = null;
            }
            this.selectedCard = null;
            this.selectedCardIdx = -1;
            this.selectedReserveIdx = -1;
            if (focusLayerManager) focusLayerManager.onCardDeselect();
            if (typeof this.state.checkMergePatterns === "function") {
                this.state.checkMergePatterns();
            }

            this.render();
            this.processToastQueue();
        } else {
            if (undoSys) undoSys.clearSnapshot();
            if (typeof alert === "function") alert(I18n.t("ALERT_CANNOT_PLACE"));
        }
    }

    /**
     * 🌟 連結即時ボーナス・ソケット開花トーストキューの画面フロートポップアップ消費
     */
    processToastQueue() {
        if (!this.state || !this.state.toastQueue || this.state.toastQueue.length === 0) return;
        if (typeof document === "undefined") return;

        const toasts = [...this.state.toastQueue];
        this.state.toastQueue = [];

        toasts.forEach((toast, idx) => {
            const { r, c, text } = toast;

            setTimeout(() => {
                // 当該セルの DOM 座標を取得
                let targetX = (typeof window !== "undefined" ? window.innerWidth / 2 : 200);
                let targetY = (typeof window !== "undefined" ? window.innerHeight / 2 : 200);

                const cellEl = document.querySelector(`.cell[data-r="${r}"][data-c="${c}"]`) || document.querySelector(`#cell_${r}_${c}`);
                if (cellEl && typeof cellEl.getBoundingClientRect === "function") {
                    const rect = cellEl.getBoundingClientRect();
                    targetX = rect.left + rect.width / 2;
                    targetY = rect.top + rect.height / 2;
                }

                // 垂直オフセット（重なり防止スタック: 1個ごとに -32px 上方へシフト）
                const offsetY = idx * 32;

                // フロートポップアップ要素の生成
                const popup = document.createElement("div");
                popup.className = "float-toast-bonus";
                popup.innerHTML = text;
                popup.style.left = `${targetX}px`;
                popup.style.top = `${targetY - offsetY}px`;
                document.body.appendChild(popup);

                // アニメーション完了後に DOM から自動削除
                setTimeout(() => {
                    if (popup.parentNode) popup.parentNode.removeChild(popup);
                }, 1700);
            }, idx * 160);
        });
    }

    clearCellPreviews() {
        this.hideTileTooltip();
        const undoSys = this.undoSys || (typeof window !== "undefined" ? window.undoSys : null);
        if (undoSys) undoSys.hideHoverTooltip();

        if (typeof window !== "undefined" && window.BlockPlacementSystem) {
            if (this.selectedCard) {
                // 🌟 カード選択中（手札の処理が残っている時）は配置可能ハイライトを絶対消去せず、ホバー枠のみ消去
                window.BlockPlacementSystem.clearHoverPreviews();
            } else {
                // カード非選択時のみ全ハイライトを完全消去
                window.BlockPlacementSystem.clearAllPreviews();
            }
        } else if (typeof document !== "undefined") {
            const cells = document.querySelectorAll(".cell");
            cells.forEach(c => c.classList.remove("preview-valid", "preview-invalid", "merge-hover-highlight", "hq-vicinity-hover-glow"));
            if (!this.selectedCard) {
                cells.forEach(c => c.classList.remove("placeable-candidate"));
            }
        }
    }

    hideTileTooltip() {
        if (typeof document === "undefined") return;
        const tt = document.getElementById("tileTooltip");
        if (tt) {
            tt.style.display = "none";
        }
    }

    highlightPlaceableCells() {
        if (!this.selectedCard) {
            if (typeof window !== "undefined" && window.BlockPlacementSystem) {
                window.BlockPlacementSystem.clearAllPreviews();
            }
            return;
        }
        const tObj = this.selectedCard.terrain || this.selectedCard;
        const category = this.selectedCard.category || tObj.category || "LAND";
        if (category !== "LAND") {
            // 🛡️ コマンドカード選択時は土地配置ハイライトを完全停止
            if (typeof window !== "undefined" && window.BlockPlacementSystem) {
                window.BlockPlacementSystem.clearAllPreviews();
            }
            return;
        }
        if (typeof window !== "undefined" && window.BlockPlacementSystem) {
            window.BlockPlacementSystem.highlightPlaceableCandidates(this.selectedCard, this.state);
        }
    }

    onCellMouseEnter(e, r, c) {
        if (!this.state || typeof document === "undefined") return;
        const cellData = this.state.grid[r][c];
        const groupId = cellData ? (cellData.mergeGroupId || cellData.placementGroupId) : null;
        if (groupId) {
            const groupCells = document.querySelectorAll(`.cell[data-group-id="${groupId}"]`);
            groupCells.forEach(el => el.classList.add("merge-hover-highlight"));
        }
        if (typeof window !== "undefined" && window.BlockPlacementSystem) {
            window.BlockPlacementSystem.updateHoverPreview(e, r, c, this.selectedCard, this.state);
        }
    }

    onCellMouseMove(e, r, c) {
        if (!this.state) return;
        const undoSys = this.undoSys || (typeof window !== "undefined" ? window.undoSys : null);
        if (undoSys) undoSys.hideHoverTooltip();

        const cellData = this.state.grid[r][c];
        this.showTileTooltip(e, r, c, cellData, r, c);
    }

    showTileTooltip(e, r, c, cell) {
        if (typeof document === "undefined") return;
        let tt = document.getElementById("tileTooltip");
        if (!tt) return;
        if (!cell) {
            tt.style.display = "none";
            return;
        }

        const I18n = (typeof globalThis !== 'undefined' && globalThis.I18n) ? globalThis.I18n : (typeof window !== 'undefined' && window.I18n ? window.I18n : { t: k => k });
        const undoSys = this.undoSys || (typeof window !== "undefined" ? window.undoSys : null);
        const isPlacedThisTurn = (undoSys && typeof undoSys.isCellPlacedThisTurn === "function") ? undoSys.isCellPlacedThisTurn(r, c) : false;

        const coordStr = `${String.fromCharCode(65 + c)}${r + 1}`;
        const isHQVic = (this.state && typeof this.state.isHQVicinity === "function") ? this.state.isHQVicinity(r, c) : false;

        // 🌊 湖 (Lake) / オアシス (Oasis) 周囲8マスの水脈判定
        let nearWaterType = null;
        if (this.state && this.state.grid) {
            const size = this.state.grid.length;
            for (let lr = 0; lr < size; lr++) {
                for (let lc = 0; lc < size; lc++) {
                    const lcCell = this.state.grid[lr][lc];
                    if (lcCell && lcCell.placed && lcCell.socketResource) {
                        const sid = lcCell.socketResource.id || lcCell.socketResource.nameKey || "";
                        if (sid === "SOCKET_LAKE" || sid === "SOCKET_OASIS") {
                            if (Math.abs(lr - r) <= 1 && Math.abs(lc - c) <= 1 && !(lr === r && lc === c)) {
                                nearWaterType = sid === "SOCKET_OASIS" ? "OASIS" : "LAKE";
                                break;
                            }
                        }
                    }
                }
                if (nearWaterType) break;
            }
        }

        let title = `[${coordStr}]`;
        let desc = isHQVic 
            ? (I18n ? I18n.t("UI_CELL_HQ_VICINITY_DESC") : "🏛️ 本営近郊エリア") 
            : (I18n ? I18n.t("UI_CELL_UNCLAIMED") : "未開拓の土地");

        if (nearWaterType && !cell.placed) {
            const waterTitle = I18n ? I18n.t(nearWaterType === "OASIS" ? "UI_OASIS_VICINITY_TITLE" : "UI_LAKE_VICINITY_TITLE") : "🌊 水脈エリア";
            title = `[${coordStr}] ${waterTitle}`;
            const waterDesc = I18n ? I18n.t(nearWaterType === "OASIS" ? "UI_OASIS_VICINITY_UNPLACED_DESC" : "UI_LAKE_VICINITY_UNPLACED_DESC") : "";
            desc = `${desc}<div style="margin-top:8px;">${waterDesc}</div>`;
        }

        if (cell.isHQ) {
            title = I18n ? I18n.t("UI_CELL_HQ_TITLE", { coord: coordStr }) : `🏛️ HQ [${coordStr}]`;
            desc = I18n ? I18n.t("UI_CELL_HQ_DESC") : "🌾+10 🧱+10 🛡️10 ✨+1";
        } else if (cell.hasSocket && !cell.placed) {
            title = I18n ? I18n.t("UI_CELL_SOCKET_TITLE", { coord: coordStr }) : `★ [${coordStr}]`;
            desc = I18n ? I18n.t("UI_CELL_SOCKET_DESC") : "★ 資源ソケット";
        } else if (cell.placed && cell.terrain) {
            const t = cell.terrain;
            const tName = I18n.t(t.nameKey || t.id || "TERRAIN_PLAINS");
            const placedTag = isPlacedThisTurn ? ` <span style="font-size:12px; background:#e74c3c; color:#fff; padding:2px 6px; border-radius:4px; margin-left:6px; font-weight:bold;">${I18n ? I18n.t("UI_CELL_PLACED_TAG") : "当ターン配置"}</span>` : "";
            title = `🌱 ${tName} [${coordStr}]${placedTag}`;

            let tf = (t.food !== undefined) ? t.food : ((t.baseYieldsPerTile && t.baseYieldsPerTile.food) || (t.yields && t.yields.food) || 0);
            let tw = (t.material !== undefined) ? t.material : ((t.wood !== undefined) ? t.wood : ((t.baseYieldsPerTile && (t.baseYieldsPerTile.material || t.baseYieldsPerTile.wood)) || (t.yields && (t.yields.material || t.yields.wood)) || 0));
            let td = (t.defense !== undefined) ? t.defense : ((t.baseYieldsPerTile && t.baseYieldsPerTile.defense) || (t.yields && t.yields.defense) || 0);
            let tm = (t.mystic !== undefined) ? t.mystic : ((t.baseYieldsPerTile && t.baseYieldsPerTile.mystic) || (t.yields && t.yields.mystic) || 0);

            const bonusParts = [];
            let sourceWaterDesc = "";
            // ソケット資源
            if (cell.socketResource) {
                const s = cell.socketResource;
                const sName = I18n.t(s.nameKey || "SOCKET_RESOURCE");
                tf += s.bonusFood || 0;
                tw += (s.bonusMaterial !== undefined ? s.bonusMaterial : (s.bonusWood || 0));
                td += s.bonusDefense || 0;
                tm += s.bonusMystic || 0;
                const resIcon = (this.boardGrid && typeof this.boardGrid.getSocketResourceIcon === "function")
                    ? this.boardGrid.getSocketResourceIcon(s)
                    : (s.icon || "💎");
                bonusParts.push(`${resIcon} : ${sName}`);

                const sid = s.id || s.nameKey || "";
                if (sid === "SOCKET_LAKE" || sid === "SOCKET_OASIS") {
                    sourceWaterDesc = I18n ? I18n.t(sid === "SOCKET_OASIS" ? "UI_OASIS_SOURCE_DESC" : "UI_LAKE_SOURCE_DESC") : "";
                }
            }

            // 本営近郊ボーナス（産出している数値すべてに+1）
            if (this.state && typeof this.state.isHQVicinity === "function" && this.state.isHQVicinity(r, c)) {
                let hqBonusCount = 0;
                if (tf > 0) { tf += 1; hqBonusCount++; }
                if (tw > 0) { tw += 1; hqBonusCount++; }
                if (td > 0) { td += 1; hqBonusCount++; }
                if (tm > 0) { tm += 1; hqBonusCount++; }
                if (hqBonusCount > 0) {
                    bonusParts.push(I18n ? I18n.t("UI_CELL_BONUS_VICINITY") : "本営近郊(+1)");
                }
            }

            // 平地バフ
            const tid = t.terrainId || t.id || "";
            if (this.state && this.state.permanentPlainsFoodBonus && tid.includes("PLAINS")) {
                tf += this.state.permanentPlainsFoodBonus;
                bonusParts.push(I18n ? I18n.t("UI_CELL_BONUS_PLAINS", { val: this.state.permanentPlainsFoodBonus }) : `平地強化(+${this.state.permanentPlainsFoodBonus})`);
            }

            // 🌊 湖 (Lake) / オアシス (Oasis) 周囲8マスの灌漑バフ (+50% 食料産出ブースト)
            if (nearWaterType && tf > 0) {
                const baseFoodForWater = (t.food !== undefined) ? t.food : ((t.baseYieldsPerTile && t.baseYieldsPerTile.food) || (t.yields && t.yields.food) || 0);
                const waterBonus = Math.max(1, Math.floor(baseFoodForWater * 0.5));
                tf += waterBonus;
                const i18nKey = nearWaterType === "OASIS" ? "UI_CELL_BONUS_OASIS_IRRIGATION" : "UI_CELL_BONUS_LAKE_IRRIGATION";
                bonusParts.push(I18n ? I18n.t(i18nKey, { val: waterBonus }) : (nearWaterType === "OASIS" ? `オアシス灌漑(+${waterBonus})` : `湖灌漑(+${waterBonus})`));
            }

            const yieldParts = [];
            if (tf > 0) yieldParts.push(`🌾+${tf}`);
            if (tw > 0) yieldParts.push(`🧱+${tw}`);
            if (td > 0) yieldParts.push(`🛡️+${td}`);
            if (tm > 0) yieldParts.push(`✨+${tm}`);

            const yieldStr = yieldParts.length > 0 ? yieldParts.join(" ") : (I18n ? I18n.t("UI_CELL_YIELD_NONE") : "産出なし");
            const bonusStr = bonusParts.length > 0 ? ` <span style="color:#f1c40f;">(${bonusParts.join(", ")})</span>` : "";
            const perTurnLabel = I18n ? I18n.t("UI_CELL_PER_TURN_YIELD") : "毎ターン産出:";
            desc = `${perTurnLabel} <strong>${yieldStr}</strong>${bonusStr}`;
            if (sourceWaterDesc) {
                desc += sourceWaterDesc;
            }

            // ↩️ 当ターン配置マスの場合は配置取り消し（置き直し）ガイドを明示
            if (isPlacedThisTurn) {
                const undoHint = I18n ? I18n.t("UI_CELL_UNDO_HINT") : "このマスをクリックすると配置を取り消せます";
                desc += `
                    <div style="margin-top:10px; padding:8px 10px; background:rgba(231,76,60,0.22); border:1.5px solid #ff4757; border-radius:6px; font-size:13px; color:#ff6b81; font-weight:bold; display:flex; align-items:center; gap:6px; line-height:1.4;">
                        <span style="font-size:16px; color:#ff4757;">↩</span>
                        <span>${undoHint}</span>
                    </div>
                `;
            }
        }

        tt.innerHTML = `<div style="font-size:18px; font-weight:900; color:#1abc9c; margin-bottom:6px; letter-spacing:0.5px;">${title}</div><div style="font-size:15px; color:#e0e0e0; line-height:1.5;">${desc}</div>`;
        tt.style.left = `${e.pageX + 14}px`;
        tt.style.top = `${e.pageY + 14}px`;
        tt.style.display = "block";
    }

    mulligan() {
        if (!this.state) return;
        if (this.state.hasPickedThisTurn || this.state.hasMulliganedThisTurn || this.state.ember < 1) return;

        const I18n = (typeof globalThis !== 'undefined' && globalThis.I18n) ? globalThis.I18n : (typeof window !== 'undefined' ? window.I18n : { t: k => k });

        if (this.engine && typeof this.engine.mulligan === "function") {
            const res = this.engine.mulligan();
            if (res && res.success) {
                this.selectedCard = null;
                this.selectedCardIdx = -1;
                this.selectedReserveIdx = -1;
                this.render();
            }
            return;
        }

        this.state.ember -= 1;
        this.state.hasMulliganedThisTurn = true;
        if (this.drawSys) {
            this.drawSys.generateOfferingCards();
        }
        this.selectedCard = null;
        this.selectedCardIdx = -1;
        this.selectedReserveIdx = -1;
        if (typeof this.state.addLog === "function") {
            this.state.addLog(I18n.t("LOG_MULLIGAN_EXECUTED") || "🎲 マリガン実行: 🔥 -1 を消費して手札を再抽選しました。");
        }
        this.render();
    }

    nextTurn() {
        const settings = (typeof window !== "undefined" && window.gameSettings) ? window.gameSettings : null;
        const warningRequired = settings ? settings.get("turnEndWarning") : true;

        if (warningRequired && this.state && !this.state.hasPickedThisTurn) {
            const modalSys = (typeof window !== "undefined" && window.ModalSystem) ? window.ModalSystem : null;
            const I18n = (typeof globalThis !== 'undefined' && globalThis.I18n) ? globalThis.I18n : (typeof window !== 'undefined' ? window.I18n : { t: k => k });
            if (modalSys && typeof modalSys.showConfirmation === "function") {
                modalSys.showConfirmation({
                    title: I18n ? I18n.t("UI_CONFIRM_WARN_NO_LAND_TITLE") : "⚠️ 土地カードが未配置です",
                    message: I18n ? I18n.t("UI_CONFIRM_WARN_NO_LAND_MSG") : "今ターンはまだ土地カードを配置していません。このままターンを終了しますか？",
                    confirmText: I18n ? I18n.t("UI_TURN_END_BTN") : "ターン終了",
                    cancelText: I18n ? I18n.t("UI_CANCEL") : "戻る",
                    onConfirm: () => this.executeNextTurn()
                });
                return;
            }
        }
        this.executeNextTurn();
    }

    executeNextTurn() {
        if (this.engine && typeof this.engine.nextTurn === "function") {
            this.engine.nextTurn();
            this.selectedCard = null;
            this.selectedCardIdx = -1;
        this.selectedReserveIdx = -1;
            this.render();
            return;
        }
        if (!this.state || !this.drawSys) return;
        if (typeof window !== "undefined" && window.undoSys) window.undoSys.clearSnapshot();
        this.state.turn++;
        this.state.hasPickedThisTurn = false;
        this.state.hasReservedThisTurn = false;
        this.state.hasMulliganedThisTurn = false;
        this.drawSys.generateOfferingCards();
        this.selectedCard = null;
        this.selectedCardIdx = -1;
        this.selectedReserveIdx = -1;

        // 📜 初期ログと同一のダイレクトログ描画
        if (typeof window !== "undefined" && window.LogComponent) {
            const I18n = (typeof globalThis !== 'undefined' && globalThis.I18n) ? globalThis.I18n : (typeof window !== 'undefined' ? window.I18n : { t: k => k });
            const logMsg = I18n ? I18n.t("LOG_TURN_START", { turn: this.state.turn }) : `Turn ${this.state.turn} started.`;
            window.LogComponent.addLog(logMsg, this.state.turn);
        }

        this.render();
    }

    toggleReservePopover(idx = 0) {
        if (!this.state || this.state.hasPickedThisTurn) return;
        if (!this.state.reserveSlots || !this.state.reserveSlots[idx]) return;

        this.isReservePopoverOpen = !this.isReservePopoverOpen;
        this.render();
    }

    closeReservePopover() {
        this.isReservePopoverOpen = false;
        this.render();
    }

    playReserveCard(idx = 0) {
        this.isReservePopoverOpen = false;
        this.selectReserveCard(idx);
    }

    reserveCard(idx) {
        if (!this.state) return;
        if (typeof this.state.moveToReserve === "function" && this.state.moveToReserve(idx)) {
            this.selectedCard = null;
            this.selectedCardIdx = -1;
            this.selectedReserveIdx = -1;
            this.isReservePopoverOpen = false;
            if (focusLayerManager) focusLayerManager.onCardDeselect();
            this.clearCellPreviews();
            this.render();
            this.highlightPlaceableCells();
        }
    }

    returnReserveCard(idx = 0, targetHandIdx = -1) {
        if (!this.state) return;
        if (typeof this.state.returnFromReserve === "function" && this.state.returnFromReserve(idx, targetHandIdx)) {
            this.selectedCard = null;
            this.selectedCardIdx = -1;
            this.selectedReserveIdx = -1;
            this.isReservePopoverOpen = false;
            if (focusLayerManager) focusLayerManager.onCardDeselect();
            this.clearCellPreviews();
            this.render();
            this.highlightPlaceableCells();
        }
    }

    discardReserveCard(idx = 0) {
        if (!this.state) return;
        if (typeof this.state.discardFromReserve === "function" && this.state.discardFromReserve(idx)) {
            this.selectedCard = null;
            this.selectedCardIdx = -1;
            this.selectedReserveIdx = -1;
            this.isReservePopoverOpen = false;
            if (focusLayerManager) focusLayerManager.onCardDeselect();
            this.clearCellPreviews();
            this.render();
            this.highlightPlaceableCells();
        }
    }

    playCommandCard(card, targetIdx) {
        if (!this.state || this.state.hasPickedThisTurn) return;
        const deckMgr = (this.engine && this.engine.deckManager) ? this.engine.deckManager : this.state.deckManager;
        const cardObj = card.terrain || card;
        let cardIdx = (typeof targetIdx === "number" && targetIdx >= 0) ? targetIdx : (this.state.handOffering ? this.state.handOffering.indexOf(card) : -1);

        if (deckMgr && typeof deckMgr.playCommandCard === "function") {
            deckMgr.playCommandCard(cardObj, null, cardIdx, this.selectedReserveIdx);
        } else if (typeof this.state.playCommandCard === "function") {
            this.state.playCommandCard(cardObj, null, cardIdx, this.selectedReserveIdx);
        }

        if (cardIdx !== -1 && this.state.handOffering) {
            this.state.handOffering[cardIdx] = { isBlank: true, originalCard: card, id: `blank_${cardIdx}_${Date.now()}` };
            this.state.hasPickedThisTurn = true;
        }
        if (this.selectedReserveIdx !== -1 && this.state.reserveSlots) {
            this.state.reserveSlots[this.selectedReserveIdx] = null;
            this.state.hasPickedThisTurn = true;
        }
        this.render();
    }

    toggleDirectiveModal() {
        if (typeof window !== "undefined" && typeof window.toggleDirectiveModal === "function") {
            // 既存モーダル連携
        }
    }

    closeDirectiveModal() {
        if (typeof document !== "undefined") {
            const modal = document.getElementById("directiveModal");
            if (modal) modal.style.display = "none";
        }
    }

    selectDirective(id) {
        const dirSys = (this.engine && this.engine.directiveSystem) ? this.engine.directiveSystem : this.state.directiveSystem;
        if (dirSys) {
            dirSys.setDirective(id);
            this.closeDirectiveModal();
            this.render();
        }
    }

    /**
     * 🎨 盤面テキストスタイル切替 (盤面左上角のボタンクリックでトリガー)
     */
    toggleTileTextStyle(e) {
        if (e && typeof e.stopPropagation === "function") e.stopPropagation();
        const presets = [
            { id: "DEFAULT", icon: "🏷️", labelKey: "UI_TILE_STYLE_LABEL_DEFAULT" },
            { id: "PILL_BADGE", icon: "💊", labelKey: "UI_TILE_STYLE_LABEL_PILL" },
            { id: "ICON_SYMMETRIC", icon: "🌾", labelKey: "UI_TILE_STYLE_LABEL_SYMMETRIC" },
            { id: "MODERN_BOARD", icon: "✨", labelKey: "UI_TILE_STYLE_LABEL_MODERN" },
            { id: "SYMBOLIC_BOARD", icon: "🎨", labelKey: "UI_TILE_STYLE_LABEL_SYMBOLIC" }
        ];

        let currentStyle = (typeof UI_FEATURE_FLAGS !== "undefined" && UI_FEATURE_FLAGS.tileTextStyle) ? UI_FEATURE_FLAGS.tileTextStyle : "DEFAULT";
        let currentIdx = presets.findIndex(p => p.id === currentStyle);
        if (currentIdx < 0) currentIdx = 0;
        const nextIdx = (currentIdx + 1) % presets.length;
        const nextPreset = presets[nextIdx];

        if (typeof UI_FEATURE_FLAGS !== "undefined") {
            UI_FEATURE_FLAGS.tileTextStyle = nextPreset.id;
        }
        const boardEl = document.getElementById("gridBoard");
        if (boardEl) {
            boardEl.setAttribute("data-tile-style", nextPreset.id);
        }
        if (typeof document !== "undefined" && document.body) {
            document.body.setAttribute("data-tile-style", nextPreset.id);
        }

        const btn = document.getElementById("cornerTileStyleToggleBtn");
        if (btn) {
            btn.innerText = nextPreset.icon;
            const I18n = (typeof globalThis !== 'undefined' && globalThis.I18n) ? globalThis.I18n : (typeof window !== 'undefined' ? window.I18n : null);
            const label = I18n ? I18n.t(nextPreset.labelKey) : nextPreset.id;
            btn.title = label;
        }
    }

    toggleBoardLabelMode(e) {
        this.toggleTileTextStyle(e);
    }

    showDataPanelTooltip(e) {
        if (typeof document === "undefined") return;
        let tt = document.getElementById("dataPanelTooltipHuge");
        if (!tt) {
            tt = document.createElement("div");
            tt.id = "dataPanelTooltipHuge";
            tt.className = "large-directive-tooltip";
            document.body.appendChild(tt);
        }
        const state = this.state;
        if (!state) return;

        const bd = (typeof state.getResourceBreakdown === "function") ? state.getResourceBreakdown() : null;
        const grossFood = bd ? (bd.food.gross !== undefined ? bd.food.gross : bd.food.total) : 10;
        const foodCost = bd ? (bd.food.foodCost !== undefined ? bd.food.foodCost : 20) : 20;
        const netFood = bd ? (bd.food.net !== undefined ? bd.food.net : (grossFood - foodCost)) : -10;
        const netFoodSign = netFood > 0 ? `+${netFood}` : `${netFood}`;
        const netFoodColor = netFood < 0 ? "#ff6b6b" : "#2ecc71";

        const foodTiles = bd ? bd.food.tiles : 0;
        const foodSockets = bd ? bd.food.sockets : 0;
        const foodVicinity = bd ? bd.food.vicinity : 0;
        const emberPct = bd ? (bd.food.emberPct || 0) : 20;

        const woodTotal = bd ? bd.wood.total : 12;
        const woodTiles = bd ? bd.wood.tiles : 0;
        const woodSockets = bd ? bd.wood.sockets : 0;
        const woodVicinity = bd ? bd.wood.vicinity : 0;

        const defTotal = bd ? bd.defense.total : 10;
        const defTiles = bd ? bd.defense.tiles : 0;
        const defSockets = bd ? bd.defense.sockets : 0;

        const mysticTotal = bd ? bd.mystic.total : 3;
        const mysticTiles = bd ? bd.mystic.tiles : 0;
        const mysticSockets = bd ? bd.mystic.sockets : 0;
        const emberMystic = bd ? (bd.mystic.emberMystic || 0) : 2;

        const I18n = (typeof globalThis !== 'undefined' && globalThis.I18n) ? globalThis.I18n : (typeof window !== 'undefined' ? window.I18n : { t: k => k });
        const emberStr = emberPct > 0 ? (I18n ? I18n.t("UI_EMBER_BLESSING_TAG", { pct: emberPct }) : ` | 🔥残り火加護: +${emberPct}%`) : "";
        const netTag = I18n ? I18n.t("UI_NET_BALANCE_TAG") : "(純収支)";
        const defTrialTag = I18n ? I18n.t("UI_DEFENSE_TRIAL_TAG") : "(試練対策)";
        const grossLabel = I18n ? I18n.t("UI_GROSS_YIELD_LABEL") : "総産出:";
        const hqBaseLabel = I18n ? I18n.t("UI_HQ_BASE_LABEL") : "本営基礎:";
        const tilesLabel = I18n ? I18n.t("UI_TILES_LABEL") : "土地配置:";
        const socketsLabel = I18n ? I18n.t("UI_SOCKETS_LABEL") : "ソケット:";
        const vicinityLabel = I18n ? I18n.t("UI_VICINITY_LABEL") : "本営近郊:";
        const emberAutoLabel = I18n ? I18n.t("UI_EMBER_AUTO_GRANT") : "残り火自動付与:";
        const foodMaintLabel = I18n ? I18n.t("UI_EMBER_ROW_FOOD_MAINT") : "🌾 食料維持費:";
        const modalTitle = I18n ? I18n.t("UI_BREAKDOWN_MODAL_TITLE") : "📊 毎ターンの産出詳細内訳";

        tt.innerHTML = `
            <div style="font-size:17px; font-weight:900; color:#1abc9c; margin-bottom:10px; border-bottom:2px solid #2a2e3d; padding-bottom:6px; display:flex; align-items:center; gap:8px;">
                <span>📊</span> ${modalTitle}
            </div>

            <!-- 🌾 食料 -->
            <div style="background:rgba(24, 34, 50, 0.75); border:1px solid #2c3e50; border-radius:8px; padding:10px 12px; margin-bottom:8px;">
                <div style="font-size:14px; font-weight:900; color:#ffffff; display:flex; justify-content:space-between; margin-bottom:4px;">
                    <span>${I18n ? I18n.t("UI_FOOD") : "🌾 食料"} (${state.food})</span>
                    <span style="color:${netFoodColor}; font-size:16px;">${netFoodSign} /T ${netTag}</span>
                </div>
                <div style="font-size:12px; color:#a4b0be; line-height:1.4;">
                    ${grossLabel} +${grossFood} (${hqBaseLabel} +10 | ${tilesLabel} +${foodTiles} | ★${socketsLabel} +${foodSockets} | ${vicinityLabel} +${foodVicinity}${emberStr})<br>
                    <span style="color:#ff9f43; font-weight:bold;">🔥 ${foodMaintLabel} -${foodCost} / T</span>
                </div>
            </div>

            <!-- 🧱 資材 -->
            <div style="background:rgba(24, 34, 50, 0.75); border:1px solid #2c3e50; border-radius:8px; padding:10px 12px; margin-bottom:8px;">
                <div style="font-size:14px; font-weight:900; color:#ffffff; display:flex; justify-content:space-between; margin-bottom:4px;">
                    <span>${I18n ? I18n.t("UI_WOOD") : "🧱 資材"} (${state.wood})</span>
                    <span style="color:#2ecc71; font-size:16px;">+${woodTotal} /T</span>
                </div>
                <div style="font-size:12px; color:#a4b0be; line-height:1.4;">
                    ${hqBaseLabel} +10 | ${tilesLabel} +${woodTiles} | ${socketsLabel} +${woodSockets} | ${vicinityLabel} +${woodVicinity}${emberStr}
                </div>
            </div>

            <!-- 🛡️ 防衛 -->
            <div style="background:rgba(24, 34, 50, 0.75); border:1px solid #2c3e50; border-radius:8px; padding:10px 12px; margin-bottom:8px;">
                <div style="font-size:14px; font-weight:900; color:#ffffff; display:flex; justify-content:space-between; margin-bottom:4px;">
                    <span>${I18n ? I18n.t("UI_DEFENSE") : "🛡️ 防衛力"} ${defTrialTag}</span>
                    <span style="color:#ffffff; font-size:16px;">${defTotal}</span>
                </div>
                <div style="font-size:12px; color:#a4b0be; line-height:1.4;">
                    ${hqBaseLabel} 10 | ${tilesLabel} +${defTiles} | ${socketsLabel} +${defSockets}
                </div>
            </div>

            <!-- ✨ 神秘 -->
            <div style="background:rgba(24, 34, 50, 0.75); border:1px solid #2c3e50; border-radius:8px; padding:10px 12px;">
                <div style="font-size:14px; font-weight:900; color:#ffffff; display:flex; justify-content:space-between; margin-bottom:4px;">
                    <span>${I18n ? I18n.t("UI_MYSTIC") : "✨ 神秘"} (${state.mystic})</span>
                    <span style="color:#2ecc71; font-size:16px;">+${mysticTotal} /T</span>
                </div>
                <div style="font-size:12px; color:#a4b0be; line-height:1.4;">
                    ${hqBaseLabel} +1 | ${tilesLabel} +${mysticTiles} | ${socketsLabel} +${mysticSockets} | ${emberAutoLabel} +${emberMystic}${emberStr}
                </div>
            </div>
        `;

        const targetEl = (e && e.currentTarget) ? e.currentTarget : (document.getElementById("headerDataPanel") || document.querySelector(".header-resource-data-panel"));
        let rect = targetEl ? targetEl.getBoundingClientRect() : null;
        if (!rect || (rect.top === 0 && rect.bottom === 0)) {
            rect = { top: 10, bottom: 74, right: (typeof window !== "undefined" ? window.innerWidth - 16 : 1900), left: 100 };
        }
        const winWidth = (typeof window !== "undefined") ? window.innerWidth : 1920;

        tt.style.position = "fixed";
        tt.style.top = `${Math.max(10, rect.bottom + 8)}px`;
        tt.style.left = "auto";
        tt.style.right = `${Math.max(16, winWidth - (rect.right || winWidth - 16))}px`;
        tt.style.display = "block";
        tt.style.zIndex = "100000";
    }

    hideDataPanelTooltip() {
        if (typeof document === "undefined") return;
        const tt = document.getElementById("dataPanelTooltipHuge");
        if (tt) tt.style.display = "none";
    }

    /**
     * 🃏 ミニマルモード時の手札直上フローティング拡大プレビューの完全制御
     * （トレイ実座標からのピクセル完全センタリング ＆ 選択中は常時表示維持）
     * @param {HTMLElement|null} overrideCardEl ホバーされたカード要素 (nullの場合は選択中カードを参照)
     */
    updateFloatingPreview(overrideCardEl = null) {
        if (typeof document === "undefined") return;
        const previewEl = document.getElementById("cardFloatingPreview");
        if (!previewEl) return;

        // ミニマルモードでない場合は常に非表示
        if (!this.isMinimalMode) {
            previewEl.classList.remove("is-visible");
            return;
        }

        let targetEl = overrideCardEl;

        // ホバー対象がない場合、現在選択中のカード（手札または保留）があればそれを表示し続ける
        if (!targetEl) {
            if (this.selectedCardIdx !== -1) {
                const cardElements = document.querySelectorAll(".cards-hand-container .card-frame-tcg");
                if (cardElements && cardElements[this.selectedCardIdx]) {
                    targetEl = cardElements[this.selectedCardIdx];
                }
            } else if (this.selectedReserveIdx !== -1) {
                targetEl = document.querySelector(".reserve-slot-single-box .card-frame-tcg");
            }
        }

        if (!targetEl) {
            previewEl.classList.remove("is-visible");
            return;
        }

        const fullHtml = targetEl.getAttribute("data-full-card-html") || targetEl.innerHTML;
        const categoryClass = Array.from(targetEl.classList).find(c => c.startsWith("category-")) || "";
        const isReserveEmpty = targetEl.classList.contains("reserve-slot-empty");

        if (isReserveEmpty) {
            previewEl.innerHTML = `
                <div class="reserve-slot-empty">
                    ${fullHtml}
                </div>
            `;
        } else {
            previewEl.innerHTML = `
                <div class="card-frame-tcg ${categoryClass}">
                    ${fullHtml}
                </div>
            `;
        }

        previewEl.classList.add("is-visible");
    }

    hideFloatingPreviewIfNotSelected() {
        // 選択中のカードがなければプレビューを非表示、あれば選択中カードに戻す
        this.updateFloatingPreview(null);
    }

    /**
     * 💡 マウスオーバー時のカード操作ガイドポップアップ表示 (3大操作ヒント)
     * @param {HTMLElement} targetCardEl 
     * @param {Object} card 
     */
    showCardActionHintPopover(targetCardEl, card) {
        if (this.isMinimalMode || (typeof document !== "undefined" && (document.body.classList.contains("is-minimal") || !!document.querySelector("#cardRow.is-minimal, .offering-section.is-minimal")))) return;
        if (typeof document === "undefined" || !targetCardEl || !card || card.isBlank) return;
        this.hideCardActionHintPopover();

        const I18n = (typeof globalThis !== 'undefined' && globalThis.I18n) ? globalThis.I18n : (typeof window !== 'undefined' && window.I18n ? window.I18n : { t: k => k });
        const tObj = card.terrain || card;
        const category = card.category || tObj.category || "LAND";

        const popover = document.createElement("div");
        popover.id = "cardActionHintPopover";
        popover.className = "card-action-hint-popover";

        if (category === "LAND") {
            popover.innerHTML = `
                <div class="card-action-hint-item">
                    <span class="card-action-hint-bullet">&bull;</span>
                    <span>${I18n.t("UI_CARD_HINT_PLACE_LAND")}</span>
                </div>
                <div class="card-action-hint-item">
                    <span class="card-action-hint-bullet">&bull;</span>
                    <span>${I18n.t("UI_CARD_HINT_ROTATE")}</span>
                </div>
                <div class="card-action-hint-item">
                    <span class="card-action-hint-bullet">&bull;</span>
                    <span>${I18n.t("UI_CARD_HINT_RESERVE")}</span>
                </div>
            `;
        } else {
            popover.innerHTML = `
                <div class="card-action-hint-item">
                    <span class="card-action-hint-bullet">&bull;</span>
                    <span>${I18n.t("UI_CARD_HINT_PLAY_CMD")}</span>
                </div>
                <div class="card-action-hint-item">
                    <span class="card-action-hint-bullet">&bull;</span>
                    <span>${I18n.t("UI_CARD_HINT_RESERVE")}</span>
                </div>
            `;
        }

        targetCardEl.style.position = "relative";
        targetCardEl.appendChild(popover);
    }

    hideCardActionHintPopover() {
        if (typeof document === "undefined") return;
        const existing = document.getElementById("cardActionHintPopover");
        if (existing && existing.parentNode) {
            existing.parentNode.removeChild(existing);
        }
    }
}

if (typeof window !== "undefined") {
    window.UIController = UIController;
}
if (typeof globalThis !== "undefined") {
    globalThis.UIController = UIController;
}

export { UIController };
export default UIController;

