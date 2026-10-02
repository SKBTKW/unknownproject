import assert from "node:assert/strict";

import { GameEngine, UIController } from "../game/src/app.js";
import { GameState } from "../game/src/v2_unity_ready_main.js";
import { I18n } from "../game/src/i18n.js";
import { createObservableEnemyProfile } from "../game/src/warning/domain/observable_enemy_profile.js";
import { attachTrialRuntimeSubsystems } from "../game/src/trial/integration/trial_runtime_bootstrap.js";
import { attachTrialLaunchSubsystem } from "../game/src/trial/integration/trial_launch_bootstrap.js";
import { attachBoardPresentationRuntime } from "../game/src/ui/board_presentation_runtime_bridge.js";
import { attachTrialActionTray } from "../game/src/ui/trial_action_tray_runtime_bridge.js";
import {
    BOARD_INPUT_COMMANDS,
    createBoardInputCommand
} from "../game/src/presentation/board_input_contract.js";
import { FIRST_RUN_TRIAL_TUTORIAL_STEPS } from "../game/src/tutorial/first_run_state.js";
import {
    resolvePlacementAnchor,
    resolvePlacementAttributeCells,
    resolvePlacementShape,
    rotatePlacementClockwise
} from "../game/src/core/placement_geometry.js";

class MockElement {
    constructor(id = "", tagName = "div") {
        this._id = id;
        this.tagName = String(tagName).toUpperCase();
        this.children = [];
        this.attributes = {};
        this.style = {};
        this.dataset = {};
        this.disabled = false;
        this._innerHTML = "";
        this._innerText = "";
        this._classes = new Set();
        if (id) elements.set(id, this);
        this.classList = {
            add: (...xs) => xs.forEach(x => this._classes.add(x)),
            remove: (...xs) => xs.forEach(x => this._classes.delete(x)),
            contains: x => this._classes.has(x),
            toggle: (x, force) => {
                if (force === true) { this._classes.add(x); return true; }
                if (force === false) { this._classes.delete(x); return false; }
                if (this._classes.has(x)) { this._classes.delete(x); return false; }
                this._classes.add(x); return true;
            }
        };
    }
    get id() { return this._id; }
    set id(v) { this._id = String(v || ""); if (this._id) elements.set(this._id, this); }
    get className() { return [...this._classes].join(" "); }
    set className(v) { this._classes = new Set(String(v || "").split(/\s+/).filter(Boolean)); }
    get innerHTML() { return this._innerHTML; }
    set innerHTML(v) { this._innerHTML = String(v ?? ""); this.children = []; }
    get innerText() { return this._innerText; }
    set innerText(v) { this._innerText = String(v ?? ""); }
    get textContent() { return this._innerText; }
    set textContent(v) { this._innerText = String(v ?? ""); }
    setAttribute(k, v) {
        this.attributes[k] = String(v);
        if (k === "id") this.id = v;
        if (k === "class") this.className = v;
    }
    getAttribute(k) {
        return k === "id" ? this.id : k === "class" ? this.className : (this.attributes[k] ?? null);
    }
    removeAttribute(k) { delete this.attributes[k]; }
    appendChild(child) { this.children.push(child); child.parentNode = this; return child; }
    querySelector() { return null; }
    querySelectorAll() { return []; }
    getBoundingClientRect() { return { top: 0, left: 0, width: 100, height: 100, right: 100, bottom: 100 }; }
}

const elements = new Map();
const body = new MockElement("body", "body");
const head = new MockElement("head", "head");
const layerPlayerTray = new MockElement("layerPlayerTray", "div");
body.appendChild(layerPlayerTray);
const documentMock = {
    body,
    head,
    createElement: tag => new MockElement("", tag),
    getElementById: id => elements.get(id) || null,
    querySelector: () => null,
    querySelectorAll: () => [],
    addEventListener: () => {},
    removeEventListener: () => {}
};

globalThis.document = documentMock;
globalThis.window = {
    __TOA_DEV_MODE__: true,
    location: { search: "?dev=1" },
    innerWidth: 1280,
    addEventListener: () => {},
    removeEventListener: () => {},
    document: documentMock,
    I18n
};

class DiagnosticFirstRunState extends GameState {
    constructor(dependencies = {}) {
        super({
            ...dependencies,
            food: 1000,
            material: 1000,
            wood: 1000,
            ember: 20,
            maxEmber: 20
        });
    }
}

