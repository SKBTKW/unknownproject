/**
 * 🏰 HqComponent (本営・C3マス専用 UI & 演出統括コンポーネント)
 * 
 * 責務:
 * 1. 本営マス（C3）のセルDOM構築（夕暮れ城壁背景、篝火アニメーション、残り火数値バッジ）
 * 2. 残り火（🔥）の残量リアルタイム同期（白枠 ✕ 中オレンジ 20pt）
 * 3. 残り火増減フロートポップアップ演出（+X: 暖色オレンジ / -X: 寒色薄青 / 変動値に応じた拡大）
 * 4. 残り火詳細ステータスコンポーネント（EmberStatusComponent）との吸着バインド管理
 */
export class HqComponent {
    /**
     * @param {UIController} uiController - 親 UI コントローラー
     */
    constructor(uiController) {
        this.ui = uiController;
        this.hqElement = null;
        this.lastEmberValue = null;
    }

    get state() {
        return this.ui ? this.ui.state : null;
    }

    /**
     * 🏰 本営セル（C3マス）のDOM構造を初期化・描画
     * @param {HTMLElement} cellEl - 本営セルのDOM要素
     * @param {Object} state - GameState オブジェクト
     * @param {Object} I18n - 多言語辞書
     */
    renderCell(cellEl, state, I18n) {
        if (!cellEl) return;
        this.hqElement = cellEl;

        cellEl.id = "hqEmberCellAnchor";
        cellEl.classList.add("hq");

        const emberVal = (state && state.ember !== undefined) ? state.ember : 20;
        const terrainHqLabel = I18n ? I18n.t("TERRAIN_HQ") : "本営";

        cellEl.innerHTML = `
            <img src="assets/campfire_background.png" class="hq-bg-img" alt="${terrainHqLabel}" />
            <div class="hq-campfire-sprite"></div>
            <span id="hqEmberValBadge" class="hq-ember-val-badge">${emberVal}</span>
        `;

        // 🔥 残り火詳細ステータスコンポーネントの吸着バインド
        const emberComp = (this.ui && this.ui.emberStatusComponent) 
            ? this.ui.emberStatusComponent 
            : (typeof window !== "undefined" && window.uiController ? window.uiController.emberStatusComponent : null);

        if (emberComp && typeof emberComp.bindToAnchor === "function") {
            emberComp.bindToAnchor(cellEl);
            if (state) emberComp.update(state);
        }
    }

    /**
     * 🔥 本営マス右上の残り火数値をリアルタイム更新
     * @param {number} currentEmber - 現在の残り火数値
     */
    updateEmberValue(currentEmber) {
        const val = (currentEmber !== undefined && currentEmber !== null) ? currentEmber : 20;
        const badgeEl = document.getElementById("hqEmberValBadge") 
            || (this.hqElement ? this.hqElement.querySelector(".hq-ember-val-badge") : null);

        if (badgeEl) {
            badgeEl.innerText = val;
        }
    }

    /**
     * 🔥 残り火数値の変動差分を検知し、C3マスにフロートポップアップ演出を発火
     * @param {number} currentEmber - 現在の残り火数値
     */
    checkAndTriggerDeltaPopup(currentEmber) {
        if (currentEmber === undefined || currentEmber === null) return;
        if (this.lastEmberValue !== null && this.lastEmberValue !== currentEmber) {
            const delta = currentEmber - this.lastEmberValue;
            this.showDeltaPopup(delta);
        }
        this.lastEmberValue = currentEmber;
        this.updateEmberValue(currentEmber);
    }

    /**
     * 🌟 本営マス（C3）での残り火増減フロートポップアップ演出
     * +X: 暖色系（オレンジ ✕ 白枠、数値が大きいほど拡大）
     * -X: 寒色系（薄青 ✕ 白枠、数値が大きいほど拡大）
     * 
     * @param {number} delta - 残り火の増減差分 (+X または -X)
     */
    showDeltaPopup(delta) {
        if (!delta || typeof document === "undefined") return;
        const hqEl = this.hqElement || document.getElementById("hqEmberCellAnchor") || document.querySelector(".cell.hq");
        if (!hqEl) return;

        const absVal = Math.abs(delta);
        // 変動値が大きいほど文字サイズおよび白枠を拡大（基準20pt、最大42pt）
        const dynamicPt = Math.min(20 + (absVal - 1) * 3.5, 42);
        const dynamicStroke = Math.min(1.5 + (absVal - 1) * 0.25, 3.0);

        const popupEl = document.createElement("div");
        popupEl.className = `hq-ember-delta-popup ${delta > 0 ? "is-plus" : "is-minus"}`;
        popupEl.innerText = delta > 0 ? `+${delta}` : `${delta}`;
        popupEl.style.fontSize = `${dynamicPt}pt`;
        popupEl.style.webkitTextStroke = `${dynamicStroke}px #ffffff`;

        // 🎯 盤面再描画 (innerHTML = "") による即時破棄を防止するため、C3マスの座標を取得して document.body にマウント
        if (typeof hqEl.getBoundingClientRect === "function") {
            const rect = hqEl.getBoundingClientRect();
            if (rect && rect.width > 0 && rect.height > 0) {
                popupEl.style.position = "fixed";
                popupEl.style.left = `${rect.left + rect.width / 2}px`;
                popupEl.style.top = `${rect.top + rect.height * 0.35}px`;
                popupEl.style.zIndex = "999999";
                document.body.appendChild(popupEl);
            } else {
                hqEl.appendChild(popupEl);
            }
        } else {
            hqEl.appendChild(popupEl);
        }

        setTimeout(() => {
            if (popupEl.parentNode) {
                popupEl.parentNode.removeChild(popupEl);
            }
        }, 1500);
    }
}
