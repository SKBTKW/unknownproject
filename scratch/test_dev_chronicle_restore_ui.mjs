import assert from 'node:assert/strict';
import { GameEngine } from '../game/src/core/game_engine.js';
import { DevChronicleRestoreComponent } from '../game/src/ui/dev_chronicle_restore_component.js';
import { LayoutStateManager } from '../game/src/ui/layout_state_manager.js';
import { UIInteractionState } from '../game/src/ui/ui_interaction_state.js';
import { TrialRestoreBoundaryService } from '../game/src/core/trial_restore_boundary_service.js';
import { TrialPresentationState } from '../game/src/trial/presentation/trial_presentation_state.js';
import { boardCameraSystem } from '../game/src/ui/board_camera_system.js';
import { describeChronicleVerse } from '../game/src/ui/chronicle_verse_entries.js';
import { LogComponent } from '../game/src/ui/log_component.js';
import { I18n } from '../game/src/i18n.js';

class Element {
    constructor() {
        this.children = [];
        this.style = {};
        this.dataset = {};
        this.textContent = '';
        this.hidden = false;
        this.classList = { remove() {} };
    }
    appendChild(element) { this.children.push(element); return element; }
    replaceChildren(...children) { this.children = children; }
    setAttribute() {}
}
const body = new Element();
globalThis.document = {
    body,
    documentElement: new Element(),
    createElement: () => new Element(),
    getElementById: () => null,
    querySelector: () => null
};

let passed = 0;
function check(name, fn) { fn(); passed++; console.log(`  PASS: ${name}`); }
const t = (key, vars = {}) => Object.entries(vars).reduce((text, [k, v]) => text.replace(`{${k}}`, v), {
    DEV_CHRONICLE_RESTORE_CONFIRM: 'Restore Verse {verse}? Later history will be lost.',
    DEV_CHRONICLE_RESTORED: 'Requested {requested} / Restored {restored}'
}[key] || key);
function createEngine(seed) {
    const mockDocument = globalThis.document;
    delete globalThis.document;
    try { return GameEngine.createGame({ runSeed: seed }); }
    finally { globalThis.document = mockDocument; }
}

function setup() {
    const engine = createEngine(331);
    engine.nextTurn();
    engine.nextTurn();
    let renderCount = 0;
    let confirmCount = 0;
    let restoreCount = 0;
    let allowed = true;
    let prompt = '';
    const restore = engine.historyRestoreService.restoreVerse.bind(engine.historyRestoreService);
    engine.historyRestoreService.restoreVerse = (...args) => { restoreCount++; return restore(...args); };
    const ui = {
        engine,
        state: engine.state,
        interactionState: new UIInteractionState(),
        developmentTrialPreviewHarness: { session: null },
        trialPreviewConfig: null,
        trialController: { state: null },
        trialPresentationState: new TrialPresentationState(),
        layoutStateManager: new LayoutStateManager({ documentRef: document }),
        advisorDockComponent: { prepareRestoreView() { this.expanded = false; } },
        isMinimalMode: false,
        closeDirectiveModal() {}, hideCardActionHintPopover() {}, hideCellTooltip() {},
        render() { renderCount++; component.render(); }
    };
    const component = new DevChronicleRestoreComponent(ui, {
        devModeResolver: () => true,
        confirm: message => { prompt = message; confirmCount++; return allowed; },
        i18n: { t }
    });
    ui.devChronicleRestore = component;
    component.mount(new Element());
    component.open = true;
    component.render();
    return {
        engine, ui, component,
        get renderCount() { return renderCount; }, get confirmCount() { return confirmCount; },
        get restoreCount() { return restoreCount; }, get prompt() { return prompt; },
        cancel() { allowed = false; },
        replaceRestore(fn) { engine.historyRestoreService.restoreVerse = fn; }
    };
}

check('dev flag gates mounting and normal Chronicle remains separate', () => {
    const engine = createEngine(90);
    const component = new DevChronicleRestoreComponent({ engine }, { devModeResolver: () => false, i18n: { t } });
    component.mount(new Element());
    assert.equal(component.root, null);
});

check('Verse entry action confirms and calls core with its requested Verse', () => {
    const f = setup();
    assert.deepEqual(f.component.list.children.map(entry => Number(entry.dataset.verse)), [1, 2, 3]);
    f.component.list.children[1].children[2].onclick();
    assert.equal(f.restoreCount, 1);
    assert.equal(f.engine.state.turn, 2);
    assert.match(f.prompt, /2/);
    assert.equal(f.renderCount, 1);
});