const observationProjector = {
    project(truth) {
        return createObservableEnemyProfile({
            trialIndex: Number.isInteger(truth?.trialIndex) ? truth.trialIndex : 1,
            threatRevision: Number.isInteger(truth?.revision) ? truth.revision : 0,
            directionHints: ["NORTH_ACTIVITY"],
            physiqueTraits: ["LARGE_BODY_PRESENT"],
            scaleBand: "SMALL"
        });
    }
};

function definitionOf(card) {
    return card?.terrain || card || null;
}

function geometryKey(shape, anchor, attributeCells) {
    return JSON.stringify({
        shape,
        anchor,
        cells: (attributeCells || []).map(cell => ({
            r: cell.r,
            c: cell.c,
            id: cell.terrainId || cell.id || null
        }))
    });
}

function enumerateLegalPlacements(state, card) {
    const definition = definitionOf(card);
    let shape = resolvePlacementShape(card);
    let anchor = resolvePlacementAnchor(card, shape);
    let attributeCells = resolvePlacementAttributeCells(card);
    const seen = new Set();
    const placements = [];

    for (let rotation = 0; rotation < 4; rotation += 1) {
        const key = geometryKey(shape, anchor, attributeCells);
        if (!seen.has(key)) {
            seen.add(key);
            for (let r = 0; r < state.grid.length; r += 1) {
                for (let c = 0; c < state.grid.length; c += 1) {
                    const startR = r - anchor.r;
                    const startC = c - anchor.c;
                    const check = state.canPlaceShape(startR, startC, shape, definition, attributeCells);
                    if (check?.can === true) {
                        placements.push({ r, c, shape, anchor, attributeCells });
                    }
                }
            }
        }
        const rotated = rotatePlacementClockwise(shape, anchor, attributeCells);
        shape = rotated.shape;
        anchor = rotated.anchor;
        attributeCells = rotated.attributeCells;
    }
    return placements;
}

function placeRepresentativeLand(engine) {
    if (engine.state.hasPickedThisTurn === true) return false;
    for (let index = 0; index < (engine.state.handOffering || []).length; index += 1) {
        const raw = engine.state.handOffering[index];
        if (definitionOf(raw)?.category !== "LAND") continue;
        const placement = enumerateLegalPlacements(engine.state, raw)[0];
        if (!placement) continue;
        const card = {
            ...raw,
            currentShape: placement.shape,
            currentAnchor: placement.anchor,
            ...(placement.attributeCells ? { currentCells: placement.attributeCells } : {})
        };
        const result = engine.placeLand(
            placement.r,
            placement.c,
            card,
            0,
            { type: "OFFERING", index }
        );
        if (result?.success) return true;
    }
    return false;
}

function findTag(html, id) {
    const escaped = id.replace(/[.*+?^$()|[\]\\]/g, "\\$&");
    const match = String(html || "").match(new RegExp("<[^>]+id=[\\\"']" + escaped + "[\\\"'][^>]*>", "i"));
    return match?.[0] || null;
}

function numericAttribute(tag, name) {
    const match = String(tag || "").match(new RegExp("\\b" + name + "=[\\\"']([^\\\"']+)[\\\"']", "i"));
    return match ? Number(match[1]) : null;
}

function hasDisabledAttribute(tag) {
    return Boolean(tag && /\sdisabled(?:\s|>|=)/i.test(tag));
}

function routeDrafts(ui) {
    return Array.from(ui.trialPresentationState.routePlanDrafts.entries()).map(([routeId, value]) => ({
        routeId,
        status: value?.status || null,
        defenseAllocation: Number(value?.defenseAllocation) || 0,
        interceptCell: value?.interceptCell ? { ...value.interceptCell } : null
    }));
}

