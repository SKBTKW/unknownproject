/**
 * 🌐 TooltipSystem (グローバル・軽量リッチツールチップ統括モジュール)
 * 
 * 責務:
 * 1. 画面全体の全要素 ([data-tooltip]) に対するイベント委譲 (Event Delegation) 監視
 * 2. 単一のDOM要素 (#globalTooltip) を使い回すゼロオーバーヘッド・シングルトン構造
 * 3. GPUハードウェアアクセラレーション (transform: translate3d) による 120fps 滑らか追従
 * 4. 画面端 (右端・上端) はみ出しの自動検知 ＆ スマート位置反転
 * 5. 多言語辞書 (i18n.js) のキー自動解決
 * 6. カード大型プレビューモーダル表示時の自動スリープ
 */
export class TooltipSystem {
    constructor() {
        this.tooltipEl = null;
        this.currentTarget = null;
        this.I18n = null;
        this.isEnabled = true;
        this._onMouseOver = this._handleMouseOver.bind(this);
        this._onMouseOut = this._handleMouseOut.bind(this);
        this._onMouseMove = this._handleMouseMove.bind(this);
        this._onClick = this._handleClick.bind(this);
    }

    /**
     * 🚀 システムの初期化 ＆ グローバルリスナー登録
     * @param {Object} I18n 多言語辞書オブジェクト
     */
    init(I18n) {
        this.I18n = I18n;
        if (typeof document === "undefined") return;

        // 既存の要素があれば再利用、なければ単一DOMを生成
        this.tooltipEl = document.getElementById("globalTooltip");
        if (!this.tooltipEl) {
            this.tooltipEl = document.createElement("div");
            this.tooltipEl.id = "globalTooltip";
            this.tooltipEl.className = "global-rich-tooltip";
            this.tooltipEl.style.display = "none";
            document.body.appendChild(this.tooltipEl);
        }

        // 🌐 たった1つのグローバルイベントリスナーで画面全体を統括
        document.removeEventListener("mouseover", this._onMouseOver, true);
        document.removeEventListener("mouseout", this._onMouseOut, true);
        document.removeEventListener("mousemove", this._onMouseMove, true);
        document.removeEventListener("click", this._onClick, true);
        document.removeEventListener("dragstart", this._onClick, true);
        document.removeEventListener("scroll", this._onClick, true);

        document.addEventListener("mouseover", this._onMouseOver, true);
        document.addEventListener("mouseout", this._onMouseOut, true);
        document.addEventListener("mousemove", this._onMouseMove, true);
        document.addEventListener("click", this._onClick, true);
        document.addEventListener("dragstart", this._onClick, true);
        document.addEventListener("scroll", this._onClick, true);

        if (typeof window !== "undefined") {
            window.removeEventListener("blur", this._onClick);
            window.addEventListener("blur", this._onClick);
        }
    }

    _handleClick(e) {
        // ボタンクリックやタップ時はツールチップを即時非表示にする
        this.hide();
    }

    _handleMouseOver(e) {
        if (!this.isEnabled) return;
        if (!e.target || typeof e.target.closest !== "function") return;

        const target = e.target.closest("[data-tooltip]");
        if (!target) return;

        // 🃏 手札ミニマル表示時: カード本体や保留枠のツールチップはオフにするが、操作ボタン類（縮小切替・マリガン・保留アクション等）は許可
        const isMinimalMode = (typeof window !== "undefined" && window.ui && window.ui.isMinimalMode) ||
                              (typeof document !== "undefined" && (
                                  document.body.classList.contains("is-minimal") ||
                                  !!document.querySelector("#cardRow.is-minimal, .offering-section.is-minimal")
                              ));

        if (isMinimalMode) {
            const isCardOrSlot = target.closest(".card-frame-tcg, .card-unified, .reserve-slot-single-box, .cards-hand-container");
            const isButtonOrControl = target.closest("button, .btn-minimal-toggle, .btn-minimal-mulligan, .reserve-header-badge, .btn-reserve-action-play, .btn-reserve-action-return");
            if (isCardOrSlot && !isButtonOrControl) {
                this.hide();
                return;
            }
        }

        // カード大型プレビュー表示中はUIツールチップを抑制
        const previewModal = document.getElementById("cardHoverPreviewModal");
        if (previewModal && previewModal.classList.contains("active")) {
            this.hide();
            return;
        }

        this.currentTarget = target;
        this.show(target, e);
    }

    _handleMouseOut(e) {
        if (!this.currentTarget) return;
        if (!document.body.contains(this.currentTarget)) {
            this.hide();
            return;
        }
        if (e.target && typeof e.target.closest === "function") {
            const target = e.target.closest("[data-tooltip]");
            if (target === this.currentTarget) {
                // 関連ターゲットがまだ自身の中にあるかチェック
                if (e.relatedTarget && this.currentTarget.contains(e.relatedTarget)) {
                    return;
                }
                this.hide();
            }
        } else {
            this.hide();
        }
    }

