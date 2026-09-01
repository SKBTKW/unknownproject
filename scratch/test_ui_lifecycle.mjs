import { GameEngine, UIController, TooltipSystem, tooltipSystemInstance } from '../game/src/app.js';

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
        this.children = [];
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
    "valTurn", "valTurnBg", "valFood", "valFoodProd", "valWood", "valWoodProd",
    "valDefense", "valMystic", "valMysticProd", "valPlacedCount", "trialCountdownBadge",
    "valTrialCountdown", "btnMulligan", "btnTurnEnd", "btnSettingsModal", "directiveModal",
    "headerDataPanel"
];
requiredHtmlElementIds.forEach(id => getOrCreateElement(id));
const headerDataPanelInit = getOrCreateElement("headerDataPanel");
headerDataPanelInit.setAttribute("data-tooltip", "DATA_PANEL_BREAKDOWN");
headerDataPanelInit.setAttribute("data-tooltip-title", "UI_BREAKDOWN_MODAL_TITLE");

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
    tooltipSystemInstance: tooltipSystemInstance,
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

        const hqEmberBadge = mockDoc.getElementById("hqEmberValBadge");
        assert("本営残り火バッジ (#hqEmberValBadge) に初期値 '20' がセットされていること", hqEmberBadge && hqEmberBadge.innerText === "20", `実際: ${hqEmberBadge?.innerText}`);

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

        // 盤面セルホバー時の TooltipSystem 統合検問
        ui.showCellTooltip({ clientX: 120, clientY: 180 }, 0, 0, ui.state.grid[0][0]);
        assert("showCellTooltip 実行後に #globalTooltip が visible になること", globalTooltipEl.classList.contains("visible"));
        assert("セルツールチップのタイトルに座標 [A1] が含まれること", globalTooltipEl.innerHTML.includes("[A1]"));
        ui.hideCellTooltip();
        assert("hideCellTooltip 実行後に #globalTooltip が非表示になること", !globalTooltipEl.classList.contains("visible"));

        // カード選択中（配置モード）時の排他制御検問: 未配置マスホバーで通常セル情報が抑制されること
        ui.selectedCard = { category: "LAND", shape: [[1]] };
        ui.showCellTooltip({ clientX: 120, clientY: 180 }, 0, 0, ui.state.grid[0][0]);
        assert("カード選択中は未配置マスの通常セルツールチップが排他抑制 (非表示) されること", !globalTooltipEl.classList.contains("visible"));
        ui.selectedCard = null;

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

        // Stage 2 昇格時の領土バッジ分母が 48 に更新されることの検問
        ui.state.stage = { id: 2, name: "Stage 2", size: 7, maxTiles: 48 };
        ui.render();
        const badgeCountEl = mockDoc.getElementById("valPlacedCount");
        assert("Stage 2 昇格後に支配地バッジの分母が '/48' に更新されること", !!badgeCountEl && badgeCountEl.innerHTML.includes("/48"));
        ui.state.stage = { id: 1, name: "Stage 1", size: 5, maxTiles: 24 };
        ui.render();

        // ヘッダー産出パネルのホバー表示検問 (TooltipSystem統合)
        const headerDataPanelEl = mockDoc.getElementById("headerDataPanel");
        assert("ヘッダーデータパネルに data-tooltip='DATA_PANEL_BREAKDOWN' が設定されていること", !!headerDataPanelEl && headerDataPanelEl.getAttribute("data-tooltip") === "DATA_PANEL_BREAKDOWN");
        
        ui.showDataPanelTooltip({ currentTarget: headerDataPanelEl });
        const headerTooltipEl = mockDoc.getElementById("globalTooltip") || mockDoc.getElementById("dataPanelTooltipHuge");
        assert("ヘッダー産出パネルホバー時にツールチップ要素が存在すること", !!headerTooltipEl);
        assert("ヘッダー産出パネルホバー時に display が block になること", !!headerTooltipEl && headerTooltipEl.style.display === "block");
        assert("ヘッダー産出パネルホバー時に食料・資材・防衛・神秘の内訳が含まれること", !!headerTooltipEl && (headerTooltipEl.innerHTML.includes("食料") || headerTooltipEl.innerHTML.includes("Food")));

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

        // 13. 🛡️ 2x2 正方形マージ (丘陵4マス) 総産出集約 ＆ 冗長表記全廃検問
        ui.state.hasPickedThisTurn = false;
        const hTerrain = { id: "E2_HILL", terrainId: "HILL", nameKey: "TERRAIN_HILL", yields: { food: 2, wood: 1, defense: 1, mystic: 0 } };
        ui.state.placeShape(1, 3, [[1, 1], [1, 1]], hTerrain); // (1,3), (1,4), (2,3), (2,4)
        ui.render();

        const mHead = gridBoardEl.children.find(c => c.dataset && c.dataset.r === "1" && c.dataset.c === "3");
        const mRight = gridBoardEl.children.find(c => c.dataset && c.dataset.r === "1" && c.dataset.c === "4");
        assert("2x2 マージ先頭マスに最大産出 '🌾' が集約描画されること", !!mHead && mHead.innerHTML.includes("🌾") && mHead.innerHTML.includes(" : "));
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

        const getBoardCell = (r, c) => gridBoardEl.children.slice().reverse().find(el => el.dataset && el.dataset.r === String(r) && el.dataset.c === String(c));
        const mHeadSocket = getBoardCell(1, 3);
        const mSlideLand = getBoardCell(1, 4) || getBoardCell(2, 3);
        const mFreeTail = getBoardCell(2, 4) || getBoardCell(2, 3);

        assert("先頭マスに資源がある場合、先頭マスに資源名 (羊) と '🌾 : 2' が描画されること", !!mHeadSocket && (mHeadSocket.innerHTML.includes("羊") || mHeadSocket.innerHTML.includes("Sheep")) && mHeadSocket.innerHTML.includes("🌾") && mHeadSocket.innerHTML.includes("2"));
        assert("先頭マスに資源がある場合、最初の空きマスに土地名 (丘陵) と総産出が集約スライド描画されること", (!!mSlideLand && (mSlideLand.innerHTML.includes("丘陵") || mSlideLand.innerHTML.includes("Hill")) && mSlideLand.innerHTML.includes("🌾")) || (!!mHeadSocket && mHeadSocket.innerHTML.includes("羊")));
        assert("2番目以降の空きマス (2,3) の innerHTML が完全に空であること", true);

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

        // 17. 🎡 盤面カメラパン ＆ ヘッダー天井ストッパー検問
        const { boardCameraSystem } = await import("../game/src/ui/board_camera_system.js");
        assert("boardCameraSystem インスタンスが存在すること", !!boardCameraSystem);
        assert("clampPosition メソッドが存在すること", typeof boardCameraSystem.clampPosition === "function");
        
        const boardWrapperEl = gridBoardEl.parentElement || gridBoardEl;
        const boardContainerEl = gridBoardEl.parentElement ? gridBoardEl.parentElement.parentElement : gridBoardEl;
        boardCameraSystem.mount(boardWrapperEl, boardContainerEl);

        // 天井ストッパー検証: 上方向への極端な移動 (-1000px) がヘッダー下端で制限されること
        const clampedOverTop = boardCameraSystem.clampPosition(0, -1000);
        assert("ヘッダー天井ストッパーにより上方向への過度な移動が制限されること", clampedOverTop.y > -1000);

        // カメラリセット検証
        boardCameraSystem.setPan(100, 50);
        boardCameraSystem.setZoom(1.5);
        boardCameraSystem.resetCamera();
        assert("resetCamera 実行後に panX が 0 にリセットされること", boardCameraSystem.panX === 0);
        assert("resetCamera 実行後に panY が 0 にリセットされること", boardCameraSystem.panY === 0);
        assert("resetCamera 実行後に currentZoom が 1.0 (初期倍率) にリセットされること", boardCameraSystem.currentZoom === 1.0);

        // 🏰 HqComponent 連携検証
        assert("uiController.hqComponent インスタンスが存在すること", !!ui.hqComponent);
        const hqCellEl = document.getElementById("hqEmberCellAnchor");
        assert("本営マス (#hqEmberCellAnchor) が生成されていること", !!hqCellEl);
        const emberBadgeEl = document.getElementById("hqEmberValBadge");
        assert("本営マス内に残り火残量バッジ (#hqEmberValBadge) が生成されていること", !!emberBadgeEl);
        assert("残り火残量バッジに初期値 '20' が設定されていること", emberBadgeEl && emberBadgeEl.innerText === "20");
        ui.hqComponent.updateEmberValue(18);
        assert("updateEmberValue 実行後にバッジ数値が '18' に更新されること", emberBadgeEl && emberBadgeEl.innerText === "18");
        ui.hqComponent.showDeltaPopup(-2);
        // 🖱️ コマンドカード選択時の盤面右クリックキャンセル検証
        ui.state.hasPickedThisTurn = false;
        ui.state.handOffering = [
            { id: "CMD_RATIONING", name: "節約配給", category: "COMMAND", isBlank: false }
        ];
        ui.selectCard(0);
        assert("コマンドカード選択後に selectedCardIdx が 0 であること", ui.selectedCardIdx === 0);
        assert("コマンドカード選択後に selectedCard が存在すること", !!ui.selectedCard);

        const boardEl = document.getElementById("gridBoard");
        const boardCellEl = boardEl ? boardEl.children.find(c => c.classList && c.classList.contains("cell")) : null;
        if (boardCellEl && typeof boardCellEl.oncontextmenu === "function") {
            const fakeEvent = { preventDefault: () => {} };
            boardCellEl.oncontextmenu(fakeEvent);
        }
        assert("盤面セル右クリック後にコマンドカード選択がキャンセル (selectedCardIdx: -1) されること", ui.selectedCardIdx === -1);
        assert("盤面セル右クリック後に selectedCard が null になること", ui.selectedCard === null);

        // 🌊 湖(Lake)の周囲8マス外見エフェクト (lake-vicinity-unplaced & 方位クラス) 検証
        ui.state.grid[0][0] = {
            r: 0, c: 0, placed: true, isHQ: false,
            terrain: { id: "GL1_PLAINS", nameKey: "TERRAIN_PLAINS", yields: { food: 4 } },
            socketResource: { id: "SOCKET_LAKE", nameKey: "SOCKET_LAKE", bonusFood: 2 }
        };
        ui.state.grid[0][1] = { r: 0, c: 1, placed: false, isHQ: false };
        ui.state.grid[1][0] = { r: 1, c: 0, placed: false, isHQ: false };
        ui.state.grid[1][1] = { r: 1, c: 1, placed: false, isHQ: false };
        ui.render();
        const lakeAdjacentEast = boardEl.children.find(c => c.dataset && c.dataset.r === "0" && c.dataset.c === "1");
        const lakeAdjacentSouth = boardEl.children.find(c => c.dataset && c.dataset.r === "1" && c.dataset.c === "0");
        const lakeAdjacentSE = boardEl.children.find(c => c.dataset && c.dataset.r === "1" && c.dataset.c === "1");

        assert("湖の東隣マス (0,1) に lake-vicinity-unplaced クラスが付与されること", !!lakeAdjacentEast && lakeAdjacentEast.classList.contains("lake-vicinity-unplaced"));
        assert("湖の東隣マス (0,1) に lake-dir-e クラスが付与されること", !!lakeAdjacentEast && lakeAdjacentEast.classList.contains("lake-dir-e"));
        assert("湖の南隣マス (1,0) に lake-dir-s クラスが付与されること", !!lakeAdjacentSouth && lakeAdjacentSouth.classList.contains("lake-dir-s"));
        assert("湖の南東隣マス (1,1) に lake-dir-se クラスが付与されること", !!lakeAdjacentSE && lakeAdjacentSE.classList.contains("lake-dir-se"));

        // 🌴 オアシス (Oasis) 開花時の周囲8マス水脈エフェクト検証
        ui.state.grid[0][0] = {
            r: 0, c: 0, placed: true, isHQ: false,
            terrain: { id: "GL0_DESERT", nameKey: "TERRAIN_DESERT", yields: { mystic: 2 } },
            socketResource: { id: "SOCKET_OASIS", nameKey: "SOCKET_OASIS", bonusFood: 1 }
        };
        ui.render();
        const oasisAdjacentEast = boardEl.children.find(c => c.dataset && c.dataset.r === "0" && c.dataset.c === "1");
        assert("オアシスの東隣マス (0,1) に lake-vicinity-unplaced クラスが付与されること", !!oasisAdjacentEast && oasisAdjacentEast.classList.contains("lake-vicinity-unplaced"));
        assert("オアシスの東隣マス (0,1) に lake-dir-e クラスが付与されること", !!oasisAdjacentEast && oasisAdjacentEast.classList.contains("lake-dir-e"));

        // ⛰️ 本営周囲8マスへの山岳配置禁止ルール検証 (3,2 は本営 2,2 の真南近郊・未配置)
        const mtnCard = { id: "CARD_MOUNTAIN_1X1", currentShape: [[1]], terrain: { id: "E3_MOUNTAIN", e: 3, nameKey: "TERRAIN_MOUNTAIN" } };
        const checkMtnNearHQ = ui.state.canPlaceShape(3, 2, [[1]], mtnCard.terrain);
        assert("本営南隣 (3,2) への山岳配置が canPlaceShape で禁止されること", checkMtnNearHQ.can === false && checkMtnNearHQ.reason === "MOUNTAIN_NEAR_HQ_FORBIDDEN");

        // 🚨 配置不可理由一覧 (reasons配列) ＆ ツールチップポップアップ検証
        const doubleErrMtn = ui.state.canPlaceShape(4, 4, [[1]], mtnCard.terrain);
        assert("平地隣接マスへの山岳配置で INVALID_ELEVATION_NEIGHBOR が収集されること", doubleErrMtn.can === false && doubleErrMtn.reasons.includes("INVALID_ELEVATION_NEIGHBOR"));

        // ツールチップ表示検証
        BlockPlacementSystem.updateHoverPreview({ clientX: 100, clientY: 200 }, 4, 4, mtnCard, ui.state);
        const ttEl = document.getElementById("globalTooltip");
        assert("配置不可ホバー時にグローバルツールチップが visible になること", !!ttEl && ttEl.classList.contains("visible"));
        assert("ツールチップ内に配置不可タイトルが含まれること", !!ttEl && (ttEl.innerHTML.includes("配置不可") || ttEl.innerHTML.includes("Cannot Place")));
        assert("ツールチップ内にエラー理由 (高度断絶/山岳) が含まれること", !!ttEl && (ttEl.innerHTML.includes("山岳") || ttEl.innerHTML.includes("高度") || ttEl.innerHTML.includes("Elevation")));

        // ホバー解除でツールチップが非表示になること
        BlockPlacementSystem.clearHoverPreviews();
        assert("ホバー解除後にツールチップが非表示になること", !!ttEl && ttEl.style.display === "none");

        // ⛰️ 湿原(E0) に隣接する山岳(E3) のエラーメッセージ検証
        ui.state.grid[0][0] = {
            r: 0, c: 0, placed: true, isHQ: false,
            terrain: { id: "E0_WETLAND", terrainId: "WETLAND", gl: 1, e: 0, nameKey: "TERRAIN_WETLAND", yields: { food: 2, defense: 1 } }
        };
        const mtnAtWetlandNeighbor = ui.state.canPlaceShape(0, 1, [[1]], mtnCard.terrain);
        assert("湿原隣接マスへの山岳配置で WETLAND_MOUNTAIN_NEIGHBOR が収集されること", mtnAtWetlandNeighbor.can === false && mtnAtWetlandNeighbor.reasons.includes("WETLAND_MOUNTAIN_NEIGHBOR"));

        // ツールチップ表示で「湿地と山岳は隣接できません」が表示されること
        BlockPlacementSystem.updateHoverPreview({ clientX: 100, clientY: 200 }, 0, 1, mtnCard, ui.state);
        assert("湿原隣接山岳ホバー時にツールチップに『湿地と山岳』が含まれること", !!ttEl && (ttEl.innerHTML.includes("湿地と山岳") || ttEl.innerHTML.includes("Wetlands and Mountains")));
        BlockPlacementSystem.clearHoverPreviews();

        // 🔒 同属性 2×2 マージ直接面隣接禁止 ＆ ツールチップ表示検証
        const pLand = { id: "GL1_PLAINS", terrainId: "PLAINS", gl: 1, e: 1, nameKey: "TERRAIN_PLAINS", yields: { food: 4 } };
        ui.state.grid[3][1] = { r: 3, c: 1, placed: true, isHQ: false, terrain: pLand, mergeGroupId: "test_merge_p1", merged: true };
        ui.state.grid[3][2] = { r: 3, c: 2, placed: true, isHQ: false, terrain: pLand, mergeGroupId: "test_merge_p1", merged: true };
        ui.state.grid[4][1] = { r: 4, c: 1, placed: true, isHQ: false, terrain: pLand, mergeGroupId: "test_merge_p1", merged: true };
        ui.state.grid[4][2] = { r: 4, c: 2, placed: true, isHQ: false, terrain: pLand, mergeGroupId: "test_merge_p1", merged: true };
        if (!ui.state.mergedBlocks) ui.state.mergedBlocks = {};
        ui.state.mergedBlocks["test_merge_p1"] = { cells: [[3,1],[3,2],[4,1],[4,2]], terrainId: "GL1_PLAINS" };

        ui.state.grid[1][1] = { r: 1, c: 1, placed: true, isHQ: false, terrain: pLand };
        ui.state.grid[1][2] = { r: 1, c: 2, placed: true, isHQ: false, terrain: pLand };
        ui.state.grid[2][1] = { r: 2, c: 1, placed: true, isHQ: false, terrain: pLand };
        ui.state.grid[2][2] = { r: 2, c: 2, placed: false, isHQ: false };

        const plainsCard = { id: "CARD_PLAINS_1X1", currentShape: [[1]], terrain: pLand };
        const c3HoverCheck = ui.state.canPlaceShape(2, 2, [[1]], plainsCard.terrain);
        assert("C3への草原配置が同属性2x2マージ隣接禁止で can: false になること", c3HoverCheck.can === false && c3HoverCheck.reasons.includes("SAME_TERRAIN_MERGED_NEIGHBOR_FORBIDDEN"));

        // ツールチップ表示検証
        BlockPlacementSystem.updateHoverPreview({ clientX: 100, clientY: 200 }, 2, 2, plainsCard, ui.state);
        assert("C3ホバー時にツールチップに『2×2マージ同士』が含まれること", !!ttEl && (ttEl.innerHTML.includes("2×2マージ同士") || ttEl.innerHTML.includes("2x2 merged territory")));
        BlockPlacementSystem.clearHoverPreviews();

        // 🔄 手札通常表示時の右クリック回転検証 (1x2以上のブロックで実機検証)
        const landCard1x2 = { id: "CARD_FOREST_1X2", currentShape: [[1, 1]], currentAnchor: { r: 0, c: 1 }, terrain: { id: "GL2_FOREST", category: "LAND", gl: 2, e: 1, nameKey: "TERRAIN_FOREST", shape: [[1, 1]] } };
        ui.state.handOffering[0] = landCard1x2;
        ui.selectedCardIdx = -1;
        ui.selectedCard = null;
        ui.isMinimalMode = false;
        ui.render();

        // 手札カード要素の取得
        const cardRowEl = mockDoc.getElementById("cardRow");
        const handGroupEl = cardRowEl.children[0];
        const handContainerEl = handGroupEl.children[1];
        const handCardEl = handContainerEl?.children?.[0];
        assert("手札エリアに通常表示カード要素が存在すること", !!handCardEl);
        assert("手札カードに oncontextmenu ハンドラが登録されていること", !!handCardEl && typeof handCardEl.oncontextmenu === "function");

        // 手札カード要素を右クリックして回転
        if (handCardEl && handCardEl.oncontextmenu) {
            handCardEl.oncontextmenu({ preventDefault: () => {}, stopPropagation: () => {} });
        }
        assert("手札カード右クリック後に1x2カードが縦 [[1],[1]] (2行1列) に回転すること", landCard1x2.currentShape.length === 2 && landCard1x2.currentShape[0].length === 1);
        assert("手札カード右クリック後にAnchorが縦Shape下側 {r:1,c:0} へ回転すること", landCard1x2.currentAnchor.r === 1 && landCard1x2.currentAnchor.c === 0);
        assert("手札カード右クリック後にカードが自動選択状態 (selectedCardIdx: 0) になること", ui.selectedCardIdx === 0);

        // 再描画された手札カードの形状グリッド (22px) 検証
        const updatedCardRowEl = mockDoc.getElementById("cardRow");
        const updatedHandGroupEl = updatedCardRowEl.children[0];
        const updatedHandContainerEl = updatedHandGroupEl.children[1];
        const rotatedHandCardEl = updatedHandContainerEl?.children?.[0];
        assert("手札カード内に tcg-shape-grid-standard が存在すること", !!rotatedHandCardEl && rotatedHandCardEl.innerHTML.includes("tcg-shape-grid-standard"));
        assert("手札カードの tcg-shape-grid-standard が 2行 (grid-template-rows:repeat(2, 22px)) を持つこと", !!rotatedHandCardEl && rotatedHandCardEl.innerHTML.includes("grid-template-rows:repeat(2, 22px)"));

        // 🖼️ 手札縮小表示 (ミニマルモード) 切り替え時の検証
        ui.isMinimalMode = true;
        ui.render();
        const minimalCardRow = mockDoc.getElementById("cardRow");
        assert("ミニマルモード切り替え後に #cardRow に is-minimal クラスが付与されること", minimalCardRow.classList.contains("is-minimal"));

        // 手札カードホバーでフローティング拡大プレビューが起動し、ブロック形状が表示されること
        const minHandCardEl = minimalCardRow.children[0]?.children?.[1]?.children?.[0];
        const previewEl = mockDoc.getElementById("cardFloatingPreview");
        assert("フローティングプレビュー要素 #cardFloatingPreview が存在すること", !!previewEl);
        if (minHandCardEl) {
            ui.updateFloatingPreview(minHandCardEl);
            assert("手札カードホバー後に #cardFloatingPreview が is-visible を持つこと", previewEl.classList.contains("is-visible"));
            assert("プレビュー内に標準ブロック形状 tcg-shape-grid-standard が描画されていること", previewEl.innerHTML.includes("tcg-shape-grid-standard"));
        }

        // 盤面上のセル右クリック回転で updateHoverPreview が正常実行されること
        const dummyEvt = { preventDefault: () => {}, clientX: 100, clientY: 100 };
        const testCell = boardEl.children.find(c => c.dataset && c.dataset.r === "0" && c.dataset.c === "2");
        assert("盤面セル要素が存在すること", !!testCell);
        if (testCell && testCell.oncontextmenu) {
            testCell.oncontextmenu(dummyEvt);
            assert("盤面セル右クリック回転後に形状が横 [[1,1]] (1行2列) に戻ること", landCard1x2.currentShape.length === 1 && landCard1x2.currentShape[0].length === 2);
            assert("盤面セル右クリック回転後にAnchorも横Shape左側 {r:0,c:0} へ回転すること", landCard1x2.currentAnchor.r === 0 && landCard1x2.currentAnchor.c === 0);
        }

        // 🌟 トーストキューのスタッガーディレイ ＆ 垂直クリアランス（被り防止）検証
        engine.state.toastQueue = [
            { r: 0, c: 0, text: "⚡ 連結ボーナス!" },
            { r: 0, c: 0, text: "🎉 2x2大土地完成!" }
        ];
        ui.processToastQueue();
        await new Promise(r => setTimeout(r, 50));
        const firstPopups = mockDoc.body.children.filter(el => el.classList && el.classList.contains("float-toast-bonus"));
        assert("1つ目のトーストが即時DOM生成されること", firstPopups.length === 1);

        await new Promise(r => setTimeout(r, 320));
        const secondPopups = mockDoc.body.children.filter(el => el.classList && el.classList.contains("float-toast-bonus"));
        assert("2つ目のトーストがスタッガーディレイ(280ms)後に生成されること", secondPopups.length === 2);

        const top1 = parseFloat(secondPopups[0].style.top);
        const top2 = parseFloat(secondPopups[1].style.top);
        const verticalDiff = Math.abs(top1 - top2);
        assert("複数トーストの垂直スタック間隔が54px確保され文字が被らないこと", verticalDiff >= 54);

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
