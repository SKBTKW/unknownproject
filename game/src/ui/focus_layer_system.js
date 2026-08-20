/* =============================================================
   game/src/ui/focus_layer_system.js
   2層レイヤー構造（手札フォーカス ✕ 盤面暗転ブラー）カプセル化UIモジュール
   ============================================================= */

class FocusLayerManager {
    constructor() {
        this.boardContainerEl = null;
        this.boardGridEl = null;
        this.offeringSectionEl = null;
        this.isCardSelected = false;
        this.isHovered = false;
        this.isEnabled = true;
    }

    /**
     * 🏗️ 2層レイヤー監視初期化
     * @param {HTMLElement} boardContainerEl - Layer 1: 盤面コンテナ
     * @param {HTMLElement} offeringSectionEl - Layer 2: 手札オーバーレイコンテナ
     */
    mount(boardContainerEl, offeringSectionEl) {
        if (!boardContainerEl && typeof document === 'undefined') return;
        this.boardContainerEl = boardContainerEl || document.querySelector('.board-container');
        this.offeringSectionEl = offeringSectionEl || document.querySelector('.offering-section');
        this.boardGridEl = (typeof document !== 'undefined') ? (document.getElementById('board') || document.querySelector('.grid-with-headers')) : this.boardContainerEl;

        if (!this.offeringSectionEl) return;

        // マウス侵入時：手札フォーカス ＆ 土地グリッド暗転ブラー発動
        this.offeringSectionEl.addEventListener('mouseenter', () => {
            this.isHovered = true;
            if (!this.isCardSelected && this.isEnabled) {
                this.applyDimBlur(true);
            }
        });

        // マウス退出時：土地グリッドフォーカス復帰
        this.offeringSectionEl.addEventListener('mouseleave', () => {
            this.isHovered = false;
            if (!this.isCardSelected) {
                this.applyDimBlur(false);
            }
        });
    }

    getGridElement() {
        if (!this.boardGridEl && typeof document !== 'undefined') {
            this.boardGridEl = document.getElementById('board') || document.querySelector('.grid-with-headers') || this.boardContainerEl;
        }
        return this.boardGridEl || this.boardContainerEl;
    }

    /**
     * 🃏 カード選択時（Pick時）：土地グリッド盤面本体へ最優先フォーカス ＆ 手札エリアを減光
     */
    onCardSelect() {
        this.isCardSelected = true;
        const gridEl = this.getGridElement();
        if (gridEl) {
            gridEl.classList.remove('board-dim-blur');
            gridEl.classList.add('board-focus-active');
        }
        if (this.offeringSectionEl) {
            this.offeringSectionEl.classList.remove('card-container-active-focus');
            this.offeringSectionEl.classList.add('hand-dim-on-selection');
        }
    }

    /**
     * ↩️ カード選択解除時（配置完了またはキャンセル時）
     */
    onCardDeselect() {
        this.isCardSelected = false;
        const gridEl = this.getGridElement();
        if (gridEl) {
            gridEl.classList.remove('board-focus-active');
        }
        if (this.offeringSectionEl) {
            this.offeringSectionEl.classList.remove('hand-dim-on-selection');
        }

        if (this.isHovered && this.isEnabled) {
            this.applyDimBlur(true);
        } else {
            this.applyDimBlur(false);
        }
    }

    /**
     * 🌓 土地グリッドの暗転ブラー効果の適用・解除
     * @param {boolean} dim - true: 暗転ブラー発動, false: 解除
     */
    applyDimBlur(dim) {
        const gridEl = this.getGridElement();
        if (!gridEl) return;
        if (dim) {
            gridEl.classList.add('board-dim-blur');
            if (this.offeringSectionEl) {
                this.offeringSectionEl.classList.add('card-container-active-focus');
            }
        } else {
            gridEl.classList.remove('board-dim-blur');
            if (this.offeringSectionEl) {
                this.offeringSectionEl.classList.remove('card-container-active-focus');
            }
        }
    }
}

const focusLayerManagerInstance = new FocusLayerManager();

if (typeof window !== 'undefined') {
    window.FocusLayerManager = FocusLayerManager;
    window.focusLayerManager = focusLayerManagerInstance;
}
if (typeof globalThis !== 'undefined') {
    globalThis.FocusLayerManager = FocusLayerManager;
    globalThis.focusLayerManager = focusLayerManagerInstance;
}

export { FocusLayerManager, focusLayerManagerInstance as focusLayerManager };
export default focusLayerManagerInstance;
