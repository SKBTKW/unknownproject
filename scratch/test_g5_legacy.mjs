import assert from "assert";
import fs from "fs";

// 🧪 Mock DOM 環境の構築
const elementRegistry = new Map();
class MockElement {
    constructor(id = "", className = "", tagName = "div") {
        this._id = id;
        if (id) elementRegistry.set(id, this);
        this._classes = new Set();
        if (className) String(className).split(" ").filter(Boolean).forEach(c => this._classes.add(c));
        this.tagName = tagName.toUpperCase();
        this.children = [];
        this.style = { setProperty: () => {}, display: "" };
        this.dataset = {};
        this.attributes = {};
    }
    get id() { return this._id; }
    set id(val) { this._id = val; if (val) elementRegistry.set(val, this); }
    get classList() {
        return {
            add: (...cls) => cls.forEach(c => this._classes.add(c)),
            remove: (...cls) => cls.forEach(c => this._classes.delete(c)),
            contains: (c) => this._classes.has(c),
            toggle: (c, force) => {
                if (force === undefined) {
                    if (this._classes.has(c)) { this._classes.delete(c); return false; }
                    else { this._classes.add(c); return true; }
                } else if (force) { this._classes.add(c); return true; }
                else { this._classes.delete(c); return false; }
            }
        };
    }
    appendChild(child) { this.children.push(child); return child; }
    removeChild(child) {
        const idx = this.children.indexOf(child);
        if (idx !== -1) this.children.splice(idx, 1);
        return child;
    }
    querySelector(sel) { return null; }
    querySelectorAll(sel) { return []; }
    setAttribute(k, v) { this.attributes[k] = v; }
    getAttribute(k) { return this.attributes[k] || null; }
    removeAttribute(k) { delete this.attributes[k]; }
    addEventListener() {}
    removeEventListener() {}
    getBoundingClientRect() { return { top: 0, left: 0, bottom: 50, right: 50, width: 50, height: 50 }; }
}

globalThis.document = {
    getElementById: (id) => elementRegistry.get(id) || null,
    querySelector: (sel) => null,
    querySelectorAll: (sel) => [],
    createElement: (tag) => new MockElement("", "", tag),
    body: new MockElement("body"),
    documentElement: new MockElement("html"),
    addEventListener: () => {}
};
globalThis.window = {
    document: globalThis.document,
    innerWidth: 1024,
    innerHeight: 768,
    addEventListener: () => {},
    localStorage: { getItem: () => null, setItem: () => {} }
};

const { GameEngine, UIController } = await import("../game/src/app.js");
const { attachLegacyUIBridge } = await import("../game/src/ui/legacy_ui_bridge.js");

console.log("============================================================");
console.log("🧪 [Gate 5: Legacy Bridge Verification Test]");
console.log("============================================================");

// 1. 🔍 静的解析検問: UIController コンストラクタからの直接 window.* 代入排除
console.log("🔍 [G5-1] UIController コンストラクタ直接 window 汚染排除検問...");
const uiControllerContent = fs.readFileSync("game/src/ui/ui_controller.js", "utf8");
const constructorBlock = uiControllerContent.split("constructor(engine) {")[1].split("// 🎛️ UIInteractionState")[0];
assert.strictEqual(constructorBlock.includes("window.selectCard ="), false, "constructor 内に window.selectCard の直接代入が存在してはならない");
assert.strictEqual(constructorBlock.includes("window.onCellClick ="), false, "constructor 内に window.onCellClick の直接代入が存在してはならない");
assert.strictEqual(constructorBlock.includes("window.undoLandPlacement ="), false, "constructor 内に window.undoLandPlacement の直接代入が存在してはならない");
assert.strictEqual(constructorBlock.includes("attachLegacyUIBridge(this);"), true, "constructor で attachLegacyUIBridge(this) が呼び出されていること");
console.log("  ✅ PASS: UIController コンストラクタからの直接 window 汚染 0 件 (attachLegacyUIBridge に集約)");

// 2. 🌐 Legacy UI Bridge 疎通動作検問
console.log("🔍 [G5-2] Legacy UI Bridge 露出・委譲検問...");
const engine = GameEngine.createGame();
const ui = new UIController(engine);

attachLegacyUIBridge(ui);

assert.strictEqual(globalThis.window.uiController, ui, "window.uiController がバインドされていること");
assert.strictEqual(globalThis.window.state, ui.state, "window.state がバインドされていること");
assert.strictEqual(typeof globalThis.window.selectCard, "function", "window.selectCard が関数としてバインドされていること");
assert.strictEqual(typeof globalThis.window.onCellClick, "function", "window.onCellClick が関数としてバインドされていること");
assert.strictEqual(typeof globalThis.window.mulligan, "function", "window.mulligan が関数としてバインドされていること");
assert.strictEqual(typeof globalThis.window.undoLandPlacement, "function", "window.undoLandPlacement が関数としてバインドされていること");

// インライン用関数呼び出しの委譲確認
globalThis.window.selectCard(0);
assert.strictEqual(ui.selectedCardIdx, 0, "window.selectCard(0) の呼び出しが ui.selectedCardIdx に正常委譲されること");

globalThis.window.deselectCard();
assert.strictEqual(ui.selectedCardIdx, -1, "window.deselectCard() の呼び出しが ui.deselectCard() に正常委譲されること");

console.log("  ✅ PASS: legacy_ui_bridge.js 経由での全レガシー/HTMLインライン操作の疎通確認");

console.log("============================================================");
console.log("🎉 [Gate 5: Legacy Bridge Verification Test] ALL PASS (100%)");
console.log("============================================================");
