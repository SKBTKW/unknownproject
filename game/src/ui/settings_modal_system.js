/* =============================================================
   game/src/ui/settings_modal_system.js
   環境設定（オプション設定）管理 ＆ タブ型モーダルUI独立モジュール
   ============================================================= */

import { UILayoutConfig } from "./layout_config.js";
import { displaySettingsAdapter } from "./display_settings_adapter.js";

const STORAGE_KEY = "TOA_GAME_SETTINGS_V1";

export const RESOLUTION_PRESETS = Object.freeze([
    Object.freeze({ value: "1366x768", width: 1366, height: 768 }),
    Object.freeze({ value: "1600x900", width: 1600, height: 900 }),
    Object.freeze({ value: "1920x1080", width: 1920, height: 1080, recommended: true }),
    Object.freeze({ value: "2560x1440", width: 2560, height: 1440 }),
    Object.freeze({ value: "3440x1440", width: 3440, height: 1440 }),
    Object.freeze({ value: "3840x2160", width: 3840, height: 2160 })
]);

// ⚙️ デフォルト設定定義
const DEFAULT_SETTINGS = {
    mulliganConfirm: true,        // マリガン時の吹き出し確認 (true: 確認あり, false: 即時実行)
    turnEndWarning: true,          // 土地未配置時のターン終了警告 (true: 警告あり, false: 即時終了)
    autoFoodDeficitFallback: true, // 食料不足時の✨/🧱自動補填
    advisorEnabled: true,          // 側近表示・平時発話
    advisorHoverExpand: false,     // 画面右端hoverによる側近一時展開
    defaultHandMode: "standard",   // 手札の初期表示モード ("standard": 標準, "minimal": 縮小)
    autoRotateOnRightClick: true,  // 右クリックでのカード回転
    focusDoFBlur: false,           // 2層DoFフォーカス演出 (true: 配置中ボケ演出あり, false: 常時クリア)
    resolution: "1920x1080",      // 表示解像度プリセット（ブラウザ版では表示設定境界へ通知）
    language: "ja",                // 表示言語 ("ja" / "en")
    animSpeed: "normal",           // 演出速度 ("normal" / "fast")
    seEnabled: true,               // 効果音 (true / false)
    bgmEnabled: true               // BGM (true / false)
};

/**
 * 📦 設定データの一元管理 ＆ LocalStorage永続化 (Single Source of Truth)
 */
export class GameSettings {
    constructor() {
        this.settings = { ...DEFAULT_SETTINGS };
        this.listeners = new Set();
        this.load();
    }

    load() {
        if (typeof localStorage === "undefined") return;
        try {
            const raw = localStorage.getItem(STORAGE_KEY);
            if (raw) {
                const parsed = JSON.parse(raw);
                this.settings = { ...DEFAULT_SETTINGS, ...parsed };
            }
        } catch (e) {
            console.warn("Failed to load GameSettings:", e);
        }
    }

    save() {
        if (typeof localStorage === "undefined") return;
        try {
            localStorage.setItem(STORAGE_KEY, JSON.stringify(this.settings));
        } catch (e) {
            console.warn("Failed to save GameSettings:", e);
        }
        this.notify();
    }

    get(key) {
        return this.settings[key] !== undefined ? this.settings[key] : DEFAULT_SETTINGS[key];
    }

    set(key, value) {
        this.settings[key] = value;
        this.save();
    }

    reset() {
        this.settings = { ...DEFAULT_SETTINGS };
        this.save();
    }

    onChange(callback) {
        this.listeners.add(callback);
        return () => this.listeners.delete(callback);
    }

    notify() {
        for (const cb of this.listeners) {
            try { cb(this.settings); } catch (e) { console.error(e); }
        }
    }
}

export const gameSettings = new GameSettings();

/**
 * 🏛️ 設定モーダルUI ＆ ヘッダー⚙️ボタン管理システム（タブ型）
 */
