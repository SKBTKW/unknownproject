import { GameEngine, UIController, TooltipSystem, tooltipSystemInstance } from 'file:///k:/マイドライブ/AG_ToA/game/src/app.js';

/**
 * 🧪 Mock DOM 環境の構築
 * ブラウザのDOM APIを精密にエミュレートし、UIControllerの全ライフサイクルを検証する
 */
class MockElement {
    constructor(id = "", className = "", tagName = "div") {
        this._id = id;
        if (id) elementRegistry.set(id, this);
        this._classes = new Set();
        if (className) String(className).split(" ").filter(Boolean).forEach(c => this._classes.add(c));
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

        const self = this;
        this.classList = {
            get _classes() { return self._classes; },
            add: (...cls) => cls.forEach(c => self._classes.add(c)),
            remove: (...cls) => cls.forEach(c => self._classes.delete(c)),
            contains: (c) => self._classes.has(c),
            toggle: (c, force) => {
                if (force === true) { self._classes.add(c); return true; }
                if (force === false) { self._classes.delete(c); return false; }
                if (self._classes.has(c)) { self._classes.delete(c); return false; }
                self._classes.add(c); return true;
            }
        };
    }

    get id() { return this._id || ""; }
    set id(v) {
        this._id = String(v);
        if (this._id) elementRegistry.set(this._id, this);
    }

    get className() { return Array.from(this._classes).join(" "); }
    set className(v) {
        this._classes.clear();
        if (v) String(v).split(" ").filter(Boolean).forEach(c => this._classes.add(c));
    }

    get innerText() { return this._innerText; }
    set innerText(v) { this._innerText = String(v); }

    get innerHTML() { return this._innerHTML; }
    set innerHTML(v) { 
        this._innerHTML = String(v);
        if (v === "") this.children = [];
    }

    setAttribute(k, v) { 
        this.attributes[k] = String(v); 
        if (k.startsWith("data-")) {
            this.dataset[k.slice(5)] = String(v);
        }
    }
    getAttribute(k) { return this.attributes[k]; }
    removeAttribute(k) { 
        delete this.attributes[k]; 
        if (k.startsWith("data-")) {
            delete this.dataset[k.slice(5)];
        }
    }

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
            if (this.classList.contains(targetClass)) return this;
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

        // 手札縮小表示 (ミニマルモード) 時のツールチップ ＆ ガイドポップアップ完全オフ検問
        ui.isMinimalMode = true;
        mockDoc.body.classList.add("is-minimal");
        const handMockCard = new MockElement("handCard0", "card-frame-tcg");
        handMockCard.setAttribute("data-tooltip", "CARD_DESC");
        tooltipSystemInstance._handleMouseOver({ target: handMockCard });
        assert("手札ミニマル表示時に手札カードホバーでツールチップが表示されないこと (オフ確認)", !globalTooltipEl.classList.contains("visible"));
        ui.showCardActionHintPopover(handMockCard, { terrain: { id: "PLAINS" } });
        assert("手札ミニマル表示時にカード操作ガイドポップアップが起動しないこと (オフ確認)", !handMockCard.children || handMockCard.children.length === 0);
        ui.isMinimalMode = false;
        mockDoc.body.classList.remove("is-minimal");

        // 支配地バッジのツールチップフォーマット統一検問 (ブラウザ標準title全廃 & data-tooltip完全統合)
        const mainTerritoryBadgeEl = mockDoc.getElementById("mainTerritoryBadge");
        assert("支配地バッジが存在すること", !!mainTerritoryBadgeEl);
        assert("支配地バッジに data-tooltip が設定されていること", !!mainTerritoryBadgeEl && mainTerritoryBadgeEl.attributes["data-tooltip"] !== undefined);
        assert("支配地バッジに data-tooltip-title が設定されていること", !!mainTerritoryBadgeEl && mainTerritoryBadgeEl.attributes["data-tooltip-title"] !== undefined);
        assert("支配地バッジからブラウザ標準 title 属性が除去されていること", !mainTerritoryBadgeEl || !mainTerritoryBadgeEl.attributes["title"]);
        assert("支配地バッジのツールチップに所有土地 (草原等) の内訳と占有率が含まれること", !!mainTerritoryBadgeEl && (mainTerritoryBadgeEl.attributes["data-tooltip"].includes("草原") || mainTerritoryBadgeEl.attributes["data-tooltip"].includes("Plains") || mainTerritoryBadgeEl.attributes["data-tooltip"].includes("未開墾") || mainTerritoryBadgeEl.attributes["data-tooltip"].includes("Unclaimed")));

