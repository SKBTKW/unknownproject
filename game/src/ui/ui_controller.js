import { I18n } from '../i18n.js';
import { LogComponent } from './log_component.js';
import { BuffPanelComponent } from './buff_panel_component.js';
import { TerritoryBadgeComponent } from './territory_badge_component.js';
import { UILayoutConfig } from './layout_config.js';
import { BlockPlacementSystem } from './block_placement_system.js';
import { ProductionCalculator } from '../systems/production_calculator.js';
import { V2UIRenderer } from './v2_ui_renderer.js';
import { ModalSystem } from './modal_system.js';
import { focusLayerManager } from './focus_layer_system.js';
import { boardCameraSystem } from './board_camera_system.js';
import { UndoLandSystem } from '../systems/undo_land_system.js';

class UIController {
    /**
     * @param {GameEngine|Object} engine - ゲームエンジンまたはGameState
     */
    constructor(engine) {
        this.engine = engine;
        this.state = (engine && engine.state) ? engine.state : engine;
        this.drawSys = (engine && engine.deckManager) ? engine.deckManager : (engine && engine.drawSys ? engine.drawSys : null);
        this.undoSys = (engine && engine.undoSys) ? engine.undoSys : (UndoLandSystem && this.state ? new UndoLandSystem(this.state) : null);
        this.selectedCard = null;
        this.selectedCardIdx = -1;
        this.pinnedPreviewCard = null;

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
            window.onCellClick = (r, c) => this.onCellClick(r, c);
            window.onCellMouseEnter = (e, r, c) => this.onCellMouseEnter(e, r, c);
            window.onCellMouseMove = (e, r, c) => this.onCellMouseMove(e, r, c);
            window.clearCellPreviews = () => this.clearCellPreviews();
            window.mulligan = () => this.mulligan();
            window.nextTurn = () => this.nextTurn();
            window.reserveCard = (idx) => this.reserveCard(idx);
            window.returnReserveCard = (idx) => this.returnReserveCard(idx);
            window.playCommandCard = (card, idx) => this.playCommandCard(card, idx);
            window.toggleDirectiveModal = () => this.toggleDirectiveModal();
            window.closeDirectiveModal = () => this.closeDirectiveModal();
            window.selectDirective = (id) => this.selectDirective(id);
            window.toggleBoardLabelMode = (e) => this.toggleBoardLabelMode(e);
            window.showDataPanelTooltip = (e) => this.showDataPanelTooltip(e);
            window.hideDataPanelTooltip = () => this.hideDataPanelTooltip();
            window.render = () => this.render();
        }
    }

    /**
     * 🚀 UI の初期化とマウント
     */
    init() {
        this.initModularUIComponents();
        this.initStaticI18nLabels();
        this.initGlobalCancelListeners();
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
        if (focusLayerManager) focusLayerManager.onCardDeselect();
        this.clearCellPreviews();
        this.render();
        this.highlightPlaceableCells();
    }

    /**
     * 🎯 盤面外クリック / Esc キー / 盤面外右クリックによる配置キャンセル検知
     */
    initGlobalCancelListeners() {
        if (typeof document === "undefined") return;

        // 1. 盤面外・背景クリックでキャンセル
        document.addEventListener("click", (e) => {
            if (!this.selectedCard) return;
            // クリック先がマス目(.cell)、手札カード、マリガンボタン、モーダル内の場合は除外
            if (e.target.closest(".cell") || e.target.closest(".card-frame-tcg") || e.target.closest(".card-slot-box") || e.target.closest("#btnMulligan") || e.target.closest(".modal-container") || e.target.closest("#directiveModal")) {
                return;
            }
            this.deselectCard();
        });

        // 2. Esc キーで即時キャンセル
        document.addEventListener("keydown", (e) => {
            if (e.key === "Escape" || e.key === "Esc") {
                if (this.selectedCard) {
                    this.deselectCard();
                }
            }
        });

        // 3. 盤面外右クリックでキャンセル
        document.addEventListener("contextmenu", (e) => {
            if (this.selectedCard && !e.target.closest(".cell") && !e.target.closest(".card-frame-tcg")) {
                e.preventDefault();
                this.deselectCard();
            }
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

        const badgeContainer = document.getElementById("territoryBadgeContainer") || document.querySelector(".board-container-wrapper");
        const badgeComp = (typeof TerritoryBadgeComponent !== "undefined" && TerritoryBadgeComponent) ? TerritoryBadgeComponent : (typeof window !== "undefined" ? window.TerritoryBadgeComponent : null);
        if (badgeComp && badgeContainer && !badgeContainer.hasChildNodes()) {
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
            const prods = (typeof this.state.calculateTotalProduction === "function") ? this.state.calculateTotalProduction() : { totalFood: 10, totalWood: 10, totalMystic: 1 };
            const defTotal = (typeof this.state.calculateTotalDefense === "function") ? this.state.calculateTotalDefense() : (this.state.defense || 10);

            this.setElementText("lblDataPanelTitle", I18n.t("UI_DATA_PANEL_TITLE"));
            this.setElementText("valTurn", this.state.turn);
            this.setElementText("valTurnBg", String(this.state.turn).padStart(2, '0'));
            this.setElementText("valEmber", this.state.ember);
            this.setElementText("valFood", this.state.food);
            this.setElementText("valFoodProd", `+${prods.totalFood}`);
            this.setElementText("valWood", this.state.wood);
            this.setElementText("valWoodProd", `+${prods.totalWood}`);
            this.setElementText("valDefense", defTotal);
            this.setElementText("valMystic", this.state.mystic);
            this.setElementText("valMysticProd", `+${prods.totalMystic || 1}`);
            
            const placedCount = (typeof this.state.countPlacedTiles === "function") ? this.state.countPlacedTiles() : 1;
            const badgeComp = (typeof TerritoryBadgeComponent !== "undefined" && TerritoryBadgeComponent) ? TerritoryBadgeComponent : (typeof window !== "undefined" ? window.TerritoryBadgeComponent : null);
            if (badgeComp && typeof badgeComp.update === "function") {
                badgeComp.update(placedCount, this.state);
            } else {
                this.setElementText("valPlacedCount", `${placedCount}/24`);
            }

            if (typeof window !== "undefined" && typeof window.renderDirectiveHeaderBadge === "function") {
                window.renderDirectiveHeaderBadge();
            }

            this.renderBoardGrid(I18n);
            this.renderOfferingCards(I18n);
            this.renderReserveSlots(I18n);
            this.renderBuffPanel();
            this.updateMulliganButton();

            // ⚠️ 試練カウントダウンの動的表示 (予告期間中のみ点灯)
            const trialBadge = document.getElementById("trialCountdownBadge");
            if (trialBadge) {
                const nextTrial = this.state.nextTrialTurn || (this.state.stage && this.state.stage.id ? this.state.stage.id * 20 : 20);
                const turnsLeft = nextTrial - this.state.turn;
                if (turnsLeft > 0 && turnsLeft <= 5) {
                    trialBadge.style.display = "inline-flex";
                    this.setElementText("valTrialCountdown", turnsLeft);
                } else {
                    trialBadge.style.display = "none";
                }
            }

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
        const boardEl = document.getElementById("gridBoard");
        if (!boardEl || !this.state.grid) return;
        boardEl.innerHTML = "";

        const cornerCell = document.createElement("div");
        cornerCell.className = "header-cell corner-toggle-cell";
        cornerCell.style.display = "flex";
        cornerCell.style.alignItems = "center";
        cornerCell.style.justifyContent = "center";

        const currentMode = (typeof window !== "undefined" && window.currentBoardMode) || 'hover';
        let modeIcon = "🏷️";
        if (currentMode === 'icon') modeIcon = "🌾";
        else if (currentMode === 'always') modeIcon = "👁️";

        cornerCell.title = "土地表示モード切替";
        cornerCell.innerHTML = `<button onclick="toggleBoardLabelMode(event)" style="background:rgba(255,255,255,0.1); border:1px solid rgba(255,255,255,0.2); color:#fff; border-radius:4px; padding:2px 4px; font-size:12px; cursor:pointer;" title="土地表示モード切替">${modeIcon}</button>`;
        boardEl.appendChild(cornerCell);

        const size = this.state.grid.length;
        // 🌟 2層レイヤー化により、7x7 でもセルサイズ 80px を維持して視認性を死守
        const cellSize = (size >= 9) ? '70px' : '80px';
        const headerSize = (size >= 9) ? '35px' : '40px';

        boardEl.style.gridTemplateColumns = `${headerSize} repeat(${size}, ${cellSize})`;
        boardEl.style.gridTemplateRows = `${headerSize} repeat(${size}, ${cellSize})`;
        boardEl.style.setProperty('--board-size', size);
        boardEl.style.setProperty('--cell-size', cellSize);
        boardEl.style.setProperty('--header-size', headerSize);

        for (let c = 0; c < size; c++) {
            const hCell = document.createElement("div");
            hCell.className = "header-cell";
            hCell.innerText = String.fromCharCode(65 + c);
            boardEl.appendChild(hCell);
        }

        for (let r = 0; r < size; r++) {
            const vCell = document.createElement("div");
            vCell.className = "header-cell";
            vCell.innerText = r + 1;
            boardEl.appendChild(vCell);

            for (let c = 0; c < size; c++) {
                const cellData = this.state.grid[r][c];
                const cellEl = document.createElement("div");
                cellEl.className = "cell";
                cellEl.setAttribute("data-r", r);
                cellEl.setAttribute("data-c", c);

                const isHQVic = (typeof this.state.isHQVicinity === "function") ? this.state.isHQVicinity(r, c) : false;

                if (cellData.isHQ) {
                    cellEl.classList.add("hq");
                    cellEl.innerHTML = I18n.t("TERRAIN_HQ");
                } else if (cellData.placed && cellData.terrain) {
                    cellEl.classList.add("placed");

                    const tid = cellData.terrain ? (cellData.terrain.terrainId || cellData.terrain.id || "") : "";
                    if (tid.includes("PLAINS")) cellEl.classList.add("terrain-plains");
                    else if (tid.includes("DEEP_FOREST") || tid.includes("DEEP_HILL")) cellEl.classList.add("terrain-deep-forest");
                    else if (tid.includes("FOREST")) cellEl.classList.add("terrain-forest");
                    else if (tid.includes("HILL")) cellEl.classList.add("terrain-hill");
                    else if (tid.includes("MOUNTAIN")) cellEl.classList.add("terrain-mountain");
                    else if (tid.includes("DESERT")) cellEl.classList.add("terrain-desert");

                    const tName = I18n.t(cellData.terrain.nameKey);
                    const mergeId = cellData.mergeGroupId;
                    const placeId = cellData.placementGroupId;
                    const activeGroupId = mergeId || placeId;

                    if (activeGroupId) {
                        cellEl.setAttribute("data-group-id", activeGroupId);
                        if (cellData.merged) {
                            cellEl.classList.add("merged");
                            if (tid.includes("PLAINS")) cellEl.classList.add("merged-plains");
                            else if (tid.includes("DEEP_FOREST") || tid.includes("DEEP_HILL")) cellEl.classList.add("merged-deep-forest");
                            else if (tid.includes("FOREST")) cellEl.classList.add("merged-forest");
                            else if (tid.includes("HILL")) cellEl.classList.add("merged-hill");
                            else if (tid.includes("MOUNTAIN")) cellEl.classList.add("merged-mountain");
                            else if (tid.includes("DESERT")) cellEl.classList.add("merged-desert");

                            cellEl.style.borderColor = "rgba(241, 196, 15, 0.4)";
                            cellEl.style.borderStyle = "dashed";
                        } else if (placeId) {
                            const topSame = (r > 0 && this.state.grid[r-1][c].placementGroupId === placeId);
                            const rightSame = (c < size - 1 && this.state.grid[r][c+1].placementGroupId === placeId);
                            const bottomSame = (r < size - 1 && this.state.grid[r+1][c].placementGroupId === placeId);
                            const leftSame = (c > 0 && this.state.grid[r][c-1].placementGroupId === placeId);

                            if (topSame) {
                                cellEl.classList.add("no-border-top", "no-radius-tl", "no-radius-tr");
                                cellEl.style.setProperty("border-top", "none", "important");
                                cellEl.style.marginTop = "-4px";
                                cellEl.style.height = "calc(100% + 4px)";
                            }
                            if (rightSame) {
                                cellEl.classList.add("no-border-right", "no-radius-tr", "no-radius-br");
                                cellEl.style.setProperty("border-right", "none", "important");
                                cellEl.style.width = "calc(100% + 4px)";
                                cellEl.style.zIndex = "2";
                            }
                            if (bottomSame) {
                                cellEl.classList.add("no-border-bottom", "no-radius-bl", "no-radius-br");
                                cellEl.style.setProperty("border-bottom", "none", "important");
                                cellEl.style.height = "calc(100% + 4px)";
                                cellEl.style.zIndex = "2";
                            }
                            if (leftSame) {
                                cellEl.classList.add("no-border-left", "no-radius-tl", "no-radius-bl");
                                cellEl.style.setProperty("border-left", "none", "important");
                                cellEl.style.marginLeft = "-4px";
                                cellEl.style.width = "calc(100% + 4px)";
                            }
                        }

                        const topGroupSame = (r > 0 && (this.state.grid[r-1][c].mergeGroupId === activeGroupId || this.state.grid[r-1][c].placementGroupId === activeGroupId));
                        const leftGroupSame = (c > 0 && (this.state.grid[r][c-1].mergeGroupId === activeGroupId || this.state.grid[r][c-1].placementGroupId === activeGroupId));

                        if (!topGroupSame && !leftGroupSame) {
                            const socketText = cellData.socketResource ? `<br><small style="color:#f1c40f;">★${I18n.t(cellData.socketResource.nameKey)}</small>` : "";
                            if (cellData.merged && cellData.mergeType === "2x2") {
                                cellEl.innerHTML = `<span style="font-size:12px; color:#f1c40f; font-weight:bold; white-space:nowrap; z-index:5; text-shadow:0 0 6px rgba(0,0,0,0.9);">${I18n.t("UI_MERGE_2X2_LABEL", { name: tName })}${socketText}</span>`;
                            } else {
                                const hasRight = (c < 4 && this.state.grid[r][c+1].placementGroupId === placeId);
                                const hasBottom = (r < 4 && this.state.grid[r+1][c].placementGroupId === placeId);
                                let spanStyle = "font-size:13px; color:#fff; font-weight:bold; z-index:5; text-shadow:0 2px 4px rgba(0,0,0,0.8); pointer-events:none;";
                                if (hasRight && !hasBottom) {
                                    spanStyle += " position:absolute; left:0; width:200%; text-align:center;";
                                } else if (hasBottom && !hasRight) {
                                    spanStyle += " position:absolute; top:0; left:0; width:100%; height:200%; display:flex; align-items:center; justify-content:center;";
                                }
                                cellEl.innerHTML = `<span style="${spanStyle}">${tName}${socketText}</span>`;
                            }
                        } else {
                            const socketBadge = cellData.socketResource ? `<small style="color:#f1c40f; font-size:10px;">★${I18n.t(cellData.socketResource.nameKey)}</small>` : "";
                            cellEl.innerHTML = socketBadge;
                        }
                    } else {
                        const socketBadge = cellData.socketResource ? `<br><small style="color:#f1c40f; font-size:10px;">★${I18n.t(cellData.socketResource.nameKey)}</small>` : "";
                        const searchedBadge = cellData.searched ? `<span class="searched-badge">${I18n.t("UI_SEARCHED_BADGE")}</span>` : "";
                        cellEl.innerHTML = `${tName}${socketBadge}${searchedBadge}`;
                    }
                } else if (cellData.hasSocket) {
                    cellEl.classList.add("socket-unopened");
                    if (isHQVic) cellEl.classList.add("hq-vicinity-unplaced");
                    cellEl.innerHTML = `<span style="color:#f39c12;font-size:22px;filter:drop-shadow(0 0 4px #f39c12);">★</span>`;
                } else {
                    if (isHQVic) {
                        cellEl.classList.add("hq-vicinity-unplaced");
                    }
                }

                // ↩️ 当ターン配置マスの場合: キャンセルガイドバッジ (Undo Badge) を付与
                const undoSys = this.undoSys || (typeof window !== "undefined" ? window.undoSys : null);
                if (undoSys && typeof undoSys.isCellPlacedThisTurn === "function" && undoSys.isCellPlacedThisTurn(r, c)) {
                    cellEl.classList.add("cell-placed-this-turn");
                    const undoBadge = document.createElement("div");
                    undoBadge.className = "undo-badge";
                    undoBadge.title = "↩ クリックで配置を取り消す";
                    undoBadge.innerHTML = "↩";
                    cellEl.appendChild(undoBadge);
                }

                cellEl.onmouseenter = (e) => this.onCellMouseEnter(e, r, c);
                cellEl.onmousemove = (e) => this.onCellMouseMove(e, r, c);
                cellEl.onmouseleave = () => this.clearCellPreviews();
                cellEl.onclick = () => this.onCellClick(r, c);
                cellEl.oncontextmenu = (e) => {
                    e.preventDefault();
                    if (this.selectedCard) {
                        const activeIdx = this.selectedCardIdx !== -1 ? this.selectedCardIdx : 0;
                        this.rotateSelectedCard(e, activeIdx);
                    }
                };
                boardEl.appendChild(cellEl);
            }
        }

        if (this.selectedCard) {
            this.highlightPlaceableCells();
        }
    }

    renderOfferingCards(I18n) {
        const cardRowEl = document.getElementById("cardRow");
        if (!cardRowEl || !this.state.handOffering) return;
        cardRowEl.innerHTML = "";

        this.state.handOffering.forEach((card, idx) => {
            if (!card) return;

            if (card.isBlank) {
                const blankEl = document.createElement("div");
                blankEl.className = "card-frame-tcg locked";
                blankEl.style.cssText = "background:#11141d; border:2px dashed #7f8c8d; border-radius:10px; display:flex; flex-direction:column; align-items:center; justify-content:center;";
                blankEl.innerHTML = `<div style="font-size:28px; color:#e74c3c; font-weight:bold;">✖</div>`;
                cardRowEl.appendChild(blankEl);
                return;
            }

            const isSelected = (this.selectedCardIdx === idx);
            const isLocked = this.state.hasPickedThisTurn;
            const tObj = card.terrain || card;
            const category = tObj.category || "LAND";
            const rCode = tObj.rarity || "C";
            const rarityClass = `rarity-${rCode.toLowerCase()}`;
            const categoryClass = category !== "LAND" ? `category-${category.toLowerCase()}` : "";

            let costMet = true;
            let costBadgeText = "";
            if (category !== "LAND" && tObj.cost) {
                const c = tObj.cost;
                const parts = [];
                if (c.food) { parts.push(`🌾-${c.food}`); if (this.state.food < c.food) costMet = false; }
                if (c.wood) { parts.push(`🧱-${c.wood}`); if (this.state.wood < c.wood) costMet = false; }
                if (c.mystic) { parts.push(`✨-${c.mystic}`); if (this.state.mystic < c.mystic) costMet = false; }
                if (c.ember) { parts.push(`🔥-${c.ember}`); if (this.state.ember < c.ember) costMet = false; }
                costBadgeText = parts.join(" ");
            }

            const cardEl = document.createElement("div");
            cardEl.className = `card-frame-tcg ${rarityClass} ${categoryClass} ${isSelected ? 'selected' : ''} ${isLocked ? 'locked' : ''} ${!costMet ? 'cost-disabled' : ''}`;
            cardEl.onclick = (e) => {
                e.stopPropagation();
                this.selectCard(idx);
            };
            cardEl.oncontextmenu = (e) => {
                e.preventDefault();
                e.stopPropagation();
                if (category === "LAND") this.rotateSelectedCard(e, idx);
            };

            const cName = tObj.nameKey ? I18n.t(tObj.nameKey) : (tObj.id || "Card");
            const cDesc = tObj.descriptionKey ? I18n.t(tObj.descriptionKey) : (tObj.description || "");

            if (category !== "LAND") {
                cardEl.innerHTML = `
                    <div class="tcg-card-top-bar" style="padding:4px 8px;">
                        <div class="tcg-title-pill" style="font-size:21px; font-weight:900; text-align:center; width:100%; letter-spacing:0.5px;">${cName}</div>
                    </div>
                    <div class="tcg-shape-art-area" style="display:flex; flex-direction:column; align-items:flex-start; justify-content:flex-start; background:#1c2536; padding:14px; text-align:left; overflow:hidden; flex:1; border-radius:6px; margin:4px 0;">
                        <div style="font-size:17.5px; color:#ffffff; line-height:1.45; font-weight:bold; text-align:left; width:100%;">${cDesc}</div>
                    </div>
                    <div class="tcg-yield-strip" style="font-size:16px; font-weight:bold; text-align:left; justify-content:flex-start; padding:8px 12px; width:100%; box-sizing:border-box;">
                        <span>${costBadgeText ? I18n.t("UI_CARD_COST_PREFIX", { cost: costBadgeText }) : I18n.t("UI_CMD_INSTANT_LABEL")}</span>
                    </div>
                    <div class="tcg-action-controls" style="display:none;">
                        <button class="tcg-reserve-btn-wireframe" onclick="event.stopPropagation(); reserveCard(${idx})">${I18n.t("UI_RESERVE_BTN")}</button>
                    </div>
                `;
            } else {
                const y = tObj.yields || { food: tObj.food || 0, wood: tObj.wood || 0, defense: tObj.def || tObj.defense || 0, mystic: tObj.mystic || 0 };
                const shapeMat = card.currentShape || tObj.shape || [[1]];
                const tileCount = shapeMat.reduce((acc, row) => acc + row.reduce((a, b) => a + b, 0), 0);
                const totF = (y.food || 0) * tileCount;
                const totW = (y.wood || 0) * tileCount;
                const totD = (y.defense || 0) * tileCount;
                const totM = (y.mystic || 0) * tileCount;

                // 🎨 地形IDに応じたプレビューブロック色とネオンオーラ (配置時の盤面色と完全一致)
                const tid = tObj.terrainId || tObj.id || "";
                let blockBg = "#1abc9c";
                let blockBorder = "#16a085";
                let blockShadow = "rgba(26, 188, 156, 0.8)";

                if (tid.includes("DEEP_FOREST") || tid.includes("DEEP_HILL")) {
                    blockBg = "#16a085"; blockBorder = "#117a65"; blockShadow = "rgba(22, 160, 133, 0.85)";
                } else if (tid.includes("FOREST")) {
                    blockBg = "#2ecc71"; blockBorder = "#27ae60"; blockShadow = "rgba(46, 204, 113, 0.85)";
                } else if (tid.includes("HILL")) {
                    blockBg = "#e67e22"; blockBorder = "#d35400"; blockShadow = "rgba(230, 126, 34, 0.85)";
                } else if (tid.includes("MOUNTAIN")) {
                    blockBg = "#9b59b6"; blockBorder = "#8e44ad"; blockShadow = "rgba(155, 89, 182, 0.85)";
                } else if (tid.includes("DESERT")) {
                    blockBg = "#f39c12"; blockBorder = "#d68910"; blockShadow = "rgba(243, 156, 18, 0.85)";
                } else if (tid.includes("PLAINS")) {
                    blockBg = "#1abc9c"; blockBorder = "#16a085"; blockShadow = "rgba(26, 188, 156, 0.85)";
                }

                let shapeHtml = `<div style="display:grid; grid-template-rows:repeat(${shapeMat.length}, 22px); grid-template-columns:repeat(${shapeMat[0].length}, 22px); gap:5px; background:rgba(0,0,0,0.55); padding:10px; border-radius:8px; border:1.5px solid rgba(255,255,255,0.18);">`;
                for (let r = 0; r < shapeMat.length; r++) {
                    for (let c = 0; c < shapeMat[0].length; c++) {
                        if (shapeMat[r][c] === 1) {
                            shapeHtml += `<div style="width:22px;height:22px;background:${blockBg};border:1.5px solid ${blockBorder};border-radius:4px;box-shadow:0 0 8px ${blockShadow};"></div>`;
                        } else {
                            shapeHtml += `<div style="width:22px;height:22px;background:transparent;"></div>`;
                        }
                    }
                }
                shapeHtml += `</div>`;

                // 🌾 産出表示: 30%拡大 ＆ 「産出:」カラー統一 (純白) ＆ 0 は非表示
                const yieldParts = [];
                if (totF > 0) yieldParts.push(`<span>🌾${totF}</span>`);
                if (totW > 0) yieldParts.push(`<span>🧱${totW}</span>`);
                if (totD > 0) yieldParts.push(`<span>🛡️${totD}</span>`);
                if (totM > 0) yieldParts.push(`<span>✨${totM}</span>`);
                const yieldContent = yieldParts.length > 0 ? yieldParts.join(" ") : `<span>-</span>`;
                const yieldText = `<span style="font-size:16px; color:#ffffff; font-weight:bold; margin-right:6px;">産出:</span> <span style="font-size:19.5px; font-weight:900; letter-spacing:0.8px; color:#ffffff;">${yieldContent}</span>`;

                cardEl.innerHTML = `
                    <div class="tcg-card-top-bar" style="padding:4px 8px;">
                        <div class="tcg-title-pill" style="font-size:21px; font-weight:900; text-align:center; width:100%; letter-spacing:0.5px;">${cName}</div>
                    </div>
                    <div class="tcg-shape-art-area" style="display:flex; align-items:center; justify-content:center; padding:12px; flex:1; background:#1c2536; border-radius:6px; margin:4px 0;">
                        ${shapeHtml}
                    </div>
                    <div class="tcg-yield-strip" style="padding:8px 10px; display:flex; align-items:center; justify-content:center;">
                        ${yieldText}
                    </div>
                    <div class="tcg-action-controls" style="display:none;">
                        <button class="tcg-reserve-btn-wireframe" onclick="event.stopPropagation(); reserveCard(${idx})">${I18n.t("UI_RESERVE_BTN")}</button>
                    </div>
                `;
            }
            cardRowEl.appendChild(cardEl);
        });
    }

    renderReserveSlots(I18n) {
        const reserveRowEl = document.getElementById("reserveRow");
        if (!reserveRowEl || !this.state.reserveSlots) return;
        reserveRowEl.innerHTML = "";

        for (let i = 0; i < 3; i++) {
            const card = this.state.reserveSlots[i];
            if (card) {
                const cName = I18n.t(card.terrain.nameKey);
                const cardEl = document.createElement("div");
                cardEl.className = "card-frame-tcg rarity-c";

                const ry = card.terrain.yields || card.terrain;
                const rParts = [];
                if ((ry.food || 0) > 0) rParts.push(`<span>🌾: ${ry.food}</span>`);
                if ((ry.wood || 0) > 0) rParts.push(`<span>🧱: ${ry.wood}</span>`);
                if ((ry.defense || 0) > 0) rParts.push(`<span>🛡️: ${ry.defense}</span>`);
                if ((ry.mystic || 0) > 0) rParts.push(`<span>✨: ${ry.mystic}</span>`);
                const rYieldText = rParts.length > 0 ? rParts.join(" ") : `<span>-</span>`;

                cardEl.innerHTML = `
                    <div class="tcg-card-top-bar">
                        <div class="tcg-title-pill" style="border-color:#d35400;">${cName}</div>
                        <div class="tcg-rarity-code" style="color:#d35400;">C</div>
                    </div>
                    <div class="tcg-shape-art-area" style="background:#fff3e0;">
                        <div style="width:12px;height:12px;background:#e67e22;border-radius:2px;"></div>
                    </div>
                    <div class="tcg-yield-strip" style="background:#fff3e0;">
                        ${rYieldText}
                    </div>
                    <div class="tcg-action-controls">
                        <button class="tcg-reserve-btn-wireframe" style="background:#e67e22;" onclick="event.stopPropagation(); returnReserveCard(${i})">${I18n.t("UI_RESERVE_RETURN_BTN")}</button>
                    </div>
                `;
                reserveRowEl.appendChild(cardEl);
            } else {
                const emptySlotEl = document.createElement("div");
                emptySlotEl.className = "reserve-slot";
                emptySlotEl.style.cssText = "width:115px; height:172.5px; aspect-ratio:2/3; background:#12141c; border:2px dashed #34495e; border-radius:10px; display:flex; align-items:center; justify-content:center; font-size:11px; color:#7f8c8d; margin:0 auto;";
                emptySlotEl.innerText = I18n.t("UI_RESERVE_EMPTY", { slot: i + 1 });
                reserveRowEl.appendChild(emptySlotEl);
            }
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

    selectCard(idx) {
        if (!this.state || this.state.hasPickedThisTurn) return;
        const card = this.state.handOffering[idx];
        if (!card || card.isBlank) return;

        if (this.selectedCardIdx === idx) {
            this.selectedCard = null;
            this.selectedCardIdx = -1;
            if (focusLayerManager) focusLayerManager.onCardDeselect();
            this.render();
            this.highlightPlaceableCells();
            return;
        }

        this.selectedCard = card;
        this.selectedCardIdx = idx;
        if (focusLayerManager) focusLayerManager.onCardSelect();
        this.render();
        this.highlightPlaceableCells();

        const tObj = card.terrain || card;
        const category = card.category || tObj.category || "LAND";
        if (category !== "LAND" && typeof window !== "undefined" && window.ModalSystem) {
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

            window.ModalSystem.showConfirmDialog({
                title: `📜 ${cName} を発動しますか？`,
                descText: cDesc,
                costText: costBadgeText,
                confirmLabel: "⚡ 発動する",
                cancelLabel: "✖ キャンセル",
                onConfirm: () => {
                    this.playCommandCard(card, idx);
                    this.selectedCard = null;
                    this.selectedCardIdx = -1;
                    this.render();
                },
                onCancel: () => {
                    this.selectedCard = null;
                    this.selectedCardIdx = -1;
                    this.render();
                }
            });
        }
    }

    rotateSelectedCard(e, idx) {
        if (e && typeof e.stopPropagation === "function") e.stopPropagation();
        if (!this.state || !this.state.handOffering) return;
        const card = this.state.handOffering[idx];
        if (!card || card.isBlank || !card.currentShape) return;

        const oldShape = card.currentShape;
        const rows = oldShape.length;
        const cols = oldShape[0].length;
        const newShape = [];
        for (let c = 0; c < cols; c++) {
            const newRow = [];
            for (let r = rows - 1; r >= 0; r--) {
                newRow.push(oldShape[r][c]);
            }
            newShape.push(newRow);
        }
        card.currentShape = newShape;

        this.render();
        if (this.selectedCardIdx === idx) {
            this.highlightPlaceableCells();
        }
    }

    onCellClick(r, c) {
        if (!this.state) return;
        const I18n = (typeof globalThis !== 'undefined' && globalThis.I18n) ? globalThis.I18n : (typeof window !== 'undefined' ? window.I18n : { t: k => k });
        const undoSys = this.undoSys || (typeof window !== "undefined" ? window.undoSys : null);

        // ↩️ 当ターン配置済みマスをクリックした場合は配置取り消し（Undo）
        if (undoSys && undoSys.isCellPlacedThisTurn(r, c)) {
            undoSys.undo();
            this.selectedCard = null;
            this.selectedCardIdx = -1;
            if (focusLayerManager) focusLayerManager.onCardDeselect();
            this.render();
            this.highlightPlaceableCells();
            return;
        }

        if (!this.selectedCard || this.state.hasPickedThisTurn) return;

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
            this.selectedCard = null;
            this.selectedCardIdx = -1;
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

        while (this.state.toastQueue.length > 0) {
            const toast = this.state.toastQueue.shift();
            const { r, c, text } = toast;

            // 当該セルの DOM 座標を取得
            let targetX = window.innerWidth / 2;
            let targetY = window.innerHeight / 2;

            const cellEl = document.querySelector(`.cell[data-r="${r}"][data-c="${c}"]`) || document.querySelector(`#cell_${r}_${c}`);
            if (cellEl) {
                const rect = cellEl.getBoundingClientRect();
                targetX = rect.left + rect.width / 2;
                targetY = rect.top + rect.height / 2;
            }

            // フロートポップアップ要素の生成
            const popup = document.createElement("div");
            popup.className = "float-toast-bonus";
            popup.innerHTML = text;
            popup.style.left = `${targetX}px`;
            popup.style.top = `${targetY}px`;
            document.body.appendChild(popup);

            // アニメーション完了後に DOM から自動削除
            setTimeout(() => {
                if (popup.parentNode) popup.parentNode.removeChild(popup);
            }, 1700);
        }
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
        if (undoSys && undoSys.isCellPlacedThisTurn(r, c)) {
            undoSys.showHoverTooltip(e, r, c);
            this.hideTileTooltip();
            return;
        } else if (undoSys) {
            undoSys.hideHoverTooltip();
        }

        const cellData = this.state.grid[r][c];
        this.showTileTooltip(e, r, c, cellData);
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
        const coordStr = `${String.fromCharCode(65 + c)}${r + 1}`;
        const isHQVic = (this.state && typeof this.state.isHQVicinity === "function") ? this.state.isHQVicinity(r, c) : false;
        let title = `土地 [${coordStr}]`;
        let desc = isHQVic 
            ? "🏛️ <strong>本営近郊エリア</strong><br>本営に隣接する特別な地脈です。<br><span style='color:#1abc9c; font-weight:bold;'>ここに配置された土地が産出しているすべての数値（>0）にそれぞれ +1 ボーナス</span> が付与されます。<br><small style='color:#a4b0be;'>（例: 🌾2 ➔ 🌾3 / ✨5 ➔ ✨6、0の項目は0のまま）</small>" 
            : "未開拓の土地";

        if (cell.isHQ) {
            title = `🏛️ 本営 HQ [${coordStr}]`;
            desc = "基礎産出: 🌾+10 🧱+10 🛡️10 ✨+1";
        } else if (cell.placed && cell.terrain) {
            const t = cell.terrain;
            const tName = I18n.t(t.nameKey || t.id || "TERRAIN_PLAINS");
            title = `🌱 ${tName} [${coordStr}]`;

            let tf = (t.food !== undefined) ? t.food : ((t.baseYieldsPerTile && t.baseYieldsPerTile.food) || (t.yields && t.yields.food) || 0);
            let tw = (t.wood !== undefined) ? t.wood : ((t.baseYieldsPerTile && t.baseYieldsPerTile.wood) || (t.yields && t.yields.wood) || 0);
            let td = (t.defense !== undefined) ? t.defense : ((t.baseYieldsPerTile && t.baseYieldsPerTile.defense) || (t.yields && t.yields.defense) || 0);
            let tm = (t.mystic !== undefined) ? t.mystic : ((t.baseYieldsPerTile && t.baseYieldsPerTile.mystic) || (t.yields && t.yields.mystic) || 0);

            const bonusParts = [];
            // ソケット資源
            if (cell.socketResource) {
                const s = cell.socketResource;
                const sName = I18n.t(s.nameKey || "SOCKET_RESOURCE");
                tf += s.bonusFood || 0;
                tw += s.bonusWood || 0;
                td += s.bonusDefense || 0;
                tm += s.bonusMystic || 0;
                bonusParts.push(`★${sName}`);
            }

            // 本営近郊ボーナス（産出している数値すべてに+1）
            if (this.state && typeof this.state.isHQVicinity === "function" && this.state.isHQVicinity(r, c)) {
                let hqBonusCount = 0;
                if (tf > 0) { tf += 1; hqBonusCount++; }
                if (tw > 0) { tw += 1; hqBonusCount++; }
                if (td > 0) { td += 1; hqBonusCount++; }
                if (tm > 0) { tm += 1; hqBonusCount++; }
                if (hqBonusCount > 0) {
                    bonusParts.push("本営近郊(+1)");
                }
            }

            // 平地バフ
            const tid = t.terrainId || t.id || "";
            if (this.state && this.state.permanentPlainsFoodBonus && tid.includes("PLAINS")) {
                tf += this.state.permanentPlainsFoodBonus;
                bonusParts.push(`平地強化(+${this.state.permanentPlainsFoodBonus})`);
            }

            const yieldParts = [];
            if (tf > 0) yieldParts.push(`🌾+${tf}`);
            if (tw > 0) yieldParts.push(`🧱+${tw}`);
            if (td > 0) yieldParts.push(`🛡️+${td}`);
            if (tm > 0) yieldParts.push(`✨+${tm}`);

            const yieldStr = yieldParts.length > 0 ? yieldParts.join(" ") : "産出なし";
            const bonusStr = bonusParts.length > 0 ? ` <span style="color:#f1c40f;">(${bonusParts.join(", ")})</span>` : "";
            desc = `毎ターン産出: <strong>${yieldStr}</strong>${bonusStr}`;
        }

        tt.innerHTML = `<div style="font-size:18px; font-weight:900; color:#1abc9c; margin-bottom:6px; letter-spacing:0.5px;">${title}</div><div style="font-size:15px; color:#e0e0e0; line-height:1.5;">${desc}</div>`;
        tt.style.left = `${e.pageX + 12}px`;
        tt.style.top = `${e.pageY + 12}px`;
        tt.style.display = "block";
    }

    mulligan() {
        if (!this.state) return;
        if (this.state.hasPickedThisTurn || this.state.hasMulliganedThisTurn || this.state.ember < 1) return;

        const I18n = (typeof globalThis !== 'undefined' && globalThis.I18n) ? globalThis.I18n : (typeof window !== 'undefined' ? window.I18n : { t: k => k });
        const modalSys = (typeof window !== "undefined" && window.ModalSystem) ? window.ModalSystem : (typeof ModalSystem !== "undefined" ? ModalSystem : null);

        const executeMulligan = () => {
            if (this.engine && typeof this.engine.mulligan === "function") {
                const res = this.engine.mulligan();
                if (res && res.success) {
                    this.selectedCard = null;
                    this.selectedCardIdx = -1;
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
            if (typeof this.state.addLog === "function") {
                this.state.addLog(I18n.t("LOG_MULLIGAN_EXECUTED") || "🎲 マリガン実行: 🔥 -1 を消費して手札を再抽選しました。");
            }
            this.render();
        };

        if (modalSys && typeof modalSys.showConfirmDialog === "function") {
            modalSys.showConfirmDialog({
                title: "🔄 マリガンを実行しますか？",
                descText: "手札オファリングを全て引き直します。<br><small style='color:#a4b0be; font-size:12px;'>（1ターン内1度きり）</small>",
                confirmLabel: "🔄 引き直す (🔥-1)",
                cancelLabel: "✖ キャンセル",
                onConfirm: executeMulligan,
                onCancel: () => {}
            });
        } else {
            executeMulligan();
        }
    }

    nextTurn() {
        if (this.engine && typeof this.engine.nextTurn === "function") {
            this.engine.nextTurn();
            this.selectedCard = null;
            this.selectedCardIdx = -1;
            this.render();
            return;
        }
        if (!this.state || !this.drawSys) return;
        if (typeof window !== "undefined" && window.undoSys) window.undoSys.clearSnapshot();
        this.state.turn++;
        this.state.hasPickedThisTurn = false;
        this.state.hasMulliganedThisTurn = false;
        this.drawSys.generateOfferingCards();
        this.selectedCard = null;
        this.selectedCardIdx = -1;

        // 📜 初期ログと同一のダイレクトログ描画
        if (typeof window !== "undefined" && window.LogComponent) {
            window.LogComponent.addLog(`ターン ${this.state.turn} を開始しました。手札オファリングを補充しました。`, this.state.turn);
        }

        this.render();
    }

    reserveCard(idx) {
        if (!this.state) return;
        if (typeof this.state.moveToReserve === "function" && this.state.moveToReserve(idx)) {
            this.selectedCard = null;
            this.selectedCardIdx = -1;
            this.render();
        }
    }

    returnReserveCard(idx) {
        if (!this.state) return;
        if (typeof this.state.returnFromReserve === "function" && this.state.returnFromReserve(idx)) {
            this.selectedCard = null;
            this.selectedCardIdx = -1;
            this.render();
        }
    }

    playCommandCard(card, targetIdx) {
        if (!this.state || this.state.hasPickedThisTurn) return;
        if (typeof this.state.playCommandCard === "function") {
            this.state.playCommandCard(card.terrain || card);
            let cardIdx = (typeof targetIdx === "number" && targetIdx >= 0) ? targetIdx : this.state.handOffering.indexOf(card);
            if (cardIdx !== -1) this.state.handOffering[cardIdx] = null;
            this.render();
        }
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
        if (this.state && this.state.directiveSystem) {
            this.state.directiveSystem.setDirective(id);
            this.closeDirectiveModal();
            this.render();
        }
    }

    toggleBoardLabelMode(e) {
        if (e && typeof e.stopPropagation === "function") e.stopPropagation();
        if (typeof window === "undefined") return;
        const modes = ['hover', 'always', 'icon'];
        const currentMode = window.currentBoardMode || 'hover';
        const nextIdx = (modes.indexOf(currentMode) + 1) % modes.length;
        window.currentBoardMode = modes[nextIdx];
        this.render();
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
        const foodTotal = bd ? bd.food.total : 12;
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

        const emberStr = emberPct > 0 ? ` | 🔥残り火加護: +${emberPct}%` : "";

        tt.innerHTML = `
            <div style="font-size:17px; font-weight:900; color:#1abc9c; margin-bottom:10px; border-bottom:1.5px solid #2a2e3d; padding-bottom:6px; display:flex; align-items:center; gap:8px;">
                <span>📊</span> 毎ターンの産出詳細内訳
            </div>

            <!-- 🌾 食料 -->
            <div style="background:rgba(24, 34, 50, 0.75); border:1px solid #2c3e50; border-radius:8px; padding:10px 12px; margin-bottom:8px;">
                <div style="font-size:14.5px; font-weight:900; color:#ffffff; display:flex; justify-content:space-between; margin-bottom:4px;">
                    <span>🌾 食料 (現在在庫: ${state.food})</span>
                    <span style="color:#2ecc71; font-size:15.5px;">+${foodTotal} /T</span>
                </div>
                <div style="font-size:12px; color:#a4b0be; line-height:1.4;">
                    本営基礎: +10 | 土地配置: +${foodTiles} | ソケット: +${foodSockets} | 本営近郊: +${foodVicinity}${emberStr}
                </div>
            </div>

            <!-- 🧱 資材 -->
            <div style="background:rgba(24, 34, 50, 0.75); border:1px solid #2c3e50; border-radius:8px; padding:10px 12px; margin-bottom:8px;">
                <div style="font-size:14.5px; font-weight:900; color:#ffffff; display:flex; justify-content:space-between; margin-bottom:4px;">
                    <span>🧱 資材 (現在在庫: ${state.wood})</span>
                    <span style="color:#2ecc71; font-size:15.5px;">+${woodTotal} /T</span>
                </div>
                <div style="font-size:12px; color:#a4b0be; line-height:1.4;">
                    本営基礎: +10 | 土地配置: +${woodTiles} | ソケット: +${woodSockets} | 本営近郊: +${woodVicinity}${emberStr}
                </div>
            </div>

            <!-- 🛡️ 防衛 -->
            <div style="background:rgba(24, 34, 50, 0.75); border:1px solid #2c3e50; border-radius:8px; padding:10px 12px; margin-bottom:8px;">
                <div style="font-size:14.5px; font-weight:900; color:#ffffff; display:flex; justify-content:space-between; margin-bottom:4px;">
                    <span>🛡️ 防衛力 (試練対策)</span>
                    <span style="color:#ffffff; font-size:15.5px;">${defTotal}</span>
                </div>
                <div style="font-size:12px; color:#a4b0be; line-height:1.4;">
                    本営基礎: 10 | 土地配置: +${defTiles} | ソケット: +${defSockets}
                </div>
            </div>

            <!-- ✨ 神秘 -->
            <div style="background:rgba(24, 34, 50, 0.75); border:1px solid #2c3e50; border-radius:8px; padding:10px 12px;">
                <div style="font-size:14.5px; font-weight:900; color:#ffffff; display:flex; justify-content:space-between; margin-bottom:4px;">
                    <span>✨ 神秘 (現在在庫: ${state.mystic})</span>
                    <span style="color:#2ecc71; font-size:15.5px;">+${mysticTotal} /T</span>
                </div>
                <div style="font-size:12px; color:#a4b0be; line-height:1.4;">
                    本営基礎: +1 | 土地配置: +${mysticTiles} | ソケット: +${mysticSockets} | 残り火自動付与: +${emberMystic}${emberStr}
                </div>
            </div>
        `;
        const rect = e.currentTarget.getBoundingClientRect();
        tt.style.position = "fixed";
        tt.style.top = `${rect.bottom + 8}px`;
        tt.style.right = `${window.innerWidth - rect.right}px`;
        tt.style.display = "block";
    }

    hideDataPanelTooltip() {
        if (typeof document === "undefined") return;
        const tt = document.getElementById("dataPanelTooltipHuge");
        if (tt) tt.style.display = "none";
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

