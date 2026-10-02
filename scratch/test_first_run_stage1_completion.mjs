import assert from "node:assert/strict";
import fs from "node:fs";

import { GameEngine, UIController } from "../game/src/app.js";
import { GameState } from "../game/src/v2_unity_ready_main.js";
import { I18n } from "../game/src/i18n.js";
import { WARNING_STATES } from "../game/src/warning/domain/warning_state.js";
import { createObservableEnemyProfile } from "../game/src/warning/domain/observable_enemy_profile.js";
import { attachTrialRuntimeSubsystems } from "../game/src/trial/integration/trial_runtime_bootstrap.js";
import { attachTrialLaunchSubsystem } from "../game/src/trial/integration/trial_launch_bootstrap.js";
import { FIRST_RUN_DEMIHUMAN_TRACES_EVENT_ID } from "../game/src/tutorial/first_run_service.js";
import { FIRST_RUN_TRIAL_TUTORIAL_STEPS } from "../game/src/tutorial/first_run_state.js";
import { GLOBAL_EVENT_TIMINGS } from "../game/src/systems/global_event_system.js";
import { OFFERING_GENERATION_REASONS } from "../game/src/systems/deck_manager.js";
import {
    resolvePlacementAnchor,
    resolvePlacementAttributeCells,
    resolvePlacementShape,
    rotatePlacementClockwise
} from "../game/src/core/placement_geometry.js";

const FAILURES = [];
const PASSES = [];
function certify(label, fn) {
    try {
        fn();
        PASSES.push(label);
        console.log(`PASS: ${label}`);
    } catch (error) {
        FAILURES.push({ label, message: error?.message || String(error) });
        console.error(`FAIL: ${label}`);
        console.error(`  ${error?.message || error}`);
    }
}
function requireSuccess(result, label) {
    assert.equal(result?.success, true, `${label}: ${JSON.stringify(result)}`);
    return result;
}

