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
         * 1. プレビューハイライトの消去 (カード選択解除時のみ完全消去)
         */
        clearAllPreviews() {
            const cells = document.querySelectorAll(".cell");
            cells.forEach(cell => {
                cell.classList.remove(
                    "preview-valid",
                    "preview-invalid",
                    "placeable-candidate",
                    "merge-hover-highlight"
                );
            });
            if (typeof window.hideTileTooltip === "function") {
                window.hideTileTooltip();
            }
        }

        /**
         * 一時的なホバー枠のみ消去 (placeable-candidate は絶対に維持)
         */
        clearHoverPreviews() {
            const cells = document.querySelectorAll(".cell");
            cells.forEach(cell => {
                cell.classList.remove("preview-valid", "preview-invalid", "merge-hover-highlight");
            });
        }

        /**
         * 2. 土地カード選択時の「置ける候補マス」全発光ハイライト (常時点灯パルス)
         * @param {Object} card 
         * @param {Object} gameState 
         */
        highlightPlaceableCandidates(card, gameState) {
            if (!card || !gameState || gameState.hasPickedThisTurn) {
                this.clearAllPreviews();
                return;
            }

            this.clearHoverPreviews();

            const shape = card.currentShape || (card.terrain ? card.terrain.shape : (card.shape || [[1]]));
            if (!shape || !Array.isArray(shape)) return;

            const size = (gameState.stage && gameState.stage.size) ? gameState.stage.size : (gameState.grid ? gameState.grid.length : 5);

            for (let r = 0; r < size; r++) {
                for (let c = 0; c < size; c++) {
                    const check = (typeof gameState.canPlaceShape === "function") 
                        ? gameState.canPlaceShape(r, c, shape) 
                        : (gameState.gridEngine ? gameState.gridEngine.canPlaceShape(r, c, shape) : false);
                    const canPlace = (typeof check === 'object' && check !== null) ? check.can : (check === true);
                    const targetEl = document.querySelector(`.cell[data-r="${r}"][data-c="${c}"]`);
                    if (targetEl) {
                        if (canPlace) {
                            targetEl.classList.add("placeable-candidate");
                        } else {
                            targetEl.classList.remove("placeable-candidate");
                        }
                    }
                }
            }
        }

        /**
         * 3. セルホバー時の配置プレビュー
         */
        updateHoverPreview(e, r, c, card, gameState) {
            if (!gameState) return;

            if (!card || gameState.hasPickedThisTurn) {
                if (typeof window.showTileTooltip === "function") {
                    window.showTileTooltip(e, r, c, gameState.grid[r][c]);
                }
                return;
            }

            this.clearHoverPreviews();

            const shape = card.currentShape || (card.terrain ? card.terrain.shape : [[1]]);
            if (!shape || !Array.isArray(shape)) return;

            const check = gameState.canPlaceShape(r, c, shape);
            const isValid = (typeof check === 'object' && check !== null) ? check.can : check;

            const rows = shape.length;
            const cols = shape[0].length;
            const size = (gameState.stage && gameState.stage.size) ? gameState.stage.size : 5;

            for (let dr = 0; dr < rows; dr++) {
                for (let dc = 0; dc < cols; dc++) {
                    if (shape[dr][dc] === 1) {
                        const tr = r + dr;
                        const tc = c + dc;
                        if (tr >= 0 && tr < size && tc >= 0 && tc < size) {
                            const targetEl = document.querySelector(`.cell[data-r="${tr}"][data-c="${tc}"]`);
                            if (targetEl) {
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



