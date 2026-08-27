/* =============================================================
   game/src/ui/board_camera_system.js
   可変型盤面カメラシステム (パン移動 ＆ ヘッダー天井ストッパー ＆ 無段階ズーム)
   ============================================================= */

class BoardCameraSystem {
    constructor() {
        this.targetEl = null;
        this.containerEl = null;
        this.defaultZoom = 1.0; // 🎯 初期表示倍率 1.0x (100%)
        this.currentZoom = 1.0;
        this.minZoom = 0.80; // 🛡️ 最小縮小限界 80% (盤面全高 515.2px を維持し手札トレイ全高460pxより常に高く上部露出を完全保証)
        this.maxZoom = 2.00; // 🌟 最大200% (2.0x) 拡大対応
        this.zoomStep = 0.06;
        this.panX = 0;
        this.panY = 0;
        this.isDragging = false;
        this.isPendingDrag = false;
        this.startX = 0;
        this.startY = 0;
        this.initialPanX = 0;
        this.initialPanY = 0;
        this.dragThreshold = 4; // 4px以上の移動でドラッグ判定
        this.isInitialized = false;
    }

    /**
     * 🏗️ 盤面カメラズーム ＆ パン移動の初期化
     * @param {HTMLElement} targetEl - 移動・ズーム対象（.board-container-wrapper または #gridBoard）
     * @param {HTMLElement} containerEl - マウスイベント検知領域（#layerWorldBoard）
     */
    mount(targetEl, containerEl) {
        if (typeof document === 'undefined') return;
        this.targetEl = targetEl || document.querySelector('.board-container-wrapper') || document.getElementById('gridBoard');
        this.containerEl = containerEl || document.getElementById('layerWorldBoard') || document.querySelector('.layer-world-board');

        if (!this.targetEl || !this.containerEl) return;
        if (this.isInitialized) return;

        this.applyTransform();

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

        // 🖱️ 盤面ドラッグ移動 (左D&D ＆ ホイールボタンD&D)
        this.containerEl.addEventListener('mousedown', (e) => {
            // 手札トレイ、操作ボタン、保留スロットなどのUIコントロール要素上の場合は盤面パンを無視
            if (e.target.closest('.offering-section') || e.target.closest('.footer-controls-partition') || e.target.closest('#logComponentContainer') || e.target.closest('button')) {
                return;
            }

            const isMiddle = (e.button === 1); // ホイールボタン (中クリック)
            const isLeft = (e.button === 0);   // 通常左クリック
            const isRight = (e.button === 2);  // 右クリック

            if (isMiddle) {
                // ホイールボタン ➔ どこからでも即座にD&Dパン開始
                e.preventDefault();
                this.startDrag(e.clientX, e.clientY);
            } else if (isLeft) {
                // 左クリック ➔ ヘッダーセル、盤面枠、背景、またはセル上のD&Dパン受付
                const isHeaderCell = !!e.target.closest('.header-cell');
                const isBackground = !e.target.closest('.cell');
                const isShift = e.shiftKey;

                if (isHeaderCell || isBackground || isShift) {
                    e.preventDefault();
                    this.startDrag(e.clientX, e.clientY);
                } else {
                    // セル上の場合は、ドラッグ移動(閾値超え)を検知する準備
                    this.isPendingDrag = true;
                    this.startX = e.clientX;
                    this.startY = e.clientY;
                    this.initialPanX = this.panX;
                    this.initialPanY = this.panY;
                }
            }
        });

        window.addEventListener('mousemove', (e) => {
            if (this.isPendingDrag) {
                const dist = Math.hypot(e.clientX - this.startX, e.clientY - this.startY);
                if (dist >= this.dragThreshold) {
                    this.isPendingDrag = false;
                    this.startDrag(e.clientX, e.clientY);
                }
            }

            if (!this.isDragging) return;
            e.preventDefault();
            this.updateDrag(e.clientX, e.clientY);
        });

        window.addEventListener('mouseup', (e) => {
            this.isPendingDrag = false;
            if (this.isDragging) {
                this.endDrag();
            }
        });

        // 🎯 盤面背景・画面全体の余白ダブルクリックで位置(0,0)と倍率(1.0x)を中央デフォルトへスムーズ復帰
        window.addEventListener('dblclick', (e) => {
            // 手札トレイ、操作ボタン、保留スロット、ログコンテナ、モーダルなどのUIコントロール要素上の場合は無視
            if (e.target.closest('.offering-section') || 
                e.target.closest('.footer-controls-partition') || 
                e.target.closest('#logComponentContainer') || 
                e.target.closest('.modal-overlay') || 
                e.target.closest('.modal-content') || 
                e.target.closest('button') || 
                e.target.closest('input') || 
                e.target.closest('select')) {
                return;
            }
            e.preventDefault();
            this.resetCamera();
        });

        // ⌨️ 'R' / 'r' キー押下による視点・配置リセットショートカット
        window.addEventListener('keydown', (e) => {
            // テキスト入力中は無視
            if (e.target && (e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA' || e.target.isContentEditable)) {
                return;
            }
            // モーダル表示中などは無視
            if (document.querySelector('.modal-overlay:not(.hidden):not([style*="display: none"])')) {
                return;
            }
            if (e.key === 'r' || e.key === 'R') {
                this.resetCamera();
            }
        });

        this.isInitialized = true;
    }

    startDrag(clientX, clientY) {
        this.isDragging = true;
        this.isPendingDrag = false;
        this.startX = clientX;
        this.startY = clientY;
        this.initialPanX = this.panX;
        this.initialPanY = this.panY;
        if (this.targetEl) {
            this.targetEl.style.transition = 'none'; // ドラッグ中は即座に追従
            this.targetEl.classList.add('is-camera-dragging');
        }
        if (this.containerEl) {
            this.containerEl.classList.add('is-camera-dragging');
        }
        if (typeof document !== 'undefined') {
            document.body.classList.add('is-camera-dragging-global');
        }
    }

    updateDrag(clientX, clientY) {
        if (!this.isDragging) return;
        const dx = clientX - this.startX;
        const dy = clientY - this.startY;
        this.setPan(this.initialPanX + dx, this.initialPanY + dy);
    }

    endDrag() {
        this.isDragging = false;
        this.isPendingDrag = false;
        if (this.targetEl) {
            this.targetEl.style.transition = 'transform 0.12s cubic-bezier(0.16, 1, 0.3, 1)';
            this.targetEl.classList.remove('is-camera-dragging');
        }
        if (this.containerEl) {
            this.containerEl.classList.remove('is-camera-dragging');
        }
        if (typeof document !== 'undefined') {
            document.body.classList.remove('is-camera-dragging-global');
        }
    }

    /**
     * 🛡️ ヘッダー天井ストッパー ＆ メインエリア四方境界クランプ計算
     */
    clampPosition(x, y) {
        if (!this.targetEl || !this.containerEl) return { x, y };

        const cRect = this.containerEl.getBoundingClientRect ? this.containerEl.getBoundingClientRect() : { width: 1200, height: 800 };
        const tWidth = this.targetEl.offsetWidth || 500;
        const tHeight = this.targetEl.offsetHeight || 500;

        // ズーム後の実サイズ
        const scaledWidth = tWidth * this.currentZoom;
        const scaledHeight = tHeight * this.currentZoom;

        // コンテナ中央配置を基準とした初期オフセット
        const baseMarginX = (cRect.width - scaledWidth) / 2;
        const baseMarginY = (cRect.height - scaledHeight) / 2;

        // 🚫 [ヘッダー天井ストッパー]: 盤面上端 (baseMarginY + y) >= 0 (ヘッダー下端 Y=0 より上へ絶対に行かない)
        // ➔ y >= -baseMarginY
        const minY = -Math.max(0, baseMarginY);

        // 🚫 [画面下端ストッパー]: 盤面下端 <= cRect.height
        const maxY = Math.max(minY, baseMarginY);

        // 🚫 [左右ストッパー]
        const minX = -Math.max(0, baseMarginX);
        const maxX = Math.max(minX, baseMarginX);

        // クランプ適用 (ヘッダー天井ストッパーを厳格適用)
        const clampedY = Math.min(maxY, Math.max(minY, y));
        const clampedX = Math.min(maxX, Math.max(minX, x));

        return { x: clampedX, y: clampedY };
    }

    /**
     * 📍 パン位置の設定
     */
    setPan(newX, newY) {
        const clamped = this.clampPosition(newX, newY);
        this.panX = clamped.x;
        this.panY = clamped.y;
        this.applyTransform();
    }

    /**
     * 🔍 ズーム倍率の設定
     * @param {number} newZoom 
     */
    setZoom(newZoom) {
        this.currentZoom = Math.min(this.maxZoom, Math.max(this.minZoom, parseFloat(newZoom.toFixed(2))));
        // ズーム倍率変更時もヘッダー天井ストッパーを超えていないか自動再クランプ
        const clamped = this.clampPosition(this.panX, this.panY);
        this.panX = clamped.x;
        this.panY = clamped.y;
        this.applyTransform();
    }

    /**
     * 🔄 位置(0,0)と倍率(1.0x)を中央デフォルトにリセット
     */
    resetCamera() {
        this.panX = 0;
        this.panY = 0;
        this.currentZoom = this.defaultZoom || 0.8;
        if (this.targetEl) {
            this.targetEl.style.transition = 'transform 0.25s cubic-bezier(0.16, 1, 0.3, 1)';
        }
        this.applyTransform();
    }

    resetZoom() {
        this.resetCamera();
    }

    /**
     * 🎨 GPU加速 Transform スタイルの適用
     */
    applyTransform() {
        if (!this.targetEl) return;
        this.targetEl.style.transform = `translate(${this.panX}px, ${this.panY}px) scale(${this.currentZoom})`;
        this.targetEl.style.transformOrigin = 'center center';
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
