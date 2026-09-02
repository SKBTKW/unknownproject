import assert from "assert";
import {
    BUILD_IDENTITY_CONFIG,
    BUILD_IDENTITY_MODES,
    BuildIdentityBadgeComponent,
    BuildIdentityService,
    UILayoutConfig,
    normalizeBuildIdentity
} from "../game/src/app.js";

class MockClassList {
    constructor(element) {
        this.element = element;
    }

    toggle(name, force) {
        const classes = new Set(this.element.className.split(/\s+/).filter(Boolean));
        if (force) classes.add(name);
        else classes.delete(name);
        this.element.className = Array.from(classes).join(" ");
    }
}

class MockElement {
    constructor(tagName = "div") {
        this.tagName = tagName.toUpperCase();
        this.id = "";
        this.className = "";
        this.children = [];
        this.style = {};
        this.dataset = {};
        this.attributes = {};
        this.hidden = false;
        this.textContent = "";
        this.classList = new MockClassList(this);
    }

    appendChild(child) {
        this.children.push(child);
        child.parentElement = this;
        return child;
    }

    setAttribute(name, value) {
        this.attributes[name] = String(value);
    }

    querySelector(selector) {
        const className = selector.startsWith(".") ? selector.slice(1) : null;
        for (const child of this.children) {
            if (className && child.className.split(/\s+/).includes(className)) return child;
            const nested = child.querySelector(selector);
            if (nested) return nested;
        }
        return null;
    }

    remove() {
        if (!this.parentElement) return;
        this.parentElement.children = this.parentElement.children.filter(child => child !== this);
    }
}

class MockDocument {
    constructor() {
        this.body = new MockElement("body");
    }

    createElement(tagName) {
        return new MockElement(tagName);
    }

    getElementById(id) {
        const visit = element => {
            if (element.id === id) return element;
            for (const child of element.children) {
                const found = visit(child);
                if (found) return found;
            }
            return null;
        };
        return visit(this.body);
    }
}

console.log("============================================================");
console.log("🏷️ Build Identity Badge Regression Tests");
console.log("============================================================");

const development = normalizeBuildIdentity({
    mode: BUILD_IDENTITY_MODES.DEVELOPMENT,
    branchName: "AGtest260902"
});
assert.deepStrictEqual(development, {
    mode: BUILD_IDENTITY_MODES.DEVELOPMENT,
    value: "AGtest260902"
});

const production = normalizeBuildIdentity({
    mode: BUILD_IDENTITY_MODES.PRODUCTION,
    versionName: "RELEASE-1"
});
assert.deepStrictEqual(production, {
    mode: BUILD_IDENTITY_MODES.PRODUCTION,
    value: "RELEASE-1"
});

const injectedService = new BuildIdentityService({
    injectedIdentity: {
        mode: BUILD_IDENTITY_MODES.DEVELOPMENT,
        branchName: "feature/test"
    },
    fetchFn: async () => {
        throw new Error("injected identity must take priority");
    }
});
assert.deepStrictEqual(await injectedService.resolve(), {
    mode: BUILD_IDENTITY_MODES.DEVELOPMENT,
    value: "feature/test"
});

const endpointService = new BuildIdentityService({
    injectedIdentity: null,
    fetchFn: async () => ({
        ok: true,
        json: async () => ({
            mode: BUILD_IDENTITY_MODES.DEVELOPMENT,
            branchName: "AGtest-endpoint"
        })
    })
});
assert.deepStrictEqual(await endpointService.resolve(), {
    mode: BUILD_IDENTITY_MODES.DEVELOPMENT,
    value: "AGtest-endpoint"
});

const fallbackService = new BuildIdentityService({
    injectedIdentity: null,
    fetchFn: async () => ({ ok: false })
});
assert.deepStrictEqual(await fallbackService.resolve(), {
    mode: BUILD_IDENTITY_MODES.PRODUCTION,
    value: BUILD_IDENTITY_CONFIG.productionVersionName
});

const mockDocument = new MockDocument();
const mockWindow = {
    innerWidth: 1280,
    isMobile: false,
    addEventListener: () => {},
    removeEventListener: () => {},
    matchMedia() {
        return { matches: this.isMobile };
    }
};
const component = new BuildIdentityBadgeComponent({
    identityService: injectedService,
    documentRef: mockDocument,
    windowRef: mockWindow,
    i18n: { t: key => key === "UI_BUILD_BADGE_BRANCH" ? "BRANCH" : "VERSION" }
});

const resolvedIdentity = await component.mount();
assert.strictEqual(resolvedIdentity.value, "feature/test");
assert.strictEqual(component.rootEl.hidden, false);
assert.strictEqual(component.rootEl.dataset.mode, BUILD_IDENTITY_MODES.DEVELOPMENT);
assert.strictEqual(component.labelEl.textContent, "BRANCH");
assert.strictEqual(component.valueEl.textContent, "feature/test");
assert.strictEqual(component.rootEl.style.right, UILayoutConfig.buildIdentityBadge.desktop.right);
assert.ok(component.rootEl.className.includes("is-development"));

mockWindow.isMobile = true;
component.applyLayout();
assert.strictEqual(component.rootEl.style.right, UILayoutConfig.buildIdentityBadge.mobile.right);
assert.strictEqual(component.rootEl.style.bottom, UILayoutConfig.buildIdentityBadge.mobile.bottom);

component.render({
    mode: BUILD_IDENTITY_MODES.PRODUCTION,
    value: "RELEASE-2"
});
assert.strictEqual(component.labelEl.textContent, "VERSION");
assert.strictEqual(component.valueEl.textContent, "RELEASE-2");
assert.ok(component.rootEl.className.includes("is-production"));
assert.ok(!component.rootEl.className.includes("is-development"));

component.destroy();
assert.strictEqual(mockDocument.getElementById("buildIdentityBadge"), null);

console.log("✅ Development branch resolution PASS");
console.log("✅ Production version fallback PASS");
console.log("✅ Desktop / mobile badge layout PASS");
console.log("✅ Component lifecycle PASS");