function captureDefenseDiagnostic(engine, ui) {
    ui.trialActionTrayComponent?.render?.();

    const tutorial = engine.firstRunState.getTrialTutorialState();
    const policy = ui.getFirstRunTrialTutorialPolicy();
    const activeRoute = ui.getActiveTrialRoute();
    const activeRouteId = activeRoute?.id || null;
    const availableDefense = ui.getTrialAvailableDefense();
    const maxForActive = activeRouteId
        ? ui.trialPresentationState.getMaxAllocationForRoute(activeRouteId, availableDefense)
        : availableDefense;
    const reservation = ui.trialController?.sessionDefenseReservation || null;
    const host = document.getElementById("trialActionTrayHost");
    const html = host?.innerHTML || "";
    const sliderTag = findTag(html, "trialDefenseAllocationSlider");
    const increaseTag = findTag(html, "btnTrialDefenseIncrease");
    const maxTag = findTag(html, "btnTrialDefenseMax");

    return {
        tutorial,
        policy: {
            tutorialActive: policy.tutorialActive,
            step: policy.step,
            allowInterceptionSelection: policy.allowInterceptionSelection,
            allowDefenseInput: policy.allowDefenseInput,
            allowTrialConfirm: policy.allowTrialConfirm,
            allowSkipRoute: policy.allowSkipRoute
        },
        selectedRoute: activeRouteId,
        selectedInterceptCell: ui.trialPresentationState.selectedInterceptCell
            ? { ...ui.trialPresentationState.selectedInterceptCell }
            : null,
        previewDefenseAllocation: ui.trialPresentationState.previewDefenseAllocation,
        availableDefense,
        maxForActive,
        remainingDefense: ui.getTrialRemainingDefense(),
        plannedDefenseTotal: ui.getTrialPlannedDefenseTotal(),
        canonicalReservation: {
            attached: Boolean(reservation),
            available: reservation?.isAvailable?.() ?? null,
            balance: reservation?.readBalance?.() ?? null
        },
        routeDrafts: routeDrafts(ui),
        planning: {
            reviewRequested: ui.trialPresentationState.planningReviewRequested,
            confirmed: ui.isTrialPlanningConfirmed(),
            activated: ui.isTrialPlanActivated(),
            battleActive: ui.isTrialBattleActive?.() === true,
            battleResolved: ui.isTrialBattleResolved?.() === true,
            completed: ui.isTrialCompleted?.() === true
        },
        actionTray: {
            active: ui.trialActionTrayComponent?.isActive?.() === true,
            sliderPresent: Boolean(sliderTag),
            sliderDisabled: sliderTag ? hasDisabledAttribute(sliderTag) : null,
            sliderMax: numericAttribute(sliderTag, "max"),
            increaseDisabled: increaseTag ? hasDisabledAttribute(increaseTag) : null,
            maxButtonDisabled: maxTag ? hasDisabledAttribute(maxTag) : null
        }
    };
}

function failWithSnapshot(label, snapshot, assertion) {
    try {
        assertion();
    } catch (error) {
        console.error("\nP0 DEFENSE ALLOCATION DIAGNOSTIC");
        console.error(JSON.stringify(snapshot, null, 2));
        assert.fail(label + ": " + (error?.message || error));
    }
}

const engine = GameEngine.createGame({
    runSeed: 20261002,
    firstRun: true,
    GameStateClass: DiagnosticFirstRunState,
    enemyObservationProjector: observationProjector
});

assert.equal(attachTrialRuntimeSubsystems(engine).success, true);
const ui = new UIController(engine);
ui.render = () => {};
ui.renderBoardGrid = () => {};
ui.hideCellTooltip = () => {};
assert.equal(attachTrialLaunchSubsystem(engine, ui).success, true);
attachBoardPresentationRuntime(ui);
attachTrialActionTray(ui);

while (engine.state.turn < 7) {
    placeRepresentativeLand(engine);
    engine.nextTurn();
}

engine.nextTurn();
const investigationIndex = engine.state.handOffering.findIndex(card =>
    definitionOf(card)?.category === "INVESTIGATION"
);
assert.notEqual(investigationIndex, -1);
const investigationCard = engine.state.handOffering[investigationIndex];
assert.equal(
    engine.executeInvestigationCard(
        investigationCard,
        { type: "OFFERING", index: investigationIndex }
    )?.success,
    true
);

while (engine.state.turn < 15) {
    placeRepresentativeLand(engine);
    engine.nextTurn();
}

assert.equal(engine.state.turn, 15);
assert.equal(ui.trialController?.state?.trialIndex, 1);

const routes = ui.getTrialPlanningRoutes();
let selectedRoute = null;
let selectedCell = null;