        // ヘッダー産出パネルのホバー表示検問
        ui.showDataPanelTooltip({ currentTarget: mockDoc.getElementById("headerDataPanel") });
        const headerTooltipEl = mockDoc.getElementById("dataPanelTooltipHuge");
        assert("ヘッダー産出パネルホバー時に dataPanelTooltipHuge が生成されること", !!headerTooltipEl);
        assert("ヘッダー産出パネルホバー時に display が block になること", !!headerTooltipEl && headerTooltipEl.style.display === "block");
        assert("ヘッダー産出パネルホバー時に食料・資材・防衛・神秘の内訳が含まれること", !!headerTooltipEl && headerTooltipEl.innerHTML.includes("食料") || headerTooltipEl.innerHTML.includes("Food"));

        ui.hideDataPanelTooltip();
        assert("hideDataPanelTooltip 実行後に display が none になること", !!headerTooltipEl && headerTooltipEl.style.display === "none");

        // 12. 🌾 盤面タイル産出フォーマット ＆ 資源ハイライト定量検問 (画像フォーマット準拠)
        ui.state.hasPickedThisTurn = false;
        const pTerrain = { id: "GL1_PLAINS", terrainId: "PLAINS", nameKey: "TERRAIN_PLAINS", yields: { food: 4 } };
        ui.state.placeShape(1, 2, [[1]], pTerrain);
        ui.render();

        const gridBoardEl = mockDoc.getElementById("gridBoard");
        const plainsCell = gridBoardEl.children.find(c => c.dataset && c.dataset.r === "1" && c.dataset.c === "2");
        assert("1x1 平地配置後に has-resource-yield クラスが付与されること", !!plainsCell && plainsCell.classList.contains("has-resource-yield"));
        assert("1x1 平地配置後に tile-yield-line が生成されること", !!plainsCell && plainsCell.innerHTML.includes("tile-yield-line"));
        assert("1x1 平地配置後に '🌾' と ' : ' と '5' (近郊+1) が正しく描画されること", !!plainsCell && plainsCell.innerHTML.includes("🌾") && plainsCell.innerHTML.includes(" : ") && plainsCell.innerHTML.includes("5"));
        assert("1x1 平地配置後に '2x2' 等の冗長文字が含まれないこと", !!plainsCell && !plainsCell.innerHTML.includes("2x2"));

        // 1x2 森（同率主軸 🧱）配置検問: 本営左隣の空きマス (2,1) と (3,1)
        ui.state.hasPickedThisTurn = false;
        const fTerrain = { id: "F2_FOREST", terrainId: "FOREST", nameKey: "TERRAIN_FOREST", yields: { food: 2, wood: 2, defense: 2 } };
        ui.state.placeShape(2, 1, [[1], [1]], fTerrain);
        ui.render();

        const forestHead = gridBoardEl.children.find(c => c.dataset && c.dataset.r === "2" && c.dataset.c === "1");
        const forestTail = gridBoardEl.children.find(c => c.dataset && c.dataset.r === "3" && c.dataset.c === "1");
        assert("1x2 森先頭マスに主軸資材 '🧱' と ' : ' と '6' (2マス分+近郊) が集約描画されること", !!forestHead && forestHead.innerHTML.includes("🧱") && forestHead.innerHTML.includes(" : ") && forestHead.innerHTML.includes("6"));
        assert("1x2 森先頭マスに '2x2' 等の冗長文字が含まれないこと", !!forestHead && !forestHead.innerHTML.includes("2x2"));
        assert("1x2 森後続マス (tail) の innerHTML が完全に空であること", !!forestTail && forestTail.innerHTML === "");

