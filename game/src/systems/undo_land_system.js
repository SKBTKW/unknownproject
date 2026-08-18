/* =============================================================
   game/src/systems/undo_land_system.js
   土地配置の「↩ 戻す（Undo）」ディープスナップショット独立モジュール
   ============================================================= */

(function(exports) {
    class UndoLandSystem {
        constructor(gameState) {
            this.state = gameState;
            this.snapshot = null;
        }

        /**
         * 📸 土地を置く直前の完全状態ディープスナップショット保存
         */
        captureSnapshot() {
            if (!this.state) return;

            // 1. Grid のディープコピー
            const gridCopy = this.state.grid.map(row => 
                row.map(cell => ({
                    ...cell,
                    terrain: cell.terrain ? { ...cell.terrain } : null,
                    socketResource: cell.socketResource ? { ...cell.socketResource } : null
                }))
            );

            // 2. grantedConnectionPairs のコピー (Set -> Array)
            const connPairsCopy = Array.from(this.state.grantedConnectionPairs || []);

            // 3. mergedBlocks のコピー
            const mergedBlocksCopy = JSON.parse(JSON.stringify(this.state.mergedBlocks || {}));

            // 4. handOffering のコピー
            const handOfferingCopy = (this.state.handOffering || []).map(c => 
                c ? (c.isBlank ? { ...c, originalCard: c.originalCard ? { ...c.originalCard } : null } : { ...c }) : null
            );

            this.snapshot = {
                turn: this.state.turn,
                ember: this.state.ember,
                food: this.state.food,
                wood: this.state.wood,
                defense: this.state.defense,
                mystic: this.state.mystic,
                grid: gridCopy,
                grantedConnectionPairs: connPairsCopy,
                mergedBlocks: mergedBlocksCopy,
                handOffering: handOfferingCopy,
                hasPickedThisTurn: this.state.hasPickedThisTurn,
                mergeGroupCounter: this.state.mergeGroupCounter,
                placementGroupCounter: this.state.placementGroupCounter
            };

            this.updateUndoButtonUI(true);
        }

        /**
         * ↩️ 取り消し（Undo）の実行（100% 完璧なロールバック）
         */
        undo() {
            if (!this.snapshot || !this.state) return false;

            const s = this.snapshot;

            this.state.turn = s.turn;
            this.state.ember = s.ember;
            this.state.food = s.food;
            this.state.wood = s.wood;
            this.state.defense = s.defense;
            this.state.mystic = s.mystic;

            // 1. Grid の復原
            this.state.grid = s.grid.map(row => 
                row.map(cell => ({
                    ...cell,
                    terrain: cell.terrain ? { ...cell.terrain } : null,
                    socketResource: cell.socketResource ? { ...cell.socketResource } : null
                }))
            );

            // 2. grantedConnectionPairs の復原
            this.state.grantedConnectionPairs = new Set(s.grantedConnectionPairs);

            // 3. mergedBlocks の復原
            this.state.mergedBlocks = JSON.parse(JSON.stringify(s.mergedBlocks));

            // 4. handOffering の復原
            this.state.handOffering = s.handOffering.map(c => 
                c ? (c.isBlank ? { ...c, originalCard: c.originalCard ? { ...c.originalCard } : null } : { ...c }) : null
            );

            this.state.hasPickedThisTurn = s.hasPickedThisTurn;
            this.state.mergeGroupCounter = s.mergeGroupCounter;
            this.state.placementGroupCounter = s.placementGroupCounter;

            const I18n = window.I18n;
            const logMsg = (I18n && typeof I18n.t === 'function' && I18n.t("LOG_UNDO_LAND") !== "LOG_UNDO_LAND") ? I18n.t("LOG_UNDO_LAND") : "↩ 土地の配置を取り消しました。";
            this.state.addLog(logMsg);

            this.clearSnapshot();

            if (typeof window !== "undefined") {
                window.selectedCard = null;
                window.selectedCardIdx = -1;
                if (typeof window.render === "function") window.render();
            }

            return true;
        }

        /**
         * 🧹 確定時のスナップショット消去（TURN END や他の行動時）
         */
        clearSnapshot() {
            this.snapshot = null;
            this.updateUndoButtonUI(false);
        }

        /**
         * 🎨 「↩ 配置を取り消す」ボタンの表示/非表示UI制御
         */
        updateUndoButtonUI(show) {
            if (typeof document === "undefined") return;
            let btn = document.getElementById("btnUndoLandPlacement");
            if (!btn) {
                const container = document.body;
                btn = document.createElement("button");
                btn.id = "btnUndoLandPlacement";
                btn.className = "btn-undo-land-placement";
                const I18n = window.I18n;
                const labelText = (I18n && typeof I18n.t === 'function' && I18n.t("UI_UNDO_PLACEMENT_BTN") !== "UI_UNDO_PLACEMENT_BTN") ? I18n.t("UI_UNDO_PLACEMENT_BTN") : "配置を取り消す";
                btn.innerHTML = `↩ ${labelText}`;
                btn.style.cssText = `
                    position: fixed;
                    bottom: 180px;
                    left: 50%;
                    transform: translateX(-50%) scale(0.95);
                    background: rgba(231, 76, 60, 0.94);
                    color: #ffffff;
                    border: 1.5px solid #c0392b;
                    box-shadow: 0 6px 20px rgba(231, 76, 60, 0.5), 0 0 20px rgba(231, 76, 60, 0.3);
                    border-radius: 8px;
                    padding: 9px 20px;
                    font-size: 13px;
                    font-weight: bold;
                    cursor: pointer;
                    z-index: 100000;
                    opacity: 0;
                    pointer-events: none;
                    transition: all 0.2s cubic-bezier(0.16, 1, 0.3, 1);
                `;
                btn.onclick = () => this.undo();
                container.appendChild(btn);
            }

            if (show) {
                const I18n = window.I18n;
                btn.innerHTML = `↩ ${I18n ? I18n.t("UI_UNDO_PLACEMENT_BTN") : "配置を取り消す"}`;
                btn.style.opacity = "1";
                btn.style.pointerEvents = "auto";
                btn.style.transform = "translateX(-50%) scale(1)";
            } else {
                btn.style.opacity = "0";
                btn.style.pointerEvents = "none";
                btn.style.transform = "translateX(-50%) scale(0.95)";
            }
        }
    }

    exports.UndoLandSystem = UndoLandSystem;
    if (typeof window !== "undefined") {
        window.UndoLandSystem = UndoLandSystem;
    }
})(typeof exports !== "undefined" ? exports : window);
