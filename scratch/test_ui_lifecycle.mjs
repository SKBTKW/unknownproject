import { GameEngine, UIController, TooltipSystem, tooltipSystemInstance } from 'file:///k:/マイドライブ/AG_ToA/game/src/app.js';

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
            return null;
        } else if (sel.startsWith(".")) {
            const targetClass = sel.slice(1);
            if (this.className && this.className.includes(targetClass)) return this;
            for (const child of this.children) {
                if (child.querySelector) {
                    const found = child.querySelector(sel);
                    if (found) return found;
                }
            }
            return null;
        }
        return null;
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
        contains: (c) => this.classList._classes.has(c),
        toggle: (c, force) => {
            if (force === true) {
                this.classList._classes.add(c);
                return true;
            } else if (force === false) {
                this.classList._classes.delete(c);
                return false;
            }
            if (this.classList._classes.has(c)) {
                this.classList._classes.delete(c);
                return false;
            } else {
                this.classList._classes.add(c);
                return true;
            }
        }
    };
    getBoundingClientRect() {
        return { top: 100, bottom: 300, left: 100, right: 400, width: 300, height: 200 };
    }
}

// 🌐 主要なDOM要素の辞書キャッシュ
const elementRegistry = new Map();
const classElementRegistry = new Map();

function getOrCreateElement(id) {
    if (!elementRegistry.has(id)) {
        elementRegistry.set(id, new MockElement(id));
    }
    return elementRegistry.get(id);
}

