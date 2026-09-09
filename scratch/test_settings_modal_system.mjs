import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const STORAGE_KEY = "TOA_GAME_SETTINGS_V1";

let passed = 0;
function assert(condition, message) {
    if (!condition) throw new Error(message);
    passed += 1;
    console.log(`  PASS: ${message}`);
}

class MemoryStorage {
    constructor(initial = {}) {
        this.values = new Map(Object.entries(initial));
    }

    getItem(key) {
        return this.values.has(key) ? this.values.get(key) : null;
    }

    setItem(key, value) {
        this.values.set(key, String(value));
    }
}

function createClassList() {
    const values = new Set();
    return {
        toggle(name, enabled) {
            if (enabled) values.add(name);
            else values.delete(name);
        },
        contains(name) {
            return values.has(name);
        }
    };
}

function createFakeDocument() {
    const elementsById = new Map();
    const controls = new Map();
    const body = {
        appendChild(element) {
            elementsById.set(element.id, element);
        }
    };

    return {
        body,
        controls,
        documentElement: {
            dataset: {},
            style: { setProperty() {} }
        },
        getElementById(id) {
            return elementsById.get(id) || null;
        },
        querySelector() {
            return null;
        },
        createElement() {
            const styleValues = new Map();
            return {
                id: "",
                className: "",
                innerHTML: "",
                style: {
                    display: "",
                    setProperty(name, value) {
                        styleValues.set(name, value);
                    },
                    getPropertyValue(name) {
                        return styleValues.get(name) || "";
                    }
                },
                remove() {
                    elementsById.delete(this.id);
                },
                querySelectorAll() {
                    return [];
                },
                querySelector(selector) {
                    if (!selector.startsWith("#")) return null;
                    if (!controls.has(selector)) {
                        controls.set(selector, {
                            value: "",
                            onclick: null,
                            onchange: null,
                            classList: createClassList()
                        });
                    }
                    return controls.get(selector);
                }
            };
        },
        addEventListener() {}
    };
}

globalThis.localStorage = new MemoryStorage({
    [STORAGE_KEY]: JSON.stringify({ language: "en", focusDoFBlur: true })
});
globalThis.document = createFakeDocument();
globalThis.window = { I18n: null };
globalThis.I18n = {
    currentLanguage: "ja",
    t(key) {
        const values = {
            UI_SETTINGS_TAB_GRAPHICS: "グラフィック",
            UI_SETTINGS_RESOLUTION_RECOMMENDED: "（推奨）"
        };
        return values[key] || key;
    },
    setLanguage(language) {
        this.currentLanguage = language;
    }
};
globalThis.window.I18n = globalThis.I18n;

const {
    GameSettings,
    RESOLUTION_PRESETS,
    SettingsModalSystem
} = await import("../game/src/ui/settings_modal_system.js");
const { DisplaySettingsAdapter } = await import("../game/src/ui/display_settings_adapter.js");

console.log("\nSettings Modal System regression tests");

const migratedSettings = new GameSettings();
assert(migratedSettings.get("language") === "en", "旧保存データの既存値を維持する");
assert(migratedSettings.get("resolution") === "1920x1080", "旧保存データへ解像度既定値を補完する");
assert(migratedSettings.get("advisorEnabled") === true, "旧保存データへ側近ON既定値を補完する");
assert(migratedSettings.get("advisorHoverExpand") === false, "旧保存データへ側近hover展開OFF既定値を補完する");
assert(RESOLUTION_PRESETS.length === 6, "解像度プリセットを6件に一元化する");
assert(RESOLUTION_PRESETS.find(item => item.recommended)?.value === "1920x1080", "1920x1080だけを推奨プリセットにする");

migratedSettings.set("resolution", "2560x1440");
const reloadedSettings = new GameSettings();
assert(reloadedSettings.get("resolution") === "2560x1440", "解像度をLocalStorageから復元する");
reloadedSettings.reset();
assert(reloadedSettings.get("resolution") === "1920x1080", "初期設定へ戻すと1920x1080へ戻る");