export class SettingsModalSystem {
    constructor(settings = gameSettings, displayAdapter = displaySettingsAdapter) {
        this.settings = settings;
        this.displayAdapter = displayAdapter;
        this.modalEl = null;
        this.isOpen = false;
        this.activeTab = "gameplay"; // "gameplay" | "graphics" | "sound"
        this.displayAdapter.applyResolution(this.settings.get("resolution"));
        this.settings.onChange(current => this.displayAdapter.applyResolution(current.resolution));
    }

    /**
     * 🚀 初期化マウント
     */
    mount() {
        if (typeof document === "undefined") return;

        // 1. ヘッダー右端に ⚙️ アイコンボタンを注入
        this.mountHeaderButton();

        // 2. 設定モーダルコンテナを body に生成
        this.createModalDOM();

        // 3. Escキー連動リスナー
        document.addEventListener("keydown", (e) => {
            if (e.key === "Escape") {
                const ui = window.ui || window.gameUI;
                // カード選択中の場合はカード解除を優先
                if (ui && ui.selectedCard) return;

                if (this.isOpen) {
                    this.close();
                } else {
                    // 他のモーダルが開いていなければ設定を開く
                    const directiveModal = document.getElementById("directiveModal");
                    const isDirectiveOpen = directiveModal && directiveModal.style.display !== "none";
                    if (!isDirectiveOpen) {
                        this.open();
                    }
                }
            }
        });
    }

    /**
     * ⚙️ 最上部ヘッダー右端へのボタン追加
     */
    mountHeaderButton() {
        const topBar = document.querySelector(".top-bar");
        if (!topBar || topBar.querySelector("#btnOpenSettings")) return;

        const btn = document.createElement("button");
        btn.id = "btnOpenSettings";
        btn.className = "btn-settings-header";
        const I18n = (typeof globalThis !== 'undefined' && globalThis.I18n) ? globalThis.I18n : (typeof window !== 'undefined' ? window.I18n : { t: k => k });
        btn.title = I18n ? I18n.t("UI_SETTINGS_BTN_TOOLTIP") : "⚙️";
        btn.innerHTML = "⚙️";
        btn.onclick = () => this.open();

        topBar.appendChild(btn);
    }

