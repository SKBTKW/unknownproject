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

            // 🔲 使用済み・空きスロット
            if (card.isBlank) {
                const blankEl = document.createElement("div");
                blankEl.className = "card-frame-tcg locked";
                blankEl.style.cssText = "background:#11141d; border:2px dashed #7f8c8d; border-radius:10px; display:flex; flex-direction:column; align-items:center; justify-content:center;";
                blankEl.innerHTML = `<div style="font-size:28px; color:#e74c3c; font-weight:bold;">✖</div>`;
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
                this.ui.selectedReserveIdx = -1;
                this.ui.selectCard(idx);
            };

            // 🔄 右クリック回転 (土地カード)
            cardEl.oncontextmenu = (e) => {
                e.preventDefault();
                e.stopPropagation();
                if (category === "LAND") this.ui.rotateSelectedCard(e, idx);
            };

            const cName = tObj.nameKey ? I18n.t(tObj.nameKey) : (tObj.id || "Card");
            const cDesc = tObj.descriptionKey ? I18n.t(tObj.descriptionKey) : (tObj.description || "");

            // 🏷️ カテゴリ判別アイコン
            let catIcon = "🌱";
            let catTitle = "土地";
            if (category === "ECONOMY" || category === "COMMAND") { catIcon = "📜"; catTitle = "経済・政策"; }
            else if (category === "MILITARY") { catIcon = "⚔️"; catTitle = "軍事・防衛"; }
            else if (category === "MYSTIC") { catIcon = "✨"; catTitle = "神秘・奇跡"; }
            else if (category === "SOCIETY") { catIcon = "👥"; catTitle = "社会・士気"; }

            if (category !== "LAND") {
                // ⚡ コマンドカード
                cardEl.innerHTML = `
                    <div class="tcg-card-top-bar" style="padding:4px 8px; display:flex; align-items:center; justify-content:space-between; gap:6px;">
                        <div class="tcg-category-icon-pill" title="${catTitle}">${catIcon}</div>
                        <div class="tcg-title-pill" style="font-size:19px; font-weight:900; text-align:center; flex:1; letter-spacing:0.5px;">${cName}</div>
                    </div>
                    <div class="tcg-shape-art-area" style="display:flex; flex-direction:column; align-items:flex-start; justify-content:flex-start; background:#1c2536; padding:14px; text-align:left; overflow:hidden; flex:1; border-radius:6px; margin:4px 0;">
                        <div style="font-size:17.5px; color:#ffffff; line-height:1.45; font-weight:bold; text-align:left; width:100%;">${cDesc}</div>
                    </div>
                    <div class="tcg-yield-strip" style="font-size:16px; font-weight:bold; text-align:left; justify-content:flex-start; padding:8px 12px; width:100%; box-sizing:border-box;">
                        <span>${costBadgeText ? I18n.t("UI_CARD_COST_PREFIX", { cost: costBadgeText }) : I18n.t("UI_CMD_INSTANT_LABEL")}</span>
                    </div>
                `;
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

                const yieldParts = [];
                if (totF > 0) yieldParts.push(`<span>🌾${totF}</span>`);
                if (totW > 0) yieldParts.push(`<span>🧱${totW}</span>`);
                if (totD > 0) yieldParts.push(`<span>🛡️${totD}</span>`);
                if (totM > 0) yieldParts.push(`<span>✨${totM}</span>`);
                const yieldContent = yieldParts.length > 0 ? yieldParts.join(" ") : `<span>-</span>`;
                const yieldText = `<span style="font-size:16px; color:#ffffff; font-weight:bold; margin-right:6px;">産出:</span> <span style="font-size:19.5px; font-weight:900; letter-spacing:0.8px; color:#ffffff;">${yieldContent}</span>`;

                cardEl.innerHTML = `
                    <div class="tcg-card-top-bar" style="padding:4px 8px; display:flex; align-items:center; justify-content:space-between; gap:6px;">
                        <div class="tcg-category-icon-pill" title="${catTitle}">${catIcon}</div>
                        <div class="tcg-title-pill" style="font-size:19px; font-weight:900; text-align:center; flex:1; letter-spacing:0.5px;">${cName}</div>
                    </div>
                    <div class="tcg-shape-art-area" style="display:flex; align-items:center; justify-content:center; padding:12px; flex:1; background:#1c2536; border-radius:6px; margin:4px 0;">
                        ${shapeHtml}
                    </div>
                    <div class="tcg-yield-strip" style="padding:8px 10px; display:flex; align-items:center; justify-content:center;">
                        ${yieldText}
                    </div>
                `;
            }

            handContainer.appendChild(cardEl);
        });

        return handContainer;
    }
}
