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
            this.isOpen = false; // 🔒 初期状態は折りたたまれた状態で開始
            this.logs = [];
        }

        /**
         * 🏗️ UIの初期構築 (指定されたコンテナ内へレイアウト干渉なしでマウント)
         */
        mount(containerEl, state = null) {
            if (!containerEl) return;
            this.containerEl = containerEl;
            this.containerEl.innerHTML = ""; // 初期化

            // Wrapper
            const wrapper = document.createElement("div");
            wrapper.className = "main-top-left-log-wrapper";

            // 0.75x (75%) スケール トグルボタン
            const I18n = (typeof globalThis !== 'undefined' && globalThis.I18n) ? globalThis.I18n : (typeof window !== 'undefined' ? window.I18n : { t: k => k });
            const logTitle = I18n ? I18n.t("UI_LOG_TITLE_HEADER") : "ログ";
            const dropdownTitle = I18n ? I18n.t("UI_LOG_DROPDOWN_TITLE") : "📜 システム・内政ログ";

            this.btnEl = document.createElement("button");
            this.btnEl.className = "btn-log-toggle-header";
            this.btnEl.id = "btnLogToggleHeader";
            this.btnEl.onclick = (e) => this.toggle(e);
            this.btnEl.style.cssText = "font-size: 15px !important; padding: 7px 16px !important; white-space: nowrap !important; display: inline-flex !important; align-items: center !important; gap: 6px !important;";
            this.btnEl.innerHTML = `📜 <span id="lblLogTitleHeader">${logTitle}</span> <span id="logHeaderArrow" style="margin-left:4px; font-weight:900;">▽</span>`;

            // 700px x 400px ドロップダウンパネル (初期状態は display: none)
            this.panelEl = document.createElement("div");
            this.panelEl.className = "log-dropdown-panel-header";
            this.panelEl.id = "logDropdownPanelHeader";
            this.panelEl.style.cssText = "display: none; width: 700px !important; max-height: 400px !important; box-shadow: 0 10px 30px rgba(0,0,0,0.9), 0 0 16px rgba(26,188,156,0.35); border: 2px solid #1abc9c; border-radius: 10px; background: #11141d; overflow: hidden; z-index: 950;";

            this.panelEl.innerHTML = `
                <div class="log-dropdown-header-bar" style="padding: 9px 16px !important; font-size: 14px !important; background: #19202c; display: flex; justify-content: space-between; align-items: center; border-bottom: 1px solid #2a3547;">
                    <span id="lblLogDropdownTitle" style="font-weight: bold; color: #1abc9c;">${dropdownTitle}</span>
                    <span style="cursor:pointer; font-size:16px !important; color: #a4b0be; font-weight: bold;" id="btnCloseLogPanel">✕</span>
                </div>
                <div id="logContent" class="log-content-header" style="padding: 10px 16px !important; font-size: 13px !important; gap: 8px !important; max-height: 345px !important; overflow-y: auto !important; color: #dcdde1;">
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

            if (state) {
                this.importStateLogs(state);
            } else {
                this.renderLogs();
            }
        }

        /**
         * 📥 GameState から蓄積ログを一括インポート
         */
        importStateLogs(state) {
            if (!state || !Array.isArray(state.gameLogs)) return;
            const I18n = (typeof globalThis !== 'undefined' && globalThis.I18n) ? globalThis.I18n : (typeof window !== 'undefined' ? window.I18n : { t: k => k });

            this.logs = [];
            // 逆順（古い順）で取り出して最新が先頭に来るように
            [...state.gameLogs].reverse().forEach(rawMsg => {
                let msg = rawMsg;
                if (typeof msg === "string" && msg.startsWith("LOG_")) {
                    msg = I18n.t(msg);
                }
                let turn = state.turn || 1;
                if (typeof msg === "string") {
                    const match = msg.match(/^\[T(\d+)\]\s*(.*)$/);
                    if (match) {
                        turn = parseInt(match[1], 10);
                        msg = match[2];
                    }
                }
                this.logs.unshift({ turn, message: msg });
            });
            this.renderLogs();
        }

        /**
         * 📜 ログメッセージの動的追加（開閉状態に関係なく常に裏で記録・蓄積）
         */
        addLog(msg, turn = 1) {
            // [T1] などのプレフィックスがあれば整形
            let cleanMsg = msg;
            let displayTurn = turn;
            if (typeof msg === "string") {
                const match = msg.match(/^\[T(\d+)\]\s*(.*)$/);
                if (match) {
                    displayTurn = parseInt(match[1], 10);
                    cleanMsg = match[2];
                }
            }

            this.logs.unshift({ turn: displayTurn, message: cleanMsg });
            if (this.logs.length > 100) this.logs.pop(); // 最大100件まで保持

            // 閉じていても裏でDOM・状態を常に更新
            this.renderLogs();
            this.updateButtonLabel();
        }

        /**
         * 🏷️ トグルボタンのラベル・バッジ更新（閉じていても件数がわかる）
         */
        updateButtonLabel() {
            const I18n = (typeof globalThis !== 'undefined' && globalThis.I18n) ? globalThis.I18n : (typeof window !== 'undefined' ? window.I18n : { t: k => k });
            const titleEl = this.btnEl ? this.btnEl.querySelector("#lblLogTitleHeader") : null;
            if (titleEl) {
                const countText = this.logs.length > 0 ? ` (${this.logs.length})` : "";
                const logLabel = I18n ? I18n.t("UI_LOG_TITLE_HEADER") : "ログ";
                titleEl.innerText = `${logLabel}${countText}`;
            }
        }

        /**
         * 🔄 ログ一覧のレンダリング
         */
        renderLogs() {
            const I18n = (typeof globalThis !== 'undefined' && globalThis.I18n) ? globalThis.I18n : (typeof window !== 'undefined' ? window.I18n : { t: k => k });
            const targetEl = this.contentEl || (typeof document !== "undefined" ? document.getElementById("logContent") : null);
            if (!targetEl) return;

            if (this.logs.length === 0) {
                const placeholder = I18n ? I18n.t("UI_LOG_EMPTY_PLACEHOLDER") : "※内部・操作ログがここに記録されます。";
                targetEl.innerHTML = `<div style="color:#7f8c8d; font-size:14px; padding:4px;">${placeholder}</div>`;
                return;
            }

            targetEl.innerHTML = this.logs.map(log => `
                <div class="log-item" style="border-bottom:1px solid rgba(44, 62, 80, 0.6); padding:4px 0; margin-bottom:4px; font-size:14px; line-height:1.45;">
                    <span style="color:#1abc9c; font-weight:bold; margin-right:6px;">[T${log.turn}]</span>
                    <span>${log.message}</span>
                </div>
            `).join("");

            this.updateButtonLabel();
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
            if (this.isOpen) {
                this.renderLogs();
            }
        }
    }

    const instance = new LogComponent();
    if (typeof window !== "undefined") {
        window.LogComponent = instance;
    }
    if (typeof globalThis !== "undefined") {
        globalThis.LogComponent = instance;
    }
})(typeof exports !== "undefined" ? exports : (typeof window !== "undefined" ? window : (typeof globalThis !== "undefined" ? globalThis : {})));

const LogComponent = (typeof globalThis !== "undefined" && globalThis.LogComponent) ? globalThis.LogComponent : null;
export { LogComponent };
export default LogComponent;