// Minimal browser surface for the production UI controller. The certification
// intentionally drives controller methods rather than testing visual markup.
class MockElement {
    constructor(id = "", tagName = "div") {
        this._id = id;
        this.tagName = String(tagName).toUpperCase();
        this.children = [];
        this.attributes = {};
        this.style = {};
        this.dataset = {};
        this.disabled = false;
        this.onclick = null;
        this.oninput = null;
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
    setAttribute(k, v) { this.attributes[k] = String(v); if (k === "id") this.id = v; if (k === "class") this.className = v; }
    getAttribute(k) { return k === "id" ? this.id : k === "class" ? this.className : (this.attributes[k] ?? null); }
    hasAttribute(k) { return this.getAttribute(k) !== null; }
    removeAttribute(k) { delete this.attributes[k]; }
    appendChild(child) { this.children.push(child); child.parentNode = this; return child; }
    removeChild(child) { this.children = this.children.filter(x => x !== child); return child; }
    querySelector() { return null; }
    querySelectorAll() { return []; }
    getBoundingClientRect() { return { top: 0, left: 0, width: 100, height: 100, right: 100, bottom: 100 }; }
}
const elements = new Map();
const body = new MockElement("body", "body");
const head = new MockElement("head", "head");
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

class SustainedFirstRunState extends GameState {
    constructor(dependencies = {}) {
        super({
            ...dependencies,
            food: 1000,
            material: 1000,
            wood: 1000,
            defense: 100,
            currentDefense: 100,
            maxDefense: 100,
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

function definitionOf(card) { return card?.terrain || card || null; }
function geometryKey(shape, anchor, attributeCells) {
    return JSON.stringify({
        shape,
        anchor,
        cells: (attributeCells || []).map(c => ({ r: c.r, c: c.c, id: c.terrainId || c.id || null }))
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
                    if (check?.can === true) placements.push({ r, c, shape, anchor, attributeCells });
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
        const result = engine.placeLand(placement.r, placement.c, card, 0, { type: "OFFERING", index });
        if (result?.success) return true;
    }
    return false;
}

const activationWrites = [];
const firstRunActivationStore = {
    markCompleted() {
        activationWrites.push({ verse: engine?.state?.turn ?? null, stageId: engine?.state?.stage?.id ?? null });
        return { success: true };
    }
};

const engine = GameEngine.createGame({
    runSeed: 20261002,
    firstRun: true,
    GameStateClass: SustainedFirstRunState,
    enemyObservationProjector: observationProjector,
    firstRunActivationStore
});
requireSuccess(attachTrialRuntimeSubsystems(engine), "attachTrialRuntimeSubsystems");
const ui = new UIController(engine);
// Rendering itself is covered by dedicated UI tests. Keep this certification on
// runtime transitions and production controller boundaries.
ui.render = () => {};
ui.renderBoardGrid = () => {};
ui.hideCellTooltip = () => {};
requireSuccess(attachTrialLaunchSubsystem(engine, ui), "attachTrialLaunchSubsystem");

let traceStarts = 0;
const unsubscribe = engine.globalEventManager.subscribe(n => {
    if (n?.eventId === FIRST_RUN_DEMIHUMAN_TRACES_EVENT_ID && n?.timing === GLOBAL_EVENT_TIMINGS.START) traceStarts += 1;
});

certify("PRE_TRIAL: Verse1 active on Stage1 5x5", () => {
    assert.equal(engine.state.turn, 1);
    assert.equal(engine.firstRunState.active, true);
    assert.equal(engine.state.stage.id, 1);
    assert.equal(engine.state.stage.size, 5);
    assert.equal(engine.state.grid.length, 5);
});

while (engine.state.turn < 7) {
    placeRepresentativeLand(engine);
    engine.nextTurn();
}
certify("PRE_TRIAL: Verse7 GE -> OMEN -> Investigation unlock", () => {
    assert.equal(engine.state.turn, 7);
    assert.equal(traceStarts, 1);
    assert.equal(engine.warningStateService.getState(), WARNING_STATES.OMEN);
    assert.equal(engine.state.investigationUnlocked, true);
});

engine.nextTurn();
let investigationIndex = engine.state.handOffering.findIndex(card => definitionOf(card)?.category === "INVESTIGATION");
certify("PRE_TRIAL: Verse8 Investigation available", () => {
    assert.equal(engine.state.turn, 8);
    assert.notEqual(investigationIndex, -1);
});

certify("VERSE8_INVESTIGATION_GUARANTEE: Verse8 only / no Mulligan re-guarantee", () => {
    const verseStartMinimums = engine.firstRunService.getMinimumRequirements({
        reason: OFFERING_GENERATION_REASONS.VERSE_START,
        state: engine.state
    });
    assert.equal(
        verseStartMinimums.some(requirement => requirement?.id === "FIRST_RUN_INVESTIGATION"),
        true,
        "Verse8 must request the FirstRun Investigation minimum"
    );
    assert.equal(
        engine.deckManager.lastOfferingGeneration?.requestedMinimums,
        1,
        "Verse8 Offering must be generated with the FirstRun minimum requirement"
    );
    const mulliganMinimums = engine.firstRunService.getMinimumRequirements({
        reason: OFFERING_GENERATION_REASONS.MULLIGAN,
        state: engine.state
    });
    assert.equal(
        mulliganMinimums.some(requirement => requirement?.id === "FIRST_RUN_INVESTIGATION"),
        false,
        "Mulligan must not re-apply the FirstRun Investigation guarantee"
    );
});
const reportsBefore = engine.state.knownEnemyState?.reports?.length || 0;
const investigationCard = engine.state.handOffering[investigationIndex];
const investigation = engine.executeInvestigationCard(investigationCard, { type: "OFFERING", index: investigationIndex });
certify("PRE_TRIAL: Investigation executes and KnownEnemyState advances", () => {
    assert.equal(investigation?.success, true);
    assert.equal(engine.state.knownEnemyState.reports.length, reportsBefore + 1);
    assert.equal(engine.warningStateService.getState(), WARNING_STATES.WATCH);
});

placeRepresentativeLand(engine);
engine.nextTurn();
certify("FIRST_RUN_INVESTIGATION_GUARANTEE_SCOPE", () => {
    assert.equal(engine.state.turn, 9);
    assert.equal(
        engine.deckManager.lastOfferingGeneration?.reason,
        OFFERING_GENERATION_REASONS.VERSE_START
    );
    assert.equal(
        engine.deckManager.lastOfferingGeneration?.requestedMinimums,
        0,
        "Verse9+ must not force the FirstRun Investigation minimum every Verse"
    );
});

while (engine.state.turn < 14) {
    placeRepresentativeLand(engine);
    engine.nextTurn();
}
certify("PRE_TRIAL: Trial1 has not started before Verse15", () => {
    assert.equal(engine.state.turn, 14);
    assert.equal(ui.trialController?.state ?? null, null);
    assert.equal(engine.warningStateService.getState(), WARNING_STATES.IMMINENT);
});
placeRepresentativeLand(engine);
engine.nextTurn();
certify("PRE_TRIAL: Verse15 launches Trial1 on Stage1 5x5", () => {
    assert.equal(engine.state.turn, 15);
    assert.equal(ui.trialController?.state?.trialIndex, 1);
    assert.equal(engine.state.stage.id, 1);
    assert.equal(engine.state.stage.size, 5);
    assert.equal(engine.firstRunState.getTrialTutorialState().currentStep, FIRST_RUN_TRIAL_TUTORIAL_STEPS.ROUTE_INTRO);
});

const routes = ui.getTrialPlanningRoutes();
let selectedRoute = null;
let selectedCell = null;
for (const route of routes) {
    ui.selectTrialRoute(route.id);
    for (const cell of route.cells || []) {
        if (ui.getTrialInterceptionCellState(cell.r, cell.c)?.canIntercept) {
            selectedRoute = route;
            selectedCell = cell;
            break;
        }
    }
    if (selectedCell) break;
}
certify("TRIAL: Route acknowledgment -> INTERCEPTION_INTRO", () => {
    assert.ok(routes.length > 0);
    assert.equal(engine.firstRunState.getTrialTutorialState().routeIntroduced, true);
    assert.ok([
        FIRST_RUN_TRIAL_TUTORIAL_STEPS.INTERCEPTION_INTRO,
        FIRST_RUN_TRIAL_TUTORIAL_STEPS.TERRAIN_COMPARE
    ].includes(engine.firstRunState.getTrialTutorialState().currentStep));
});
certify("TRIAL: representative legal interception exists", () => {
    assert.ok(selectedRoute, "No route exposes a legal placed interception cell");
    assert.ok(selectedCell, "No legal interception cell found on representative Stage1 board");
});

if (selectedRoute && selectedCell) {
    ui.selectTrialRoute(selectedRoute.id);
    ui.updateTrialInterceptionPreview(selectedCell.r, selectedCell.c);
    assert.equal(ui.selectTrialInterceptionCell(selectedCell.r, selectedCell.c), true);
    const allocation = ui.setTrialDefenseAllocation(Math.max(1, Math.min(10, ui.getTrialAvailableDefense())));
    certify("TRIAL: DEFENSE_ALLOCATION -> FINAL_REVIEW unlock", () => {
        assert.ok(allocation > 0);
        const tutorial = engine.firstRunState.getTrialTutorialState();
        const policy = ui.getFirstRunTrialTutorialPolicy();
        assert.equal(tutorial.defenseAllocated, true);
        assert.equal(tutorial.currentStep, FIRST_RUN_TRIAL_TUTORIAL_STEPS.FINAL_REVIEW);
        assert.equal(policy.allowTrialConfirm, true);
    });
    requireSuccess(ui.setTrialActiveRouteIntercept(), "setTrialActiveRouteIntercept");
    for (const route of routes) {
        if (route.id === selectedRoute.id) continue;
        ui.selectTrialRoute(route.id);
        const skipped = ui.setTrialActiveRouteSkip();
        // FirstRun may intentionally disallow SKIP. If so, pick another legal interception.
        if (skipped?.success === true) continue;
        let alternate = null;
        for (const cell of route.cells || []) {
            if (ui.getTrialInterceptionCellState(cell.r, cell.c)?.canIntercept) { alternate = cell; break; }
        }
        assert.ok(alternate, `route ${route.id}: no legal interception and SKIP rejected`);
        assert.equal(ui.selectTrialInterceptionCell(alternate.r, alternate.c), true);
        ui.setTrialDefenseAllocation(1);
        requireSuccess(ui.setTrialActiveRouteIntercept(), `route ${route.id}: intercept`);
    }

    requireSuccess(ui.finishTrialPlanning(), "finishTrialPlanning");
    requireSuccess(ui.confirmTrialPlanning(), "confirmTrialPlanning");
    requireSuccess(ui.activateTrialPlan(), "activateTrialPlan");

    let firstBattleResolved = false;
    const battleCount = (ui.getTrialBattleQueue() || []).length;
    for (let battleOrdinal = 0; battleOrdinal < battleCount; battleOrdinal += 1) {
        const started = requireSuccess(ui.startTrialBattle(), "startTrialBattle");
        const resolved = requireSuccess(ui.resolveCurrentTrialBattle(), "resolveCurrentTrialBattle");
        firstBattleResolved = true;
        certify("TRIAL: Battle result and causality are observable", () => {
            assert.ok(resolved.battleResolutionSnapshot, "canonical Battle Resolution Snapshot required");
            assert.ok(ui.getCurrentTrialBattleResult(), "Battle result required");
            const presentation = ui.battlePresentationRuntimeBridge?.project?.(resolved.battleResolutionSnapshot);
            assert.equal(presentation?.available, true, "Battle Presentation projection required");
            assert.ok(presentation?.narrative, "Battle Narrative projection required");
            const causality = ui.getCurrentTrialCausality();
            assert.equal(causality?.available, true);
            assert.equal(engine.firstRunState.getTrialTutorialState().currentStep, FIRST_RUN_TRIAL_TUTORIAL_STEPS.RESULT_CAUSALITY);
        });
        if (!engine.firstRunState.getTrialTutorialState().completed) {
            ui.acknowledgeFirstRunTrialCausality();
        }
        const advanced = requireSuccess(ui.advanceCurrentTrialBattle(), "advanceCurrentTrialBattle");
        if (advanced.traversalResult?.reachedRouteEnd) {
            requireSuccess(ui.trialController.resolveRouteEndDamage(advanced.traversalResult.battleIndex), "resolveRouteEndDamage");
        }
        requireSuccess(ui.transitionTrialAfterCurrentBattle(), "transitionTrialAfterCurrentBattle");
    }
    certify("TRIAL: FirstRun Trial tutorial completes after causality acknowledgment", () => {
        assert.equal(firstBattleResolved, true);
        const tutorial = engine.firstRunState.getTrialTutorialState();
        assert.equal(tutorial.completed, true);
        assert.equal(tutorial.currentStep, FIRST_RUN_TRIAL_TUTORIAL_STEPS.COMPLETED);
    });

    // This is deliberately a certification failure on the current implementation:
    // tutorial completion must not persist browser-wide FirstRun completion before Stage2.
    certify("FIRST_RUN_PERSISTENCE: activation remains incomplete until Stage2", () => {
        assert.equal(engine.state.stage.id, 1, "persistence check must occur before Stage Advance");
        assert.equal(activationWrites.length, 0, `FirstRun completion persisted too early: ${JSON.stringify(activationWrites)}`);
    });

    certify("TRIAL: canCompleteTrial", () => assert.equal(ui.canCompleteTrial(), true));
    requireSuccess(ui.completeTrial(), "completeTrial");
    certify("TRIAL: Trial completion reaches RESULT", () => {
        assert.equal(ui.isTrialCompleted(), true);
        assert.ok(ui.getTrialResult()?.completed);
    });

    const settled = requireSuccess(ui.settleCurrentTrialResult(), "settleCurrentTrialResult");
    certify("SETTLEMENT: TRIAL_RESULT_SETTLED creates Post-Trial transition", () => {
        assert.equal(settled.settlement?.settled, true);
        assert.ok(engine.state.postTrialTransition);
        assert.equal(engine.state.postTrialTransition.trialIndex, 1);
    });

    // Settlement exit adapter may have already released the Trial presentation.
    if (ui.trialPreviewConfig) requireSuccess(ui.handleSettledTrialExitReady(), "handleSettledTrialExitReady");
    certify("POST_TRIAL: Trial interaction/layout released", () => {
        assert.equal(Boolean(ui.trialPreviewConfig), false);
        assert.equal(ui.isTrialInteractionActive(), false);
    });

    // Respect the FirstRun interlude scene order. STAGE_PRELUDE opens the
    // canonical Stage gate through the presentation bridge.
    if (!engine.state.postTrialTransition?.presentation) {
        requireSuccess(ui.preparePostTrialInterlude(), "preparePostTrialInterlude");
    }
    let sceneGuard = 0;
    while (ui.postTrialInterludeProgressService?.getCurrentScene?.() && sceneGuard++ < 20) {
        const scene = ui.postTrialInterludeProgressService.getCurrentScene();
        requireSuccess(
            ui.postTrialInterludeProgressService.completeCurrentScene({ expectedSceneId: scene.id }),
            `completePostTrialScene:${scene.id}`
        );
    }
    certify("POST_TRIAL: Stage Advance applied -> Stage2 7x7", () => {
        assert.equal(engine.state.stage.id, 2);
        assert.equal(engine.state.stage.size, 7);
        assert.equal(engine.state.grid.length, 7);
        assert.equal(engine.state.grid.every(row => row.length === 7), true);
    });
    certify("STAGE2: normal progression resume gate open", () => {
        assert.equal(engine.postTrialProgressionReadService.read().canResumeNormalProgression, true);
        assert.equal(engine.trialSessionBoundaryService?.getState?.().active ?? false, false);
    });
}

// Restore coverage: the canonical pre-Trial restore points are exercised by the
// existing Stage1 flow test. Keep this end-to-end test focused on the completion
// path, but ensure those checkpoints remain present and runnable alongside it.
const existingFlow = fs.readFileSync(new URL("./test_first_run_stage1_flow.mjs", import.meta.url), "utf8");
certify("RESTORE: Verse7/Verse8/Verse9 checkpoints remain covered by canonical pre-Trial test", () => {
    assert.match(existingFlow, /restoreVerse\(7\)/);
    assert.match(existingFlow, /restoreVerse\(8\)/);
    assert.match(existingFlow, /restoreVerse\(9\)/);
    assert.match(existingFlow, /must not replay the Verse7 Global Event/);
});

unsubscribe();
console.log(`\nFirstRun Stage1 completion certification: PASS=${PASSES.length} FAIL=${FAILURES.length}`);
if (FAILURES.length > 0) {
    console.error("Certification failures:");
    for (const failure of FAILURES) console.error(`- ${failure.label}: ${failure.message}`);
    process.exitCode = 1;
} else {
    console.log("✅ FirstRun Stage1 Verse1 -> Trial1 -> Post-Trial -> Stage2 certification PASS");
}