    _handleMouseMove(e) {
        if (!this.currentTarget || !this.tooltipEl || this.tooltipEl.style.display === "none") return;
        // DOM再描画などで対象要素が消滅していた場合は即座に非表示
        if (!document.body.contains(this.currentTarget)) {
            this.hide();
            return;
        }
        this._updatePosition(e.clientX, e.clientY);
    }

    /**
     * 💡 ツールチップの表示
     */
    show(target, e) {
        if (!this.tooltipEl) return;

        const tooltipKeyOrText = target.getAttribute("data-tooltip");
        if (!tooltipKeyOrText) return;

        const titleKeyOrText = target.getAttribute("data-tooltip-title");

        let isDataPanelBreakdown = (tooltipKeyOrText === "DATA_PANEL_BREAKDOWN");

        // 🌐 多言語解決
        let descText = tooltipKeyOrText;
        if (isDataPanelBreakdown) {
            const state = (this.stateProvider && typeof this.stateProvider === 'function') 
                ? this.stateProvider() 
                : (this.state || (typeof window !== 'undefined' && window.ui ? window.ui.state : null) || (typeof window !== 'undefined' && window.gameEngine ? window.gameEngine.state : null));
            descText = this.renderDataPanelBreakdown(state);
            this.tooltipEl.classList.add("tooltip-data-panel-breakdown");
        } else {
            this.tooltipEl.classList.remove("tooltip-data-panel-breakdown");
            if (this.I18n && typeof this.I18n.t === "function") {
                const translated = this.I18n.t(tooltipKeyOrText);
                if (translated && translated !== tooltipKeyOrText) {
                    descText = translated;
                }
            }
        }

        let titleHtml = "";
        if (titleKeyOrText) {
            let titleText = titleKeyOrText;
            if (this.I18n && typeof this.I18n.t === "function") {
                const translatedTitle = this.I18n.t(titleKeyOrText);
                if (translatedTitle && translatedTitle !== titleKeyOrText) {
                    titleText = translatedTitle;
                }
            }
            titleHtml = `<div class="global-tooltip-title">${titleText}</div>`;
        }

        this.tooltipEl.innerHTML = `
            ${titleHtml}
            <div class="global-tooltip-desc">${descText}</div>
        `;

        this.tooltipEl.style.display = "block";
        this.tooltipEl.classList.add("visible");

        if (isDataPanelBreakdown) {
            // 📊 ヘッダーデータパネル直下に右揃えでエレガントに吸着
            const rect = target.getBoundingClientRect();
            const ttWidth = this.tooltipEl.offsetWidth || 400;
            const winWidth = (typeof window !== "undefined") ? window.innerWidth : 1920;
            const targetX = Math.max(16, Math.min(winWidth - ttWidth - 16, rect.right - ttWidth));
            const targetY = rect.bottom + 10;
            this.tooltipEl.style.transform = `translate3d(${targetX}px, ${targetY}px, 0)`;
        } else if (e) {
            this._updatePosition(e.clientX, e.clientY);
        }
    }

    /**
     * 📍 GPUハードウェアアクセラレーションによる位置更新 ＆ はみ出し自動反転
     */
    _updatePosition(mouseX, mouseY) {
        if (!this.tooltipEl) return;

        const offset = 16;
        let x = mouseX + offset;
        let y = mouseY + offset;

        const ttWidth = this.tooltipEl.offsetWidth || 260;
        const ttHeight = this.tooltipEl.offsetHeight || 60;
        const winWidth = (typeof window !== "undefined") ? window.innerWidth : 1920;
        const winHeight = (typeof window !== "undefined") ? window.innerHeight : 1080;

        // 右端はみ出し防止 ➔ 左側に反転
        if (x + ttWidth > winWidth - 12) {
            x = mouseX - ttWidth - offset;
        }
        if (x < 10) x = 10;

        // 下端はみ出し防止 ➔ 上側に反転
        if (y + ttHeight > winHeight - 12) {
            y = mouseY - ttHeight - offset;
        }
        if (y < 10) y = 10;

        this.tooltipEl.style.transform = `translate3d(${Math.round(x)}px, ${Math.round(y)}px, 0)`;
    }

    /**
     * 🎯 カスタム座標・HTMLによる直接ツールチップ表示
     */
    showCustom(mouseX, mouseY, titleText, descHtml) {
        if (!this.tooltipEl) return;

        let titleHtml = "";
        if (titleText) {
            titleHtml = `<div class="global-tooltip-title">${titleText}</div>`;
        }

        this.tooltipEl.innerHTML = `
            ${titleHtml}
            <div class="global-tooltip-desc">${descHtml}</div>
        `;

        this.tooltipEl.style.display = "block";
        this.tooltipEl.classList.add("visible");
        this._updatePosition(mouseX, mouseY);
    }

