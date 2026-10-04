import assert from "node:assert/strict";

class MockElement {
    constructor(tagName = "div", documentRef = null) {
        this.tagName = String(tagName).toUpperCase();
        this.ownerDocument = documentRef;
        this.children = [];
        this.parentElement = null;
        this.className = "";
        this.id = "";
        this.hidden = false;
        this.textContent = "";
        this.type = "";
        this.attributes = {};
        this.listeners = new Map();
        this.isConnected = false;
    }

    appendChild(child) {
        child.parentElement = this;
        child.isConnected = this.isConnected;
        this.children.push(child);
        return child;
    }

    replaceChildren(...children) {
        for (const child of this.children) {
            child.parentElement = null;
            child.isConnected = false;
        }
        this.children = [];
        for (const child of children) this.appendChild(child);
    }

    get firstElementChild() {
        return this.children[0] || null;
    }

    setAttribute(key, value) {
        this.attributes[key] = String(value);
    }

    getAttribute(key) {
        return this.attributes[key];
    }

    addEventListener(type, listener, options = {}) {
        const list = this.listeners.get(type) || [];
        list.push({ listener, once: options?.once === true });
        this.listeners.set(type, list);
    }

    dispatchEvent(event) {
        const list = [...(this.listeners.get(event.type) || [])];
        for (const entry of list) {
            entry.listener.call(this, event);
            if (entry.once) {
                const next = (this.listeners.get(event.type) || []).filter(item => item !== entry);
                this.listeners.set(event.type, next);
            }
        }
    }

    focus() {
        if (this.ownerDocument) this.ownerDocument.activeElement = this;
    }

    remove() {
        if (this.parentElement) {
            this.parentElement.children = this.parentElement.children.filter(child => child !== this);
        }
        this.parentElement = null;
        this.isConnected = false;
    }

    findByClass(className) {
        if (String(this.className).split(/\s+/).includes(className)) return this;
        for (const child of this.children) {
            const found = child.findByClass?.(className);
            if (found) return found;
        }
        return null;
    }

    findAllByClass(className, out = []) {
        if (String(this.className).split(/\s+/).includes(className)) out.push(this);
        for (const child of this.children) child.findAllByClass?.(className, out);
        return out;
    }
}

const documentListeners = new Map();
const mockDocument = {
    activeElement: null,
    createElement(tagName) {
        return new MockElement(tagName, mockDocument);
    },
    getElementById(id) {
        const visit = node => {
            if (!node) return null;
            if (node.id === id) return node;
            for (const child of node.children || []) {
                const found = visit(child);
                if (found) return found;
            }
            return null;
        };
        return visit(mockDocument.head) || visit(mockDocument.body);
    },
    addEventListener(type, listener) {
        const list = documentListeners.get(type) || [];
        list.push(listener);
        documentListeners.set(type, list);
    },
    removeEventListener(type, listener) {
        const list = documentListeners.get(type) || [];
        documentListeners.set(type, list.filter(item => item !== listener));
    },
    dispatch(type, event = {}) {
        for (const listener of [...(documentListeners.get(type) || [])]) {
            listener({ type, ...event });
        }
    }
};
mockDocument.head = new MockElement("head", mockDocument);
mockDocument.body = new MockElement("body", mockDocument);
mockDocument.head.isConnected = true;
mockDocument.body.isConnected = true;

globalThis.document = mockDocument;

const { InvestigationReportComponent } = await import(
    "../game/src/ui/investigation_report_component.js"
);

const i18n = {
    t(key) {
        const values = {
            UI_INVESTIGATION_REPORT_KICKER: "調査報告",
            UI_INVESTIGATION_DICE_LABEL: "観測判定",
            UI_INVESTIGATION_FAILURE_TITLE: "調査中止",
            UI_INVESTIGATION_FAILURE_GENERIC: "調査を実行できませんでした。",
            UI_CONFIRM: "確認"
        };
        return values[key] || key;
    }
};

const previousFocus = new MockElement("button", mockDocument);
previousFocus.isConnected = true;
mockDocument.activeElement = previousFocus;

const component = new InvestigationReportComponent({ i18n });
const presentation = {
    available: true,
    report: {
        observedAtVerse: 9,
        title: "足跡の調査",
        roll: { dice: [5, 4], total: 9 },
        observationVolume: "複数の手掛かりを得た。",
        summary: "新しい情報が判明した。",
        preparationHint: "次の試練への備えに活用できる。",
        hasObservations: true,
        sections: [
            {
                label: "接近・移動",
                observations: [
                    {
                        statusLabel: "新たに判明",
                        value: "北方で活動の痕跡がある"
                    }
                ]
            },
            {
                label: "敵の特徴",
                observations: [
                    {
                        statusLabel: "確認が取れた",
                        value: "大柄な個体が含まれる"
                    }
                ]
            }
        ]
    },
    narrative: {
        text: "structured observations are present, so this fallback narrative must not render"
    }
};

assert.equal(component.show(presentation), true);
assert.equal(component.overlay.hidden, false);
assert.equal(component.overlay.getAttribute("role"), "dialog");
assert.equal(component.overlay.getAttribute("aria-modal"), "true");

const panel = component.overlay.firstElementChild;
assert.ok(panel);
assert.equal(panel.findByClass("investigation-report-kicker").textContent, "Verse 9 / 調査報告");
assert.equal(panel.findByClass("investigation-report-title").textContent, "足跡の調査");
assert.equal(panel.findByClass("investigation-report-roll").textContent, "観測判定: 5 + 4 = 9");
assert.equal(panel.findAllByClass("investigation-report-group").length, 2);
assert.equal(panel.findAllByClass("investigation-report-observation").length, 2);
assert.equal(panel.findByClass("investigation-report-narrative"), null);

const close = panel.findByClass("investigation-report-close");
assert.ok(close);
assert.equal(mockDocument.activeElement, close, "show must focus the report close action");

let prevented = false;
mockDocument.dispatch("keydown", {
    key: "Escape",
    preventDefault() { prevented = true; }
});
assert.equal(prevented, true);
assert.equal(component.overlay.hidden, true);
assert.equal(mockDocument.activeElement, previousFocus, "hide must restore prior focus");

mockDocument.activeElement = previousFocus;
assert.equal(component.show(presentation), true);
close.dispatchEvent({ type: "click" });
assert.equal(component.overlay.hidden, true, "close action must dismiss the report");

mockDocument.activeElement = previousFocus;
assert.equal(component.showFailure({
    reason: "INVESTIGATION_LOCKED",
    title: "調査中止",
    message: "まだ調査を行える段階ではありません。"
}), true);
assert.equal(component.overlay.hidden, false);
assert.equal(panel.findByClass("investigation-report-title").textContent, "調査中止");
assert.equal(
    panel.findByClass("investigation-report-failure").textContent,
    "まだ調査を行える段階ではありません。"
);
assert.equal(mockDocument.activeElement, panel.findByClass("investigation-report-close"));
component.hide();
assert.equal(mockDocument.activeElement, previousFocus);

assert.equal((documentListeners.get("keydown") || []).length, 1);
component.destroy();
assert.equal((documentListeners.get("keydown") || []).length, 0, "destroy must remove keydown listener");
assert.equal(component.overlay, null);

delete globalThis.document;
console.log("PASS investigation report component DOM lifecycle");
