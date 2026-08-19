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

            // トグルボタン
            this.btnEl = document.createElement("button");
            this.btnEl.className = "btn-log-toggle-header";
            this.btnEl.id = "btnLogToggleHeader";
            this.btnEl.onclick = (e) => this.toggle(e);
            this.btnEl.style.cssText = "font-size: 20px !important; padding: 10px 22px !important;";
            this.btnEl.innerHTML = `📜 <span id="lblLogTitleHeader">ログ</span> <span id="logHeaderArrow" style="margin-left:4px; font-weight:900;">▽</span>`;

            // ドロップダウンパネル (初期格納: display: none)
            this.panelEl = document.createElement("div");
            this.panelEl.className = "log-dropdown-panel-header";
            this.panelEl.id = "logDropdownPanelHeader";
            this.panelEl.style.cssText = "display: none; width: 680px !important; max-height: 480px !important;";

            this.panelEl.innerHTML = `
                <div class="log-dropdown-header-bar" style="padding: 12px 20px !important; font-size: 20px !important;">
                    <span id="lblLogDropdownTitle">📜 システム動作・内政ログ一覧</span>
                    <span style="cursor:pointer; font-size:22px !important;" id="btnCloseLogPanel">✕</span>
                </div>
                <div id="logContent" class="log-content-header" style="padding: 16px 20px !important; font-size: 18px !important; gap: 10px !important;">
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
                this.contentEl.innerHTML = `<div style="color:#7f8c8d; font-size:18px;">※内政・操作ログがここに記録されます。</div>`;
                return;
            }

            this.contentEl.innerHTML = this.logs.map(log => `
                <div style="border-bottom:1px solid rgba(44, 62, 80, 0.6); padding-bottom:6px; margin-bottom:6px; font-size:18px; line-height:1.6;">
                    <span style="color:#1abc9c; font-weight:bold; margin-right:8px;">[T${log.turn}]</span>
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