    /**
     * 🖼️ 設定モーダルのDOM構築（タブ切り替え形式）
     */
    createModalDOM() {
        let existing = document.getElementById("settingsModal");
        if (existing) existing.remove();

        const I18n = (typeof globalThis !== 'undefined' && globalThis.I18n) ? globalThis.I18n : (typeof window !== 'undefined' ? window.I18n : { t: k => k });
        this.modalEl = document.createElement("div");
        this.modalEl.id = "settingsModal";
        this.modalEl.className = "directive-modal-overlay";
        this.modalEl.style.display = "none";
        this.modalEl.style.setProperty("--settings-modal-width", UILayoutConfig.settingsModal.width);
        this.modalEl.style.setProperty("--settings-modal-height", UILayoutConfig.settingsModal.height);

        const titleText = I18n ? I18n.t("UI_SETTINGS_TITLE") : "⚙️";
        const descText = I18n ? I18n.t("UI_SETTINGS_DESC") : "";
        const resetBtnText = I18n ? I18n.t("UI_RESET_DEFAULT") : "Reset";
        const closeBtnText = I18n ? I18n.t("UI_CLOSE") : "Close";

        // タブ名
        const tabGameplayText = I18n ? I18n.t("UI_SETTINGS_TAB_GAMEPLAY") : "Gameplay";
        const tabGraphicsText = I18n ? I18n.t("UI_SETTINGS_TAB_GRAPHICS") : "Graphics";
        const tabSoundText = I18n ? I18n.t("UI_SETTINGS_TAB_SOUND") : "Sound";

        // ① ゲームプレイ項目
        const mTitle = I18n ? I18n.t("UI_SETTINGS_MULLIGAN_TITLE") : "Mulligan";
        const mDesc = I18n ? I18n.t("UI_SETTINGS_MULLIGAN_DESC") : "";

        const wTitle = I18n ? I18n.t("UI_SETTINGS_WARN_TITLE") : "Turn End Warning";
        const wDesc = I18n ? I18n.t("UI_SETTINGS_WARN_DESC") : "";

        const afTitle = I18n ? I18n.t("UI_SETTINGS_AUTO_FALLBACK_TITLE") : "Food Deficit Fallback";
        const afDesc = I18n ? I18n.t("UI_SETTINGS_AUTO_FALLBACK_DESC") : "";

        const hmTitle = I18n ? I18n.t("UI_SETTINGS_HAND_MODE_TITLE") : "Hand Mode";
        const hmDesc = I18n ? I18n.t("UI_SETTINGS_HAND_MODE_DESC") : "";
        const hmOptStd = I18n ? I18n.t("UI_SETTINGS_HAND_MODE_STANDARD") : "Standard";
        const hmOptMin = I18n ? I18n.t("UI_SETTINGS_HAND_MODE_MINIMAL") : "Minimal";

        const rotTitle = I18n ? I18n.t("UI_SETTINGS_ROTATE_TITLE") : "Right-Click Rotate";
        const rotDesc = I18n ? I18n.t("UI_SETTINGS_ROTATE_DESC") : "";
        const advisorTitle = I18n ? I18n.t("UI_SETTINGS_ADVISOR_TITLE") : "Advisor";
        const advisorDesc = I18n ? I18n.t("UI_SETTINGS_ADVISOR_DESC") : "";
        const advisorHoverTitle = I18n ? I18n.t("UI_SETTINGS_ADVISOR_HOVER_TITLE") : "Hover expansion";
        const advisorHoverDesc = I18n ? I18n.t("UI_SETTINGS_ADVISOR_HOVER_DESC") : "";

        // ② グラフィック項目
        const resolutionTitle = I18n ? I18n.t("UI_SETTINGS_RESOLUTION_TITLE") : "Resolution";
        const resolutionDesc = I18n ? I18n.t("UI_SETTINGS_RESOLUTION_DESC") : "";
        const recommendedLabel = I18n ? I18n.t("UI_SETTINGS_RESOLUTION_RECOMMENDED") : " (Recommended)";
        const resolutionOptions = RESOLUTION_PRESETS.map(preset => {
            const suffix = preset.recommended ? recommendedLabel : "";
            return `<option value="${preset.value}">${preset.width} × ${preset.height}${suffix}</option>`;
        }).join("");
        const fTitle = I18n ? I18n.t("UI_SETTINGS_FOCUS_TITLE") : "DoF Blur";
        const fDesc = I18n ? I18n.t("UI_SETTINGS_FOCUS_DESC") : "";

        const langTitle = I18n ? I18n.t("UI_SETTINGS_LANG_TITLE") : "Language";
        const langDesc = I18n ? I18n.t("UI_SETTINGS_LANG_DESC") : "";
        const langJa = I18n ? I18n.t("UI_SETTINGS_LANG_JA") : "日本語";
        const langEn = I18n ? I18n.t("UI_SETTINGS_LANG_EN") : "English";

        const animTitle = I18n ? I18n.t("UI_SETTINGS_ANIM_TITLE") : "Animation Speed";
        const animDesc = I18n ? I18n.t("UI_SETTINGS_ANIM_DESC") : "";
        const animNorm = I18n ? I18n.t("UI_SETTINGS_ANIM_NORMAL") : "1.0x";
        const animFast = I18n ? I18n.t("UI_SETTINGS_ANIM_FAST") : "1.5x";

        // ③ サウンド項目
        const seTitle = I18n ? I18n.t("UI_SETTINGS_SE_TITLE") : "SE";
        const seDesc = I18n ? I18n.t("UI_SETTINGS_SE_DESC") : "";
        const bgmTitle = I18n ? I18n.t("UI_SETTINGS_BGM_TITLE") : "BGM";
        const bgmDesc = I18n ? I18n.t("UI_SETTINGS_BGM_DESC") : "";

        const createToggleMarkup = (id, key) => {
            const checked = Boolean(this.settings.get(key));
            return `
                <button type="button" role="switch" id="${id}" class="setting-toggle" aria-checked="${checked}">
                    <span class="setting-toggle-track"></span>
                    <span class="setting-toggle-thumb"></span>
                </button>
            `;
        };

        this.modalEl.innerHTML = `
            <div class="directive-modal-window settings-modal-window">
                <div class="directive-modal-header settings-modal-header">
                    <h3 class="directive-modal-title settings-modal-title">
                        <span>⚙️</span> ${titleText}
                    </h3>
                    <button class="directive-modal-close-btn" id="btnCloseSettings">✕</button>
                </div>
                
                <div class="directive-modal-desc settings-modal-desc">
                    ${descText}
                </div>

                <!-- 🗂️ 設定タブバー -->
                <div class="settings-tab-bar">
                    <button class="settings-tab-btn ${this.activeTab === 'gameplay' ? 'active' : ''}" data-tab="gameplay">${tabGameplayText}</button>
                    <button class="settings-tab-btn ${this.activeTab === 'graphics' ? 'active' : ''}" data-tab="graphics">${tabGraphicsText}</button>
                    <button class="settings-tab-btn ${this.activeTab === 'sound' ? 'active' : ''}" data-tab="sound">${tabSoundText}</button>
                </div>

                <div class="settings-tab-content-container">
                    <!-- 🎮 1. ゲームプレイ タブペイン -->
                    <div class="settings-tab-pane ${this.activeTab === 'gameplay' ? 'active' : ''}" id="paneGameplay">
                        <!-- 手札初期表示モード -->
                        <div class="setting-item-row">
                            <div class="setting-item-copy">
                                <div class="setting-item-title">${hmTitle}</div>
                                <div class="setting-item-desc">${hmDesc}</div>
                            </div>
                            <div class="setting-item-control">
                                <select id="optDefaultHandMode" class="setting-select-control">
                                    <option value="standard">${hmOptStd}</option>
                                    <option value="minimal">${hmOptMin}</option>
                                </select>
                            </div>
                        </div>

                        <!-- マリガン確認 -->
                        <div class="setting-item-row">
                            <div class="setting-item-copy">
                                <div class="setting-item-title">${mTitle}</div>
                                <div class="setting-item-desc">${mDesc}</div>
                            </div>
                            <div class="setting-item-control">
                                ${createToggleMarkup("optMulliganConfirm", "mulliganConfirm")}
                            </div>
                        </div>

                        <!-- 土地未配置ターン終了警告 -->
                        <div class="setting-item-row">
                            <div class="setting-item-copy">
                                <div class="setting-item-title">${wTitle}</div>
                                <div class="setting-item-desc">${wDesc}</div>
                            </div>
                            <div class="setting-item-control">
                                ${createToggleMarkup("optTurnEndWarning", "turnEndWarning")}
                            </div>
                        </div>

                        <!-- 食料不足時の自動補填 -->
                        <div class="setting-item-row">
                            <div class="setting-item-copy">
                                <div class="setting-item-title">${afTitle}</div>
                                <div class="setting-item-desc">${afDesc}</div>
                            </div>
                            <div class="setting-item-control">
                                ${createToggleMarkup("optAutoFoodDeficitFallback", "autoFoodDeficitFallback")}
                            </div>
                        </div>

                        <!-- 右クリック回転 -->
                        <div class="setting-item-row">
                            <div class="setting-item-copy">
                                <div class="setting-item-title">${rotTitle}</div>
                                <div class="setting-item-desc">${rotDesc}</div>
                            </div>
                            <div class="setting-item-control">
                                ${createToggleMarkup("optAutoRotate", "autoRotateOnRightClick")}
                            </div>
                        </div>

                        <!-- 側近表示 -->
                        <div class="setting-item-row">
                            <div class="setting-item-copy">
                                <div class="setting-item-title">${advisorTitle}</div>
                                <div class="setting-item-desc">${advisorDesc}</div>
                            </div>
                            <div class="setting-item-control">
                                ${createToggleMarkup("optAdvisorEnabled", "advisorEnabled")}
                            </div>
                        </div>

                        <!-- 側近ホバー展開 -->
                        <div class="setting-item-row">
                            <div class="setting-item-copy">
                                <div class="setting-item-title">${advisorHoverTitle}</div>
                                <div class="setting-item-desc">${advisorHoverDesc}</div>
                            </div>
                            <div class="setting-item-control">
                                ${createToggleMarkup("optAdvisorHoverExpand", "advisorHoverExpand")}
                            </div>
                        </div>
                    </div>

                    <!-- 🎨 2. グラフィック タブペイン -->
                    <div class="settings-tab-pane ${this.activeTab === 'graphics' ? 'active' : ''}" id="paneGraphics">
                        <!-- 解像度 -->
                        <div class="setting-item-row">
                            <div class="setting-item-copy">
                                <div class="setting-item-title">${resolutionTitle}</div>
                                <div class="setting-item-desc">${resolutionDesc}</div>
                            </div>
                            <div class="setting-item-control">
                                <select id="optResolution" class="setting-select-control setting-select-resolution">
                                    ${resolutionOptions}
                                </select>
                            </div>
                        </div>
                        <!-- 言語設定 -->
                        <div class="setting-item-row">
                            <div class="setting-item-copy">
                                <div class="setting-item-title">${langTitle}</div>
                                <div class="setting-item-desc">${langDesc}</div>
                            </div>
                            <div class="setting-item-control">
                                <select id="optLanguage" class="setting-select-control">
                                    <option value="ja">${langJa}</option>
                                    <option value="en">${langEn}</option>
                                </select>
                            </div>
                        </div>

                        <!-- フォーカス演出 -->
                        <div class="setting-item-row">
                            <div class="setting-item-copy">
                                <div class="setting-item-title">${fTitle}</div>
                                <div class="setting-item-desc">${fDesc}</div>
                            </div>
                            <div class="setting-item-control">
                                ${createToggleMarkup("optFocusDoFBlur", "focusDoFBlur")}
                            </div>
                        </div>

                        <!-- 演出速度 -->
                        <div class="setting-item-row">
                            <div class="setting-item-copy">
                                <div class="setting-item-title">${animTitle}</div>
                                <div class="setting-item-desc">${animDesc}</div>
                            </div>
                            <div class="setting-item-control">
                                <select id="optAnimSpeed" class="setting-select-control">
                                    <option value="normal">${animNorm}</option>
                                    <option value="fast">${animFast}</option>
                                </select>
                            </div>
                        </div>
                    </div>

                    <!-- 🔊 3. サウンド タブペイン -->
                    <div class="settings-tab-pane ${this.activeTab === 'sound' ? 'active' : ''}" id="paneSound">
                        <!-- 効果音 (SE) -->
                        <div class="setting-item-row">
                            <div class="setting-item-copy">
                                <div class="setting-item-title">${seTitle}</div>
                                <div class="setting-item-desc">${seDesc}</div>
                            </div>
                            <div class="setting-item-control">
                                ${createToggleMarkup("optSeEnabled", "seEnabled")}
                            </div>
                        </div>

                        <!-- 背景音楽 (BGM) -->
                        <div class="setting-item-row">
                            <div class="setting-item-copy">
                                <div class="setting-item-title">${bgmTitle}</div>
                                <div class="setting-item-desc">${bgmDesc}</div>
                            </div>
                            <div class="setting-item-control">
                                ${createToggleMarkup("optBgmEnabled", "bgmEnabled")}
                            </div>
                        </div>
                    </div>
                </div>

                <div class="directive-modal-footer settings-modal-footer">
                    <button id="btnResetSettings" class="settings-reset-btn">${resetBtnText}</button>
                    <button class="directive-modal-btn-close settings-btn-close" id="btnSaveCloseSettings">${closeBtnText}</button>
                </div>
            </div>
        `;

        document.body.appendChild(this.modalEl);

        // タブ切替イベントバインド
        const tabBtns = this.modalEl.querySelectorAll(".settings-tab-btn");
        tabBtns.forEach(btn => {
            btn.onclick = () => {
                const targetTab = btn.getAttribute("data-tab");
                this.switchTab(targetTab);
            };
        });

        // モーダル閉じる・リセットイベント
        const closeBtn = this.modalEl.querySelector("#btnCloseSettings");
        const saveCloseBtn = this.modalEl.querySelector("#btnSaveCloseSettings");
        const resetBtn = this.modalEl.querySelector("#btnResetSettings");

        if (closeBtn) closeBtn.onclick = () => this.close();
        if (saveCloseBtn) saveCloseBtn.onclick = () => this.close();
        if (resetBtn) resetBtn.onclick = () => {
            this.settings.reset();
            this.updateControlsFromSettings();
        };

        // トグルバインド共通ヘルパー
        const bindToggle = (id, key, onToggle) => {
            const btn = this.modalEl.querySelector(id);
            if (!btn) return;
            const toggleAction = () => {
                const current = Boolean(this.settings.get(key));
                const next = !current;
                this.settings.set(key, next);
                this.syncToggleControl(btn, next);
                if (typeof onToggle === "function") onToggle(next);
            };
            btn.onclick = toggleAction;
            // 仮想環境/テスト互換性用 onchange プロパティサポート
            btn.onchange = (e) => {
                const next = (e && e.target && e.target.value !== undefined)
                    ? (e.target.value === "true" || e.target.value === true)
                    : !Boolean(this.settings.get(key));
                this.settings.set(key, next);
                this.syncToggleControl(btn, next);
                if (typeof onToggle === "function") onToggle(next);
            };
        };

        bindToggle("#optMulliganConfirm", "mulliganConfirm");
        bindToggle("#optTurnEndWarning", "turnEndWarning");
        bindToggle("#optAutoFoodDeficitFallback", "autoFoodDeficitFallback");
        bindToggle("#optAutoRotate", "autoRotateOnRightClick");
        bindToggle("#optAdvisorEnabled", "advisorEnabled", () => {
            if (typeof window !== "undefined" && window.gameUI) window.gameUI.render();
        });
        bindToggle("#optAdvisorHoverExpand", "advisorHoverExpand");
        bindToggle("#optFocusDoFBlur", "focusDoFBlur");
        bindToggle("#optSeEnabled", "seEnabled");
        bindToggle("#optBgmEnabled", "bgmEnabled");

        // セレクト変更イベント
        const selHandMode = this.modalEl.querySelector("#optDefaultHandMode");
        const selResolution = this.modalEl.querySelector("#optResolution");
        const selLanguage = this.modalEl.querySelector("#optLanguage");
        const selAnimSpeed = this.modalEl.querySelector("#optAnimSpeed");

        if (selHandMode) selHandMode.onchange = (e) => {
            this.settings.set("defaultHandMode", e.target.value);
            if (typeof window !== "undefined" && window.gameUI) {
                window.gameUI.isMinimalMode = (e.target.value === "minimal");
                window.gameUI.render();
            }
        };
        if (selResolution) selResolution.onchange = (e) => this.settings.set("resolution", e.target.value);
        if (selLanguage) selLanguage.onchange = (e) => {
            const lang = e.target.value;
            this.settings.set("language", lang);
            if (I18n && typeof I18n.setLanguage === "function") {
                I18n.setLanguage(lang);
            }
            // 言語切替時はモーダル内テキストおよびゲームUIを再描画
            this.createModalDOM();
            this.open();
            if (typeof window !== "undefined" && window.gameUI) {
                window.gameUI.render();
            }
        };
        if (selAnimSpeed) selAnimSpeed.onchange = (e) => this.settings.set("animSpeed", e.target.value);

        this.updateControlsFromSettings();
    }

