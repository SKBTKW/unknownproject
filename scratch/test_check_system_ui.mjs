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
        this.style = { setProperty: () => {}, display: "", opacity: "0", transform: "" };
        this.dataset = {};
        this.attributes = {};
        this.innerHTML = "";
    }
    get id() { return this._id; }
    set id(val) { this._id = val; if (val) elementRegistry.set(val, this); }
    get classList() {
        return {
            add: (...cls) => cls.forEach(c => this._classes.add(c)),
            remove: (...cls) => cls.forEach(c => this._classes.delete(c)),
            contains: (c) => this._classes.has(c)
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
}

globalThis.document = {
    getElementById: (id) => elementRegistry.get(id) || null,
    querySelector: (sel) => null,
    querySelectorAll: (sel) => [],
    createElement: (tag) => new MockElement("", "", tag),
    body: new MockElement("body"),
    head: new MockElement("head"),
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
const { DiceDisplayQueue } = await import("../game/src/ui/dice_display_queue.js");
const { DiceWidgetComponent } = await import("../game/src/ui/dice_widget_component.js");
const { UILayoutConfig } = await import("../game/src/ui/layout_config.js");
const { FloatingFeedbackService } = await import("../game/src/ui/floating_feedback_service.js");

console.log("============================================================");
console.log("🧪 [Phase 3: CheckSystem UI & DisplayQueue Verification Test]");
console.log("============================================================");

// 1. 📐 UILayoutConfig 定義検問
console.log("🔍 [UI-1] UILayoutConfig diceWidget 定義検問...");
assert.ok(UILayoutConfig.diceWidget, "UILayoutConfig に diceWidget 定義が存在すること");
assert.strictEqual(UILayoutConfig.diceWidget.desktop.pointerEvents, "none", "デスクトップで pointer-events が none であること (盤面操作非阻害)");
assert.strictEqual(UILayoutConfig.diceWidget.mobile.pointerEvents, "none", "モバイルで pointer-events が none であること");
assert.ok(UILayoutConfig.diceWidget.importanceThemes.NORMAL, "NORMAL テーマが存在すること");
assert.ok(UILayoutConfig.diceWidget.importanceThemes.TACTICAL, "TACTICAL テーマが存在すること");
assert.ok(UILayoutConfig.diceWidget.importanceThemes.CRITICAL, "CRITICAL テーマが存在すること");
console.log("  ✅ PASS: UILayoutConfig diceWidget 定義正常 (pointer-events: none / 3テーマ確認)");

// 2. 📥 DiceDisplayQueue FIFO 順次消化検問
console.log("\n🔍 [UI-2] DiceDisplayQueue FIFO 順次消化検問...");
const playedEvents = [];
const mockWidget = {
    play: async (event) => {
        playedEvents.push(event);
        // 50ms 再生をシミュレート
        await new Promise(r => setTimeout(r, 50));
    },
    hide: () => {}
};

const queue = new DiceDisplayQueue(mockWidget);
const event1 = { result: { checkId: "check_1", dice: { kept: [2, 3] } }, feedback: { importance: "NORMAL" } };
const event2 = { result: { checkId: "check_2", dice: { kept: [5, 6] } }, feedback: { importance: "CRITICAL" } };

queue.enqueue(event1);
queue.enqueue(event2);

// 2件のイベントが順番に再生されるのを待機
await new Promise(r => setTimeout(r, 150));

assert.strictEqual(playedEvents.length, 2, "2件のイベントがすべて再生されたこと");
assert.strictEqual(playedEvents[0].result.checkId, "check_1", "1番目のイベントが check_1 であること (FIFO順)");
assert.strictEqual(playedEvents[1].result.checkId, "check_2", "2番目のイベントが check_2 であること (FIFO順)");
assert.strictEqual(queue.isPlaying, false, "消化完了後に isPlaying が false に戻ること");
console.log("  ✅ PASS: DiceDisplayQueue FIFO 順次処理正常確認");

// 3. 🎲 DiceWidgetComponent DOM ＆ 安全受動検問
console.log("\n🔍 [UI-3] DiceWidgetComponent DOM ＆ 安全受動検問...");
const widget = new DiceWidgetComponent();
assert.ok(widget.containerEl, "containerEl が生成されていること");
assert.strictEqual(widget.containerEl.id, "diceWidgetRoot", "ID が diceWidgetRoot であること");
assert.strictEqual(widget.containerEl.style.pointerEvents, "none", "DOM 上で pointer-events: none が適用されていること");
console.log("  ✅ PASS: DiceWidgetComponent 完全受動 HUD 確認 (pointer-events: none)");

// 4. 🤝 UIController ↔ DiceQueue 連携検問
console.log("\n🔍 [UI-4] UIController ↔ DiceQueue 連携検問...");
const engine = GameEngine.createGame();
const ui = new UIController(engine);

assert.ok(ui.diceQueue instanceof DiceDisplayQueue, "UIController が diceQueue を所有していること");
assert.strictEqual(typeof ui.showDiceCheck, "function", "ui.showDiceCheck メソッドが存在すること");

// showDiceCheck 呼び出し
const testEvent = { result: { checkId: "trial_intercept", dice: { kept: [4, 5] } } };
ui.showDiceCheck(testEvent);
assert.strictEqual(ui.diceQueue.isPlaying, true, "showDiceCheck 呼び出し後にキューが再生中になること");
console.log("  ✅ PASS: UIController ↔ DiceQueue 連携正常確認");

// 5. 🎴 実カード経路での連続2D6伝達
console.log("\n🔍 [UI-5] CMD_ABANDONED_SETTLEMENT 連続実行のUI伝達検問...");
const commandEngine = GameEngine.createGame({ runSeed: 12345678 });
const commandUi = new UIController(commandEngine);
const forwardedChecks = [];
commandUi.showDiceCheck = event => forwardedChecks.push(event);
commandUi.render = () => {};

const commandCard = {
    id: "CMD_ABANDONED_SETTLEMENT",
    category: "COMMAND",
    nameKey: "CMD_ABANDONED_SETTLEMENT_NAME",
    descriptionKey: "CMD_ABANDONED_SETTLEMENT_DESC",
    cost: { ember: 1 }
};

commandEngine.state.ember = 100;
for (let i = 0; i < 24; i++) {
    commandEngine.state.hasPickedThisTurn = false;
    commandEngine.state.handOffering[0] = commandCard;
    commandUi.playCommandCard(commandCard, 0);
}

assert.strictEqual(commandEngine.checkSystem, commandEngine.state.checkSystem, "EngineとStateが同じCheckSystemを参照すること");
assert.strictEqual(forwardedChecks.length, 24, "24回すべてのdiceCheckがUIのshowDiceCheckへ渡ること");
assert.strictEqual(commandEngine.checkSystem.getState().rng.callCount, 48, "24回の2D6が同一RNGを48回進めること");
const forwardedTotals = forwardedChecks.map(event => event.result.finalTotal);
assert.ok(new Set(forwardedTotals).size > 1, "連続結果が単一値へ固定されないこと");
assert.ok(forwardedTotals.some(total => total !== 8), "CMD_ABANDONED_SETTLEMENTが毎回8にならないこと");
for (const event of forwardedChecks) {
    const kept = event.result.dice.kept;
    assert.strictEqual(kept.length, 2, "UIへ渡すdice.keptが2要素であること");
    assert.strictEqual(event.result.finalTotal, kept[0] + kept[1], "UIへ渡すfinalTotalがdice.keptの合計であること");
}
console.log("  ✅ PASS: 同一CheckSystemの連続ロールとUI伝達を確認");

// 6. 📊 FloatingFeedbackServiceの既存増減表示
console.log("\n🔍 [UI-6] FloatingFeedbackService 増減表示検問...");
const feedbackTarget = new MockElement("feedbackTarget");
feedbackTarget.getBoundingClientRect = () => ({ left: 100, top: 40, width: 60, height: 20 });
const bodyChildCountBefore = document.body.children.length;
FloatingFeedbackService.spawnOnElement(feedbackTarget, 5, { durationMs: 1 });
FloatingFeedbackService.spawnOnElement(feedbackTarget, -3, { durationMs: 1 });
const feedbackPopups = document.body.children.slice(bodyChildCountBefore);
assert.strictEqual(feedbackPopups.length, 2, "増加・減少の2要素が生成されること");
assert.strictEqual(feedbackPopups[0].textContent, "+5", "増加量が+5表記になること");
assert.ok(feedbackPopups[0].className.includes("is-plus"), "増加用classが付くこと");
assert.strictEqual(feedbackPopups[1].textContent, "-3", "減少量が-3表記になること");
assert.ok(feedbackPopups[1].className.includes("is-minus"), "減少用classが付くこと");
console.log("  ✅ PASS: 既存の増加・減少フロート生成を確認");

console.log("\n============================================================");
console.log("🎉 [Phase 3: CheckSystem UI & DisplayQueue Verification Test] ALL PASS");
console.log("============================================================");
