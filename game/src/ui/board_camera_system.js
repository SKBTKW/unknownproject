/* =============================================================
   game/src/ui/board_camera_system.js
   可変型盤面カメラズームシステム (Civ6 スタイル マウスホイール無段階ズーム)
   ============================================================= */

class BoardCameraSystem {
    constructor() {
        this.targetEl = null;
        this.containerEl = null;
        this.currentZoom = 1.0;
        this.minZoom = 0.50;
        this.maxZoom = 2.00; // 🌟 最大200% (2.0x) 拡大対応
        this.zoomStep = 0.06;
        this.isInitialized = false;
    }

    /**
     * 🏗️ 盤面カメラズーム初期化
     * @param {HTMLElement} targetEl - ズーム対象（.board-container-wrapper または #gridBoard）
     * @param {HTMLElement} containerEl - マウスホイール検知領域（#layerWorldBoard）
     */
    mount(targetEl, containerEl) {
        if (typeof document === 'undefined') return;
        this.targetEl = targetEl || document.querySelector('.board-container-wrapper') || document.getElementById('gridBoard');
        this.containerEl = containerEl || document.getElementById('layerWorldBoard') || document.querySelector('.layer-world-board');

        if (!this.targetEl || !this.containerEl) return;
        if (this.isInitialized) return;

        this.applyZoomTransform();

        // 🎡 マウスホイール ズームイン / ズームアウト
        this.containerEl.addEventListener('wheel', (e) => {
            // 手札トレイや他UIの上の場合は無効化
            if (e.target.closest('.offering-section') || e.target.closest('.footer-controls-partition') || e.target.closest('#logComponentContainer')) {
                return;
            }

            e.preventDefault();

            if (e.deltaY < 0) {
                // 上回転 ➔ ズームイン (拡大)
                this.setZoom(this.currentZoom + this.zoomStep);
            } else if (e.deltaY > 0) {
                // 下回転 ➔ ズームアウト (縮小)
                this.setZoom(this.currentZoom - this.zoomStep);
            }
        }, { passive: false });

        // 🎯 盤面背景ダブルクリックで倍率を 1.0x にリセット
        this.containerEl.addEventListener('dblclick', (e) => {
            if (!e.target.closest('.cell') && !e.target.closest('button')) {
                this.resetZoom();
            }
        });

        this.isInitialized = true;
    }

    /**
     * 🔍 ズーム倍率の設定
     * @param {number} newZoom 
     */
    setZoom(newZoom) {
        this.currentZoom = Math.min(this.maxZoom, Math.max(this.minZoom, parseFloat(newZoom.toFixed(2))));
        this.applyZoomTransform();
    }

    /**
     * 🔄 ズーム倍率を 1.0x にリセット
     */
    resetZoom() {
        this.setZoom(1.0);
    }

    /**
     * 🎨 GPU加速 Transform スタイルの適用
     */
    applyZoomTransform() {
        if (!this.targetEl) return;
        this.targetEl.style.transform = `scale(${this.currentZoom})`;
        this.targetEl.style.transformOrigin = 'center center';
        this.targetEl.style.transition = 'transform 0.08s cubic-bezier(0.16, 1, 0.3, 1)';
    }
}

const boardCameraSystemInstance = new BoardCameraSystem();

if (typeof window !== 'undefined') {
    window.BoardCameraSystem = BoardCameraSystem;
    window.boardCameraSystem = boardCameraSystemInstance;
}
if (typeof globalThis !== 'undefined') {
    globalThis.BoardCameraSystem = BoardCameraSystem;
    globalThis.boardCameraSystem = boardCameraSystemInstance;
}

export { BoardCameraSystem, boardCameraSystemInstance as boardCameraSystem };
export default boardCameraSystemInstance;