    /**
     * 🔘 トグルコントロールの同期
     */
    syncToggleControl(el, checked) {
        if (!el) return;
        const boolVal = Boolean(checked);
        if (typeof el.setAttribute === "function") {
            el.setAttribute("aria-checked", String(boolVal));
        }
        el.value = String(boolVal);
        if (el.classList && typeof el.classList.toggle === "function") {
            el.classList.toggle("is-active", boolVal);
        }
    }

    /**
     * 🗂️ タブ切り替え処理
     */
    switchTab(tabName) {
        this.activeTab = tabName;
        if (!this.modalEl) return;

        // タブボタンのアクティブ更新
        const tabBtns = this.modalEl.querySelectorAll(".settings-tab-btn");
        tabBtns.forEach(btn => {
            const isMatch = btn.getAttribute("data-tab") === tabName;
            btn.classList.toggle("active", isMatch);
        });

        // タブペインの表示・非表示更新
        const paneMap = {
            gameplay: this.modalEl.querySelector("#paneGameplay"),
            graphics: this.modalEl.querySelector("#paneGraphics"),
            sound: this.modalEl.querySelector("#paneSound")
        };

        for (const [key, el] of Object.entries(paneMap)) {
            if (el) el.classList.toggle("active", key === tabName);
        }
    }

