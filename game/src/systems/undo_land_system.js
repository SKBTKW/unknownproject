/* =============================================================
   game/src/systems/undo_land_system.js
   当ターン限定・ホバー追従型「↩ 配置を取り消す」独立モジュール
   ============================================================= */

(function(exports) {
    class UndoLandSystem {
        constructor(gameState) {
            this.state = gameState;
            this.snapshot = null;
            this.placedCellCoords = []; // 当ターンで配置されたマス {r, c} のリスト
            this.initHoverTooltipDOM();
        }

        /**
         * 📸 土地を置く直前のディープスナップショット保存 ＋ 置いたマス座標の記録
         */
        captureSnapshot(placedCoords = []) {
            if (!this.state) return;

            const gridCopy = this.state.grid.map(row => 
                row.map(cell => ({
                    ...cell,
                    terrain: cell.terrain ? { ...cell.terrain } : null,
                    socketResource: cell.socketResource ? { ...cell.socketResource } : null
                }))
            );

            const connPairsCopy = Array.from(this.state.grantedConnectionPairs || []);
            const mergedBlocksCopy = JSON.parse(JSON.stringify(this.state.mergedBlocks || {}));
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

            this.placedCellCoords = placedCoords;
        }

        /**
         * 🔍 マウスオーバー位置が「当ターンで置いたばかりの土地」か判定
         */
        isCellPlacedThisTurn(r, c) {
            if (!this.snapshot || !this.state || !this.state.hasPickedThisTurn) return false;
            if (!this.placedCellCoords || this.placedCellCoords.length === 0) return false;
            return this.placedCellCoords.some(pos => pos.r === r && pos.c === c);
        }

        /**
         * ↩️ 取り消し（Undo）の実行
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

            this.state.grid = s.grid.map(row => 
                row.map(cell => ({
                    ...cell,
                    terrain: cell.terrain ? { ...cell.terrain } : null,
                    socketResource: cell.socketResource ? { ...cell.socketResource } : null
                }))
            );

            this.state.grantedConnectionPairs = new Set(s.grantedConnectionPairs);
            this.state.mergedBlocks = JSON.parse(JSON.stringify(s.mergedBlocks));
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
         * 🧹 確定（次ターン進出など）
         */
        clearSnapshot() {
            this.snapshot = null;
            this.placedCellCoords = [];
            this.hideHoverTooltip();
        }

        /**
         * 🎨 マウス追従型「↩ クリックで配置を取り消す」ツールチップの制御
         */
        initHoverTooltipDOM() {
            if (typeof document === "undefined") return;
            if (document.getElementById("undoHoverCursorTooltip")) return;

            const tt = document.createElement("div");
            tt.id = "undoHoverCursorTooltip";
            tt.style.cssText = `
                position: fixed;
                pointer-events: none;
                z-index: 300000;
                display: none;
                background: rgba(231, 76, 60, 0.94);
                color: #ffffff;
                border: 1px solid #c0392b;
                box-shadow: 0 4px 15px rgba(231, 76, 60, 0.5), 0 0 15px rgba(231, 76, 60, 0.4);
                padding: 6px 14px;
                border-radius: 6px;
                font-size: 12px;
                font-weight: bold;
                white-space: nowrap;
                backdrop-filter: blur(4px);
                transition: opacity 0.15s ease;
            `;
            const I18n = window.I18n;
            const labelText = (I18n && typeof I18n.t === 'function' && I18n.t("UI_HOVER_CLICK_TO_UNDO") !== "UI_HOVER_CLICK_TO_UNDO") ? I18n.t("UI_HOVER_CLICK_TO_UNDO") : "↩ クリックで配置を取り消す";
            tt.innerHTML = labelText;
            document.body.appendChild(tt);
        }

        showHoverTooltip(e, r, c) {
            if (!this.isCellPlacedThisTurn(r, c)) {
                this.hideHoverTooltip();
                return;
            }
            const tt = document.getElementById("undoHoverCursorTooltip");
            if (!tt) return;

            const I18n = window.I18n;
            const labelText = (I18n && typeof I18n.t === 'function' && I18n.t("UI_HOVER_CLICK_TO_UNDO") !== "UI_HOVER_CLICK_TO_UNDO") ? I18n.t("UI_HOVER_CLICK_TO_UNDO") : "↩ クリックで配置を取り消す";
            tt.innerHTML = labelText;

            tt.style.display = "block";
            if (e) {
                tt.style.top = (e.clientY + 18) + "px";
                tt.style.left = (e.clientX + 16) + "px";
            }
        }

        updateHoverTooltipPosition(e) {
            const tt = document.getElementById("undoHoverCursorTooltip");
            if (tt && tt.style.display !== "none" && e) {
                tt.style.top = (e.clientY + 18) + "px";
                tt.style.left = (e.clientX + 16) + "px";
            }
        }

        hideHoverTooltip() {
            if (typeof document === "undefined") return;
            const tt = document.getElementById("undoHoverCursorTooltip");
            if (tt) tt.style.display = "none";
        }
    }

    exports.UndoLandSystem = UndoLandSystem;
    if (typeof window !== "undefined") {
        window.UndoLandSystem = UndoLandSystem;
    }
})(typeof exports !== "undefined" ? exports : window);