check('cancel never calls restore or render', () => {
    const f = setup();
    f.cancel();
    f.component.list.children[0].children[2].onclick();
    assert.equal(f.confirmCount, 1);
    assert.equal(f.restoreCount, 0);
    assert.equal(f.renderCount, 0);
});

check('Verse 1 is same run, not a new engine; future Chronicle entries vanish', () => {
    const f = setup();
    const originalEngine = f.engine;
    const oldState = f.engine.state;
    f.component.list.children[0].children[2].onclick();
    assert.equal(f.engine, originalEngine);
    assert.equal(f.engine.state, oldState);
    assert.equal(f.engine.state.turn, 1);
    assert.deepEqual(f.component.list.children.map(entry => Number(entry.dataset.verse)), [1]);
    assert.deepEqual(f.engine.chronicleSystem.getAllEvents(), []);
    assert.equal(f.renderCount, 1);
});

check('core failure and thrown error show failure without render', () => {
    const f = setup();
    const oldError = console.error;
    console.error = () => {};
    try {
        f.replaceRestore(() => ({ success: false, reason: 'TEST_FAILURE' }));
        f.component.list.children[1].children[2].onclick();
        assert.equal(f.renderCount, 0);
        assert.match(f.component.status.textContent, /FAILED/);
        f.replaceRestore(() => { throw new Error('TEST_EXCEPTION'); });
        f.component.list.children[0].children[2].onclick();
        assert.equal(f.renderCount, 0);
    } finally { console.error = oldError; }
});

check('Trial restore maps to start and clears all transient UI without extra render', () => {
    const f = setup();
    f.engine.trialRestoreBoundaryService = new TrialRestoreBoundaryService(f.engine);
    f.engine.trialRestoreBoundaryService.begin(1);
    f.ui.layoutStateManager.enterTrial();
    f.ui.trialPreviewConfig = { active: true };
    f.ui.developmentTrialPreviewHarness.session = { displayGrid: [['STALE']] };
    f.ui.trialController.state = { battleQueue: ['FUTURE'], currentBattleIndex: 1 };
    f.ui.trialPresentationState.selectedInterceptCell = { r: 2, c: 2 };
    f.ui.trialPresentationState.routePlanDrafts.set('route', { defense: 9 });
    f.ui.trialPresentationState.currentBattleStep = { id: 'FUTURE' };
    f.ui.trialPresentationState.highlightedCells = [{ r: 0, c: 0 }];
    f.ui.interactionState.selectOffering(0, f.engine.state.handOffering[0]);
    f.ui.interactionState.pinnedPreviewCard = { id: 'STALE' };
    f.ui.interactionState.isReservePopoverOpen = true;
    f.ui.advisorDockComponent.expanded = true;
    const camera = [boardCameraSystem.currentZoom, boardCameraSystem.panX, boardCameraSystem.panY];
    const result = f.component.list.children[2].children[2].onclick();
    // Action handler calls controller; inspect resulting state and status rather than button return.
    assert.equal(result.success, true);
    assert.equal(f.engine.state.turn, 1);
    assert.match(f.component.status.textContent, /requested.*3.*restored.*1/i);
    assert.equal(f.engine.trialRestoreBoundaryService.isActive(), false);
    assert.equal(f.ui.trialPreviewConfig, null);
    assert.equal(f.ui.developmentTrialPreviewHarness.session, null);
    assert.equal(f.ui.trialController.state, null);
    assert.equal(f.ui.trialPresentationState.selectedInterceptCell, null);
    assert.equal(f.ui.trialPresentationState.routePlanDrafts.size, 0);
    assert.equal(f.ui.trialPresentationState.currentBattleStep, null);
    assert.deepEqual(f.ui.trialPresentationState.highlightedCells, []);
    assert.equal(f.ui.interactionState.selectedCardIdx, -1);
    assert.equal(f.ui.interactionState.selectedReserveIdx, -1);
    assert.equal(f.ui.interactionState.pinnedPreviewCard, null);
    assert.equal(f.ui.interactionState.isReservePopoverOpen, false);
    assert.equal(f.ui.advisorDockComponent.expanded, false);
    assert.equal(f.ui.layoutStateManager.getState(), 'normal');
    assert.equal(document.body.dataset.contextOwner, 'none');
    assert.deepEqual([boardCameraSystem.currentZoom, boardCameraSystem.panX, boardCameraSystem.panY], camera);
    assert.equal(f.renderCount, 1);
    assert.deepEqual(f.component.list.children.map(entry => Number(entry.dataset.verse)), [1]);
});

