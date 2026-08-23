import { GameEngine, UIController } from 'file:///k:/マイドライブ/AG_ToA/game/src/app.js';

/**
 * 🧪 Mock DOM 環境の構築
 * ブラウザのDOM APIを精密にエミュレートし、UIControllerの全ライフサイクルを検証する
 */
class MockElement {
    constructor(id = "", className = "", tagName = "div") {
        this.id = id;
        this.className = className;
        this.tagName = tagName.toUpperCase();
        this.children = [];
        this.style = {
            setProperty: () => {},
            display: "",
            gridTemplateColumns: "",
            gridTemplateRows: "",
            color: "",
            borderColor: "",
            borderStyle: ""
        };
        this.dataset = {};
        this.attributes = {};
        this.onclick = null;
        this.onmouseenter = null;
        this.onmousemove = null;
        this.onmouseleave = null;
        this.oncontextmenu = null;
        this.ondragstart = null;
        this.ondragend = null;
        this.ondragover = null;
        this.ondrop = null;
        this._innerText = "";
        this._innerHTML = "";
    }

    get innerText() { return this._innerText; }
    set innerText(v) { this._innerText = String(v); }

    get innerHTML() { return this._innerHTML; }
    set innerHTML(v) { 
        this._innerHTML = String(v);
        // innerHTML が空文字でリセットされた場合は子要素もクリア
        if (v === "") this.children = [];
    }

    setAttribute(k, v) { this.attributes[k] = v; }
    getAttribute(k) { return this.attributes[k]; }
    removeAttribute(k) { delete this.attributes[k]; }

    appendChild(el) { 
        if (el) this.children.push(el); 
        return el;
    }
    insertBefore(el, ref) { 
        if (el) this.children.unshift(el); 
        return el;
    }
    removeChild(el) { 
        this.children = this.children.filter(c => c !== el); 
        return el;
    }
    hasChildNodes() { return this.children.length > 0; }

    querySelector(sel) {
        if (sel.startsWith("#")) {
            const targetId = sel.slice(1);
            if (this.id === targetId) return this;
            for (const child of this.children) {
                if (child.querySelector) {
                    const found = child.querySelector(sel);
                    if (found) return found;
                }
            }
            // 見つからない場合は新しいモックを返してチェーン呼び出しを安全に
            return new MockElement(targetId);
        }
        return new MockElement("", sel.replace(".", ""));
    }

    querySelectorAll(sel) { return []; }
    closest(sel) { return null; }
    addEventListener() {}
    removeEventListener() {}
    remove() {
        if (this.parentElement) {
            this.parentElement.removeChild(this);
        }
    }
    classList = {
        _classes: new Set(),
        add: (...cls) => cls.forEach(c => this.classList._classes.add(c)),
        remove: (...cls) => cls.forEach(c => this.classList._classes.delete(c)),
        contains: (c) => this.classList._classes.has(c)
    };
    getBoundingClientRect() {
        return { top: 100, bottom: 300, left: 100, right: 400, width: 300, height: 200 };
    }
}

// 🌐 主要なDOM要素の辞書キャッシュ
const elementRegistry = new Map();

function getOrCreateElement(id) {
    if (!elementRegistry.has(id)) {
        elementRegistry.set(id, new MockElement(id));
    }
    return elementRegistry.get(id);
}

// index.html に存在する主要要素を事前登録
const requiredHtmlElementIds = [
    "gridBoard", "cardRow", "logComponentContainer", "buffComponentContainer",
    "territoryBadgeContainer", "mainTerritoryBadge", "layerWorldBoard", "lblDataPanelTitle",
    "valTurn", "valTurnBg", "valEmber", "valFood", "valFoodProd", "valWood", "valWoodProd",
    "valDefense", "valMystic", "valMysticProd", "valPlacedCount", "trialCountdownBadge",
    "valTrialCountdown", "btnMulligan", "btnTurnEnd", "btnSettingsModal", "directiveModal"
];
requiredHtmlElementIds.forEach(id => getOrCreateElement(id));