for (const route of routes) {
    assert.equal(ui.selectTrialRoute(route.id), true);
    for (const cell of route.cells || []) {
        if (ui.getTrialInterceptionCellState(cell.r, cell.c)?.canIntercept) {
            selectedRoute = route;
            selectedCell = cell;
            break;
        }
    }
    if (selectedCell) break;
}

assert.ok(selectedRoute, "P0_REPRO_NO_ROUTE");
assert.ok(selectedCell, "P0_REPRO_NO_LEGAL_INTERCEPTION_CELL");
assert.equal(ui.selectTrialRoute(selectedRoute.id), true);
const interceptionInput = createBoardInputCommand(
    BOARD_INPUT_COMMANDS.SELECT_TRIAL_INTERCEPTION,
    {
        routeId: selectedRoute.id,
        cell: { r: selectedCell.r, c: selectedCell.c }
    }
);
const interceptionDispatch = ui.boardPresentationRuntimeBridge.dispatchInput(interceptionInput);
assert.equal(
    interceptionDispatch?.success,
    true,
    "production BoardPresentationRuntime must deliver interception selection"
);

const snapshot = {
    ...captureDefenseDiagnostic(engine, ui),
    boardInput: {
        interceptionDispatch
    }
};
console.log("\nP0 DEFENSE ALLOCATION SNAPSHOT");
console.log(JSON.stringify(snapshot, null, 2));

failWithSnapshot("tutorial must enter DEFENSE_ALLOCATION", snapshot, () => {
    assert.equal(snapshot.tutorial.currentStep, FIRST_RUN_TRIAL_TUTORIAL_STEPS.DEFENSE_ALLOCATION);
    assert.equal(snapshot.policy.allowInterceptionSelection, true);
    assert.equal(snapshot.policy.allowDefenseInput, true);
    assert.equal(snapshot.policy.allowTrialConfirm, false);
});

failWithSnapshot("gameplay defense budget must be allocatable", snapshot, () => {
    assert.ok(snapshot.availableDefense > 0, "availableDefense must be > 0");
    assert.ok(snapshot.maxForActive > 0, "maxForActive must be > 0");
    assert.equal(snapshot.canonicalReservation.attached, true);
    assert.equal(snapshot.canonicalReservation.available, true);
    assert.equal(
        snapshot.canonicalReservation.balance,
        engine.getTrialAvailableDefense(),
        "canonical reservation balance must match GameEngine defense"
    );
});

failWithSnapshot("Action Tray defense input must be enabled", snapshot, () => {
    assert.equal(snapshot.actionTray.active, true);
    assert.equal(snapshot.actionTray.sliderPresent, true);
    assert.equal(snapshot.actionTray.sliderDisabled, false);
    assert.equal(snapshot.actionTray.sliderMax, snapshot.maxForActive);
    assert.equal(snapshot.actionTray.increaseDisabled, false);
    assert.equal(snapshot.actionTray.maxButtonDisabled, false);
});

const requested = Math.max(1, Math.min(3, snapshot.maxForActive));
const allocation = ui.setTrialDefenseAllocation(requested);
const afterAllocation = captureDefenseDiagnostic(engine, ui);

failWithSnapshot("defense allocation must advance tutorial and remain in draft preview", afterAllocation, () => {
    assert.equal(allocation, requested);
    assert.equal(afterAllocation.previewDefenseAllocation, requested);
    assert.equal(afterAllocation.tutorial.defenseAllocated, true);
    assert.equal(afterAllocation.tutorial.currentStep, FIRST_RUN_TRIAL_TUTORIAL_STEPS.FINAL_REVIEW);
    assert.equal(afterAllocation.policy.allowTrialConfirm, true);
});

const committedDraft = ui.setTrialActiveRouteIntercept();
const afterDraft = captureDefenseDiagnostic(engine, ui);

failWithSnapshot("defense allocation must commit into Trial Planning Draft", afterDraft, () => {
    assert.equal(committedDraft?.success, true);
    const row = afterDraft.routeDrafts.find(entry => entry.routeId === selectedRoute.id);
    assert.ok(row, "route draft must exist");
    assert.equal(row.status, "INTERCEPT");
    assert.equal(row.defenseAllocation, requested);
    assert.deepEqual(row.interceptCell, { r: selectedCell.r, c: selectedCell.c });
});

console.log("\n✅ FirstRun Trial1 Defense Allocation production-path diagnostic PASS");
