/* =============================================================
   game/src/ui/focus_layer_system.js
   動的被写界深度（DoF）2層フォーカス管理モジュール
   最優先レイヤー: 完全フォーカス ＋ 最前面 (z-index: 700)
   下層レイヤー: 映画風ボケ (blur: 2.5~3px) ＋ 下層 (z-index: 10)
   ============================================================= */

class FocusLayerManager {
    constructor() {
        this.boardContainerEl = null;
        this.boardGridEl = null;
        this.offeringSectionEl = null;
        this.isCardSelected = false;
        this.isHandHovered = false;
        this.isBoardHovered = false;
        this.isEnabled = true;
        this.hasUserInteracted = false; // 🌟 ユーザーの初回意図的操作検知フラグ
    }

    /**
     * 🏗️ 2層レイヤー監視初期化
     * @param {HTMLElement} boardContainerEl - 盤面レイヤーコンテナ (#layerWorldBoard)
     * @param {HTMLElement} offeringSectionEl - 手札オファリングコンテナ (.offering-section)
     */
    mount(boardContainerEl, offeringSectionEl) {
        if (typeof document === 'undefined') return;
        this.boardContainerEl = boardContainerEl || document.getElementById('layerWorldBoard') || document.querySelector('.layer-world-board') || document.querySelector('.board-container');
        this.offeringSectionEl = offeringSectionEl || document.querySelector('.offering-section');
        this.boardGridEl = document.getElementById('gridBoard') || document.getElementById('board') || document.querySelector('.grid-with-headers') || this.boardContainerEl;

        if (!this.offeringSectionEl || !this.boardContainerEl) return;

        // 🌟 初期状態はマウスの初期位置に関わらず【手札・盤面を100%完全表示】に固定
        this.resetToNeutral();

        // ユーザーが初めて意図的にマウスを動かした時にフォーカス制御を活性化
        const enableInteraction = () => {
            this.hasUserInteracted = true;
            document.removeEventListener('mousemove', enableInteraction);
            document.removeEventListener('pointerdown', enableInteraction);
        };
        document.addEventListener('mousemove', enableInteraction, { passive: true });
        document.addEventListener('pointerdown', enableInteraction, { passive: true });

        // 🃏 1. 手札エリアへマウス侵入 ➔ 手札最優先・盤面ボケ
        this.offeringSectionEl.addEventListener('mouseenter', () => {
            if (!this.hasUserInteracted) return;
            this.isHandHovered = true;
            this.updateLayerStates();
        });

        // 🃏 手札エリアからマウス退出
        this.offeringSectionEl.addEventListener('mouseleave', () => {
            if (!this.hasUserInteracted) return;
            this.isHandHovered = false;
            this.updateLayerStates();
        });

        // 🗺️ 2. 中央の土地グリッド盤面本体（余白を除く）へマウス侵入 ➔ 盤面最優先・手札ボケ
        const boardHoverTarget = document.querySelector('.board-container-wrapper') || document.querySelector('.grid-board-anchor') || document.getElementById('gridBoard') || this.boardContainerEl;
        
        boardHoverTarget.addEventListener('mouseenter', () => {
            if (!this.hasUserInteracted) return;
            this.isBoardHovered = true;
            this.updateLayerStates();
        });

        // 🗺️ 盤面本体からマウス退出（余白に出た時） ➔ 両方完全表示へ復帰
        boardHoverTarget.addEventListener('mouseleave', () => {
            if (!this.hasUserInteracted) return;
            this.isBoardHovered = false;
            this.updateLayerStates();
        });
    }

    getGridElement() {
        if (!this.boardGridEl && typeof document !== 'undefined') {
            this.boardGridEl = document.getElementById('gridBoard') || document.getElementById('board') || document.querySelector('.grid-with-headers') || this.boardContainerEl;
        }
        return this.boardGridEl || this.boardContainerEl;
    }

    /**
     * 🎯 土地カード選択時（Pick時）：盤面が最優先配置レイヤーとなり、手札は下層ボケへ
     */
    onCardSelect() {
        this.isCardSelected = true;
        this.updateLayerStates();
    }

    /**
     * 🧹 カード配置完了 / 選択解除時（Deselect時）：状態を通常へ復帰
     */
    onCardDeselect() {
        this.isCardSelected = false;
        this.updateLayerStates();
    }

