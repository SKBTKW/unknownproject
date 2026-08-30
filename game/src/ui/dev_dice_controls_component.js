/**
 * 🧪 DevDiceControlsComponent (テスト用ダイス判定 HUD: 完全リアルタイム版)
 * 
 * 責務:
 * 1. 画面左下のテストボタンから、本物の CheckSystem.resolve() をリアルタイム実行する。
 * 2. 騎馬突撃 (CRITICAL)・迎撃戦術 (TACTICAL)・通常判定 (LIVE) の成否が毎回ランダムに変動する。
 * 3. 初期シードを時間依存にし、リロードしても毎回異なるサイコロ体験を提供する。
 */

import { UILayoutConfig } from './layout_config.js';
import { I18n } from '../i18n.js';
import { CheckSystem, CheckModifier } from '../core/check_system/check_system.js';

export class DevDiceControlsComponent {
    /**
     * @param {Object} uiController - UIController インスタンス
     */
    constructor(uiController) {
        this.ui = uiController;
        this.containerEl = null;
        // 🎲 ブラウザ実機テスト用: 時間依存のランダムシードで初期化
        const dynamicSeed = (Date.now() ^ (Math.random() * 0xFFFFFFFF)) >>> 0;
        this.checkSystem = new CheckSystem({ seed: dynamicSeed });
        this.actionCounter = 1;

        if (typeof document !== "undefined") {
            this.initDOM();
        }
    }

    /**
     * 🏗️ DOM の初期構築 ＆ スタイル注入
     */
    initDOM() {
        if (this.containerEl || typeof document === "undefined") return;

        const config = (UILayoutConfig && UILayoutConfig.devDiceControls && UILayoutConfig.devDiceControls.desktop) || {
            position: "fixed",
            left: "24px",
            bottom: "24px",
            zIndex: 700,
            pointerEvents: "auto"
        };

        const root = document.createElement("div");
        root.id = "devDiceControlsRoot";
        root.className = "dev-dice-controls-panel";
        root.style.position = config.position;
        root.style.left = config.left;
        root.style.bottom = config.bottom;
        root.style.zIndex = String(config.zIndex);
        root.style.pointerEvents = config.pointerEvents;

        document.body.appendChild(root);
        this.containerEl = root;
        this.injectCSS();
        this.render();
    }

    /**
     * 🎨 クリーンな CSS スタイル定義
     */
    injectCSS() {
        if (typeof document === "undefined" || document.getElementById("devDiceControlsStyle")) return;
        const style = document.createElement("style");
        style.id = "devDiceControlsStyle";
        style.textContent = `
            .dev-dice-controls-panel {
                box-sizing: border-box;
                padding: 8px 12px;
                border-radius: 8px;
                background: rgba(15, 23, 42, 0.88);
                backdrop-filter: blur(6px);
                -webkit-backdrop-filter: blur(6px);
                border: 1px solid #334155;
                color: #e2e8f0;
                font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
                user-select: none;
                box-shadow: 0 4px 14px rgba(0, 0, 0, 0.35);
            }
            .dev-dice-header-title {
                font-size: 10px;
                font-weight: 700;
                color: #94a3b8;
                text-transform: uppercase;
                letter-spacing: 0.5px;
                margin-bottom: 6px;
                display: flex;
                align-items: center;
                gap: 4px;
            }
            .dev-dice-btn-row {
                display: flex;
                align-items: center;
                gap: 6px;
            }
            .dev-dice-btn {
                appearance: none;
                -webkit-appearance: none;
                border: 1px solid #475569;
                background: #1e293b;
                color: #f8fafc;
                font-size: 11px;
                font-weight: 600;
                padding: 4px 8px;
                border-radius: 6px;
                cursor: pointer;
                transition: background 0.15s ease, border-color 0.15s ease, transform 0.1s ease;
                white-space: nowrap;
            }
            .dev-dice-btn:hover {
                background: #334155;
                border-color: #64748b;
                transform: translateY(-1px);
            }
            .dev-dice-btn:active {
                transform: translateY(0px) scale(0.97);
            }
            .dev-dice-btn-critical {
                border-color: #f59e0b;
                color: #fbbf24;
            }
            .dev-dice-btn-critical:hover {
                background: rgba(245, 158, 11, 0.2);
                border-color: #fbbf24;
            }
            .dev-dice-btn-tactical {
                border-color: #3b82f6;
                color: #60a5fa;
            }
            .dev-dice-btn-tactical:hover {
                background: rgba(59, 130, 246, 0.2);
                border-color: #60a5fa;
            }
        `;
        document.head.appendChild(style);
    }