function getOrCreateClassElement(className) {
    if (!classElementRegistry.has(className)) {
        classElementRegistry.set(className, new MockElement("", className));
    }
    return classElementRegistry.get(className);
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
        if (sel.startsWith(".")) return getOrCreateClassElement(sel.slice(1));
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
        assert("手札トレイ内に手札グループ・セパレーター・保留グループ (3要素) が存在すること", cardRow.children.length === 3, `実際: ${cardRow.children.length}`);

        // 5. 手札グループ ＆ 手札カード 3 枚の存在検証
        const handGroup = cardRow.children[0];
        assert("手札グループ (.offering-hand-group) が生成されていること", !!handGroup && handGroup.className.includes("offering-hand-group"));
        const handHeader = handGroup.children[0];
        assert("手札グループ上部にマリガンヘッダーが存在すること", !!handHeader && handHeader.className.includes("offering-header-hand-col"));
        const handContainer = handGroup.children[1];
        assert("手札コンテナ内に 3 枚のカード要素が生成されていること", handContainer && handContainer.children && handContainer.children.length === 3, `実際: ${handContainer?.children?.length}`);

        // 6. 保留グループ ＆ コストヘッダーの存在検証
        const reserveGroup = cardRow.children[2];
        assert("保留グループ (.offering-reserve-group) が正しく生成されていること", !!reserveGroup && reserveGroup.className.includes("offering-reserve-group"));
        const reserveHeader = reserveGroup.children[0];
        assert("保留グループ上部に「ターン終了時 🔥-1」バッジが存在すること", !!reserveHeader && reserveHeader.innerHTML.includes("reserve-header-cost-badge"));
        const reserveContainer = reserveGroup.children[1];
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

        // 9. 🃏 カード選択 ➔ 📦 保留スロットクリックによる保留処理検証
        ui.selectCard(0);
        assert("手札0番目のカードを選択した時、selectedCardIdx が 0 になること", ui.selectedCardIdx === 0);
        
        // 再レンダリングされた保留スロット (空枠) の onclick をシミュレート
        const updatedCardRow = mockDoc.getElementById("cardRow");
        const updatedReserveGroup = updatedCardRow.children[2];
        const updatedReserveContainer = updatedReserveGroup.children[1];
        const emptySlotEl = updatedReserveContainer.children[0];
        assert("選択中に保留スロット要素が存在すること", !!emptySlotEl);
        
        if (emptySlotEl && typeof emptySlotEl.onclick === "function") {
            const mockEvent = { stopPropagation: () => {}, preventDefault: () => {} };
            emptySlotEl.onclick(mockEvent);
        }
        
        assert("保留スロットクリック後に手札0番目が保留スロットに移動していること", !!ui.state.reserveSlots[0]);
        assert("保留完了後に selectedCardIdx が -1 (解除) になること", ui.selectedCardIdx === -1);
        assert("保留完了後に手札0番目が isBlank (使用済み) になること", ui.state.handOffering[0].isBlank === true);

        // 10. 📦 保留スロット手札同サイズ描画・直上ポップオーバー検証
        const cardRowWithReserve = mockDoc.getElementById("cardRow");
        const reserveGroupWithCard = cardRowWithReserve.children[2];
        const reserveBox = reserveGroupWithCard.children[1];
        const reserveCardEl = reserveBox.children[0];
        assert("保留枠にカード要素が生成されていること", !!reserveCardEl);
        assert("保留カード内にバッジ (reserve-hold-badge) が存在しないこと (全廃確認)", !reserveCardEl.innerHTML.includes("reserve-hold-badge"));
        assert("保留カード内に解除ボタン (btn-reserve-return-corner) が存在しないこと (全廃確認)", !reserveCardEl.innerHTML.includes("btn-reserve-return-corner"));
        assert("保留カード内に通常タイトルピルが存在すること", reserveCardEl.innerHTML.includes("tcg-title-pill"));

        // 保留カードクリック ➔ 直上ポップオーバー展開
        ui.toggleReservePopover(0);
        assert("保留カードクリックで isReservePopoverOpen が true になること", ui.isReservePopoverOpen === true);

        const cardRowWithPopover = mockDoc.getElementById("cardRow");
        const reserveGroupWithPopover = cardRowWithPopover.children[2];
        const reserveBoxWithPopover = reserveGroupWithPopover.children[1];
        const popoverEl = reserveBoxWithPopover.children[1];
        assert("直上ポップオーバー (.reserve-popover-menu) が生成されていること", !!popoverEl && popoverEl.className.includes("reserve-popover-menu"));
        assert("ポップオーバー内に維持コスト警告 (.reserve-popover-cost-warn) が存在すること", popoverEl.innerHTML.includes("reserve-popover-cost-warn"));
        assert("ポップオーバー内にプレイボタン (.btn-reserve-action-play) が存在すること", popoverEl.innerHTML.includes("btn-reserve-action-play"));
        assert("ポップオーバー内に保留解除ボタン (.btn-reserve-action-return) が存在すること", popoverEl.innerHTML.includes("btn-reserve-action-return"));

        // 保留カードのカテゴリ判定 (土地の場合は選択状態、コマンドの場合は発動モーダルへ)
        const resCard = ui.state.reserveSlots[0];
        const resCat = (resCard && (resCard.category || (resCard.terrain && resCard.terrain.category))) || "LAND";
        ui.playReserveCard(0);
        assert("playReserveCard 実行後に isReservePopoverOpen が false になること", ui.isReservePopoverOpen === false);
        if (resCat === "LAND") {
            assert("playReserveCard (土地) 実行後に selectedReserveIdx が 0 (選択状態) になること", ui.selectedReserveIdx === 0);
        } else {
            assert("playReserveCard (コマンド) 実行後に selectedReserveIdx が -1 (即時発動) であること", ui.selectedReserveIdx === -1);
        }

        // 「保留解除」を実行して手札へ復元
        ui.returnReserveCard(0);
        assert("returnReserveCard 実行後に reserveSlots[0] が null になること", ui.state.reserveSlots[0] === null);
        assert("returnReserveCard 実行後に手札0番目が通常カード (isBlank: false) に復帰すること", !ui.state.handOffering[0].isBlank);

        // 11. 🌐 TooltipSystem グローバルモジュール検証
        assert("TooltipSystem クラスおよび tooltipSystemInstance が存在すること", !!TooltipSystem && !!tooltipSystemInstance);
        const globalTooltipEl = mockDoc.getElementById("globalTooltip");
        assert("TooltipSystem 初期化後に #globalTooltip DOM要素が生成されていること", !!globalTooltipEl);

        // ツールチップ表示テスト
        const mockTarget = new MockElement("btnTest", "test-btn");
        mockTarget.setAttribute("data-tooltip", "UI_MULLIGAN_HELP_TOOLTIP");
        tooltipSystemInstance.show(mockTarget, { clientX: 100, clientY: 200 });
        assert("tooltipSystemInstance.show() 実行後に tooltipEl が visible になること", globalTooltipEl.classList.contains("visible"));
        assert("tooltipEl 内に翻訳テキストが含まれていること", globalTooltipEl.innerHTML.includes("UI_MULLIGAN_HELP_TOOLTIP") || globalTooltipEl.innerHTML.includes("手札") || globalTooltipEl.innerHTML.includes("Discard"));

        tooltipSystemInstance.hide();
        assert("tooltipSystemInstance.hide() 実行後に visible クラスが除去されること", !globalTooltipEl.classList.contains("visible"));

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
