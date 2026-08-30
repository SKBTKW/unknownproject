/**
 * 🎲 DiceWidgetComponent (画面右下隅 完全受動ダイス HUD)
 * 
 * 責務:
 * 1. 画面右下隅の安全領域 (手札トレイ上部) にコンパクトに浮遊する。
 * 2. pointer-events: none により、プレイヤーの盤面・手札操作を一切阻害しない。
 * 3. UILayoutConfig から一元レイアウトと 3 段階 importance (NORMAL / TACTICAL / CRITICAL) を適用。
 * 4. CSS 3D Transform による小気味よい 0.7 秒回転 ➔ 出目確定 ➔ 結果帯バッジ ➔ 自動フェードアウト。
 */

import { UILayoutConfig } from './layout_config.js';
import { I18n } from '../i18n.js';

export class DiceWidgetComponent {
    constructor() {
        this.containerEl = null;
        this.currentResolve = null;
        if (typeof document !== "undefined") {
            this.initDOM();
        }
    }

    /**
     * 🏗️ DOM 要素の初期構築 ＆ スタイル注入
     */
    initDOM() {
        if (this.containerEl || typeof document === "undefined") return;

        const config = (UILayoutConfig && UILayoutConfig.diceWidget && UILayoutConfig.diceWidget.desktop) || {
            position: "fixed",
            right: "24px",
            bottom: "135px",
            width: "180px",
            zIndex: 850,
            pointerEvents: "none"
        };

        const root = document.createElement("div");
        root.id = "diceWidgetRoot";
        root.className = "dice-widget-hud";
        root.style.position = config.position;
        root.style.right = config.right;
        root.style.bottom = config.bottom;
        root.style.width = config.width;
        root.style.zIndex = String(config.zIndex);
        root.style.pointerEvents = config.pointerEvents;
        root.style.opacity = "0";
        root.style.transform = "translateY(12px) scale(0.96)";
        root.style.transition = "opacity 0.22s ease, transform 0.22s cubic-bezier(0.16, 1, 0.3, 1)";

        document.body.appendChild(root);
        this.containerEl = root;
        this.injectCSS();
    }

    /**
     * 🎨 クリーンな CSS スタイル定義 (CSS 3D キューブ ＆ アニメーション)
     */
    injectCSS() {
        if (typeof document === "undefined" || document.getElementById("diceWidgetStyle")) return;
        const style = document.createElement("style");
        style.id = "diceWidgetStyle";
        style.textContent = `
            .dice-widget-hud {
                box-sizing: border-box;
                padding: 10px 14px;
                border-radius: 10px;
                background: rgba(15, 23, 42, 0.88);
                backdrop-filter: blur(8px);
                -webkit-backdrop-filter: blur(8px);
                border: 1px solid #475569;
                color: #f8fafc;
                font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
                user-select: none;
            }
            .dice-widget-header {
                font-size: 11px;
                font-weight: 600;
                color: #94a3b8;
                margin-bottom: 6px;
                display: flex;
                align-items: center;
                justify-content: space-between;
                white-space: nowrap;
            }
            .dice-widget-stage {
                display: flex;
                align-items: center;
                justify-content: center;
                gap: 12px;
                perspective: 600px;
                height: 42px;
            }
            .dice-cube {
                width: 32px;
                height: 32px;
                position: relative;
                transform-style: preserve-3d;
                transition: transform 0.65s cubic-bezier(0.2, 0.8, 0.2, 1);
            }
            .dice-face {
                position: absolute;
                width: 32px;
                height: 32px;
                background: #f8fafc;
                border: 1px solid #cbd5e1;
                border-radius: 6px;
                display: flex;
                align-items: center;
                justify-content: center;
                font-size: 15px;
                font-weight: bold;
                color: #0f172a;
                box-shadow: inset 0 0 4px rgba(0, 0, 0, 0.15);
            }
            .dice-face-1 { transform: translateZ(16px); }
            .dice-face-6 { transform: rotateY(180deg) translateZ(16px); }
            .dice-face-3 { transform: rotateX(90deg) translateZ(16px); }
            .dice-face-4 { transform: rotateX(-90deg) translateZ(16px); }
            .dice-face-5 { transform: rotateY(90deg) translateZ(16px); }
            .dice-face-2 { transform: rotateY(-90deg) translateZ(16px); }

            .dice-modifier-badge {
                font-size: 13px;
                font-weight: bold;
                color: #38bdf8;
            }
            .dice-widget-footer {
                margin-top: 6px;
                display: flex;
                align-items: center;
                justify-content: center;
                font-size: 12px;
                font-weight: bold;
                padding: 3px 8px;
                border-radius: 4px;
                transition: background-color 0.2s ease, color 0.2s ease;
            }
        `;
        document.head.appendChild(style);
    }

    /**
     * 🎲 出目に応じたキューブ回転角度の取得 (ピタッと正面を向く角度)
     */
    getFaceRotation(face) {
        switch (face) {
            case 1: return { x: 0, y: 0 };
            case 6: return { x: 0, y: 180 };
            case 3: return { x: -90, y: 0 };
            case 4: return { x: 90, y: 0 };
            case 5: return { x: 0, y: -90 };
            case 2: return { x: 0, y: 90 };
            default: return { x: 0, y: 0 };
        }
    }