    /**
     * 🖼️ ボタン描画 ＆ リアルタイムクリック配線
     */
    render() {
        if (!this.containerEl) return;

        const titleText = (I18n && typeof I18n.t === "function") ? I18n.t("DEV_TEST_HUD_TITLE") : "DICE TEST";
        const cavalryText = (I18n && typeof I18n.t === "function") ? I18n.t("DEV_BTN_CAVALRY") : "Cavalry";
        const interceptText = (I18n && typeof I18n.t === "function") ? I18n.t("DEV_BTN_INTERCEPT") : "Intercept";
        const liveRollText = (I18n && typeof I18n.t === "function") ? I18n.t("DEV_BTN_LIVE_ROLL") : "Live Roll";

        this.containerEl.innerHTML = `
            <div class="dev-dice-header-title">🎲 ${titleText}</div>
            <div class="dev-dice-btn-row">
                <button type="button" id="btnDevCavalry" class="dev-dice-btn dev-dice-btn-critical">🏇 ${cavalryText}</button>
                <button type="button" id="btnDevIntercept" class="dev-dice-btn dev-dice-btn-tactical">⚔️ ${interceptText}</button>
                <button type="button" id="btnDevLiveRoll" class="dev-dice-btn">🎲 ${liveRollText}</button>
            </div>
        `;

        // 🏇 騎馬突撃 (CRITICAL演出 / リアルタイム2D6判定)
        const btnCavalry = document.getElementById("btnDevCavalry");
        if (btnCavalry) {
            btnCavalry.onclick = () => {
                this.rollCavalryCharge();
            };
        }

        // ⚔️ 迎撃戦術 (TACTICAL演出 / リアルタイム2D6+2判定)
        const btnIntercept = document.getElementById("btnDevIntercept");
        if (btnIntercept) {
            btnIntercept.onclick = () => {
                this.rollInterceptTactic();
            };
        }

        // 🎲 通常判定 (リアルタイム2D6判定)
        const btnLiveRoll = document.getElementById("btnDevLiveRoll");
        if (btnLiveRoll) {
            btnLiveRoll.onclick = () => {
                this.rollStandardCheck();
            };
        }
    }

    /**
     * 🏇 騎馬突撃: リアルタイム 2D6 判定 (出目で大成功・成功・失敗がリアルに分岐！)
     */
    rollCavalryCharge() {
        const actionId = `cavalry_${this.actionCounter++}`;
        const checkResult = this.checkSystem.resolve({
            checkId: "standard_2d6",
            actionId,
            checkSequence: 1,
            modifiers: []
        });

        if (this.ui && typeof this.ui.showDiceCheck === "function") {
            this.ui.showDiceCheck({
                result: checkResult,
                context: {
                    sourceType: "TRIAL_TACTIC",
                    sourceId: "cavalry_charge",
                    tacticNameKey: "TACTIC_CAVALRY_CHARGE_NAME"
                },
                feedback: {
                    importance: "CRITICAL" // 黄金光彩
                }
            });
        }
    }

    /**
     * ⚔️ 迎撃戦術: リアルタイム 2D6 + 2 判定 (防衛修正+2が乗る！)
     */
    rollInterceptTactic() {
        const actionId = `intercept_${this.actionCounter++}`;
        const checkResult = this.checkSystem.resolve({
            checkId: "standard_2d6",
            actionId,
            checkSequence: 1,
            modifiers: [
                new CheckModifier({ source: "defense_hq", operation: "add", value: 2 })
            ]
        });

        if (this.ui && typeof this.ui.showDiceCheck === "function") {
            this.ui.showDiceCheck({
                result: checkResult,
                context: {
                    sourceType: "TRIAL_TACTIC",
                    sourceId: "defensive_barricade",
                    tacticNameKey: "TACTIC_INTERCEPT_NAME"
                },
                feedback: {
                    importance: "TACTICAL" // 青色グロー
                }
            });
        }
    }

    /**
     * 🎲 通常判定: リアルタイム 2D6 判定
     */
    rollStandardCheck() {
        const actionId = `check_${this.actionCounter++}`;
        const checkResult = this.checkSystem.resolve({
            checkId: "standard_2d6",
            actionId,
            checkSequence: 1,
            modifiers: []
        });

        let importance = "NORMAL";
        if (checkResult.outcome.id === "great_success") {
            importance = "CRITICAL";
        } else if (checkResult.outcome.id === "success") {
            importance = "TACTICAL";
        }

        if (this.ui && typeof this.ui.showDiceCheck === "function") {
            this.ui.showDiceCheck({
                result: checkResult,
                context: {
                    sourceType: "LIVE_CHECK",
                    sourceId: actionId,
                    tacticNameKey: "CHECK_STANDARD_2D6_NAME"
                },
                feedback: {
                    importance
                }
            });
        }
    }
}

if (typeof window !== "undefined") {
    window.DevDiceControlsComponent = DevDiceControlsComponent;
}
if (typeof globalThis !== "undefined") {
    globalThis.DevDiceControlsComponent = DevDiceControlsComponent;
}
