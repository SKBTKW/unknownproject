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

        // 🌐 多言語解決
        let descText = tooltipKeyOrText;
        if (this.I18n && typeof this.I18n.t === "function") {
            const translated = this.I18n.t(tooltipKeyOrText);
            if (translated && translated !== tooltipKeyOrText) {
                descText = translated;
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

        if (e) {
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