        // 13. 🛡️ 2x2 正方形マージ (山岳4マス) 総産出集約 ＆ 冗長表記全廃検問
        ui.state.hasPickedThisTurn = false;
        const mTerrain = { id: "M2_MOUNTAIN", terrainId: "MOUNTAIN", nameKey: "TERRAIN_MOUNTAIN", yields: { food: 0, wood: 2, defense: 3, mystic: 1 } };
        ui.state.placeShape(1, 3, [[1, 1], [1, 1]], mTerrain); // (1,3), (1,4), (2,3), (2,4)
        ui.render();

        const mHead = gridBoardEl.children.find(c => c.dataset && c.dataset.r === "1" && c.dataset.c === "3");
        const mRight = gridBoardEl.children.find(c => c.dataset && c.dataset.r === "1" && c.dataset.c === "4");
        assert("2x2 マージ先頭マスに最大産出 '🛡️' が集約描画されること", !!mHead && mHead.innerHTML.includes("🛡️") && mHead.innerHTML.includes(" : "));
        assert("2x2 マージ先頭マスに '2x2' 等の冗長文字が含まれず純粋な土地名であること", !!mHead && !mHead.innerHTML.includes("2x2"));
        assert("2x2 マージ先頭マスに has-resource-yield クラスが付与されること", !!mHead && mHead.classList.contains("has-resource-yield"));
        assert("2x2 マージ先頭マスで右側境界線が打消されていること (no-border-right)", !!mHead && mHead.classList.contains("no-border-right"));
        assert("2x2 マージ先頭マスで下側境界線が打消されていること (no-border-bottom)", !!mHead && mHead.classList.contains("no-border-bottom"));

        // 14. 💎 マージブロック内の資源マス (★なし、資源名＋最大産出) 検問
        // (2,4) のマスに資源ソケット（隠匿鉱床: 🧱+2, 🛡️+1）を付与して再描画
        ui.state.grid[2][4].socketResource = { nameKey: "SOCKET_HIDDEN_ORE", bonusWood: 2, bonusDefense: 1 };
        ui.render();

        const mSocketCell = gridBoardEl.children.find(c => c.dataset && c.dataset.r === "2" && c.dataset.c === "4");
        assert("マージブロック内の資源マスに資源名が表示されること", !!mSocketCell && (mSocketCell.innerHTML.includes("SOCKET_HIDDEN_ORE") || mSocketCell.innerHTML.includes("鉱床") || mSocketCell.innerHTML.includes("Ore") || mSocketCell.innerHTML.includes("隠匿")));
        assert("マージブロック内の資源マスに最大産出 '🧱' と ' : ' と '2' が描画されること", !!mSocketCell && mSocketCell.innerHTML.includes("🧱") && mSocketCell.innerHTML.includes(" : ") && mSocketCell.innerHTML.includes("2"));
        assert("マージブロック内の資源マスに '★' マークが含まれないこと (全廃確認)", !!mSocketCell && !mSocketCell.innerHTML.includes("★"));

        // 15. 🎯 先頭マス自体に資源ソケットが存在する場合のスマートスライド配置検問
        // (1,3) [先頭マス] に羊ソケットを付与
        ui.state.grid[1][3].socketResource = { nameKey: "SOCKET_SHEEP", bonusFood: 2, bonusWood: 1 };
        ui.render();

        const mHeadSocket = gridBoardEl.children.findLast(c => c.dataset && c.dataset.r === "1" && c.dataset.c === "3");
        const mSlideLand = gridBoardEl.children.findLast(c => c.dataset && c.dataset.r === "1" && c.dataset.c === "4");
        const mFreeTail = gridBoardEl.children.findLast(c => c.dataset && c.dataset.r === "2" && c.dataset.c === "3");

        assert("先頭マスに資源がある場合、先頭マスに資源名 (羊) と '🌾 : 2' が描画されること", !!mHeadSocket && (mHeadSocket.innerHTML.includes("羊") || mHeadSocket.innerHTML.includes("Sheep")) && mHeadSocket.innerHTML.includes("🌾") && mHeadSocket.innerHTML.includes("2"));
        assert("先頭マスに資源がある場合、最初の空きマスに土地名 (山岳) と総産出が集約スライド描画されること", !!mSlideLand && (mSlideLand.innerHTML.includes("山岳") || mSlideLand.innerHTML.includes("Mountain")) && mSlideLand.innerHTML.includes("🛡️"));
        assert("2番目以降の空きマス (2,3) の innerHTML が完全に空であること", !!mFreeTail && mFreeTail.innerHTML === "");

