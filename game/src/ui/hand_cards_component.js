import { UILayoutConfig } from './layout_config.js';

/**
 * 🃏 HandCardsComponent (手札オファリング ＆ カードフレーム描画・操作専門コンポーネント)
 * 
 * 責務:
 * 1. 手札カード（3枚）のTCGフレーム描画
 * 2. カテゴリ判別アイコンピル (🌱/📜/⚔️/✨/👥) ＆ 格 (Prestige) スタイル適用
 * 3. 🖱️ D&D ドラッグ＆ドロップ ＆ 🚀 上フリック発動
 * 4. 🔄 右クリック / Rキーによる回転操作
 */
export class HandCardsComponent {
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
     * 🃏 手札カードコンテナのHTML要素を生成・構築
     * @param {Object} I18n 多言語辞書オブジェクト
     * @returns {HTMLElement} 手札カードコンテナ
     */
    render(I18n) {
        const handContainer = document.createElement("div");
        handContainer.className = "cards-hand-container";

        if (!this.state || !this.state.handOffering) return handContainer;

        this.state.handOffering.forEach((card, idx) => {
            if (!card) return;

            // 🔲 使用済み・空きスロット (保留カードのD&Dドロップ受け入れ対応)
            if (card.isBlank) {
                const blankEl = document.createElement("div");
                const hasReservedCard = (this.state.reserveSlots && this.state.reserveSlots[0] && !this.state.hasPickedThisTurn);
                blankEl.className = `card-frame-tcg card-slot-blank ${hasReservedCard ? 'can-receive-reserve' : 'locked'}`;

                const blankLabel = hasReservedCard ? (I18n ? I18n.t("UI_RESERVE_RETURN_LABEL") : "保留を戻す") : (I18n ? I18n.t("UI_CARD_USED_LABEL") : "使用済");

                blankEl.innerHTML = `
                    <div class="blank-slot-inner">
                        <div class="blank-slot-icon">${hasReservedCard ? "↩" : "✖"}</div>
                        <div class="blank-slot-text">${blankLabel}</div>
                    </div>
                `;

                // 🖱️ D&D ドロップ受け入れ（保留カード ➔ 手札空きスロット）
                blankEl.ondragover = (e) => {
                    if (this.state.hasPickedThisTurn) return;
                    if (!this.state.reserveSlots || !this.state.reserveSlots[0]) return;
                    e.preventDefault();
                    e.dataTransfer.dropEffect = "move";
                };
                blankEl.ondragenter = (e) => {
                    if (this.state.hasPickedThisTurn) return;
                    if (!this.state.reserveSlots || !this.state.reserveSlots[0]) return;
                    e.preventDefault();
                    blankEl.classList.add("blank-slot-drop-hover");
                };
                blankEl.ondragleave = () => {
                    blankEl.classList.remove("blank-slot-drop-hover");
                };
                blankEl.ondrop = (e) => {
                    if (this.state.hasPickedThisTurn) return;
                    e.preventDefault();
                    blankEl.classList.remove("blank-slot-drop-hover");
                    const data = e.dataTransfer.getData("text/plain");
                    if (data === "reserve_0" || (typeof data === "string" && data.startsWith("reserve_"))) {
                        const reserveIdx = data.startsWith("reserve_") ? parseInt(data.replace("reserve_", ""), 10) : 0;
                        this.ui.returnReserveCard(isNaN(reserveIdx) ? 0 : reserveIdx, idx);
                    }
                };

                // 👆 保留カード選択中に空きスロットをクリックして手札復帰
                blankEl.onclick = (e) => {
                    e.stopPropagation();
                    if (this.ui.selectedReserveIdx !== -1 && !this.state.hasPickedThisTurn) {
                        this.ui.returnReserveCard(this.ui.selectedReserveIdx, idx);
                    }
                };

                handContainer.appendChild(blankEl);
                return;
            }

            const isSelected = (this.ui.selectedCardIdx === idx && this.ui.selectedReserveIdx === -1);
            const isLocked = this.state.hasPickedThisTurn;
            const tObj = card.terrain || card;
            const category = tObj.category || "LAND";
            const rCode = tObj.rarity || "C";
            const rarityClass = `rarity-${rCode.toLowerCase()}`;
            const categoryClass = category !== "LAND" ? `category-${category.toLowerCase()}` : "";

            // 💰 発動コスト判定 (コマンドカード)
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
            cardEl.setAttribute("draggable", !isLocked ? "true" : "false");

            // 🖱️ D&D ドラッグ開始
            cardEl.ondragstart = (e) => {
                if (isLocked) {
                    e.preventDefault();
                    return;
                }
                e.dataTransfer.setData("text/plain", idx.toString());
                e.dataTransfer.setData("application/card-category", category);
                e.dataTransfer.effectAllowed = "move";
                cardEl.classList.add("card-dragging");
            };

            // 🚀 ドラッグ終了（上フリック発動検知）
            cardEl.ondragend = (e) => {
                cardEl.classList.remove("card-dragging");
                if (category !== "LAND" && !this.state.hasPickedThisTurn) {
                    const offeringEl = document.querySelector(".offering-section") || document.getElementById("cardRow");
                    if (offeringEl) {
                        const rect = offeringEl.getBoundingClientRect();
                        if (e.clientY < rect.top || e.clientX < rect.left || e.clientX > rect.right) {
                            this.ui.triggerCommandCardPlay(card, idx, -1);
                        }
                    }
                }
            };

            // 👆 クリック選択
            cardEl.onclick = (e) => {
                e.stopPropagation();
                if (this.ui && typeof this.ui.hideCardActionHintPopover === "function") {
                    this.ui.hideCardActionHintPopover();
                }
                this.ui.selectedReserveIdx = -1;
                this.ui.selectCard(idx);
            };

            // 🔄 右クリック回転 (土地カード)
            cardEl.oncontextmenu = (e) => {
                e.preventDefault();
                e.stopPropagation();
                if (category === "LAND") this.ui.rotateSelectedCard(e, idx);
            };

            // 🃏 ホバー時フローティング拡大プレビュー ＆ 操作ガイドポップアップ ＆ 未選択時盤面配置可能ガイド
            cardEl.addEventListener("mouseenter", () => {
                if (this.ui) {
                    if (typeof this.ui.updateFloatingPreview === "function") {
                        this.ui.updateFloatingPreview(cardEl);
                    }
                    if (typeof this.ui.showCardActionHintPopover === "function") {
                        this.ui.showCardActionHintPopover(cardEl, card);
                    }
                    if (this.ui.selectedCardIdx === -1 && this.ui.selectedReserveIdx === -1) {
                        if (category === "LAND" && typeof window !== "undefined" && window.BlockPlacementSystem) {
                            window.BlockPlacementSystem.highlightPlaceableCandidates(card, this.state);
                        }
                    }
                }
            });
            cardEl.addEventListener("mouseleave", () => {
                if (this.ui) {
                    if (typeof this.ui.hideFloatingPreviewIfNotSelected === "function") {
                        this.ui.hideFloatingPreviewIfNotSelected();
                    }
                    if (typeof this.ui.hideCardActionHintPopover === "function") {
                        this.ui.hideCardActionHintPopover();
                    }
                    if (this.ui.selectedCardIdx === -1 && this.ui.selectedReserveIdx === -1) {
                        if (typeof window !== "undefined" && window.BlockPlacementSystem) {
                            window.BlockPlacementSystem.clearAllPreviews();
                        }
                    }
                }
            });
            cardEl.addEventListener("dragstart", () => {
                if (this.ui) {
                    if (typeof this.ui.hideFloatingPreviewIfNotSelected === "function") {
                        this.ui.hideFloatingPreviewIfNotSelected();
                    }
                    if (typeof this.ui.hideCardActionHintPopover === "function") {
                        this.ui.hideCardActionHintPopover();
                    }
                }
            });

            const cName = tObj.nameKey ? I18n.t(tObj.nameKey) : (tObj.name || tObj.id || "Card");
            const cDesc = tObj.descriptionKey ? I18n.t(tObj.descriptionKey) : (tObj.description || "");

            // 🏷️ カテゴリ判別アイコン
            let catIcon = "🌱";
            let catTitle = I18n.t("TOOLTIP_CAT_LAND") || "土地";
            if (category === "ECONOMY" || category === "COMMAND") { catIcon = "📜"; catTitle = I18n.t("TOOLTIP_CAT_ECONOMY") || "経済・政策"; }
            else if (category === "MILITARY") { catIcon = "⚔️"; catTitle = I18n.t("TOOLTIP_CAT_MILITARY") || "軍事・防衛"; }
            else if (category === "MYSTIC") { catIcon = "✨"; catTitle = I18n.t("TOOLTIP_CAT_MYSTIC") || "神秘・奇跡"; }
            else if (category === "SOCIETY") { catIcon = "👥"; catTitle = I18n.t("TOOLTIP_CAT_SOCIETY") || "社会・士気"; }

            if (category !== "LAND") {
                // ⚡ コマンドカード (カード面自体のリッチテキストで完結・ツールチップ完全廃止)
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

                cardEl.setAttribute("data-full-card-html", fullInnerHtml);
                cardEl.innerHTML = fullInnerHtml;
            } else {
                // 🌱 土地カード
                const y = tObj.yields || { food: tObj.food || 0, wood: tObj.wood || 0, defense: tObj.def || tObj.defense || 0, mystic: tObj.mystic || 0 };
                const shapeMat = card.currentShape || tObj.shape || [[1]];
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

                cardEl.setAttribute("data-full-card-html", fullInnerHtml);
                cardEl.innerHTML = fullInnerHtml;
            }

            handContainer.appendChild(cardEl);
        });

        return handContainer;
    }
}