check('Chronicle titles select observed historic over major/minor without creating new events', () => {
    const point = { verse: 4, sourceCompletedTurn: 3, gameState: { stage: { id: 1 } }, chronicle: [
        { turn: 3, type: 'EVENT', nameKey: 'minor', importance: 'MINOR' },
        { turn: 3, type: 'EVENT', nameKey: 'major', importance: 'MAJOR' },
        { turn: 3, type: 'EVENT', nameKey: 'historic', importance: 'HISTORIC' },
        { turn: 2, type: 'EVENT', nameKey: 'future-unrelated', importance: 'HISTORIC' }
    ] };
    const entry = describeChronicleVerse(point, null, { t: key => key });
    assert.equal(entry.title, 'historic');
    assert.equal(entry.importance, 'HISTORIC');
    assert.equal(entry.events.length, 3);
    assert.equal(point.chronicle.length, 4);
});

check('Verse 1 and stage/Trial boundaries use observed metadata, not invented Chronicle records', () => {
    const i18n = { t: (key, vars = {}) => `${key}:${Object.values(vars).join(',')}` };
    const origin = { verse: 1, gameState: { stage: { id: 1 } }, chronicle: [] };
    const stage = { verse: 2, gameState: { stage: { id: 2 } }, chronicle: [] };
    const trial = { verse: 15, gameState: { stage: { id: 2 }, trialSchedule: { trial1: 15 } }, chronicle: [] };
    assert.match(describeChronicleVerse(origin, null, i18n).title, /ORIGIN/);
    assert.equal(describeChronicleVerse(stage, origin, i18n).importance, 'MAJOR');
    assert.equal(describeChronicleVerse(trial, stage, i18n).importance, 'HISTORIC');
    assert.equal(describeChronicleVerse(trial, stage, i18n).trialStart, true);
});

check('Verse reading opens details but not restore; restore remains a separate secondary action', () => {
    const f = setup();
    const row = f.component.list.children[1];
    assert.equal(row.dataset.importance, 'MINOR');
    row.children[0].onclick();
    assert.equal(f.restoreCount, 0);
    assert.equal(f.confirmCount, 0);
    assert.equal(f.component.selectedVerse, 2);
    assert.equal(f.component.list.children.length, 4);
    assert.equal(f.component.list.children[2].className, 'dev-chronicle-expanded');
    f.component.list.children[1].children[2].onclick();
    assert.equal(f.restoreCount, 1);
});

check('confirmation explains branch loss and Trial mapping before the core restore', () => {
    const f = setup();
    f.engine.trialRestoreBoundaryService = new TrialRestoreBoundaryService(f.engine);
    f.engine.trialRestoreBoundaryService.begin(1);
    f.component.controller.i18n = I18n;
    f.cancel();
    f.component.list.children[2].children[2].onclick();
    assert.match(f.prompt, /第3節/);
    assert.match(f.prompt, /第1節の試練開始時点/);
    assert.match(f.prompt, /復元先の第1節より後の記録/);
    assert.match(f.prompt, /未来は分岐/);
    assert.equal(f.restoreCount, 0);
});

check('Verse 1 confirmation describes same-run history, never a new run or restart', () => {
    const f = setup();
    f.component.i18n = I18n;
    f.component.controller.i18n = I18n;
    f.cancel();
    f.component.list.children[0].children[2].onclick();
    assert.match(f.prompt, /同じ世界のはじまり/);
    assert.doesNotMatch(f.prompt, /New Run|Restart|最初からやり直す/);
});

check('restore point restores Advisor records and operation log without future messages', () => {
    const f = setup();
    const point = f.engine.historySnapshotService.getRestorePoint(2);
    assert.deepEqual(point.runtime.gameLogs, f.engine.historySnapshotService.getRestorePoint(2).runtime.gameLogs);
    f.engine.state.addLog('FUTURE_ONLY_LOG');
    assert.ok(f.engine.state.gameLogs.includes('FUTURE_ONLY_LOG'));
    f.component.list.children[1].children[2].onclick();
    assert.deepEqual(f.engine.state.gameLogs, point.runtime.gameLogs);
    assert.deepEqual(LogComponent.logs.map(log => log.message), point.runtime.gameLogs);
    assert.equal(f.renderCount, 1);
});

console.log(`Dev Chronicle Restore UI: ${passed}/${passed} PASS`);