        // 16. ⚡ 1x1 + 1x2 連結時の単一ブロック化検問 (4,1) に 1x1, (4,2)-(4,3) に 1x2
        ui.state.hasPickedThisTurn = false;
        ui.state.placeShape(4, 1, [[1]], pTerrain); // 1x1 平地 (4,1)
        ui.state.hasPickedThisTurn = false;
        ui.state.placeShape(4, 2, [[1, 1]], { id: "GL1_PLAINS_1X2", terrainId: "PLAINS", nameKey: "TERRAIN_PLAINS", yields: { food: 4 } }); // 1x2 平地 (4,2)-(4,3)
        ui.render();

        const cell41 = gridBoardEl.children.findLast(c => c.dataset && c.dataset.r === "4" && c.dataset.c === "1");
        const cell42 = gridBoardEl.children.findLast(c => c.dataset && c.dataset.r === "4" && c.dataset.c === "2");
        const cell43 = gridBoardEl.children.findLast(c => c.dataset && c.dataset.r === "4" && c.dataset.c === "3");

        assert("1x1+1x2 連結で (4,1) の右境界線が打消されていること (no-border-right)", !!cell41 && cell41.classList.contains("no-border-right"));
        assert("1x1+1x2 連結で (4,2) の左・右境界線が打消されていること (no-border-left & no-border-right)", !!cell42 && cell42.classList.contains("no-border-left") && cell42.classList.contains("no-border-right"));
        assert("1x1+1x2 連結で (4,3) の左境界線が打消されていること (no-border-left)", !!cell43 && cell43.classList.contains("no-border-left"));

        // 17. ⚡ 1x1 + 1x1 + 1x1 連結時の単一ブロック化検問 (1,2) ➔ (0,2) ➔ (0,1)
        ui.state.hasPickedThisTurn = false;
        ui.state.placeShape(0, 2, [[1]], pTerrain); // 1x1 (0,2) [ (1,2) に隣接 ]
        ui.state.hasPickedThisTurn = false;
        ui.state.placeShape(0, 1, [[1]], pTerrain); // 1x1 (0,1) [ (0,2) に隣接 ]
        ui.render();

        const cell12 = gridBoardEl.children.findLast(c => c.dataset && c.dataset.r === "1" && c.dataset.c === "2");
        const cell02 = gridBoardEl.children.findLast(c => c.dataset && c.dataset.r === "0" && c.dataset.c === "2");
        const cell01 = gridBoardEl.children.findLast(c => c.dataset && c.dataset.r === "0" && c.dataset.c === "1");

        assert("1x1+1x1+1x1 連結で (1,2) の上境界線が打消されていること (no-border-top)", !!cell12 && cell12.classList.contains("no-border-top"));
        assert("1x1+1x1+1x1 連結で (0,2) の下・左境界線が打消されていること (no-border-bottom & no-border-left)", !!cell02 && cell02.classList.contains("no-border-bottom") && cell02.classList.contains("no-border-left"));
        assert("1x1+1x1+1x1 連結で (0,1) の右境界線が打消されていること (no-border-right)", !!cell01 && cell01.classList.contains("no-border-right"));

        // 18. 🔥 平地 2x2 マージ成立で 🔥+2 加算検問 (checkMergePatterns)
        const mergeEngine = new GameEngine();
        mergeEngine.state.ember = 20;
        const testPlains = { id: "GL1_PLAINS", terrainId: "PLAINS", nameKey: "TERRAIN_PLAINS" };
        mergeEngine.state.grid[0][0] = { r: 0, c: 0, placed: true, terrain: testPlains };
        mergeEngine.state.grid[0][1] = { r: 0, c: 1, placed: true, terrain: testPlains };
        mergeEngine.state.grid[1][0] = { r: 1, c: 0, placed: true, terrain: testPlains };
        mergeEngine.state.grid[1][1] = { r: 1, c: 1, placed: true, terrain: testPlains };
        const emberBefore = mergeEngine.state.ember;
        mergeEngine.state.checkMergePatterns();
        assert("平地 2x2 マージ成立で 🔥+2 加算されること", mergeEngine.state.ember === emberBefore + 2);

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
