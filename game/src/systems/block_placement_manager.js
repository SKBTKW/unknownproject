/* =============================================================
   game/src/ui/block_placement_system.js
   配置ブロックプレビュー・発光ハイライト管理モジュール
   ============================================================= */

(function(window) {
    'use strict';

    class BlockPlacementSystem {
        constructor() {}

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

        updateHoverPreview(e, r, c, card, gameState) {
            if (!gameState) return;

            // ホバープレビュー枠のみを毎回クリーンアップ
            const cells = document.querySelectorAll("#gridBoard .cell");
            cells.forEach(cell => {
                cell.classList.remove("preview-valid", "preview-invalid");
            });

            if (!card || gameState.hasPickedThisTurn) {
                if (typeof window.showTileTooltip === "function") {
                    window.showTileTooltip(e, r, c, gameState.grid[r][c]);
                }
                return;
            }

            const shape = card.currentShape || (card.terrain ? card.terrain.shape : [[1]]);
            if (!shape || !Array.isArray(shape)) return;

            const check = gameState.canPlaceShape ? gameState.canPlaceShape(r, c, shape) : { can: false };
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
                                targetEl.classList.add(isValid ? "preview-valid" : "preview-invalid");
                            }
                        }
                    }
                }
            }
        }
    }

    window.BlockPlacementSystem = new BlockPlacementSystem();
})(window);

