import { GameEngine, UIController, I18n } from '../game/src/app.js';

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
        this.classList = {
            _classes: new Set(),
            add: (...cls) => { cls.forEach(c => this.classList._classes.add(c)); this.className = Array.from(this.classList._classes).join(' '); },
            remove: (...cls) => { cls.forEach(c => this.classList._classes.delete(c)); this.className = Array.from(this.classList._classes).join(' '); },
            toggle: (c, force) => {
                if (force === undefined) {
                    if (this.classList._classes.has(c)) this.classList._classes.delete(c);
                    else this.classList._classes.add(c);
                } else if (force) {
                    this.classList._classes.add(c);
                } else {
                    this.classList._classes.delete(c);
                }
                this.className = Array.from(this.classList._classes).join(' ');
            },
            contains: (c) => this.classList._classes.has(c)
        };
        if (className) {
            className.split(' ').filter(Boolean).forEach(c => this.classList._classes.add(c));
        }
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
        if (v === "") this.children = [];
    }

    hasChildNodes() {
        return this.children.length > 0;
    }

    appendChild(child) {
        if (!child) return child;
        child.parentElement = this;
        this.children.push(child);
        return child;
    }

    insertBefore(newNode, referenceNode) {
        if (!newNode) return newNode;
        newNode.parentElement = this;
        const idx = this.children.indexOf(referenceNode);
        if (idx !== -1) {
            this.children.splice(idx, 0, newNode);
        } else {
            this.children.push(newNode);
        }
        return newNode;
    }

    removeChild(child) {
        const idx = this.children.indexOf(child);
        if (idx !== -1) {
            this.children.splice(idx, 1);
            child.parentElement = null;
        }
        return child;
    }

    setAttribute(k, v) {
        this.attributes[k] = String(v);
        if (k.startsWith("data-")) {
            const dataKey = k.slice(5);
            this.dataset[dataKey] = String(v);
        }
    }

    getAttribute(k) {
        return this.attributes[k] !== undefined ? this.attributes[k] : null;
    }

    removeAttribute(k) {
        delete this.attributes[k];
        if (k.startsWith("data-")) {
            delete this.dataset[k.slice(5)];
        }
    }

    hasAttribute(k) {
        return this.attributes[k] !== undefined;
    }

    getBoundingClientRect() {
        return { top: 0, left: 0, width: 80, height: 80, right: 80, bottom: 80 };
    }

    addEventListener() {}
    removeEventListener() {}

    querySelectorAll(selector) {
        const results = [];
        const traverse = (el) => {
            if (selector.startsWith(".")) {
                const cls = selector.slice(1);
                if (el.classList && el.classList.contains(cls)) results.push(el);
            } else if (selector.startsWith("#")) {
                const id = selector.slice(1);
                if (el.id === id) results.push(el);
            }
            if (el.children) {
                for (const child of el.children) traverse(child);
            }
        };
        traverse(this);
        return results;
    }

    querySelector(selector) {
        const res = this.querySelectorAll(selector);
        return res.length > 0 ? res[0] : null;
    }
}

class MockDocument {
    constructor() {
        this.elements = new Map();
        this.body = new MockElement("body", "", "body");
    }

    createElement(tagName) {
        return new MockElement("", "", tagName);
    }

    getElementById(id) {
        return this.elements.get(id) || null;
    }

    registerElement(el) {
        if (el.id) this.elements.set(el.id, el);
    }

    addEventListener() {}
    removeEventListener() {}

    querySelectorAll(selector) {
        return this.body.querySelectorAll(selector);
    }

    querySelector(selector) {
        return this.body.querySelector(selector);
    }
}

const mockDoc = new MockDocument();
const reqIds = [
    "gridBoard", "cardRow", "layerWorldBoard", "layerPlayerTray", "layerSystemOverlay",
    "territoryBadgeContainer", "valTurn", "valEmber", "valFood", "valMaterial",
    "valDefense", "valMystic", "valFoodPerTurn", "valMaterialPerTurn", "valDefensePerTurn",
    "valMysticPerTurn", "valEmberPerTurn", "btnTurnEnd", "logComponentContainer",
    "buffComponentContainer", "cardFloatingPreview"
];

for (const id of reqIds) {
    const el = new MockElement(id, "");
    mockDoc.registerElement(el);
    mockDoc.body.appendChild(el);
}

globalThis.document = mockDoc;
globalThis.window = {
    document: mockDoc,
    I18n,
    addEventListener: () => {},
    removeEventListener: () => {},
    localStorage: { getItem: () => null, setItem: () => {} }
};

export function runLayoutAudit() {
    console.log("====================================================");
    console.log("🔍 [DIAGNOSTIC] Board Layout & Quantitative DOM Audit");
    console.log("====================================================");

    const engine = GameEngine.createGame();
    const ui = new UIController(engine);
    ui.init();

    const gridBoard = mockDoc.getElementById("gridBoard");
    const headers = gridBoard.querySelectorAll(".header-cell");
    const cells = gridBoard.querySelectorAll(".cell");
    console.log("  - Headers Count: " + headers.length + " (expected: 11)");
    console.log("  - Cells Count: " + cells.length + " (expected: 25)");
    if (headers.length !== 11 || cells.length !== 25) {
        throw new Error("DOM Mismatch: Headers=" + headers.length + ", Cells=" + cells.length);
    }
    console.log("  ✅ [PASS] Initial grid 36 elements complete");

    // 🌾 1. 1x1 Plains
    engine.state.hasPickedThisTurn = false;
    const pTerrain = { id: "GL1_PLAINS", terrainId: "PLAINS", nameKey: "TERRAIN_PLAINS", yields: { food: 4 } };
    engine.state.placeShape(1, 2, [[1]], pTerrain);
    ui.render();

    const plainsCell = cells.find(c => c.dataset.r === "1" && c.dataset.c === "2");
    console.log("  - Plains(1x1) HTML: " + (plainsCell ? plainsCell.innerHTML : "NULL"));

    // 🌲 2. 1x2 Forest
    engine.state.hasPickedThisTurn = false;
    const fTerrain = { id: "F2_FOREST", terrainId: "FOREST", nameKey: "TERRAIN_FOREST", yields: { food: 2, wood: 2, defense: 2 } };
    engine.state.placeShape(0, 2, [[1], [1]], fTerrain);
    ui.render();

    const forestHead = cells.find(c => c.dataset.r === "0" && c.dataset.c === "2");
    const forestTail = cells.find(c => c.dataset.r === "1" && c.dataset.c === "2");
    console.log("  - Forest(1x2) Head HTML: " + (forestHead ? forestHead.innerHTML : "NULL"));
    console.log("  - Forest(1x2) Tail HTML: \"" + (forestTail ? forestTail.innerHTML : "NULL") + "\"");

    console.log("====================================================");
    console.log("🎉 [PASS] Step 0: Diagnostic System Ready & Fully Operational!");
    console.log("====================================================");
}

runLayoutAudit();
