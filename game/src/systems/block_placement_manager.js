/* =============================================================
   game/src/systems/block_placement_manager.js
   ブロック配置統合管理モジュール (ルール判定・配置実行・プレビュー一元化)
   ============================================================= */

(function(window) {
    'use strict';

    class BlockPlacementManager {
        constructor() {
            this.selectedCard = null;
            this.selectedCardIdx = -1;
        }

        /**
         * 1. ブロック配置ルール検証コアエンジン (原本 v2_unity_ready_main.js:canPlaceShape と100%同一)
         * @param {number} startR 
         * @param {number} startC 
         * @param {Array<Array<number>>} shapeMatrix 
         * @param {Object} gameState 
         * @returns {Object} { can: boolean, reason?: string }
         */
        canPlace(startR, startC, shapeMatrix, gameState) {
            if (!gameState || !gameState.grid || !shapeMatrix || !Array.isArray(shapeMatrix)) {
                return { can: false, reason: "INVALID_STATE" };
            }

            const rows = shapeMatrix.length;
            const cols = shapeMatrix[0].length;
            const size = (gameState.stage && gameState.stage.size) ? gameState.stage.size : 5;

            // ① 範囲外・重複設置チェック
            for (let dr = 0; dr < rows; dr++) {
                for (let dc = 0; dc < cols; dc++) {
                    if (shapeMatrix[dr][dc] === 1) {
                        const r = startR + dr;
                        const c = startC + dc;
                        if (r < 0 || r >= size || c < 0 || c >= size) return { can: false, reason: "OUT_OF_BOUNDS" };
                        if (gameState.grid[r] && gameState.grid[r][c] && gameState.grid[r][c].placed) {
                            return { can: false, reason: "ALREADY_PLACED" };
                        }
                    }
                }
            }

            // ② 本営・既設置マスへの隣接チェック
            let isAdjacent = false;
            for (let dr = 0; dr < rows; dr++) {
                for (let dc = 0; dc < cols; dc++) {
                    if (shapeMatrix[dr][dc] === 1) {
                        const r = startR + dr;
                        const c = startC + dc;
                        const neighbors = [
                            [r - 1, c], [r + 1, c], [r, c - 1], [r, c + 1]
                        ];
                        for (let [nr, nc] of neighbors) {
                            if (nr >= 0 && nr < size && nc >= 0 && nc < size) {
                                if (gameState.grid[nr] && gameState.grid[nr][nc] && gameState.grid[nr][nc].placed) {
                                    isAdjacent = true;
                                    break;
                                }
                            }
                        }
                        if (isAdjacent) break;
                    }
                }
                if (isAdjacent) break;
            }

            if (!isAdjacent) return { can: false, reason: "NOT_ADJACENT" };
            return { can: true };
        }

        /**
         * 2. プレビュー枠のクリーンアップ
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
         * 3. カード選択時の「置ける候補マス」全発光ハイライト
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
                    const check = this.canPlace(r, c, shape, gameState);
                    if (check.can) {
                        const targetEl = document.querySelector(`#gridBoard .cell[data-r="${r}"][data-c="${c}"]`);
                        if (targetEl) {
                            targetEl.classList.add("preview-valid");
                        }
                    }
                }
            }
        }

        /**
         * 4. セルホバー時の「置ける緑枠 / 置けない赤枠」リアルタイムプレビュー描画
         * @param {Event} e 
         * @param {number} r 
         * @param {number} c 
         * @param {Object} card 
         * @param {Object} gameState 
         */
        updateHoverPreview(e, r, c, card, gameState) {
            if (!gameState) return;

            if (!card || gameState.hasPickedThisTurn) {
                if (typeof window.showTileTooltip === "function") {
                    window.showTileTooltip(e, r, c, gameState.grid[r][c]);
                }
                return;
            }

            const shape = card.currentShape || (card.terrain ? card.terrain.shape : [[1]]);
            if (!shape || !Array.isArray(shape)) return;

            const check = this.canPlace(r, c, shape, gameState);
            const isValid = check.can;

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

        /**
         * 5. 土地ブロックの90度回転処理
         * @param {Event} e 
         * @param {number} idx 
         * @param {Object} gameState 
         */
        rotateCard(e, idx, gameState) {
            if (e) e.stopPropagation();
            if (!gameState || !gameState.handOffering) return;

            const card = gameState.handOffering[idx];
            if (!card || card.isBlank || !card.currentShape) return;

            const oldShape = card.currentShape;
            const rows = oldShape.length;
            const cols = oldShape[0].length;
            const newShape = [];

            for (let c = 0; c < cols; c++) {
                const newRow = [];
                for (let r = rows - 1; r >= 0; r--) {
                    newRow.push(oldShape[r][c]);
                }
                newShape.push(newRow);
            }
            card.currentShape = newShape;

            if (typeof window.render === "function") {
                window.render();
            }
            if (window.selectedCardIdx === idx) {
                this.highlightPlaceableCandidates(card, gameState);
            }
        }
    }

    // グローバルインスタンスの公開
    window.BlockPlacementManager = new BlockPlacementManager();
})(window);
