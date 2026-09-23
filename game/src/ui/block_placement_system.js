import { PlacementPreviewResolver } from '../presentation/placement_preview_resolver.js';
import { UILayoutConfig } from './layout_config.js';

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
            this.previewResolver = new PlacementPreviewResolver();
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
                cell.removeAttribute("data-preview-terrain");
                cell.style.removeProperty("background");
            });
            if (typeof window !== "undefined" && window.tooltipSystemInstance && typeof window.tooltipSystemInstance.hide === "function") {
                window.tooltipSystemInstance.hide();
            }
        }

        /**
         * 一時的なホバー枠のみ消去 (placeable-candidate は絶対に維持)
         */
        clearHoverPreviews() {
            const cells = document.querySelectorAll(".cell");
            cells.forEach(cell => {
                cell.classList.remove("preview-valid", "preview-invalid", "merge-hover-highlight");
                cell.removeAttribute("data-preview-terrain");
                cell.style.removeProperty("background");
            });
            if (typeof window !== "undefined" && window.tooltipSystemInstance && typeof window.tooltipSystemInstance.hide === "function") {
                window.tooltipSystemInstance.hide();
            }
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

            const candidates = this.previewResolver.resolveCandidates(card, gameState);
            for (const candidate of candidates) {
                const { r, c } = candidate.anchor;
                const targetEl = document.querySelector(`.cell[data-r="${r}"][data-c="${c}"]`);
                if (!targetEl) continue;
                if (candidate.valid) targetEl.classList.add("placeable-candidate");
                else targetEl.classList.remove("placeable-candidate");
            }
        }

        /**
         * 3. セルホバー時の配置プレビュー ＆ 配置不可理由ポップアップ
         */
        updateHoverPreview(e, r, c, card, gameState) {
            if (!gameState) return;

            if (!card || gameState.hasPickedThisTurn) {
                if (typeof window !== "undefined" && window.ui && typeof window.ui.showTileTooltip === "function") {
                    window.ui.showTileTooltip(e, r, c, gameState.grid[r][c]);
                }
                return;
            }

            this.clearHoverPreviews();

            const preview = this.previewResolver.resolveHover(card, gameState, r, c);
            if (!preview) return;
            const isValid = preview.valid;
            const size = (gameState.stage && gameState.stage.size) ? gameState.stage.size : 5;

            for (const cell of preview.placement.cells) {
                if (cell.r >= 0 && cell.r < size && cell.c >= 0 && cell.c < size) {
                    const targetEl = document.querySelector(`.cell[data-r="${cell.r}"][data-c="${cell.c}"]`);
                    if (targetEl) {
                        targetEl.classList.add(isValid ? "preview-valid" : "preview-invalid");

                        // Multi-Attribute preview keeps legality as the outer
                        // green/red signal while the fill uses the actual cell
                        // terrain color. Uniform legacy cards have no per-cell
                        // terrainId here and retain the existing preview style.
                        if (cell.terrainId) {
                            const theme = UILayoutConfig.getBlockThemeColor(cell.terrainId);
                            targetEl.setAttribute("data-preview-terrain", "1");
                            targetEl.style.setProperty("background", theme.bg, "important");
                        }
                    }
                }
            }

            // ⚠️ 配置不可マスの場合、理由一覧をツールチップポップアップ表示
            if (!isValid && typeof window !== "undefined" && window.tooltipSystemInstance && typeof window.tooltipSystemInstance.showCustom === "function") {
                const I18n = (typeof globalThis !== 'undefined' && globalThis.I18n) ? globalThis.I18n : (typeof window !== 'undefined' && window.I18n ? window.I18n : { t: k => k });
                const reasons = preview.reasons.length > 0 ? preview.reasons : ["NOT_ADJACENT"];

                const titleText = I18n.t("TOOLTIP_CANNOT_PLACE_TITLE");
                const itemsHtml = reasons.map(reasonKey => {
                    const i18nKey = "ERR_" + reasonKey;
                    const msg = I18n.t(i18nKey);
                    const displayMsg = (msg && msg !== i18nKey) ? msg : I18n.t(reasonKey);
                    return `<div style="display:flex;align-items:center;gap:4px;margin-top:2px;"><span style="color:#e74c3c;">•</span> <span>${displayMsg}</span></div>`;
                }).join("");

                const descHtml = `<div class="cannot-place-reasons-box" style="font-size:12px;line-height:1.45;color:#e2e8f0;">${itemsHtml}</div>`;
                const clientX = e ? e.clientX : 0;
                const clientY = e ? e.clientY : 0;
                window.tooltipSystemInstance.showCustom(clientX, clientY, titleText, descHtml);
            } else if (isValid && typeof window !== "undefined" && window.tooltipSystemInstance && typeof window.tooltipSystemInstance.hide === "function") {
                window.tooltipSystemInstance.hide();
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