    /**
     * 🎬 演出の再生 (受動 HUD)
     * @param {Object} event - { result, context, feedback }
     * @returns {Promise<void>}
     */
    async play(event) {
        if (!event || !event.result) return;
        if (typeof document === "undefined" || !this.containerEl) {
            // ヘッドレス環境では即座に完了
            return;
        }

        const { result, context, feedback } = event;
        const keptDice = (result.dice && result.dice.kept) || [1, 1];
        const importance = (feedback && feedback.importance) || "NORMAL";
        const themes = (UILayoutConfig && UILayoutConfig.diceWidget && UILayoutConfig.diceWidget.importanceThemes) || {};
        const theme = themes[importance] || {
            rollDurationMs: 650,
            displayDurationMs: 1000,
            borderColor: "#64748b",
            badgeBg: "#1e293b",
            badgeColor: "#f8fafc",
            glowShadow: "none"
        };

        // タイトルテキストの解決 (I18n 辞書経由)
        let checkTitle = "CHECK";
        if (I18n && typeof I18n.t === "function") {
            if (context && context.tacticNameKey) {
                checkTitle = I18n.t(context.tacticNameKey);
            } else {
                checkTitle = I18n.t(`CHECK_${(result.checkId || "").toUpperCase()}_NAME`);
            }
        } else {
            checkTitle = (context && context.tacticNameKey) || result.checkId || "CHECK";
        }

        const outcomeLabel = I18n && typeof I18n.t === "function" && result.outcome && result.outcome.nameKey
            ? I18n.t(result.outcome.nameKey)
            : ((result.outcome && result.outcome.id) || "RESULT");

        const modStr = result.modifierTotal > 0 ? `+${result.modifierTotal}` : (result.modifierTotal < 0 ? `${result.modifierTotal}` : "");

        // 1. DOM の構築
        this.containerEl.style.borderColor = theme.borderColor;
        this.containerEl.style.boxShadow = theme.glowShadow;
        this.containerEl.innerHTML = `
            <div class="dice-widget-header">
                <span>🎲 ${checkTitle}</span>
                <span style="font-size:10px; color:#64748b;">seq:${result.checkSequence || 1}</span>
            </div>
            <div class="dice-widget-stage">
                ${keptDice.map((val, idx) => `
                    <div class="dice-cube" id="diceCube_${idx}">
                        <div class="dice-face dice-face-1">1</div>
                        <div class="dice-face dice-face-2">2</div>
                        <div class="dice-face dice-face-3">3</div>
                        <div class="dice-face dice-face-4">4</div>
                        <div class="dice-face dice-face-5">5</div>
                        <div class="dice-face dice-face-6">6</div>
                    </div>
                `).join("")}
                ${modStr ? `<span class="dice-modifier-badge">${modStr}</span>` : ""}
            </div>
            <div class="dice-widget-footer" id="diceWidgetFooter" style="background:${theme.badgeBg}; color:${theme.badgeColor};">
                <span>...</span>
            </div>
        `;

        // 2. フェードイン
        this.containerEl.style.opacity = "1";
        this.containerEl.style.transform = "translateY(0px) scale(1.0)";

        // 3. 小気味よい 3D タンブリング回転
        const rollDuration = theme.rollDurationMs || 650;
        keptDice.forEach((val, idx) => {
            const cube = document.getElementById(`diceCube_${idx}`);
            if (cube) {
                const faceRot = this.getFaceRotation(val);
                // 激しい予備回転 (720deg) ＋ 目標面の角度
                cube.style.transform = `rotateX(${faceRot.x + 720}deg) rotateY(${faceRot.y + 720}deg)`;
            }
        });

        // 4. 回転完了待ち ➔ 出目 ＆ 結果バッジ確定
        await new Promise(r => setTimeout(r, rollDuration));

        const footer = document.getElementById("diceWidgetFooter");
        if (footer) {
            footer.innerHTML = `<span>★ ${outcomeLabel} (${result.finalTotal})</span>`;
        }

        // 5. 結果表示待機 ➔ 自動フェードアウト
        const displayDuration = theme.displayDurationMs || 1000;
        await new Promise(r => setTimeout(r, displayDuration));

        this.containerEl.style.opacity = "0";
        this.containerEl.style.transform = "translateY(12px) scale(0.96)";
        await new Promise(r => setTimeout(r, 220));
    }

    /**
     * 🛑 即時非表示
     */
    hide() {
        if (this.containerEl) {
            this.containerEl.style.opacity = "0";
            this.containerEl.style.transform = "translateY(12px) scale(0.96)";
        }
    }
}

if (typeof window !== "undefined") {
    window.DiceWidgetComponent = DiceWidgetComponent;
}
if (typeof globalThis !== "undefined") {
    globalThis.DiceWidgetComponent = DiceWidgetComponent;
}