const mockDoc = {
    getElementById: (id) => getOrCreateElement(id),
    querySelector: (sel) => {
        if (sel.startsWith("#")) return getOrCreateElement(sel.slice(1));
        if (sel.startsWith(".")) return new MockElement("", sel.slice(1));
        return new MockElement("", "", sel);
    },
    querySelectorAll: (sel) => [],
    createElement: (tag) => new MockElement("", "", tag),
    addEventListener: () => {},
    removeEventListener: () => {},
    body: new MockElement("body"),
    documentElement: new MockElement("html")
};

globalThis.document = mockDoc;
globalThis.window = {
    I18n: { t: (k, params) => k },
    document: mockDoc,
    addEventListener: () => {},
    removeEventListener: () => {},
    localStorage: { getItem: () => null, setItem: () => {} }
};

export async function runUILifecycleInspection() {
    console.log("------------------------------------------------------------");
    console.log("🖥️  [UI LIFECYCLE & DOM ELEMENT INSPECTION]");
    console.log("------------------------------------------------------------");

    let passCount = 0;
    let failCount = 0;

    function assert(name, condition, extraInfo = "") {
        if (condition) {
            console.log(`  ✅ [PASS] ${name}`);
            passCount++;
        } else {
            console.error(`  ❌ [FAIL] ${name} ${extraInfo ? `(${extraInfo})` : ""}`);
            failCount++;
        }
    }

    try {
        // 1. ゲームエンジンとUIControllerの初期化
        const engine = GameEngine.createGame();
        assert("GameEngine.createGame() が正常にインスタンス化されること", !!engine);

        const ui = new UIController(engine);
        assert("UIController が例外なくインスタンス化されること", !!ui);

        // 2. ui.init() ライフサイクルの完走
        ui.init();
        assert("ui.init() が未定義参照エラーなく完走すること", true);

        // 3. 盤面グリッド (#gridBoard) の構築検証
        const gridBoard = mockDoc.getElementById("gridBoard");
        assert("盤面コンテナ #gridBoard が取得できること", !!gridBoard);
        assert("盤面グリッドに全ヘッダーおよび全セル (計36要素以上) が構築されていること", gridBoard.children.length >= 36, `実際: ${gridBoard.children.length}`);

        // 4. 手札・保留トレイ (#cardRow) の構築検証
        const cardRow = mockDoc.getElementById("cardRow");
        assert("手札トレイ #cardRow が取得できること", !!cardRow);
        assert("手札トレイ内に手札コンテナ・セパレーター・保留枠 (3要素) が存在すること", cardRow.children.length >= 3, `実際: ${cardRow.children.length}`);

        // 5. 手札カード 3 枚の存在検証
        const handContainer = cardRow.children[0];
        assert("手札コンテナ内に 3 枚のカード要素が生成されていること", handContainer && handContainer.children && handContainer.children.length === 3, `実際: ${handContainer?.children?.length}`);

        // 6. 保留スロット (HOLD) の存在検証
        const reserveContainer = cardRow.children[2];
        assert("保留スロットコンテナが正しく生成されていること", !!reserveContainer);

        // 7. HUD ヘッダーリソース値の更新検証
        const valTurn = mockDoc.getElementById("valTurn");
        assert("ターン数 (#valTurn) に初期値 '1' がセットされていること", valTurn.innerText === "1", `実際: ${valTurn.innerText}`);

        const valEmber = mockDoc.getElementById("valEmber");
        assert("残り火 (#valEmber) に初期値 '20' がセットされていること", valEmber.innerText === "20", `実際: ${valEmber.innerText}`);

        // 8. 複数回 render() 実行時の安定性
        ui.render();
        ui.render();
        assert("連続 render() 実行時にもエラーが発生せず安定描画されること", true);

    } catch (err) {
        console.error("  ❌ [FATAL] UIライフサイクル実行中に致命的例外が発生:", err);
        failCount++;
    }

    console.log("------------------------------------------------------------");
    console.log(`📊 UI検問結果: ${passCount} PASS / ${failCount} FAIL`);
    if (failCount > 0) {
        console.error(`💥 UIライフサイクル検問で ${failCount} 件の不合格が検出されました。`);
        return false;
    } else {
        console.log(`🎉 UIライフサイクル・DOM要素検問 ALL PASS (100%)`);
        return true;
    }
}

runUILifecycleInspection().then(success => {
    if (!success) process.exit(1);
});
