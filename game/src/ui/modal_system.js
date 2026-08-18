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

        /* 🖼️ スリム横帯アクションモーダル (確認ダイアログ) */
        .modal-system-strip-card {
            width: 90%;
            max-width: 580px;
            background: rgba(17, 22, 31, 0.94);
            border: 1.5px solid rgba(26, 188, 156, 0.5);
            box-shadow: 0 20px 50px rgba(0, 0, 0, 0.95), 0 0 30px rgba(26, 188, 156, 0.3);
            border-radius: 14px;
            padding: 18px 24px;
            color: #ffffff;
            font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
            transform: scale(0.92) translateY(10px);
            transition: transform 0.2s cubic-bezier(0.16, 1, 0.3, 1);
        }
        .modal-system-overlay.active .modal-system-strip-card {
            transform: scale(1) translateY(0);
        }

        .modal-system-header-title {
            font-size: 17px;
            font-weight: 700;
            color: #ffffff;
            display: flex;
            align-items: center;
            gap: 8px;
            margin-bottom: 8px;
            border-bottom: 1px solid rgba(255, 255, 255, 0.1);
            padding-bottom: 8px;
        }

        .modal-system-body-desc {
            font-size: 13px;
            color: #bdc3c7;
            line-height: 1.5;
            margin-bottom: 16px;
        }
        .modal-system-cost-badge {
            display: inline-block;
            background: rgba(241, 196, 15, 0.15);
            border: 1px solid rgba(241, 196, 15, 0.4);
            color: #f1c40f;
            padding: 2px 8px;
            border-radius: 4px;
            font-size: 12px;
            font-weight: 600;
            margin-top: 4px;
        }

        .modal-system-actions {
            display: flex;
            justify-content: flex-end;
            gap: 12px;
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
        static showConfirmDialog({ title, costText, descText, confirmLabel, cancelLabel, onConfirm, onCancel }) {
            this.init();
            const overlay = document.getElementById("modalSystemOverlay");
            const content = document.getElementById("modalSystemContent");

            const cText = costText ? `<div class="modal-system-cost-badge">${costText}</div>` : '';
            const confirmBtnText = confirmLabel || "⚡ 発動する";
            const cancelBtnText = cancelLabel || "✖ キャンセル";

            content.innerHTML = `
                <div class="modal-system-strip-card">
                    <div class="modal-system-header-title">
                        <span>${title}</span>
                    </div>
                    <div class="modal-system-body-desc">
                        ${descText || ''}
                        ${cText}
                    </div>
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
                close();
                if (typeof onConfirm === "function") onConfirm();
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
})(typeof exports !== "undefined" ? exports : window);
