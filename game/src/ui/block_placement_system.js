/* =============================================================
   game/src/ui/block_placement_system.js
   ブロック配置・プレビュー・ルール検証一元管理モジュール (余計なエフェクト一切なしの純粋復元)
   ============================================================= */

(function(window) {
    'use strict';

    class BlockPlacementSystem {
        constructor() {
            this.activeSelectedCard = null;
            this.activeSelectedCardIdx = -1;
        }

        /**
         * 1. プレビューハイライトの全消去
         */
        clearAllPreviews() {
            const cells = document.querySelectorAll("#gridBoard .cell");
            cells.forEach(cell => {
                cell.classList.remove(
                    "preview-valid",
                    "preview-invalid",
                    "merge-hover-highlight"
                );
            });
            if (typeof window.hideTileTooltip === "function") {
                window.hideTileTooltip();
            }
        }

        /**
         * 2. 土地カード選択時の「置ける候補マス」全発光ハイライト
         * @param {Object} card 
         * @param {Object} gameState 
         */
        highlightPlaceableCandidates(card, gameState) {
            this.clearAllPreviews();
            if (!card || !gameState || gameState.hasPickedThisTurn) return;

            const shape = card.currentShape || (card.terrain ? card.terrain.shape : [[1]]);
            if (!shape || !Array.isArray(shape)) return;

            for (let r = 0; r < 5; r++) {
                for (let c = 0; c < 5; c++) {
                    const check = gameState.canPlaceShape(r, c, shape);
                    const canPlace = (typeof check === 'object' && check !== null) ? check.can : check;
                    if (canPlace) {
                        const targetEl = document.querySelector(`#gridBoard .cell[data-r="${r}"][data-c="${c}"]`);
                        if (targetEl) {
                            targetEl.classList.add("preview-valid");
                        }
                    }
                }
            }
        }

        /**
         * 3. セルホバー時のシンプルで確実な「配置ブロックプレビューハイライト」描画
         *    - 近郊マス(hq-vicinity-unplaced)の上であっても、余計なアニメーションなしで
         *      シンプルに .preview-valid (緑枠) / .preview-invalid (赤枠) が100%最前面にクッキリ表示される
         * @param {Event} e 
         * @param {number} r 
         * @param {number} c 
         * @param {Object} card 
         * @param {Object} gameState 
         */
        updateHoverPreview(e, r, c, card, gameState) {
            if (!gameState) return;

            // カード非選択時は通常ツールチップのみ表示
            if (!card || gameState.hasPickedThisTurn) {
                if (typeof window.showTileTooltip === "function") {
                    window.showTileTooltip(e, r, c, gameState.grid[r][c]);
                }
                return;
            }

            const shape = card.currentShape || (card.terrain ? card.terrain.shape : [[1]]);
            if (!shape || !Array.isArray(shape)) return;

            const check = gameState.canPlaceShape(r, c, shape);
            const isValid = (typeof check === 'object' && check !== null) ? check.can : check;

            const rows = shape.length;
            const cols = shape[0].length;

            for (let dr = 0; dr < rows; dr++) {
                for (let dc = 0; dc < cols; dc++) {
                    if (shape[dr][dc] === 1) {
                        const tr = r + dr;
                        const tc = c + dc;
                        if (tr >= 0 && tr < 5 && tc >= 0 && tc < 5) {
                            const targetEl = document.querySelector(`#gridBoard .cell[data-r="${tr}"][data-c="${tc}"]`);
                            if (targetEl) {
                                // 🌟 近郊マスやソケットマスの元スタイルを上書きし、緑枠/赤枠プレビューを忠実に最前面表示
                                targetEl.classList.add(isValid ? "preview-valid" : "preview-invalid");
                            }
                        }
                    }
                }
            }
        }
    }

    // グローバルへ公開
    const instance = new BlockPlacementSystem();
    if (typeof window !== "undefined") {
        window.BlockPlacementSystem = instance;
    }
    if (typeof globalThis !== "undefined") {
        globalThis.BlockPlacementSystem = instance;
    }
})(typeof window !== "undefined" ? window : (typeof globalThis !== "undefined" ? globalThis : {}));

const BlockPlacementSystem = (typeof globalThis !== "undefined" && globalThis.BlockPlacementSystem) ? globalThis.BlockPlacementSystem : null;
export { BlockPlacementSystem };
export default BlockPlacementSystem;