    /**
     * 🔄 設定値からUIコントロールの状態を更新
     */
    updateControlsFromSettings() {
        if (!this.modalEl) return;

        // トグルコントロールの更新
        const updateToggle = (selector, key) => {
            const el = this.modalEl.querySelector(selector);
            if (el) {
                this.syncToggleControl(el, this.settings.get(key));
            }
        };

        updateToggle("#optMulliganConfirm", "mulliganConfirm");
        updateToggle("#optTurnEndWarning", "turnEndWarning");
        updateToggle("#optAutoFoodDeficitFallback", "autoFoodDeficitFallback");
        updateToggle("#optAutoRotate", "autoRotateOnRightClick");
        updateToggle("#optAdvisorEnabled", "advisorEnabled");
        updateToggle("#optAdvisorHoverExpand", "advisorHoverExpand");
        updateToggle("#optFocusDoFBlur", "focusDoFBlur");
        updateToggle("#optSeEnabled", "seEnabled");
        updateToggle("#optBgmEnabled", "bgmEnabled");

        // セレクトコントロールの更新
        const setVal = (selector, val) => {
            const el = this.modalEl.querySelector(selector);
            if (el) el.value = String(val);
        };

        setVal("#optDefaultHandMode", this.settings.get("defaultHandMode"));
        setVal("#optResolution", this.settings.get("resolution"));
        setVal("#optLanguage", this.settings.get("language"));
        setVal("#optAnimSpeed", this.settings.get("animSpeed"));
    }

    open() {
        if (!this.modalEl) this.createModalDOM();
        this.updateControlsFromSettings();
        this.modalEl.style.display = "flex";
        this.isOpen = true;
    }

    close() {
        if (this.modalEl) {
            this.modalEl.style.display = "none";
        }
        this.isOpen = false;
    }
}

export const settingsModalInstance = new SettingsModalSystem();

if (typeof window !== "undefined") {
    window.gameSettings = gameSettings;
    window.settingsModalInstance = settingsModalInstance;
    window.openSettingsModal = () => settingsModalInstance.open();
    window.closeSettingsModal = () => settingsModalInstance.close();
}
