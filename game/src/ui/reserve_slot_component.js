/**
 * 📦 ReserveSlotComponent (保留スロット ＆ HOLD カード操作専門コンポーネント)
 * 
 * 責務:
 * 1. 保留スロット（1枠固定）の描画
 * 2. 保留中カードのTCGフレーム描画 ＆ ↩手札復元ボタン
 * 3. 👆 カード選択後の空枠クリックによる保留登録
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
            // 🗃️ 保留カードが存在する場合
            const isReserveSelected = (this.ui.selectedReserveIdx === 0);
            const isLocked = this.state.hasPickedThisTurn;
            const tObj = reserveCard.terrain || reserveCard;
            const cName = tObj.nameKey ? I18n.t(tObj.nameKey) : (tObj.id || "Card");

            const y = tObj.yields || { food: tObj.food || 0, wood: tObj.wood || 0, defense: tObj.def || tObj.defense || 0, mystic: tObj.mystic || 0 };
            const shapeMat = reserveCard.currentShape || tObj.shape || [[1]];
            const tileCount = shapeMat.reduce((acc, row) => acc + row.reduce((a, b) => a + b, 0), 0);
            const totF = (y.food || 0) * tileCount;
            const totW = (y.wood || 0) * tileCount;
            const totD = (y.defense || 0) * tileCount;
            const totM = (y.mystic || 0) * tileCount;

            const yieldParts = [];
            if (totF > 0) yieldParts.push(`<span>🌾${totF}</span>`);
            if (totW > 0) yieldParts.push(`<span>🧱${totW}</span>`);
            if (totD > 0) yieldParts.push(`<span>🛡️${totD}</span>`);
            if (totM > 0) yieldParts.push(`<span>✨${totM}</span>`);
            const yieldContent = yieldParts.length > 0 ? yieldParts.join(" ") : `<span>-</span>`;

            const rCardEl = document.createElement("div");
            rCardEl.className = `card-frame-tcg reserve-card-hold ${isReserveSelected ? 'selected' : ''} ${isLocked ? 'locked' : ''}`;
            rCardEl.setAttribute("draggable", !isLocked ? "true" : "false");
            
            rCardEl.ondragstart = (e) => {
                if (isLocked) { e.preventDefault(); return; }
                e.dataTransfer.setData("text/plain", "reserve_0");
                e.dataTransfer.setData("application/card-category", reserveCard.category || (reserveCard.terrain ? reserveCard.terrain.category : "LAND") || "LAND");
                e.dataTransfer.effectAllowed = "move";
                rCardEl.classList.add("card-dragging");
            };
            rCardEl.ondragend = (e) => {
                rCardEl.classList.remove("card-dragging");
                const resCat = reserveCard.category || (reserveCard.terrain ? reserveCard.terrain.category : "LAND") || "LAND";
                if (resCat !== "LAND" && !this.state.hasPickedThisTurn) {
                    const offeringEl = document.querySelector(".offering-section") || document.getElementById("cardRow");
                    if (offeringEl) {
                        const rect = offeringEl.getBoundingClientRect();
                        if (e.clientY < rect.top || e.clientX < rect.left || e.clientX > rect.right) {
                            this.ui.triggerCommandCardPlay(reserveCard, -1, 0);
                        }
                    }
                }
            };
            rCardEl.title = "保管カード (クリックで直接盤面に配置)";
            rCardEl.onclick = (e) => {
                e.stopPropagation();
                this.ui.selectReserveCard(0);
            };
            rCardEl.oncontextmenu = (e) => {
                e.preventDefault();
                e.stopPropagation();
                this.ui.rotateReserveCard(e, 0);
            };

            const resCategory = reserveCard.category || (reserveCard.terrain ? reserveCard.terrain.category : "LAND") || "LAND";
            let resCatIcon = "🌱";
            let resCatTitle = "土地";
            if (resCategory === "ECONOMY" || resCategory === "COMMAND") { resCatIcon = "📜"; resCatTitle = "経済・政策"; }
            else if (resCategory === "MILITARY") { resCatIcon = "⚔️"; resCatTitle = "軍事・防衛"; }
            else if (resCategory === "MYSTIC") { resCatIcon = "✨"; resCatTitle = "神秘・奇跡"; }
            else if (resCategory === "SOCIETY") { resCatIcon = "👥"; resCatTitle = "社会・士気"; }

            rCardEl.innerHTML = `
                <div class="reserve-hold-badge">HOLD</div>
                <button class="btn-reserve-return-corner" title="手札へ戻す" onclick="event.stopPropagation(); window.ui.returnReserveCard(0)">↩</button>
                <div class="tcg-card-top-bar" style="padding:4px 8px; display:flex; align-items:center; justify-content:space-between; gap:6px;">
                    <div class="tcg-category-icon-pill" title="${resCatTitle}" style="background:rgba(243,156,18,0.25); border-color:#f39c12;">${resCatIcon}</div>
                    <div class="tcg-title-pill" style="font-size:19px; font-weight:900; text-align:center; flex:1; letter-spacing:0.5px; color:#f39c12; border-color:#f39c12;">${cName}</div>
                </div>
                <div class="tcg-shape-art-area" style="display:flex; align-items:center; justify-content:center; padding:12px; flex:1; background:#201a13; border-radius:6px; margin:4px 0;">
                    <div style="font-size:18px; font-weight:bold; color:#f39c12; letter-spacing:1px;">HOLD</div>
                </div>
                <div class="tcg-yield-strip" style="padding:8px 10px; display:flex; align-items:center; justify-content:center; color:#f39c12;">
                    <span style="font-size:16px; font-weight:900;">${yieldContent}</span>
                </div>
            `;
            reserveContainer.appendChild(rCardEl);
        } else {
            // 🔲 保留スロットが空の場合
            const emptySlotEl = document.createElement("div");
            const canDepositSelected = (this.ui.selectedCardIdx !== -1 && !this.state.hasPickedThisTurn);
            emptySlotEl.className = `reserve-slot-empty ${canDepositSelected ? 'reserve-slot-can-deposit' : ''}`;
            
            emptySlotEl.innerHTML = `
                <div class="reserve-slot-empty-label">HOLD</div>
                <div class="reserve-slot-empty-sub">${canDepositSelected ? 'クリックで保留' : 'D&D または<br>選択後にクリック'}</div>
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
