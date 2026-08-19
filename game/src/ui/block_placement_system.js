/* =============================================================
   game/src/ui/block_placement_system.js
   ブロック配置・プレビュー・ルール検証・発光一元管理モジュール
   ============================================================= */

(function(window) {
    'use strict';

    class BlockPlacementSystem {
        constructor() {
            this.activeSelectedCard = null;
            this.activeSelectedCardIdx = -1;
        }

        /**
         * 1. プレビューおよびハイライトの全消去
         */
        clearAllPreviews() {
            const cells = document.querySelectorAll("#gridBoard .cell");
            cells.forEach(cell => {
                cell.classList.remove(
                    "preview-valid",
                    "preview-invalid",
                    "merge-hover-highlight",
                    "hq-vicinity-hover-glow"
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
                    const check = gameState.canPlaceShape(shape, r, c);
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
         * 3. セルホバー時の「配置ブロックプレビューハイライト」描画
         *    表示優先順位:
         *    1位: preview-valid / preview-invalid (最優先・近郊マスの上でも緑/赤枠が勝つ)
         *    2位: hq-vicinity-hover-glow (本営隣接ボーナス波紋)
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

            const check = gameState.canPlaceShape(shape, r, c);
            const isValid = (typeof check === 'object' && check !== null) ? check.can : check;

            const rows = shape.length;
            const cols = shape[0].length;
            let hitsHQVicinity = false;

            for (let dr = 0; dr < rows; dr++) {
                for (let dc = 0; dc < cols; dc++) {
                    if (shape[dr][dc] === 1) {
                        const tr = r + dr;
                        const tc = c + dc;
                        if (tr >= 0 && tr < 5 && tc >= 0 && tc < 5) {
                            const targetEl = document.querySelector(`#gridBoard .cell[data-r="${tr}"][data-c="${tc}"]`);
                            if (targetEl) {
                                // 🌟 優先順位1位: どんなマス（近郊・ソケット）の上でもプレビュー枠が勝つ
                                targetEl.classList.add(isValid ? "preview-valid" : "preview-invalid");

                                if (gameState.isHQVicinity && gameState.isHQVicinity(tr, tc)) {
                                    hitsHQVicinity = true;
                                    targetEl.classList.add("hq-vicinity-hover-glow");
                                }
                            }
                        }
                    }
                }
            }

            // 本営周囲マスに被っている場合、本営自体もエメラルド波紋発光
            if (hitsHQVicinity && isValid) {
                const hqEl = document.querySelector("#gridBoard .cell.hq");
                if (hqEl) hqEl.classList.add("hq-vicinity-hover-glow");
            }
        }
    }

    // グローバルへ公開
    window.BlockPlacementSystem = new BlockPlacementSystem();
})(window);
