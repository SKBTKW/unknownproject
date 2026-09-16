import { UILayoutConfig } from './layout_config.js';

/**
 * 📦 ReserveSlotComponent (保留スロット ＆ HOLD カード操作専門コンポーネント)
 * 
 * 責務:
 * 1. 保留スロット外枠・ヘッダー（📦 保留スロット 維持費 🔥-1/T）の描画
 * 2. 保留中カードのTCGフレーム描画（バッジなし・通常手札と100%同一の純粋描画）
 * 3. 🚀 直上ポップオーバー・ダイアログ（カードをプレイ・保留解除・閉じる・維持コスト警告）
 * 4. 🖱️ D&D ドロップ受け入れによる保留登録
 */
export class ReserveSlotComponent {
    constructor(uiController) {
        this.ui = uiController;
    }

    get state() {
        return this.ui.state;
    }

    get engine() {
        return this.ui.engine;
    }

    /**
     * 📦 保留スロットコンテナのHTML要素を生成・構築
     * @param {Object} I18n 多言語辞書オブジェクト
     * @returns {HTMLElement} 保留スロットコンテナ
     */
    render(I18n) {
        const reserveContainer = document.createElement("div");
        reserveContainer.className = "reserve-slot-single-box";

        const reserveCard = (this.state && this.state.reserveSlots && this.state.reserveSlots.length > 0) ? this.state.reserveSlots[0] : null;

        if (reserveCard) {
            // 🗃️ 保留カードが存在する場合: 手札と完全に同一サイズのTCGフレームを描画 (バッジなし)
            const isReserveSelected = (this.ui.selectedReserveIdx === 0);
            const isLocked = this.state.hasPickedThisTurn;
            const tObj = reserveCard.terrain || reserveCard;
            const category = reserveCard.category || tObj.category || "LAND";
            const rCode = tObj.rarity || "C";
            const rarityClass = `rarity-${rCode.toLowerCase()}`;
            const categoryClass = category !== "LAND" ? `category-${category.toLowerCase()}` : "";

            const cName = tObj.nameKey ? I18n.t(tObj.nameKey) : (tObj.name || tObj.id || "Card");
            const cDesc = tObj.descriptionKey ? I18n.t(tObj.descriptionKey) : (tObj.description || "");

            // 💰 コマンドカード発動コスト判定
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

            // 🏷️ カテゴリ判別アイコン
            let catIcon = "🌱";
            let catTitle = I18n.t("TOOLTIP_CAT_LAND") || "土地";
            if (category === "ECONOMY" || category === "COMMAND") { catIcon = "📜"; catTitle = I18n.t("TOOLTIP_CAT_ECONOMY") || "経済・政策"; }
            else if (category === "MILITARY") { catIcon = "⚔️"; catTitle = I18n.t("TOOLTIP_CAT_MILITARY") || "軍事・防衛"; }
            else if (category === "MYSTIC") { catIcon = "✨"; catTitle = I18n.t("TOOLTIP_CAT_MYSTIC") || "神秘・奇跡"; }
            else if (category === "SOCIETY") { catIcon = "👥"; catTitle = I18n.t("TOOLTIP_CAT_SOCIETY") || "社会・士気"; }

            const rCardEl = document.createElement("div");
            rCardEl.className = `card-frame-tcg reserve-card-hold ${rarityClass} ${categoryClass} ${isReserveSelected ? 'selected' : ''} ${isLocked ? 'locked' : ''} ${!costMet ? 'cost-disabled' : ''}`;
            rCardEl.setAttribute("draggable", !isLocked ? "true" : "false");

            // 🖱️ D&D ドラッグ
            rCardEl.ondragstart = (e) => {
                if (isLocked) { e.preventDefault(); return; }
                e.dataTransfer.setData("text/plain", "reserve_0");
                e.dataTransfer.setData("application/card-category", category);
                e.dataTransfer.effectAllowed = "move";
                rCardEl.classList.add("card-dragging");
            };
            rCardEl.ondragend = (e) => {
                rCardEl.classList.remove("card-dragging");
                if (category !== "LAND" && !this.state.hasPickedThisTurn) {
                    const offeringEl = document.querySelector(".offering-section") || document.getElementById("cardRow");
                    if (offeringEl) {
                        const rect = offeringEl.getBoundingClientRect();
                        if (e.clientY < rect.top || e.clientX < rect.left || e.clientX > rect.right) {
                            this.ui.triggerCommandCardPlay(reserveCard, -1, 0);
                        }
                    }
                }
            };

            // 👆 クリック操作（直上ポップオーバーを開く）
            rCardEl.onclick = (e) => {
                e.stopPropagation();
                this.ui.toggleReservePopover(0);
            };

            // 🔄 右クリック回転（土地カード）
            rCardEl.oncontextmenu = (e) => {
                e.preventDefault();
                e.stopPropagation();
                if (category === "LAND") this.ui.rotateReserveCard(e, 0);
            };

            // 🃏 ホバー時フローティング拡大プレビュー ＆ 未選択時盤面配置可能ガイド
            rCardEl.addEventListener("mouseenter", () => {
                if (this.ui) {
                    if (typeof this.ui.updateFloatingPreview === "function") {
                        this.ui.updateFloatingPreview(rCardEl);
                    }
                    if (this.ui.selectedCardIdx === -1 && this.ui.selectedReserveIdx === -1) {
                        if (category === "LAND" && typeof window !== "undefined" && window.BlockPlacementSystem) {
                            window.BlockPlacementSystem.highlightPlaceableCandidates(reserveCard, this.state);
                        }
                    }
                }
            });
            rCardEl.addEventListener("mouseleave", () => {
                if (this.ui) {
                    if (typeof this.ui.hideFloatingPreviewIfNotSelected === "function") {
                        this.ui.hideFloatingPreviewIfNotSelected();
                    }
                    if (this.ui.selectedCardIdx === -1 && this.ui.selectedReserveIdx === -1) {
                        if (typeof window !== "undefined" && window.BlockPlacementSystem) {
                            window.BlockPlacementSystem.clearAllPreviews();
                        }
                    }
                }
            });
            rCardEl.addEventListener("dragstart", () => {
                if (this.ui && typeof this.ui.hideFloatingPreviewIfNotSelected === "function") {
                    this.ui.hideFloatingPreviewIfNotSelected();
                }
            });

            if (category !== "LAND") {
                // ⚡ コマンドカード (通常手札と100%同一描画・バッジなし・ツールチップ完全廃止)
                const fullInnerHtml = `
                    <div class="tcg-card-top-bar">
                        <div class="tcg-category-icon-pill">${catIcon}</div>
                        <div class="tcg-title-pill">${cName}</div>
                    </div>
                    <div class="tcg-shape-art-area">
                        <div class="tcg-minimal-cmd-icon">${catIcon}</div>
                        <div class="tcg-card-desc-full">${cDesc}</div>
                    </div>
                    <div class="tcg-yield-strip">
                        <span>${costBadgeText ? I18n.t("UI_CARD_COST_PREFIX", { cost: costBadgeText }) : I18n.t("UI_CMD_INSTANT_LABEL")}</span>
                    </div>
                    <div class="tcg-minimal-name-label">${cName}</div>
                `;

                rCardEl.setAttribute("data-full-card-html", fullInnerHtml);
                rCardEl.innerHTML = fullInnerHtml;
            } else {
                // 🌱 土地カード (通常手札と100%同一描画・バッジなし)
                const y = tObj.yields || { food: tObj.food || 0, wood: tObj.wood || 0, defense: tObj.def || tObj.defense || 0, mystic: tObj.mystic || 0 };
                const shapeMat = reserveCard.currentShape || tObj.shape || [[1]];
                const tileCount = shapeMat.reduce((acc, row) => acc + row.reduce((a, b) => a + b, 0), 0);
                const totF = (y.food || 0) * tileCount;
                const totW = (y.wood || 0) * tileCount;
                const totD = (y.defense || 0) * tileCount;
                const totM = (y.mystic || 0) * tileCount;

                const tid = tObj.terrainId || tObj.id || "";
                const blockTheme = UILayoutConfig.getBlockThemeColor(tid);
                const blockBg = blockTheme.bg;
                const blockBorder = blockTheme.border;
                const blockShadow = blockTheme.shadow;

                // 標準用 22px 形状 (インライン display:grid を全廃し CSS で制御)
                let shapeHtml = `<div class="tcg-shape-grid-standard" style="grid-template-rows:repeat(${shapeMat.length}, 22px); grid-template-columns:repeat(${shapeMat[0].length}, 22px); gap:5px; background:rgba(0,0,0,0.55); padding:10px; border-radius:8px; border:2px solid rgba(255,255,255,0.18);">`;
                for (let r = 0; r < shapeMat.length; r++) {
                    for (let c = 0; c < shapeMat[0].length; c++) {
                        if (shapeMat[r][c] === 1) {
                            shapeHtml += `<div style="width:22px;height:22px;background:${blockBg};border:2px solid ${blockBorder};border-radius:4px;box-shadow:0 0 8px ${blockShadow};"></div>`;
                        } else {
                            shapeHtml += `<div style="width:22px;height:22px;background:transparent;"></div>`;
                        }
                    }
                }
                shapeHtml += `</div>`;

                // ミニマル用 14px ミニ形状 (縦4マス・横4マス完全収容 ＆ 下部ラベル非干渉)
                let miniShapeHtml = `<div class="tcg-mini-shape-grid" style="grid-template-rows:repeat(${shapeMat.length}, 14px); grid-template-columns:repeat(${shapeMat[0].length}, 14px); gap:2.5px;">`;
                for (let r = 0; r < shapeMat.length; r++) {
                    for (let c = 0; c < shapeMat[0].length; c++) {
                        if (shapeMat[r][c] === 1) {
                            miniShapeHtml += `<div class="tcg-mini-shape-cell" style="background:${blockBg};border-color:${blockBorder};"></div>`;
                        } else {
                            miniShapeHtml += `<div style="width:14px;height:14px;background:transparent;"></div>`;
                        }
                    }
                }
                miniShapeHtml += `</div>`;

                const yieldParts = [];
                const yieldPlainParts = [];
                if (totF > 0) { yieldParts.push(`<span>🌾${totF}</span>`); yieldPlainParts.push(`🌾${totF}`); }
                if (totW > 0) { yieldParts.push(`<span>🧱${totW}</span>`); yieldPlainParts.push(`🧱${totW}`); }
                if (totD > 0) { yieldParts.push(`<span>🛡️${totD}</span>`); yieldPlainParts.push(`🛡️${totD}`); }
                if (totM > 0) { yieldParts.push(`<span>✨${totM}</span>`); yieldPlainParts.push(`✨${totM}`); }
                const yieldContent = yieldParts.length > 0 ? yieldParts.join(" ") : `<span>-</span>`;
                const yieldPlainText = yieldPlainParts.length > 0 ? yieldPlainParts.join(" ") : "-";
                const yieldLabel = I18n.t("UI_YIELD_LABEL") || "産出:";
                const yieldText = `<span style="font-size:15px; color:#ffffff; font-weight:bold; margin-right:4px; white-space:nowrap;">${yieldLabel}</span> <span style="font-size:17px; font-weight:900; letter-spacing:0.5px; color:#ffffff; white-space:nowrap; display:inline-flex; align-items:center; gap:5px;">${yieldContent}</span>`;

                const fullInnerHtml = `
                    <div class="tcg-card-top-bar">
                        <div class="tcg-category-icon-pill">${catIcon}</div>
                        <div class="tcg-title-pill">${cName}</div>
                    </div>
                    <div class="tcg-shape-art-area">
                        ${shapeHtml}
                        ${miniShapeHtml}
                    </div>
                    <div class="tcg-yield-strip">
                        ${yieldText}
                    </div>
                    <div class="tcg-minimal-name-label">${cName}</div>
                `;

                rCardEl.setAttribute("data-full-card-html", fullInnerHtml);
                rCardEl.innerHTML = fullInnerHtml;
            }

            reserveContainer.appendChild(rCardEl);

            // 🚀 直上ポップオーバー・ダイアログ (カードの上に被らない上空展開)
            if (this.ui.isReservePopoverOpen) {
                const popoverEl = document.createElement("div");
                popoverEl.className = "reserve-popover-menu";

                const hasBlankSlot = this.state.handOffering && this.state.handOffering.some(c => c && c.isBlank);
                const returnDisabledAttr = !hasBlankSlot ? 'disabled style="opacity:0.45; cursor:not-allowed;"' : '';
                const returnTitle = !hasBlankSlot ? `title="${I18n.t("RESERVE_ACTION_RETURN_DISABLED")}"` : '';

                const isDiscardDisabled = !!reserveCard.reservedThisTurn;
                const discardDisabledAttr = isDiscardDisabled ? 'disabled style="opacity:0.45; cursor:not-allowed;"' : '';
                const discardTitle = isDiscardDisabled ? `title="${I18n.t("RESERVE_ACTION_DISCARD_DISABLED")}"` : '';

                popoverEl.innerHTML = `
                    <div class="reserve-popover-cost-warn">${I18n.t("RESERVE_ACTION_COST_WARN")}</div>
                    <div class="reserve-popover-btn-group">
                        <button class="btn-reserve-action-play" onclick="event.stopPropagation(); window.ui.playReserveCard(0)">${I18n.t("RESERVE_ACTION_PLAY")}</button>
                        <button class="btn-reserve-action-return" ${returnDisabledAttr} ${returnTitle} onclick="event.stopPropagation(); window.ui.returnReserveCard(0)">${I18n.t("RESERVE_ACTION_RETURN")}</button>
                        <button class="btn-reserve-action-discard" ${discardDisabledAttr} ${discardTitle} onclick="event.stopPropagation(); window.ui.discardReserveCard(0)">${I18n.t("RESERVE_ACTION_DISCARD")}</button>
                        <button class="btn-reserve-action-close" onclick="event.stopPropagation(); window.ui.closeReservePopover()">${I18n.t("RESERVE_ACTION_CLOSE")}</button>
                    </div>
                `;
                reserveContainer.appendChild(popoverEl);
            }
        } else {
            // 🔲 保留スロットが空の場合 (手札と100%同一の3段TCGカード規格フレームで描画)
            const emptySlotEl = document.createElement("div");
            const isDepositLimitReached = !!this.state.hasReservedThisTurn;
            const canDepositSelected = (this.ui.selectedCardIdx !== -1 && !this.state.hasPickedThisTurn && !isDepositLimitReached);
            emptySlotEl.className = `reserve-slot-empty ${canDepositSelected ? 'reserve-slot-can-deposit' : ''} ${isDepositLimitReached ? 'reserve-slot-limit-reached' : ''}`;
            if (!this.ui.isMinimalMode) {
                emptySlotEl.setAttribute("data-tooltip-title", I18n.t("UI_RESERVE_SLOT_EMPTY_TOOLTIP_TITLE") || "📦 保留スロット (HOLD)");
                const tooltipDesc = isDepositLimitReached
                    ? (I18n.t("RESERVE_SLOT_DEPOSIT_LIMIT") || "⚠️ 保留への移動は1ターン1回のみ可能です")
                    : (I18n.t("UI_RESERVE_SLOT_EMPTY_TOOLTIP_DESC") || "手札カードを1枚キープできます<br>維持費: ターン終了時 🔥-1");
                emptySlotEl.setAttribute("data-tooltip", tooltipDesc);
            }
            
            const holdLabel = I18n.t("RESERVE_LABEL_HOLD") || "保留";
            const holdSlotTitle = I18n.t("RESERVE_SLOT_TITLE") || "保留スロット";
            const emptyBoxLabel = I18n.t("RESERVE_EMPTY_BOX_LABEL") || "保留枠 (空き)";
            const subText = canDepositSelected ? (I18n.t("RESERVE_EMPTY_SUB_SELECTED") || "手札を選択中: クリックで保留") : (I18n.t("RESERVE_EMPTY_SUB_DEFAULT") || "手札を選択してクリック<br>またはドラッグでキープ");
            const upkeepCostLabel = I18n.t("RESERVE_UPKEEP_COST_LABEL") || "維持費: ターン終了時 🔥-1";
            
            const fullEmptyHtml = `
                <!-- 1. 上部タイトルバー (手札と完全同一フォーマット) -->
                <div class="tcg-card-top-bar">
                    <div class="tcg-category-icon-pill" style="background:#f39c12; color:#ffffff;">📦</div>
                    <div class="tcg-title-pill" style="font-size:18px; font-weight:900; text-align:center; flex:1; letter-spacing:0.5px; color:#ffffff;">${holdSlotTitle}</div>
                </div>

                <!-- 2. 中央エリア (手札と同一背景・巨大アイコン・視認性抜群) -->
                <div class="tcg-shape-art-area">
                    <div class="tcg-minimal-cmd-icon">📦</div>
                    <div class="tcg-card-desc-full">
                        <div class="reserve-empty-large-icon">📦</div>
                        <div class="reserve-empty-title-text">${emptyBoxLabel}</div>
                        <div class="reserve-empty-sub-text">${subText}</div>
                    </div>
                </div>

                <!-- 3. 下部ストリップ (手札と完全同一フォーマット) -->
                <div class="tcg-yield-strip">
                    <span>${upkeepCostLabel}</span>
                </div>
                <div class="tcg-minimal-name-label">${holdLabel}</div>
            `;

            emptySlotEl.setAttribute("data-full-card-html", fullEmptyHtml);
            emptySlotEl.innerHTML = fullEmptyHtml;

            // 🃏 空保留枠ホバー時フローティング拡大プレビュー (ミニマルモード連動 ＆ 選択中常時表示対応)
            emptySlotEl.addEventListener("mouseenter", () => {
                if (this.ui && typeof this.ui.updateFloatingPreview === "function") {
                    this.ui.updateFloatingPreview(emptySlotEl);
                }
            });

            emptySlotEl.addEventListener("mouseleave", () => {
                if (this.ui && typeof this.ui.hideFloatingPreviewIfNotSelected === "function") {
                    this.ui.hideFloatingPreviewIfNotSelected();
                }
            });

            // 👆 手札選択後に空スロットクリックで保留 (1ターン1回制限)
            emptySlotEl.onclick = (e) => {
                e.stopPropagation();
                e.preventDefault();
                if (this.ui.selectedCardIdx !== -1 && !this.state.hasPickedThisTurn && !this.state.hasReservedThisTurn) {
                    this.ui.reserveCard(this.ui.selectedCardIdx);
                }
            };

            // 🖱️ D&D ドロップ受け入れ (1ターン1回制限)
            emptySlotEl.ondragover = (e) => {
                if (this.state.hasPickedThisTurn || this.state.hasReservedThisTurn) return;
                e.preventDefault();
                e.dataTransfer.dropEffect = "move";
            };
            emptySlotEl.ondragenter = (e) => {
                if (this.state.hasPickedThisTurn || this.state.hasReservedThisTurn) return;
                e.preventDefault();
                emptySlotEl.classList.add("reserve-slot-drop-hover");
            };
            emptySlotEl.ondragleave = () => {
                emptySlotEl.classList.remove("reserve-slot-drop-hover");
            };
            emptySlotEl.ondrop = (e) => {
                if (this.state.hasPickedThisTurn || this.state.hasReservedThisTurn) return;
                e.preventDefault();
                emptySlotEl.classList.remove("reserve-slot-drop-hover");
                const data = e.dataTransfer.getData("text/plain");
                const droppedIdx = parseInt(data, 10);
                if (!isNaN(droppedIdx) && droppedIdx >= 0 && droppedIdx < this.state.handOffering.length) {
                    this.ui.reserveCard(droppedIdx);
                }
            };

            reserveContainer.appendChild(emptySlotEl);
        }

        return reserveContainer;
    }
}