    /**
     * 🙈 ツールチップの非表示
     */
    hide() {
        if (!this.tooltipEl) return;
        this.currentTarget = null;
        this.tooltipEl.style.display = "none";
        this.tooltipEl.classList.remove("visible");
        this.tooltipEl.classList.remove("tooltip-data-panel-breakdown");
    }

    /**
     * 📊 ヘッダー各種データパネル（食料・資材・防衛・神秘）のリアルタイム詳細内訳HTMLを生成
     * @param {Object} state 
     * @returns {string}
     */
    renderDataPanelBreakdown(state) {
        if (!state) return "";
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

        const I18n = this.I18n || ((typeof globalThis !== 'undefined' && globalThis.I18n) ? globalThis.I18n : (typeof window !== 'undefined' ? window.I18n : { t: k => k }));
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

        return `
            <div style="display:flex; flex-direction:column; gap:8px; width:100%; min-width:340px; max-width:440px;">
                <!-- 🌾 食料 -->
                <div style="background:rgba(24, 34, 50, 0.75); border:1px solid #2c3e50; border-radius:8px; padding:8px 10px;">
                    <div style="font-size:13px; font-weight:900; color:#ffffff; display:flex; justify-content:space-between; margin-bottom:3px;">
                        <span>${I18n ? I18n.t("UI_FOOD") : "🌾 食料"} (${state.food})</span>
                        <span style="color:${netFoodColor}; font-size:15px;">${netFoodSign} /T ${netTag}</span>
                    </div>
                    <div style="font-size:11.5px; color:#a4b0be; line-height:1.4;">
                        ${grossLabel} +${grossFood} (${hqBaseLabel} +10 | ${tilesLabel} +${foodTiles} | ★${socketsLabel} +${foodSockets} | ${vicinityLabel} +${foodVicinity}${emberStr})<br>
                        <span style="color:#ff9f43; font-weight:bold;">🔥 ${foodMaintLabel} -${foodCost} / T</span>
                    </div>
                </div>

                <!-- 🧱 資材 -->
                <div style="background:rgba(24, 34, 50, 0.75); border:1px solid #2c3e50; border-radius:8px; padding:8px 10px;">
                    <div style="font-size:13px; font-weight:900; color:#ffffff; display:flex; justify-content:space-between; margin-bottom:3px;">
                        <span>${I18n ? I18n.t("UI_WOOD") : "🧱 資材"} (${state.wood})</span>
                        <span style="color:#2ecc71; font-size:15px;">+${woodTotal} /T</span>
                    </div>
                    <div style="font-size:11.5px; color:#a4b0be; line-height:1.4;">
                        ${hqBaseLabel} +10 | ${tilesLabel} +${woodTiles} | ${socketsLabel} +${woodSockets} | ${vicinityLabel} +${woodVicinity}${emberStr}
                    </div>
                </div>

                <!-- 🛡️ 防衛 -->
                <div style="background:rgba(24, 34, 50, 0.75); border:1px solid #2c3e50; border-radius:8px; padding:8px 10px;">
                    <div style="font-size:13px; font-weight:900; color:#ffffff; display:flex; justify-content:space-between; margin-bottom:3px;">
                        <span>${I18n ? I18n.t("UI_DEFENSE") : "🛡️ 防衛力"} ${defTrialTag}</span>
                        <span style="color:#ffffff; font-size:15px;">${defTotal}</span>
                    </div>
                    <div style="font-size:11.5px; color:#a4b0be; line-height:1.4;">
                        ${hqBaseLabel} 10 | ${tilesLabel} +${defTiles} | ${socketsLabel} +${defSockets}
                    </div>
                </div>

                <!-- ✨ 神秘 -->
                <div style="background:rgba(24, 34, 50, 0.75); border:1px solid #2c3e50; border-radius:8px; padding:8px 10px;">
                    <div style="font-size:13px; font-weight:900; color:#ffffff; display:flex; justify-content:space-between; margin-bottom:3px;">
                        <span>${I18n ? I18n.t("UI_MYSTIC") : "✨ 神秘"} (${state.mystic})</span>
                        <span style="color:#2ecc71; font-size:15px;">+${mysticTotal} /T</span>
                    </div>
                    <div style="font-size:11.5px; color:#a4b0be; line-height:1.4;">
                        ${hqBaseLabel} +1 | ${tilesLabel} +${mysticTiles} | ${socketsLabel} +${mysticSockets} | ${emberAutoLabel} +${emberMystic}${emberStr}
                    </div>
                </div>
            </div>
        `;
    }
}

// 🌐 アプリ全体で共有するシングルトンインスタンス
export const tooltipSystemInstance = new TooltipSystem();
if (typeof window !== "undefined") {
    window.tooltipSystemInstance = tooltipSystemInstance;
}
if (typeof globalThis !== "undefined") {
    globalThis.tooltipSystemInstance = tooltipSystemInstance;
}