const applied = [];
const displayAdapter = {
    applyResolution(value) {
        applied.push(value);
        return true;
    }
};
const modal = new SettingsModalSystem(reloadedSettings, displayAdapter);
modal.createModalDOM();
assert(modal.modalEl.innerHTML.includes('data-tab="graphics"'), "内部タブ識別子にgraphicsを使う");
assert(modal.modalEl.innerHTML.includes('id="paneGraphics"'), "グラフィックペイン識別子を使う");
assert(!modal.modalEl.innerHTML.includes('data-tab="visual"'), "旧visualタブ識別子を生成しない");
assert(modal.modalEl.innerHTML.includes('id="optResolution"'), "グラフィックタブに解像度selectを生成する");
assert(modal.modalEl.innerHTML.includes('id="optAdvisorEnabled"'), "ゲームプレイタブに側近ON/OFFを生成する");
assert(modal.modalEl.innerHTML.includes('id="optAdvisorHoverExpand"'), "ゲームプレイタブに側近hover展開設定を生成する");
assert(modal.modalEl.innerHTML.includes("1920 × 1080（推奨）"), "日本語で推奨解像度ラベルを表示する");
assert(modal.modalEl.style.getPropertyValue("--settings-modal-width") === "min(680px, 92vw)", "モーダル幅をレイアウト設定から受け取る");
assert(modal.modalEl.style.getPropertyValue("--settings-modal-height") === "min(680px, calc(100vh - 64px))", "モーダル高をレイアウト設定から受け取る");

const resolutionControl = document.controls.get("#optResolution");
resolutionControl.onchange({ target: { value: "3440x1440" } });
assert(reloadedSettings.get("resolution") === "3440x1440", "select変更をGameSettingsへ保存する");
assert(applied.at(-1) === "3440x1440", "保存変更を表示Adapterへ通知する");

const advisorHoverControl = document.controls.get("#optAdvisorHoverExpand");
advisorHoverControl.onchange({ target: { value: "true" } });
assert(reloadedSettings.get("advisorHoverExpand") === true, "hover展開設定をGameSettingsへ保存する");

const languageControl = document.controls.get("#optLanguage");
languageControl.onchange({ target: { value: "en" } });
assert(reloadedSettings.get("resolution") === "3440x1440", "言語切替によるDOM再生成後も解像度を維持する");
assert(document.controls.get("#optResolution").value === "3440x1440", "再生成後のselectへ保存値を反映する");

const root = {
    dataset: {},
    style: {
        values: new Map(),
        setProperty(name, value) {
            this.values.set(name, value);
        }
    }
};
const adapter = new DisplaySettingsAdapter(() => root);
assert(adapter.applyResolution("1920x1080") === true, "有効な解像度設定を表示境界で受理する");
assert(root.dataset.resolution === "1920x1080", "ブラウザ版ではdata属性へ対象解像度を反映する");
assert(root.style.values.get("--display-target-width") === "1920px", "対象幅をCSS変数へ反映する");
assert(adapter.applyResolution("invalid") === false, "不正な解像度値を表示境界で拒否する");

const css = fs.readFileSync(path.join(ROOT, "game/css/0_global_common/base_layout.css"), "utf8");
const source = fs.readFileSync(path.join(ROOT, "game/src/ui/settings_modal_system.js"), "utf8");
assert(css.includes(".settings-modal-window") && css.includes("height: var(--settings-modal-height"), "設定モーダル外形をCSSで固定する");
assert(css.includes(".settings-tab-content-container") && css.includes("overflow-y: auto"), "タブ内容領域だけを縦スクロール可能にする");
assert(!source.includes('style="'), "設定モーダルのHTMLテンプレートへinline styleを残さない");

console.log(`\nPASS: ${passed} settings modal assertions`);
