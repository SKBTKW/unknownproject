import assert from 'node:assert/strict';
import { GameEngine } from '../game/src/core/game_engine.js';
import { resolveCanonicalTerrainSemantic } from '../game/src/data/land_system.js';
import { resolveCardProductionPreview } from '../game/src/core/land_production_contract.js';
import { BoardAwareUIController as UIController } from '../game/src/ui/board_aware_ui_controller.js';
import { BoardGridComponent } from '../game/src/ui/board_grid_component.js';
import { TrialActionTrayComponent } from '../game/src/ui/trial_action_tray_component.js';
import { InterceptionPowerResolver } from '../game/src/trial/systems/interception_power_resolver.js';
import { I18n } from '../game/src/i18n.js';

const engine = GameEngine.createGame({ runSeed: 20261004, firstRun: true });
const state = engine.state;
const master = engine.deckManager.getLandCardMaster();
const granary = master.find(card => card.id === 'CMD_GRANARY');
assert.equal(engine.deckManager.offeringEligibility.evaluate(granary).reason, 'OFFERING_FROZEN');
assert.equal(engine.deckManager.isCardEligible(granary, 1, 0, { ignoreCooldown: true }), false);
assert.equal(engine.deckManager.offeringCandidatePool.build({ eligibilityOptions: { ignoreCooldown: true } }).some(c => c.id === granary.id), false);
const mixed = master.find(card => card.id === 'CARD_MULTI_PLAINS_FOREST_1X2');
assert.equal(engine.deckManager.isCardEligible(mixed, 1, 0, { ignoreCooldown: true }), false);
assert.equal(engine.deckManager.isCardEligible(mixed, 2, 0, { ignoreCooldown: true }), true);
assert.deepEqual(resolveCardProductionPreview(mixed).totalYields, { food: 6, wood: 2, defense: 2, mystic: 0 });

Object.assign(state.grid[1][1], { placed: true, terrain: { ...resolveCanonicalTerrainSemantic('GL1_PLAINS') } });
state.wood = state.material = 150;
const cultivation = master.find(card => card.id === 'CMD_CULTIVATION');
function farm(r, c) {
    state.handOffering = [cultivation]; state.hasPickedThisTurn = false;
    assert.equal(engine.playCommandCard(cultivation, { type: 'OFFERING', index: 0 }, { r, c }).success, true);
}
farm(1, 1); farm(1, 0);
assert.equal(engine.getCellViewData(1, 1).yields.food, 6);
assert.equal(engine.getCellViewData(1, 0).yields.food, 6);

class Element {
    constructor() {
        this.children = []; this.attributes = {}; this.style = { setProperty() {} };
        const values = new Set();
        this.classList = { add: (...xs) => xs.forEach(x => values.add(x)), contains: x => values.has(x), toggle() {}, remove() {} };
    }
    setAttribute(k, v) { this.attributes[k] = String(v); }
    getAttribute(k) { return this.attributes[k] ?? null; }
    appendChild(child) { this.children.push(child); return child; }
    querySelectorAll() { return []; }
    querySelector() { return null; }
}
const board = new Element();
const controls = new Map(['slider', 'increase', 'decrease', 'max', 'intercept', 'skip', 'clear'].map(k => [k, {}]));
const host = new Element();
host.querySelector = selector => controls.get(selector.match(/"([^"]+)"/)?.[1]) || null;
globalThis.document = { body: new Element(), getElementById: id => id === 'gridBoard' ? board : null,
    createElement: () => new Element(), querySelectorAll: () => [] };
let tooltip = null;
globalThis.window = { tooltipSystemInstance: { showCustom: (...args) => { tooltip = args; } } };
globalThis.I18n = I18n;
const ui = { state, engine, getBoardDisplayGrid: () => state.grid,
    onCellMouseEnter() {}, onCellMouseMove() {}, clearCellPreviews() {}, onCellClick() {},
    selectedCard: null, hideCellTooltip() {} };
const gridComponent = new BoardGridComponent(ui);
gridComponent.render(I18n);
for (const c of [0, 1]) {
    const cell = board.children.find(el => el.attributes['data-r'] === '1' && el.attributes['data-c'] === String(c));
    assert.equal(cell.classList.contains('cell-special-block'), true);
    assert.match(cell.innerHTML, /special-block-marker/);
    UIController.prototype.showBoardPresentationCellTooltip.call(ui, {}, 1, c, engine.getCellViewData(1, c));
    assert.match(tooltip[2], /FARM|農場|Farm/i);
    assert.match(tooltip[3], /🌾\+6/);
    assert.match(tooltip[3], /🌾\+20/);
}

let allocation = null;
const trayUi = {
    trialController: { state: {}, powerResolver: new InterceptionPowerResolver() },
    getTrialAvailableDefense: () => 23, getTrialRemainingDefense: () => 23, getTrialPlannedDefenseTotal: () => 0,
    getTrialPlanningRoutes: () => [], getActiveTrialRoute: () => ({ id: 'route' }),
    getFirstRunTrialTutorialPolicy: () => ({ allowDefenseInput: true }),
    trialPresentationState: { getMaxAllocationForRoute: () => 23, previewDefenseAllocation: 0,
        getRouteDecision: () => ({ status: 'UNDECIDED' }) },
    isTrialPlanningConfirmed: () => false,
    isTrialPlanActivated: () => false,
    setTrialDefenseAllocation: value => { allocation = value; },
    adjustTrialDefenseAllocation() {}
};
const tray = new TrialActionTrayComponent(trayUi);
tray.getHost = () => host; tray.isActive = () => true;
tray.render();
assert.match(host.innerHTML, /max="115" step="5" value="0"/);
controls.get('slider').oninput({ target: { value: '115' } });
assert.equal(allocation, 23, 'combat input must reserve strategic defense exactly once');
controls.get('max').onclick(); assert.equal(allocation, 23);
delete globalThis.document; delete globalThis.window;
console.log('PASS: frozen Offering/fallback, Stage2 mixed land, summed output, Farm rendering/tooltip, combat input scale');
