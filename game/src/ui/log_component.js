/* =============================================================
   game/src/ui/log_component.js
   メインエリア左上隅 2倍拡大ログ表示 カプセル化UIコンポーネント
   ============================================================= */

(function(exports) {
    class LogComponent {
        constructor() {
            this.containerEl = null;
            this.btnEl = null;
            this.panelEl = null;
            this.arrowEl = null;
            this.contentEl = null;
            this.isOpen = false;
            this.logs = [];
        }

        /**
         * 🏗️ UIの初期構築 (指定されたコンテナ内へレイアウト干渉なしでマウント)
         */
        mount(containerEl) {
            if (!containerEl) return;
            this.containerEl = containerEl;
            this.containerEl.innerHTML = ""; // 初期化

            // Wrapper
            const wrapper = document.createElement("div");
            wrapper.className = "main-top-left-log-wrapper";

            // 0.75x (75%) スケール トグルボタン
            this.btnEl = document.createElement("button");
            this.btnEl.className = "btn-log-toggle-header";
            this.btnEl.id = "btnLogToggleHeader";
            this.btnEl.onclick = (e) => this.toggle(e);
            this.btnEl.style.cssText = "font-size: 15px !important; padding: 7px 16px !important;";
            this.btnEl.innerHTML = `📜 <span id="lblLogTitleHeader">ログ</span> <span id="logHeaderArrow" style="margin-left:4px; font-weight:900;">▽</span>`;

            // 0.75x (75%) スケール ドロップダウンパネル
            this.panelEl = document.createElement("div");
            this.panelEl.className = "log-dropdown-panel-header";
            this.panelEl.id = "logDropdownPanelHeader";
            this.panelEl.style.cssText = "display: none; width: 510px !important; max-height: 360px !important;";

            this.panelEl.innerHTML = `
                <div class="log-dropdown-header-bar" style="padding: 9px 15px !important; font-size: 15px !important;">
                    <span id="lblLogDropdownTitle">📜 システム動作・内政ログ一覧</span>
                    <span style="cursor:pointer; font-size:17px !important;" id="btnCloseLogPanel">✕</span>
                </div>
                <div id="logContent" class="log-content-header" style="padding: 12px 15px !important; font-size: 14px !important; gap: 8px !important;">
                    <div style="color:#7f8c8d;" id="lblLogSub"></div>
                </div>
            `;

            wrapper.appendChild(this.btnEl);
            wrapper.appendChild(this.panelEl);
            this.containerEl.appendChild(wrapper);

            this.arrowEl = this.btnEl.querySelector("#logHeaderArrow");
            this.contentEl = this.panelEl.querySelector("#logContent");

            const closeBtn = this.panelEl.querySelector("#btnCloseLogPanel");
            if (closeBtn) {
                closeBtn.onclick = (e) => this.toggle(e);
            }

            this.renderLogs();
        }

        /**
         * 📜 ログメッセージの動的追加
         */
        addLog(msg, turn = 1) {
            this.logs.unshift({ turn, message: msg });
            if (this.logs.length > 50) this.logs.pop();
            this.renderLogs();
        }

        /**
         * 🔄 ログ一覧のレンダリング
         */
        renderLogs() {
            if (!this.contentEl) return;
            if (this.logs.length === 0) {
                this.contentEl.innerHTML = `<div style="color:#7f8c8d; font-size:14px;">※内政・操作ログがここに記録されます。</div>`;
                return;
            }

            this.contentEl.innerHTML = this.logs.map(log => `
                <div style="border-bottom:1px solid rgba(44, 62, 80, 0.6); padding-bottom:5px; margin-bottom:5px; font-size:14px; line-height:1.5;">
                    <span style="color:#1abc9c; font-weight:bold; margin-right:6px;">[T${log.turn}]</span>
                    <span>${log.message}</span>
                </div>
            `).join("");
        }

        /**
         * ↕️ トグル開閉制御
         */
        toggle(e) {
            if (e) e.stopPropagation();
            if (!this.panelEl) return;

            this.isOpen = !this.isOpen;
            this.panelEl.style.display = this.isOpen ? "flex" : "none";
            if (this.arrowEl) {
                this.arrowEl.innerText = this.isOpen ? "△" : "▽";
            }
        }
    }

    const instance = new LogComponent();
    if (typeof window !== "undefined") {
        window.LogComponent = instance;
    }
    if (typeof exports !== "undefined") {
        exports.LogComponent = instance;
    }
})(typeof exports !== "undefined" ? exports : window);
