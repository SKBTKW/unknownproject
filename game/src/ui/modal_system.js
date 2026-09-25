/* =============================================================
   game/src/ui/modal_system.js
   共通UIモジュール: ModalSystem (完全カプセル化・独立コンポーネント)
   ============================================================= */

(function(exports) {
    // 🎨 共通デザインシステムのCSS注入（既存要素に一切影響を与えないプレフィックス付きカプセルCSS）
    const MODAL_CSS = `
        /* 🛡️ ModalSystem 共通オーバーレイ・コンテナ */
        .modal-system-overlay {
            position: fixed;
            top: 0;
            left: 0;
            width: 100vw;
            height: 100vh;
            background: rgba(10, 13, 18, 0.78);
            backdrop-filter: blur(10px);
            -webkit-backdrop-filter: blur(10px);
            z-index: 250000;
            display: flex;
            align-items: center;
            justify-content: center;
            opacity: 0;
            pointer-events: none;
            transition: opacity 0.2s cubic-bezier(0.16, 1, 0.3, 1);
        }
        .modal-system-overlay.active {
            opacity: 1;
            pointer-events: auto;
        }

        /* 🖼️ スリム横帯アクションモーダル (完全センタリングデザイン) */
        .modal-system-strip-card {
            width: 90%;
            max-width: 580px;
            background: rgba(17, 22, 31, 0.95);
            border: 1.5px solid rgba(26, 188, 156, 0.5);
            box-shadow: 0 20px 50px rgba(0, 0, 0, 0.95), 0 0 30px rgba(26, 188, 156, 0.3);
            border-radius: 14px;
            padding: 22px 28px;
            color: #ffffff;
            font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
            text-align: center;
            transform: scale(0.92) translateY(0);
            transition: transform 0.2s cubic-bezier(0.16, 1, 0.3, 1);
            margin: auto;
        }
        .modal-system-overlay.active .modal-system-strip-card {
            transform: scale(1) translateY(0);
        }

        .modal-system-header-title {
            font-size: 18px;
            font-weight: 700;
            color: #ffffff;
            display: flex;
            align-items: center;
            justify-content: center;
            gap: 8px;
            margin-bottom: 10px;
            border-bottom: 1px solid rgba(255, 255, 255, 0.1);
            padding-bottom: 10px;
            text-align: center;
        }

        .modal-system-body-desc {
            font-size: 13px;
            color: #bdc3c7;
            line-height: 1.5;
            margin-bottom: 18px;
            text-align: center;
        }
        .modal-system-cost-badge {
            display: inline-block;
            background: rgba(241, 196, 15, 0.15);
            border: 1px solid rgba(241, 196, 15, 0.4);
            color: #f1c40f;
            padding: 3px 10px;
            border-radius: 4px;
            font-size: 12px;
            font-weight: 600;
            margin: 6px auto 0 auto;
        }

        .modal-system-checkbox-label {
            display: inline-flex;
            align-items: center;
            justify-content: center;
            gap: 8px;
            font-size: 12.5px;
            color: #1abc9c;
            cursor: pointer;
            margin: 12px auto 16px auto;
            user-select: none;
        }
        .modal-system-checkbox {
            cursor: pointer;
            accent-color: #1abc9c;
            width: 15px;
            height: 15px;
        }

        .modal-system-actions {
            display: flex;
            justify-content: center;
            gap: 16px;
        }

        .modal-system-btn {
            padding: 9px 22px;
            border-radius: 8px;
            font-size: 13px;
            font-weight: 700;
            cursor: pointer;
            border: none;
            transition: all 0.15s ease;
            display: flex;
            align-items: center;
            gap: 6px;
        }
        .modal-system-btn-confirm {
            background: #1abc9c;
            color: #0d201a;
            box-shadow: 0 4px 15px rgba(26, 188, 156, 0.4);
        }
        .modal-system-btn-confirm:hover {
            background: #16a085;
            color: #ffffff;
            transform: translateY(-1px);
            box-shadow: 0 6px 20px rgba(26, 188, 156, 0.6);
        }
        .modal-system-btn-cancel {
            background: rgba(255, 255, 255, 0.08);
            color: #bdc3c7;
            border: 1px solid rgba(255, 255, 255, 0.15);
        }
        .modal-system-btn-cancel:hover {
            background: rgba(255, 255, 255, 0.15);
            color: #ffffff;
        }
        .modal-system-choice-list {
            display: grid;
            gap: 10px;
            margin: 14px 0 18px;
        }
        .modal-system-choice-btn {
            width: 100%;
            text-align: left;
            justify-content: space-between;
            background: rgba(255, 255, 255, 0.07);
            color: #ffffff;
            border: 1px solid rgba(255, 255, 255, 0.14);
        }
        .modal-system-choice-btn:hover:not(:disabled) {
            background: rgba(26, 188, 156, 0.16);
            border-color: rgba(26, 188, 156, 0.55);
        }
        .modal-system-choice-btn:disabled {
            opacity: 0.4;
            cursor: not-allowed;
        }
        .modal-system-choice-copy {
            display: flex;
            flex-direction: column;
            gap: 3px;
        }
        .modal-system-choice-desc {
            color: #bdc3c7;
            font-size: 11px;
            font-weight: 500;
        }
        .modal-system-choice-cost {
            color: #f1c40f;
            white-space: nowrap;
        }

        /* 🎬 ターン開始・試練アイキャッチ演出 (Eyecatch Banner) */
        .modal-system-eyecatch-banner {
            width: 100vw;
            background: linear-gradient(90deg, rgba(26, 188, 156, 0) 0%, rgba(17, 22, 31, 0.95) 20%, rgba(17, 22, 31, 0.95) 80%, rgba(26, 188, 156, 0) 100%);
            border-top: 2px solid #1abc9c;
            border-bottom: 2px solid #1abc9c;
            box-shadow: 0 0 40px rgba(26, 188, 156, 0.4);
            padding: 24px 0;
            text-align: center;
            color: #ffffff;
            transform: scaleY(0.8);
            opacity: 0;
            transition: all 0.3s cubic-bezier(0.16, 1, 0.3, 1);
        }
        .modal-system-overlay.active .modal-system-eyecatch-banner {
            transform: scaleY(1);
            opacity: 1;
        }

        .modal-system-eyecatch-title {
            font-size: 28px;
            font-weight: 900;
            letter-spacing: 2px;
            color: #ffffff;
            text-shadow: 0 0 15px rgba(26, 188, 156, 0.8);
        }
        .modal-system-eyecatch-sub {
            font-size: 14px;
            color: #1abc9c;
            margin-top: 6px;
            letter-spacing: 1px;
        }
    `;

    class ModalSystem {
        static init() {
            if (typeof document === "undefined") return;
            if (document.getElementById("modal-system-styles")) return;

            const styleEl = document.createElement("style");
            styleEl.id = "modal-system-styles";
            styleEl.textContent = MODAL_CSS;
            document.head.appendChild(styleEl);

            if (!document.getElementById("modalSystemOverlay")) {
                const overlay = document.createElement("div");
                overlay.id = "modalSystemOverlay";
                overlay.className = "modal-system-overlay";
                overlay.innerHTML = `
                    <div id="modalSystemContent" style="width:100%; display:flex; justify-content:center;"></div>
                `;
                document.body.appendChild(overlay);
            }
        }

        /**
         * 📜 1. コマンドカード発動確認ダイアログ
         */
        static showConfirmDialog({ title, costText, descText, checkboxLabel, confirmLabel, cancelLabel, onConfirm, onCancel }) {
            this.init();
            const overlay = document.getElementById("modalSystemOverlay");
            const content = document.getElementById("modalSystemContent");

            const I18n = (typeof globalThis !== 'undefined' && globalThis.I18n) ? globalThis.I18n : (typeof window !== 'undefined' ? window.I18n : { t: k => k });
            const cText = costText ? `<div class="modal-system-cost-badge">${costText}</div>` : '';
            const chkHtml = checkboxLabel ? `
                <label class="modal-system-checkbox-label">
                    <input type="checkbox" id="modalSysCheckbox" class="modal-system-checkbox">
                    <span>${checkboxLabel}</span>
                </label>
            ` : '';
            const confirmBtnText = confirmLabel || (I18n ? I18n.t("UI_ACTIVATE_CMD") : "⚡ 発動する");
            const cancelBtnText = cancelLabel || I18n.t("UI_CANCEL");

            content.innerHTML = `
                <div class="modal-system-strip-card">
                    <div class="modal-system-header-title">
                        <span>${title}</span>
                    </div>
                    <div class="modal-system-body-desc">
                        ${descText || ''}
                        ${cText}
                    </div>
                    ${chkHtml}
                    <div class="modal-system-actions">
                        <button id="modalSysBtnCancel" class="modal-system-btn modal-system-btn-cancel">${cancelBtnText}</button>
                        <button id="modalSysBtnConfirm" class="modal-system-btn modal-system-btn-confirm">${confirmBtnText}</button>
                    </div>
                </div>
            `;

            overlay.classList.add("active");

            const close = () => {
                overlay.classList.remove("active");
                setTimeout(() => { content.innerHTML = ""; }, 200);
            };

            document.getElementById("modalSysBtnConfirm").onclick = () => {
                const chk = document.getElementById("modalSysCheckbox");
                const isChecked = chk ? chk.checked : false;
                close();
                if (typeof onConfirm === "function") onConfirm(isChecked);
            };

            document.getElementById("modalSysBtnCancel").onclick = () => {
                close();
                if (typeof onCancel === "function") onCancel();
            };

            overlay.onclick = (e) => {
                if (e.target === overlay) {
                    close();
                    if (typeof onCancel === "function") onCancel();
                }
            };
        }

        static showChoiceDialog({ title, descText, choices = [], cancelLabel, onSelect, onCancel }) {
            this.init();
            const overlay = document.getElementById("modalSystemOverlay");
            const content = document.getElementById("modalSystemContent");
            const I18n = (typeof globalThis !== 'undefined' && globalThis.I18n) ? globalThis.I18n : (typeof window !== 'undefined' ? window.I18n : { t: k => k });
            const cancelBtnText = cancelLabel || (I18n ? I18n.t("UI_CANCEL") : "✖ キャンセル");

            const choiceHtml = choices.map((choice, index) => `
                <button class="modal-system-btn modal-system-choice-btn" data-choice-index="${index}" ${choice.disabled ? "disabled" : ""}>
                    <span class="modal-system-choice-copy">
                        <strong>${choice.label || choice.id || ""}</strong>
                        <span class="modal-system-choice-desc">${choice.description || ""}</span>
                    </span>
                    <span class="modal-system-choice-cost">${choice.costText || ""}</span>
                </button>
            `).join("");

            content.innerHTML = `
                <div class="modal-system-strip-card">
                    <div class="modal-system-header-title"><span>${title}</span></div>
                    <div class="modal-system-body-desc">${descText || ""}</div>
                    <div class="modal-system-choice-list">${choiceHtml}</div>
                    <div class="modal-system-actions">
                        <button id="modalSysBtnCancel" class="modal-system-btn modal-system-btn-cancel">${cancelBtnText}</button>
                    </div>
                </div>
            `;

            overlay.classList.add("active");
            const close = () => {
                overlay.classList.remove("active");
                setTimeout(() => { content.innerHTML = ""; }, 200);
            };
            content.querySelectorAll("[data-choice-index]").forEach(button => {
                button.onclick = () => {
                    const choice = choices[Number(button.dataset.choiceIndex)];
                    if (!choice || choice.disabled) return;
                    close();
                    if (typeof onSelect === "function") onSelect(choice);
                };
            });
            document.getElementById("modalSysBtnCancel").onclick = () => {
                close();
                if (typeof onCancel === "function") onCancel();
            };
            overlay.onclick = e => {
                if (e.target !== overlay) return;
                close();
                if (typeof onCancel === "function") onCancel();
            };
        }

        /**
         * 🎬 2. ターン開始 / 試練アイキャッチ演出
         */
        static showEyecatch({ title, subtitle, durationMs = 1800, onComplete }) {
            this.init();
            const overlay = document.getElementById("modalSystemOverlay");
            const content = document.getElementById("modalSystemContent");

            content.innerHTML = `
                <div class="modal-system-eyecatch-banner">
                    <div class="modal-system-eyecatch-title">${title}</div>
                    <div class="modal-system-eyecatch-sub">${subtitle || ''}</div>
                </div>
            `;

            overlay.classList.add("active");

            setTimeout(() => {
                overlay.classList.remove("active");
                setTimeout(() => {
                    content.innerHTML = "";
                    if (typeof onComplete === "function") onComplete();
                }, 300);
            }, durationMs);
        }
    }

    exports.ModalSystem = ModalSystem;

    if (typeof window !== "undefined") {
        window.ModalSystem = ModalSystem;
    }
    if (typeof globalThis !== "undefined") {
        globalThis.ModalSystem = ModalSystem;
    }
})(typeof exports !== "undefined" ? exports : (typeof window !== "undefined" ? window : (typeof globalThis !== "undefined" ? globalThis : {})));

const ModalSystem = (typeof globalThis !== "undefined" && globalThis.ModalSystem) ? globalThis.ModalSystem : null;
export { ModalSystem };
export default ModalSystem;



