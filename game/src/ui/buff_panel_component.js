/* =============================================================
   game/src/ui/buff_panel_component.js
   盤面直上 上方向トグル展開型バフ表示 カプセル化UIコンポーネント
   ============================================================= */

(function(exports) {
    /**
     * ✨ BuffPanelComponent
     * 土地盤面直上の1行サマリーバー ＆ 上方向トグル縦積み展開バフ表示モジュール
     */
    const BUFF_FEATURE_FLAGS = {
        enableEmberBuff: false,    // 🔥 残り火旺盛・標準バフ (false で一旦停止)
        enableCardBuff: true,      // 📜 カード期限バフ (true で有効)
        enableTrialBuff: true      // ⚔️ 試練期限バフ (true で有効)
    };
    if (typeof window !== "undefined") {
        window.BUFF_FEATURE_FLAGS = BUFF_FEATURE_FLAGS;
    }
    if (typeof globalThis !== "undefined") {
        globalThis.BUFF_FEATURE_FLAGS = BUFF_FEATURE_FLAGS;
    }

    class BuffPanelComponent {
        constructor() {
            this.containerEl = null;
            this.masterEl = null;
            this.summaryBarEl = null;
            this.dropupPanelEl = null;
            this.stackListEl = null;
            this.arrowEl = null;
            this.isOpen = false;
            this.sortMode = "ACQUIRED"; // ACQUIRED (新➔古) | CATEGORY
            this.activeBuffs = [];
        }

        /**
         * 🏗️ UIの初期構築 (レイアウトの位置シフトを発生させない絶対配置構造)
         */
        mount(containerEl) {
            if (!containerEl) return;
            this.containerEl = containerEl;
            this.containerEl.innerHTML = "";

            this.masterEl = document.createElement("div");
            this.masterEl.className = "buff-display-master-container";
            this.masterEl.style.display = "none"; // 初期は0個非表示

            // ⬆️ 上方向トグル展開パネル (Dropup Panel)
            this.dropupPanelEl = document.createElement("div");
            this.dropupPanelEl.className = "buff-dropup-panel";
            this.dropupPanelEl.style.display = "none";

            this.dropupPanelEl.innerHTML = `
                <div class="buff-dropup-header">
                    <span id="buffDropupTitleText">✨ 発動中のバフ一覧</span>
                    <div style="display:flex; align-items:center; gap:8px;">
                        <button class="sort-select-btn" id="btnBuffSortToggle">並び替え: 獲得順 🔄</button>
                        <span style="cursor:pointer; font-size:16px;" id="btnCloseBuffDropup">✕</span>
                    </div>
                </div>
                <div class="buff-stack-list" id="buffStackList"></div>
            `;

            // 1行サマリーバー
            this.summaryBarEl = document.createElement("div");
            this.summaryBarEl.className = "buff-summary-bar";
            this.summaryBarEl.onclick = (e) => this.toggle(e);

            this.summaryBarEl.innerHTML = `
                <div class="buff-summary-left">
                    <span id="buffSummaryCountText">✨ 発動中のバフ (0)</span>
                    <div class="buff-pills-preview" id="buffPillsPreview"></div>
                </div>
                <span class="buff-toggle-arrow" id="buffToggleArrow">△</span>
            `;

            this.masterEl.appendChild(this.dropupPanelEl);
            this.masterEl.appendChild(this.summaryBarEl);
            this.containerEl.appendChild(this.masterEl);

            this.arrowEl = this.summaryBarEl.querySelector("#buffToggleArrow");
            this.stackListEl = this.dropupPanelEl.querySelector("#buffStackList");

            const closeBtn = this.dropupPanelEl.querySelector("#btnCloseBuffDropup");
            if (closeBtn) closeBtn.onclick = (e) => this.toggle(e);

            const sortBtn = this.dropupPanelEl.querySelector("#btnBuffSortToggle");
            if (sortBtn) sortBtn.onclick = (e) => this.toggleSortMode(e);
        }

        /**
         * 🔄 バフ状態の更新・レンダリング (0個時は自動隠蔽)
         */
        update(buffList = []) {
            this.activeBuffs = buffList || [];
            if (!this.masterEl) return;

            if (this.activeBuffs.length === 0) {
                this.masterEl.style.display = "none";
                if (this.dropupPanelEl) this.dropupPanelEl.style.display = "none";
                this.isOpen = false;
                return;
            }

            // 1個以上存在する場合は表示
            this.masterEl.style.display = "block";

            // 1行サマリーバーの更新
            const countText = this.summaryBarEl.querySelector("#buffSummaryCountText");
            if (countText) countText.innerText = `✨ 発動中のバフ (${this.activeBuffs.length})`;

            const pillsPreview = this.summaryBarEl.querySelector("#buffPillsPreview");
            if (pillsPreview) {
                pillsPreview.innerHTML = this.activeBuffs.slice(0, 3).map(b => `
                    <span class="buff-pill-mini">${b.icon || "✨"} ${b.shortName || b.name}</span>
                `).join("");
            }

            // 上展開詳細パネルの更新
            this.renderDropupList();
        }

        /**
         * 📜 上方向展開パネル内の全バフ縦積みレンダリング (ユーザー様指定: 新しい＝上, 古い＝下)
         */
        renderDropupList() {
            if (!this.stackListEl) return;

            let displayList = [...this.activeBuffs];
            if (this.sortMode === "CATEGORY") {
                displayList.sort((a, b) => (a.category || "").localeCompare(b.category || ""));
            } else {
                // ACQUIRED: 新しいのが上、古いのが下
                displayList.reverse();
            }

            this.stackListEl.innerHTML = displayList.map(buff => `
                <div class="buff-card-item">
                    <div class="buff-card-left">
                        <span class="buff-card-icon">${buff.icon || "✨"}</span>
                        <div>
                            <div class="buff-card-title">${buff.name}</div>
                            <div class="buff-card-desc">${buff.description || ""}</div>
                        </div>
                    </div>
                    <span class="buff-card-badge">${buff.badgeText || "パッシブ"}</span>
                </div>
            `).join("");
        }

        /**
         * 🔄 ソートモード切替
         */
        toggleSortMode(e) {
            if (e) e.stopPropagation();
            this.sortMode = (this.sortMode === "ACQUIRED") ? "CATEGORY" : "ACQUIRED";
            const sortBtn = this.dropupPanelEl.querySelector("#btnBuffSortToggle");
            if (sortBtn) {
                sortBtn.innerText = `並び替え: ${this.sortMode === "ACQUIRED" ? "獲得順 (新➔古)" : "カテゴリ順"} 🔄`;
            }
            this.renderDropupList();
        }

        /**
         * ↕️ 上方向トグル開閉制御
         */
        toggle(e) {
            if (e) e.stopPropagation();
            if (!this.dropupPanelEl || this.activeBuffs.length === 0) return;

            this.isOpen = !this.isOpen;
            this.dropupPanelEl.style.display = this.isOpen ? "flex" : "none";
            if (this.arrowEl) {
                this.arrowEl.innerText = this.isOpen ? "▽" : "△";
            }
        }
    }

    const instance = new BuffPanelComponent();
    if (typeof window !== "undefined") {
        window.BuffPanelComponent = instance;
    }
    if (typeof globalThis !== "undefined") {
        globalThis.BuffPanelComponent = instance;
    }
})(typeof exports !== "undefined" ? exports : (typeof window !== "undefined" ? window : (typeof globalThis !== "undefined" ? globalThis : {})));

const BuffPanelComponent = (typeof globalThis !== "undefined" && globalThis.BuffPanelComponent) ? globalThis.BuffPanelComponent : null;
export { BuffPanelComponent };
export default BuffPanelComponent;



