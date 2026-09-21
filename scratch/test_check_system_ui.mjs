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
            contains: (c) => this._classes.has(c),
            toggle: (c, force) => {
                if (force === undefined) {
                    if (this._classes.has(c)) { this._classes.delete(c); return false; }
                    this._classes.add(c); return true;
                }
                if (force) { this._classes.add(c); return true; }
                this._classes.delete(c); return false;
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

// 5. 🎴 CheckSystem結果のEngine境界とUI転送境界を分離検証
console.log("\n🔍 [UI-5] CMD_ABANDONED_SETTLEMENT Engine/UI 境界検問...");

const commandEngine = GameEngine.createGame({ runSeed: 12345678 });
const commandCard = commandEngine.deckManager.getLandCardMaster()
    .find(card => card.id === "CMD_ABANDONED_SETTLEMENT");
assert.ok(commandCard, "CMD_ABANDONED_SETTLEMENT が現行masterに存在すること");
commandEngine.state.ember = 100;
commandEngine.state.hasPickedThisTurn = false;
commandEngine.state.handOffering[0] = commandCard;

const rngBeforeCommand = commandEngine.checkSystem.getState().rng.callCount;
const engineCommandResult = commandEngine.playCommandCard(commandCard, { type: "OFFERING", index: 0 });
assert.strictEqual(engineCommandResult.success, true, "Engine facade経由のカード実行が成功すること");
assert.ok(engineCommandResult.diceCheck?.result?.dice?.kept, "Engine facadeがdiceCheckを公開すること");
assert.strictEqual(
    commandEngine.checkSystem.getState().rng.callCount - rngBeforeCommand,
    2,
    "2D6カード1回でCheckSystem RNGが2回だけ進むこと"
);

// UIは乱数やカード解決を再検証せず、Engineが返したCheckResolvedEventをそのまま演出境界へ渡す。
const uiEngine = GameEngine.createGame({ runSeed: 87654321 });
const expectedDiceEvent = {
    result: {
        checkId: "standard_2d6",
        dice: { rolled: [3, 5], kept: [3, 5] },
        rawTotal: 8,
        modifierTotal: 0,
        finalTotal: 8,
        outcome: { id: "medium" }
    },
    context: { sourceType: "CARD_CHECK", sourceId: "abandoned_settlement" },
    feedback: { importance: "TACTICAL" }
};
uiEngine.playCommandCard = () => ({ success: true, diceCheck: expectedDiceEvent });
const commandUi = new UIController(uiEngine);
const forwardedChecks = [];
commandUi.showDiceCheck = event => forwardedChecks.push(event);
commandUi.render = () => {};
uiEngine.state.hasPickedThisTurn = false;
uiEngine.state.handOffering[0] = commandCard;
commandUi.playCommandCard(commandCard, 0);

assert.strictEqual(forwardedChecks.length, 1, "EngineのdiceCheckをUIが1回だけshowDiceCheckへ渡すこと");
assert.strictEqual(forwardedChecks[0], expectedDiceEvent, "UIがCheckResolvedEventを書き換えないこと");
console.log("  ✅ PASS: Engineの2D6解決とUI転送責務を分離して確認");

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