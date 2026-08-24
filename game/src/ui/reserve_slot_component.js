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

            const cName = tObj.nameKey ? I18n.t(tObj.nameKey) : (tObj.id || "Card");
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
            let catTitle = "土地";
            if (category === "ECONOMY" || category === "COMMAND") { catIcon = "📜"; catTitle = "経済・政策"; }
            else if (category === "MILITARY") { catIcon = "⚔️"; catTitle = "軍事・防衛"; }
            else if (category === "MYSTIC") { catIcon = "✨"; catTitle = "神秘・奇跡"; }
            else if (category === "SOCIETY") { catIcon = "👥"; catTitle = "社会・士気"; }

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

            if (category !== "LAND") {
                // ⚡ コマンドカード (通常手札と100%同一描画・バッジなし)
                rCardEl.setAttribute("data-tooltip-title", `📜 ${cName}`);
                rCardEl.setAttribute("data-tooltip", `コストを消費して効果を発動します<br>コスト: ${costBadgeText || "即時発動"}<br>効果: ${cDesc}`);

                rCardEl.innerHTML = `
                    <div class="tcg-card-top-bar" style="padding:4px 8px; display:flex; align-items:center; justify-content:space-between; gap:6px;">
                        <div class="tcg-category-icon-pill">${catIcon}</div>
                        <div class="tcg-title-pill" style="font-size:18px; font-weight:900; text-align:center; flex:1; letter-spacing:0.5px;">${cName}</div>
                    </div>
                    <div class="tcg-shape-art-area" style="display:flex; flex-direction:column; align-items:flex-start; justify-content:flex-start; background:#1c2536; padding:14px; text-align:left; overflow:hidden; flex:1; border-radius:6px; margin:4px 0;">
                        <div style="font-size:18px; color:#ffffff; line-height:1.45; font-weight:bold; text-align:left; width:100%;">${cDesc}</div>
                    </div>
                    <div class="tcg-yield-strip" style="font-size:16px; font-weight:bold; text-align:left; justify-content:flex-start; padding:8px 12px; width:100%; box-sizing:border-box;">
                        <span>${costBadgeText ? I18n.t("UI_CARD_COST_PREFIX", { cost: costBadgeText }) : I18n.t("UI_CMD_INSTANT_LABEL")}</span>
                    </div>
                `;
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
                    blockBg = "#f7d794"; blockBorder = "#f1c40f"; blockShadow = "rgba(247, 215, 148, 0.85)";
                } else if (tid.includes("PLAINS")) {
                    blockBg = "#1abc9c"; blockBorder = "#16a085"; blockShadow = "rgba(26, 188, 156, 0.85)";
                }

                let shapeHtml = `<div style="display:grid; grid-template-rows:repeat(${shapeMat.length}, 22px); grid-template-columns:repeat(${shapeMat[0].length}, 22px); gap:5px; background:rgba(0,0,0,0.55); padding:10px; border-radius:8px; border:2px solid rgba(255,255,255,0.18);">`;
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

                const yieldParts = [];
                const yieldPlainParts = [];
                if (totF > 0) { yieldParts.push(`<span>🌾${totF}</span>`); yieldPlainParts.push(`🌾${totF}`); }
                if (totW > 0) { yieldParts.push(`<span>🧱${totW}</span>`); yieldPlainParts.push(`🧱${totW}`); }
                if (totD > 0) { yieldParts.push(`<span>🛡️${totD}</span>`); yieldPlainParts.push(`🛡️${totD}`); }
                if (totM > 0) { yieldParts.push(`<span>✨${totM}</span>`); yieldPlainParts.push(`✨${totM}`); }
                const yieldContent = yieldParts.length > 0 ? yieldParts.join(" ") : `<span>-</span>`;
                const yieldPlainText = yieldPlainParts.length > 0 ? yieldPlainParts.join(" ") : "-";
                const yieldText = `<span style="font-size:16px; color:#ffffff; font-weight:bold; margin-right:6px;">産出:</span> <span style="font-size:20px; font-weight:900; letter-spacing:0.8px; color:#ffffff;">${yieldContent}</span>`;

                const placedCount = (this.state && this.state.placedBlockCount) || 0;
                let placementCost = 0;
                if (placedCount >= 31) placementCost = 3;
                else if (placedCount >= 16) placementCost = 2;
                else if (placedCount >= 6) placementCost = 1;
                const costText = placementCost > 0 ? `🔥-${placementCost}` : `🔥0 (無料)`;

                rCardEl.setAttribute("data-tooltip-title", `🌱 ${cName}`);
                rCardEl.setAttribute("data-tooltip", `ブロックを土地グリッド内に配置します<br>${costText}、産出: ${yieldPlainText}<br><strong style="color:#f1c40f;">[ Rキー ] で回転</strong>`);

                rCardEl.innerHTML = `
                    <div class="tcg-card-top-bar" style="padding:4px 8px; display:flex; align-items:center; justify-content:space-between; gap:6px;">
                        <div class="tcg-category-icon-pill">${catIcon}</div>
                        <div class="tcg-title-pill" style="font-size:18px; font-weight:900; text-align:center; flex:1; letter-spacing:0.5px;">${cName}</div>
                    </div>
                    <div class="tcg-shape-art-area" style="display:flex; align-items:center; justify-content:center; padding:12px; flex:1; background:#1c2536; border-radius:6px; margin:4px 0;">
                        ${shapeHtml}
                    </div>
                    <div class="tcg-yield-strip" style="padding:8px 10px; display:flex; align-items:center; justify-content:center;">
                        ${yieldText}
                    </div>
                `;
            }

            reserveContainer.appendChild(rCardEl);

            // 🚀 直上ポップオーバー・ダイアログ (カードの上に被らない上空展開)
            if (this.ui.isReservePopoverOpen) {
                const popoverEl = document.createElement("div");
                popoverEl.className = "reserve-popover-menu";

                const hasBlankSlot = this.state.handOffering && this.state.handOffering.some(c => c && c.isBlank);
                const returnDisabledAttr = !hasBlankSlot ? 'disabled style="opacity:0.45; cursor:not-allowed;"' : '';
                const returnTitle = !hasBlankSlot ? `title="${I18n.t("RESERVE_ACTION_RETURN_DISABLED")}"` : '';

                popoverEl.innerHTML = `
                    <div class="reserve-popover-cost-warn">${I18n.t("RESERVE_ACTION_COST_WARN")}</div>
                    <div class="reserve-popover-btn-group">
                        <button class="btn-reserve-action-play" onclick="event.stopPropagation(); window.ui.playReserveCard(0)">${I18n.t("RESERVE_ACTION_PLAY")}</button>
                        <button class="btn-reserve-action-return" ${returnDisabledAttr} ${returnTitle} onclick="event.stopPropagation(); window.ui.returnReserveCard(0)">${I18n.t("RESERVE_ACTION_RETURN")}</button>
                        <button class="btn-reserve-action-close" onclick="event.stopPropagation(); window.ui.closeReservePopover()">${I18n.t("RESERVE_ACTION_CLOSE")}</button>
                    </div>
                `;
                reserveContainer.appendChild(popoverEl);
            }
        } else {
            // 🔲 保留スロットが空の場合 (手札と100%同一の3段TCGカード規格フレームで描画)
            const emptySlotEl = document.createElement("div");
            const canDepositSelected = (this.ui.selectedCardIdx !== -1 && !this.state.hasPickedThisTurn);
            emptySlotEl.className = `reserve-slot-empty ${canDepositSelected ? 'reserve-slot-can-deposit' : ''}`;
            emptySlotEl.setAttribute("data-tooltip-title", "📦 保留スロット (HOLD)");
            emptySlotEl.setAttribute("data-tooltip", "手札カードを1枚キープできます<br>維持費: ターン終了時 🔥-1");
            
            const holdLabel = I18n.t("RESERVE_LABEL_HOLD") || "保留";
            const subText = canDepositSelected ? "手札を選択中: クリックで保留" : "手札を選択してクリック<br>またはドラッグでキープ";
            
            emptySlotEl.innerHTML = `
                <!-- 1. 上部タイトルバー (手札と完全同一フォーマット) -->
                <div class="tcg-card-top-bar" style="padding:4px 8px; display:flex; align-items:center; justify-content:space-between; gap:6px;">
                    <div class="tcg-category-icon-pill" style="background:#f39c12; color:#ffffff;">📦</div>
                    <div class="tcg-title-pill" style="font-size:18px; font-weight:900; text-align:center; flex:1; letter-spacing:0.5px; color:#2c3e50;">${holdLabel}スロット</div>
                </div>

                <!-- 2. 中央エリア (手札と同一背景・巨大アイコン・視認性抜群) -->
                <div class="tcg-shape-art-area" style="display:flex; flex-direction:column; align-items:center; justify-content:center; background:#1c2536; padding:14px; text-align:center; overflow:hidden; flex:1; border-radius:6px; margin:4px 0; border:2px dashed rgba(243, 156, 18, 0.45);">
                    <div style="font-size:46px; line-height:1; margin-bottom:10px; filter:drop-shadow(0 0 12px rgba(243,156,18,0.7));">📦</div>
                    <div style="font-size:22px; font-weight:900; color:#f39c12; letter-spacing:1.5px; margin-bottom:8px; text-shadow:0 0 10px rgba(243,156,18,0.5);">${holdLabel}枠 (空き)</div>
                    <div style="font-size:14px; color:#cbd5e1; font-weight:700; line-height:1.45;">${subText}</div>
                </div>

                <!-- 3. 下部ストリップ (手札と完全同一フォーマット) -->
                <div class="tcg-yield-strip" style="font-size:15px; font-weight:900; text-align:center; justify-content:center; padding:8px 10px; width:100%; box-sizing:border-box; color:#f87171; background:#1e293b; border-radius:4px;">
                    <span>維持費: ターン終了時 🔥-1</span>
                </div>
            `;

            // 👆 手札選択後に空スロットクリックで保留
            emptySlotEl.onclick = (e) => {
                e.stopPropagation();
                e.preventDefault();
                if (this.ui.selectedCardIdx !== -1 && !this.state.hasPickedThisTurn) {
                    this.ui.reserveCard(this.ui.selectedCardIdx);
                }
            };

            // 🖱️ D&D ドロップ受け入れ
            emptySlotEl.ondragover = (e) => {
                if (this.state.hasPickedThisTurn) return;
                e.preventDefault();
                e.dataTransfer.dropEffect = "move";
            };
            emptySlotEl.ondragenter = (e) => {
                if (this.state.hasPickedThisTurn) return;
                e.preventDefault();
                emptySlotEl.classList.add("reserve-slot-drop-hover");
            };
            emptySlotEl.ondragleave = () => {
                emptySlotEl.classList.remove("reserve-slot-drop-hover");
            };
            emptySlotEl.ondrop = (e) => {
                if (this.state.hasPickedThisTurn) return;
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
