/* =============================================================
   game/src/ui/settings_modal_system.js
   環境設定（オプション設定）管理 ＆ モーダルUI独立モジュール
   ============================================================= */

const STORAGE_KEY = "TOA_GAME_SETTINGS_V1";

// ⚙️ デフォルト設定定義
const DEFAULT_SETTINGS = {
    mulliganConfirm: true,     // マリガン時の吹き出し確認 (true: 確認あり, false: 即時実行)
    turnEndWarning: true,       // 土地未配置時のターン終了警告 (true: 警告あり, false: 即時終了)
    focusDoFBlur: false,        // 2層DoFフォーカス演出 (true: 配置中ボケ演出あり, false: 常時クリア [デフォルトOFF])
    autoRotateOnRightClick: true // 右クリックでのカード回転
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
 * 🏛️ 設定モーダルUI ＆ ヘッダー⚙️ボタン管理システム
 */
export class SettingsModalSystem {
    constructor(settings = gameSettings) {
        this.settings = settings;
        this.modalEl = null;
        this.isOpen = false;
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
                const ui = window.ui;
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
        btn.title = "⚙️ 環境設定 (Esc)";
        btn.innerHTML = "⚙️";
        btn.onclick = () => this.open();

        topBar.appendChild(btn);
    }

    /**
     * 🖼️ 設定モーダルのDOM構築
     */
    createModalDOM() {
        let existing = document.getElementById("settingsModal");
        if (existing) existing.remove();

        this.modalEl = document.createElement("div");
        this.modalEl.id = "settingsModal";
        this.modalEl.className = "directive-modal-overlay";
        this.modalEl.style.display = "none";

        this.modalEl.innerHTML = `
            <div class="directive-modal-window" style="max-width: 540px;">
                <div class="directive-modal-header">
                    <h3 class="directive-modal-title">
                        <span>⚙️</span> ゲーム環境設定 (Game Preferences)
                    </h3>
                    <button class="directive-modal-close-btn" id="btnCloseSettings">✕</button>
                </div>
                
                <div class="directive-modal-desc">
                    プレイスタイルや好みに合わせて操作感や画面演出をカスタマイズします。設定はブラウザに自動保存されます。
                </div>

                <div class="settings-options-list" style="display: flex; flex-direction: column; gap: 14px; margin-top: 8px;">
                    <!-- ① マリガン確認 -->
                    <div class="setting-item-row" style="display: flex; justify-content: space-between; align-items: center; background: #1c2230; padding: 12px 16px; border-radius: 8px; border: 1px solid #2a3144;">
                        <div>
                            <div style="font-weight: bold; color: #ffffff; font-size: 14px;">🔄 マリガン確認ダイアログ</div>
                            <div style="font-size: 11.5px; color: #a4b0be; margin-top: 2px;">手札引き直し時に手札直上で確認するか、即時引き直すかを選択</div>
                        </div>
                        <select id="optMulliganConfirm" class="setting-select-control" style="background: #2b3548; color: #1abc9c; border: 1px solid #3d4a63; padding: 6px 12px; border-radius: 6px; font-weight: bold; font-size: 13px; cursor: pointer;">
                            <option value="true">吹き出し確認あり</option>
                            <option value="false">確認なし即時実行</option>
                        </select>
                    </div>

                    <!-- ② 土地未配置ターン終了警告 -->
                    <div class="setting-item-row" style="display: flex; justify-content: space-between; align-items: center; background: #1c2230; padding: 12px 16px; border-radius: 8px; border: 1px solid #2a3144;">
                        <div>
                            <div style="font-weight: bold; color: #ffffff; font-size: 14px;">⚠️ 土地未配置時のターン終了警告</div>
                            <div style="font-size: 11.5px; color: #a4b0be; margin-top: 2px;">当ターン土地を置かずにターン終了を押した際に警告を表示</div>
                        </div>
                        <select id="optTurnEndWarning" class="setting-select-control" style="background: #2b3548; color: #1abc9c; border: 1px solid #3d4a63; padding: 6px 12px; border-radius: 6px; font-weight: bold; font-size: 13px; cursor: pointer;">
                            <option value="true">警告を出す (推奨)</option>
                            <option value="false">即時ターン終了</option>
                        </select>
                    </div>

                    <!-- ③ 2層DoFフォーカス演出 -->
                    <div class="setting-item-row" style="display: flex; justify-content: space-between; align-items: center; background: #1c2230; padding: 12px 16px; border-radius: 8px; border: 1px solid #2a3144;">
                        <div>
                            <div style="font-weight: bold; color: #ffffff; font-size: 14px;">🌓 2層フォーカス演出 (DoFボケ)</div>
                            <div style="font-size: 11.5px; color: #a4b0be; margin-top: 2px;">土地カード選択中に手札をボカして盤面を際立たせる演出</div>
                        </div>
                        <select id="optFocusDoFBlur" class="setting-select-control" style="background: #2b3548; color: #1abc9c; border: 1px solid #3d4a63; padding: 6px 12px; border-radius: 6px; font-weight: bold; font-size: 13px; cursor: pointer;">
                            <option value="true">ON (映画風演出)</option>
                            <option value="false">OFF (常時クッキリ)</option>
                        </select>
                    </div>
                </div>

                <div class="directive-modal-footer" style="margin-top: 10px; display: flex; justify-content: space-between; align-items: center;">
                    <button id="btnResetSettings" style="background: transparent; color: #e74c3c; border: 1px solid #e74c3c; padding: 6px 14px; border-radius: 6px; font-size: 12px; font-weight: bold; cursor: pointer;">初期設定に戻す</button>
                    <button class="directive-modal-btn-close" id="btnSaveCloseSettings">閉じる</button>
                </div>
            </div>
        `;

        document.body.appendChild(this.modalEl);

        // イベントバインド
        const closeBtn = this.modalEl.querySelector("#btnCloseSettings");
        const saveCloseBtn = this.modalEl.querySelector("#btnSaveCloseSettings");
        const resetBtn = this.modalEl.querySelector("#btnResetSettings");

        if (closeBtn) closeBtn.onclick = () => this.close();
        if (saveCloseBtn) saveCloseBtn.onclick = () => this.close();
        if (resetBtn) resetBtn.onclick = () => {
            this.settings.reset();
            this.updateControlsFromSettings();
        };

        // セレクト変更イベント
        const selMulligan = this.modalEl.querySelector("#optMulliganConfirm");
        const selTurnEnd = this.modalEl.querySelector("#optTurnEndWarning");
        const selFocus = this.modalEl.querySelector("#optFocusDoFBlur");

        if (selMulligan) selMulligan.onchange = (e) => this.settings.set("mulliganConfirm", e.target.value === "true");
        if (selTurnEnd) selTurnEnd.onchange = (e) => this.settings.set("turnEndWarning", e.target.value === "true");
        if (selFocus) selFocus.onchange = (e) => this.settings.set("focusDoFBlur", e.target.value === "true");
    }

    updateControlsFromSettings() {
        if (!this.modalEl) return;
        const selMulligan = this.modalEl.querySelector("#optMulliganConfirm");
        const selTurnEnd = this.modalEl.querySelector("#optTurnEndWarning");
        const selFocus = this.modalEl.querySelector("#optFocusDoFBlur");

        if (selMulligan) selMulligan.value = String(this.settings.get("mulliganConfirm"));
        if (selTurnEnd) selTurnEnd.value = String(this.settings.get("turnEndWarning"));
        if (selFocus) selFocus.value = String(this.settings.get("focusDoFBlur"));
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