    /**
     * 🔄 最優先 ⇄ 下層レイヤーの動的状態更新 (Single Source of Truth)
     */
    updateLayerStates() {
        if (!this.boardContainerEl || !this.offeringSectionEl) return;
        const gridEl = this.getGridElement();

        // 状態 A: 土地カード選択中 (配置モード) ➔ 盤面最優先、手札ボケ
        if (this.isCardSelected) {
            this.setBoardFocus(true);
            this.setHandFocus(false);
            if (gridEl) gridEl.classList.add('board-focus-active');
            return;
        }

        if (gridEl) gridEl.classList.remove('board-focus-active');

        // 状態 B: 手札にマウスがある時 (手札検討中) ➔ 手札最優先、盤面ボケ
        if (this.isHandHovered) {
            this.setHandFocus(true);
            this.setBoardFocus(false);
            return;
        }

        // 状態 C: 盤面にマウスがある時 (盤面観察・操作中) ➔ 盤面最優先、手札ボケ
        if (this.isBoardHovered) {
            this.setBoardFocus(true);
            this.setHandFocus(false);
            return;
        }

        // 状態 D: 初期状態・余白にマウスがある時 (中立) ➔ 両方通常クリア表示
        this.resetToNeutral();
    }

    /**
     * 🗺️ 盤面を最優先（最前面手前 z-index: 700）または下層ボケ（奥 z-index: 50）に設定
     */
    setBoardFocus(isFront) {
        if (!this.boardContainerEl) return;
        const gridEl = this.getGridElement();
        const playerTray = document.getElementById('layerPlayerTray') || document.querySelector('.layer-player-tray');

        if (isFront) {
            this.boardContainerEl.classList.add('layer-active-front');
            this.boardContainerEl.classList.remove('layer-dim-blur');
            this.boardContainerEl.style.zIndex = '700';
            if (gridEl) gridEl.classList.remove('board-dim-blur');

            if (playerTray) playerTray.style.zIndex = '50';
            if (this.offeringSectionEl) this.offeringSectionEl.style.zIndex = '50';
        } else {
            this.boardContainerEl.classList.remove('layer-active-front');
            this.boardContainerEl.classList.add('layer-dim-blur');
            this.boardContainerEl.style.zIndex = '50';
            if (gridEl) gridEl.classList.add('board-dim-blur');
        }
    }

    /**
     * 🃏 手札を最優先（最前面手前 z-index: 700）または下層ボケ（奥 z-index: 50）に設定
     */
    setHandFocus(isFront) {
        if (!this.offeringSectionEl) return;
        const playerTray = document.getElementById('layerPlayerTray') || document.querySelector('.layer-player-tray');

        if (isFront) {
            this.offeringSectionEl.classList.add('layer-active-front');
            this.offeringSectionEl.classList.remove('layer-dim-blur');
            this.offeringSectionEl.style.zIndex = '700';
            if (playerTray) playerTray.style.zIndex = '700';

            if (this.boardContainerEl) this.boardContainerEl.style.zIndex = '50';
        } else {
            this.offeringSectionEl.classList.remove('layer-active-front');
            this.offeringSectionEl.classList.add('layer-dim-blur');
            this.offeringSectionEl.style.zIndex = '50';
            if (playerTray) playerTray.style.zIndex = '50';
        }
    }

    /**
     * ⚖️ 中立（平常時）クリア表示へのリセット
     */
    resetToNeutral() {
        const playerTray = document.getElementById('layerPlayerTray') || document.querySelector('.layer-player-tray');
        if (this.boardContainerEl) {
            this.boardContainerEl.classList.remove('layer-active-front', 'layer-dim-blur');
            this.boardContainerEl.style.zIndex = '10';
        }
        if (this.offeringSectionEl) {
            this.offeringSectionEl.classList.remove('layer-active-front', 'layer-dim-blur');
            this.offeringSectionEl.style.zIndex = '500';
        }
        if (playerTray) {
            playerTray.style.zIndex = '500';
        }
        const gridEl = this.getGridElement();
        if (gridEl) {
            gridEl.classList.remove('board-dim-blur', 'board-focus-active');
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
