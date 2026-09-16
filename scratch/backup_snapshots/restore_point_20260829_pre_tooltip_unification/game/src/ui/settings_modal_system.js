/* =============================================================
   game/src/ui/settings_modal_system.js
   環境設定（オプション設定）管理 ＆ タブ型モーダルUI独立モジュール
   ============================================================= */

const STORAGE_KEY = "TOA_GAME_SETTINGS_V1";

// ⚙️ デフォルト設定定義
const DEFAULT_SETTINGS = {
    mulliganConfirm: true,        // マリガン時の吹き出し確認 (true: 確認あり, false: 即時実行)
    turnEndWarning: true,          // 土地未配置時のターン終了警告 (true: 警告あり, false: 即時終了)
    defaultHandMode: "standard",   // 手札の初期表示モード ("standard": 標準, "minimal": 縮小)
    autoRotateOnRightClick: true,  // 右クリックでのカード回転
    focusDoFBlur: false,           // 2層DoFフォーカス演出 (true: 配置中ボケ演出あり, false: 常時クリア)
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
    constructor(settings = gameSettings) {
        this.settings = settings;
        this.modalEl = null;
        this.isOpen = false;
        this.activeTab = "gameplay"; // "gameplay" | "visual" | "sound"
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

        const titleText = I18n ? I18n.t("UI_SETTINGS_TITLE") : "⚙️";
        const descText = I18n ? I18n.t("UI_SETTINGS_DESC") : "";
        const resetBtnText = I18n ? I18n.t("UI_RESET_DEFAULT") : "Reset";
        const closeBtnText = I18n ? I18n.t("UI_CLOSE") : "Close";

        // タブ名
        const tabGameplayText = I18n ? I18n.t("UI_SETTINGS_TAB_GAMEPLAY") : "Gameplay";
        const tabVisualText = I18n ? I18n.t("UI_SETTINGS_TAB_VISUAL") : "Visual";
        const tabSoundText = I18n ? I18n.t("UI_SETTINGS_TAB_SOUND") : "Sound";

        // ① ゲームプレイ項目
        const mTitle = I18n ? I18n.t("UI_SETTINGS_MULLIGAN_TITLE") : "Mulligan";
        const mDesc = I18n ? I18n.t("UI_SETTINGS_MULLIGAN_DESC") : "";
        const mOptTrue = I18n ? I18n.t("UI_SETTINGS_MULLIGAN_OPT_TRUE") : "ON";
        const mOptFalse = I18n ? I18n.t("UI_SETTINGS_MULLIGAN_OPT_FALSE") : "OFF";

        const wTitle = I18n ? I18n.t("UI_SETTINGS_WARN_TITLE") : "Turn End Warning";
        const wDesc = I18n ? I18n.t("UI_SETTINGS_WARN_DESC") : "";
        const wOptTrue = I18n ? I18n.t("UI_SETTINGS_WARN_OPT_TRUE") : "ON";
        const wOptFalse = I18n ? I18n.t("UI_SETTINGS_WARN_OPT_FALSE") : "OFF";

        const hmTitle = I18n ? I18n.t("UI_SETTINGS_HAND_MODE_TITLE") : "Hand Mode";
        const hmDesc = I18n ? I18n.t("UI_SETTINGS_HAND_MODE_DESC") : "";
        const hmOptStd = I18n ? I18n.t("UI_SETTINGS_HAND_MODE_STANDARD") : "Standard";
        const hmOptMin = I18n ? I18n.t("UI_SETTINGS_HAND_MODE_MINIMAL") : "Minimal";

        const rotTitle = I18n ? I18n.t("UI_SETTINGS_ROTATE_TITLE") : "Right-Click Rotate";
        const rotDesc = I18n ? I18n.t("UI_SETTINGS_ROTATE_DESC") : "";
        const rotOptTrue = I18n ? I18n.t("UI_SETTINGS_ROTATE_OPT_TRUE") : "ON";
        const rotOptFalse = I18n ? I18n.t("UI_SETTINGS_ROTATE_OPT_FALSE") : "OFF";

        // ② ビジュアル項目
        const fTitle = I18n ? I18n.t("UI_SETTINGS_FOCUS_TITLE") : "DoF Blur";
        const fDesc = I18n ? I18n.t("UI_SETTINGS_FOCUS_DESC") : "";
        const fOptTrue = I18n ? I18n.t("UI_SETTINGS_FOCUS_OPT_TRUE") : "ON";
        const fOptFalse = I18n ? I18n.t("UI_SETTINGS_FOCUS_OPT_FALSE") : "OFF";

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
        const sndOptOn = I18n ? I18n.t("UI_SETTINGS_SOUND_OPT_ON") : "ON";
        const sndOptOff = I18n ? I18n.t("UI_SETTINGS_SOUND_OPT_OFF") : "OFF";

        this.modalEl.innerHTML = `
            <div class="directive-modal-window settings-modal-window" style="max-width: 580px; width: 90%;">
                <div class="directive-modal-header">
                    <h3 class="directive-modal-title">
                        <span>⚙️</span> ${titleText}
                    </h3>
                    <button class="directive-modal-close-btn" id="btnCloseSettings">✕</button>
                </div>
                
                <div class="directive-modal-desc">
                    ${descText}
                </div>

                <!-- 🗂️ 設定タブバー -->
                <div class="settings-tab-bar" style="display: flex; gap: 8px; margin: 12px 0 16px 0; border-bottom: 2px solid #2e384e; padding-bottom: 8px;">
                    <button class="settings-tab-btn ${this.activeTab === 'gameplay' ? 'active' : ''}" data-tab="gameplay" style="flex: 1; padding: 8px 12px; border-radius: 6px; font-weight: bold; font-size: 13px; cursor: pointer; border: 1px solid #3d4a63; background: ${this.activeTab === 'gameplay' ? '#1abc9c' : '#1c2230'}; color: ${this.activeTab === 'gameplay' ? '#ffffff' : '#a4b0be'};">${tabGameplayText}</button>
                    <button class="settings-tab-btn ${this.activeTab === 'visual' ? 'active' : ''}" data-tab="visual" style="flex: 1; padding: 8px 12px; border-radius: 6px; font-weight: bold; font-size: 13px; cursor: pointer; border: 1px solid #3d4a63; background: ${this.activeTab === 'visual' ? '#1abc9c' : '#1c2230'}; color: ${this.activeTab === 'visual' ? '#ffffff' : '#a4b0be'};">${tabVisualText}</button>
                    <button class="settings-tab-btn ${this.activeTab === 'sound' ? 'active' : ''}" data-tab="sound" style="flex: 1; padding: 8px 12px; border-radius: 6px; font-weight: bold; font-size: 13px; cursor: pointer; border: 1px solid #3d4a63; background: ${this.activeTab === 'sound' ? '#1abc9c' : '#1c2230'}; color: ${this.activeTab === 'sound' ? '#ffffff' : '#a4b0be'};">${tabSoundText}</button>
                </div>

                <div class="settings-tab-content-container" style="min-height: 220px;">
                    <!-- 🎮 1. ゲームプレイ タブペイン -->
                    <div class="settings-tab-pane" id="paneGameplay" style="display: ${this.activeTab === 'gameplay' ? 'flex' : 'none'}; flex-direction: column; gap: 12px;">
                        <!-- 手札初期表示モード -->
                        <div class="setting-item-row" style="display: flex; justify-content: space-between; align-items: center; background: #1c2230; padding: 10px 14px; border-radius: 8px; border: 1px solid #2a3144;">
                            <div>
                                <div style="font-weight: bold; color: #ffffff; font-size: 13px;">${hmTitle}</div>
                                <div style="font-size: 11px; color: #a4b0be; margin-top: 2px;">${hmDesc}</div>
                            </div>
                            <select id="optDefaultHandMode" class="setting-select-control" style="background: #2b3548; color: #1abc9c; border: 1px solid #3d4a63; padding: 5px 10px; border-radius: 6px; font-weight: bold; font-size: 12px; cursor: pointer;">
                                <option value="standard">${hmOptStd}</option>
                                <option value="minimal">${hmOptMin}</option>
                            </select>
                        </div>

                        <!-- マリガン確認 -->
                        <div class="setting-item-row" style="display: flex; justify-content: space-between; align-items: center; background: #1c2230; padding: 10px 14px; border-radius: 8px; border: 1px solid #2a3144;">
                            <div>
                                <div style="font-weight: bold; color: #ffffff; font-size: 13px;">${mTitle}</div>
                                <div style="font-size: 11px; color: #a4b0be; margin-top: 2px;">${mDesc}</div>
                            </div>
                            <select id="optMulliganConfirm" class="setting-select-control" style="background: #2b3548; color: #1abc9c; border: 1px solid #3d4a63; padding: 5px 10px; border-radius: 6px; font-weight: bold; font-size: 12px; cursor: pointer;">
                                <option value="true">${mOptTrue}</option>
                                <option value="false">${mOptFalse}</option>
                            </select>
                        </div>

                        <!-- 土地未配置ターン終了警告 -->
                        <div class="setting-item-row" style="display: flex; justify-content: space-between; align-items: center; background: #1c2230; padding: 10px 14px; border-radius: 8px; border: 1px solid #2a3144;">
                            <div>
                                <div style="font-weight: bold; color: #ffffff; font-size: 13px;">${wTitle}</div>
                                <div style="font-size: 11px; color: #a4b0be; margin-top: 2px;">${wDesc}</div>
                            </div>
                            <select id="optTurnEndWarning" class="setting-select-control" style="background: #2b3548; color: #1abc9c; border: 1px solid #3d4a63; padding: 5px 10px; border-radius: 6px; font-weight: bold; font-size: 12px; cursor: pointer;">
                                <option value="true">${wOptTrue}</option>
                                <option value="false">${wOptFalse}</option>
                            </select>
                        </div>

                        <!-- 右クリック回転 -->
                        <div class="setting-item-row" style="display: flex; justify-content: space-between; align-items: center; background: #1c2230; padding: 10px 14px; border-radius: 8px; border: 1px solid #2a3144;">
                            <div>
                                <div style="font-weight: bold; color: #ffffff; font-size: 13px;">${rotTitle}</div>
                                <div style="font-size: 11px; color: #a4b0be; margin-top: 2px;">${rotDesc}</div>
                            </div>
                            <select id="optAutoRotate" class="setting-select-control" style="background: #2b3548; color: #1abc9c; border: 1px solid #3d4a63; padding: 5px 10px; border-radius: 6px; font-weight: bold; font-size: 12px; cursor: pointer;">
                                <option value="true">${rotOptTrue}</option>
                                <option value="false">${rotOptFalse}</option>
                            </select>
                        </div>
                    </div>

                    <!-- 🎨 2. ビジュアル タブペイン -->
                    <div class="settings-tab-pane" id="paneVisual" style="display: ${this.activeTab === 'visual' ? 'flex' : 'none'}; flex-direction: column; gap: 12px;">
                        <!-- 言語設定 -->
                        <div class="setting-item-row" style="display: flex; justify-content: space-between; align-items: center; background: #1c2230; padding: 10px 14px; border-radius: 8px; border: 1px solid #2a3144;">
                            <div>
                                <div style="font-weight: bold; color: #ffffff; font-size: 13px;">${langTitle}</div>
                                <div style="font-size: 11px; color: #a4b0be; margin-top: 2px;">${langDesc}</div>
                            </div>
                            <select id="optLanguage" class="setting-select-control" style="background: #2b3548; color: #1abc9c; border: 1px solid #3d4a63; padding: 5px 10px; border-radius: 6px; font-weight: bold; font-size: 12px; cursor: pointer;">
                                <option value="ja">${langJa}</option>
                                <option value="en">${langEn}</option>
                            </select>
                        </div>

                        <!-- 2層DoFフォーカス演出 -->
                        <div class="setting-item-row" style="display: flex; justify-content: space-between; align-items: center; background: #1c2230; padding: 10px 14px; border-radius: 8px; border: 1px solid #2a3144;">
                            <div>
                                <div style="font-weight: bold; color: #ffffff; font-size: 13px;">${fTitle}</div>
                                <div style="font-size: 11px; color: #a4b0be; margin-top: 2px;">${fDesc}</div>
                            </div>
                            <select id="optFocusDoFBlur" class="setting-select-control" style="background: #2b3548; color: #1abc9c; border: 1px solid #3d4a63; padding: 5px 10px; border-radius: 6px; font-weight: bold; font-size: 12px; cursor: pointer;">
                                <option value="true">${fOptTrue}</option>
                                <option value="false">${fOptFalse}</option>
                            </select>
                        </div>

                        <!-- 演出アニメーション速度 -->
                        <div class="setting-item-row" style="display: flex; justify-content: space-between; align-items: center; background: #1c2230; padding: 10px 14px; border-radius: 8px; border: 1px solid #2a3144;">
                            <div>
                                <div style="font-weight: bold; color: #ffffff; font-size: 13px;">${animTitle}</div>
                                <div style="font-size: 11px; color: #a4b0be; margin-top: 2px;">${animDesc}</div>
                            </div>
                            <select id="optAnimSpeed" class="setting-select-control" style="background: #2b3548; color: #1abc9c; border: 1px solid #3d4a63; padding: 5px 10px; border-radius: 6px; font-weight: bold; font-size: 12px; cursor: pointer;">
                                <option value="normal">${animNorm}</option>
                                <option value="fast">${animFast}</option>
                            </select>
                        </div>
                    </div>

                    <!-- 🔊 3. サウンド タブペイン -->
                    <div class="settings-tab-pane" id="paneSound" style="display: ${this.activeTab === 'sound' ? 'flex' : 'none'}; flex-direction: column; gap: 12px;">
                        <!-- 効果音 (SE) -->
                        <div class="setting-item-row" style="display: flex; justify-content: space-between; align-items: center; background: #1c2230; padding: 10px 14px; border-radius: 8px; border: 1px solid #2a3144;">
                            <div>
                                <div style="font-weight: bold; color: #ffffff; font-size: 13px;">${seTitle}</div>
                                <div style="font-size: 11px; color: #a4b0be; margin-top: 2px;">${seDesc}</div>
                            </div>
                            <select id="optSeEnabled" class="setting-select-control" style="background: #2b3548; color: #1abc9c; border: 1px solid #3d4a63; padding: 5px 10px; border-radius: 6px; font-weight: bold; font-size: 12px; cursor: pointer;">
                                <option value="true">${sndOptOn}</option>
                                <option value="false">${sndOptOff}</option>
                            </select>
                        </div>

                        <!-- 背景音楽 (BGM) -->
                        <div class="setting-item-row" style="display: flex; justify-content: space-between; align-items: center; background: #1c2230; padding: 10px 14px; border-radius: 8px; border: 1px solid #2a3144;">
                            <div>
                                <div style="font-weight: bold; color: #ffffff; font-size: 13px;">${bgmTitle}</div>
                                <div style="font-size: 11px; color: #a4b0be; margin-top: 2px;">${bgmDesc}</div>
                            </div>
                            <select id="optBgmEnabled" class="setting-select-control" style="background: #2b3548; color: #1abc9c; border: 1px solid #3d4a63; padding: 5px 10px; border-radius: 6px; font-weight: bold; font-size: 12px; cursor: pointer;">
                                <option value="true">${sndOptOn}</option>
                                <option value="false">${sndOptOff}</option>
                            </select>
                        </div>
                    </div>
                </div>

                <div class="directive-modal-footer" style="margin-top: 14px; display: flex; justify-content: space-between; align-items: center;">
                    <button id="btnResetSettings" style="background: transparent; color: #e74c3c; border: 1px solid #e74c3c; padding: 6px 14px; border-radius: 6px; font-size: 12px; font-weight: bold; cursor: pointer;">${resetBtnText}</button>
                    <button class="directive-modal-btn-close" id="btnSaveCloseSettings">${closeBtnText}</button>
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

        // 各種セレクト変更イベント
        const selMulligan = this.modalEl.querySelector("#optMulliganConfirm");
        const selTurnEnd = this.modalEl.querySelector("#optTurnEndWarning");
        const selHandMode = this.modalEl.querySelector("#optDefaultHandMode");
        const selAutoRotate = this.modalEl.querySelector("#optAutoRotate");
        const selFocus = this.modalEl.querySelector("#optFocusDoFBlur");
        const selLanguage = this.modalEl.querySelector("#optLanguage");
        const selAnimSpeed = this.modalEl.querySelector("#optAnimSpeed");
        const selSe = this.modalEl.querySelector("#optSeEnabled");
        const selBgm = this.modalEl.querySelector("#optBgmEnabled");

        if (selMulligan) selMulligan.onchange = (e) => this.settings.set("mulliganConfirm", e.target.value === "true");
        if (selTurnEnd) selTurnEnd.onchange = (e) => this.settings.set("turnEndWarning", e.target.value === "true");
        if (selHandMode) selHandMode.onchange = (e) => {
            this.settings.set("defaultHandMode", e.target.value);
            if (typeof window !== "undefined" && window.gameUI) {
                window.gameUI.isMinimalMode = (e.target.value === "minimal");
                window.gameUI.render();
            }
        };
        if (selAutoRotate) selAutoRotate.onchange = (e) => this.settings.set("autoRotateOnRightClick", e.target.value === "true");
        if (selFocus) selFocus.onchange = (e) => this.settings.set("focusDoFBlur", e.target.value === "true");
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
        if (selSe) selSe.onchange = (e) => this.settings.set("seEnabled", e.target.value === "true");
        if (selBgm) selBgm.onchange = (e) => this.settings.set("bgmEnabled", e.target.value === "true");

        this.updateControlsFromSettings();
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
            btn.style.background = isMatch ? "#1abc9c" : "#1c2230";
            btn.style.color = isMatch ? "#ffffff" : "#a4b0be";
        });

        // タブペインの表示・非表示更新
        const paneMap = {
            gameplay: this.modalEl.querySelector("#paneGameplay"),
            visual: this.modalEl.querySelector("#paneVisual"),
            sound: this.modalEl.querySelector("#paneSound")
        };

        for (const [key, el] of Object.entries(paneMap)) {
            if (el) {
                el.style.display = (key === tabName) ? "flex" : "none";
            }
        }
    }

    /**
     * 🔄 設定値からUIコントロールの状態を更新
     */
    updateControlsFromSettings() {
        if (!this.modalEl) return;

        const setVal = (selector, val) => {
            const el = this.modalEl.querySelector(selector);
            if (el) el.value = String(val);
        };

        setVal("#optMulliganConfirm", this.settings.get("mulliganConfirm"));
        setVal("#optTurnEndWarning", this.settings.get("turnEndWarning"));
        setVal("#optDefaultHandMode", this.settings.get("defaultHandMode"));
        setVal("#optAutoRotate", this.settings.get("autoRotateOnRightClick"));
        setVal("#optFocusDoFBlur", this.settings.get("focusDoFBlur"));
        setVal("#optLanguage", this.settings.get("language"));
        setVal("#optAnimSpeed", this.settings.get("animSpeed"));
        setVal("#optSeEnabled", this.settings.get("seEnabled"));
        setVal("#optBgmEnabled", this.settings.get("bgmEnabled"));
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

