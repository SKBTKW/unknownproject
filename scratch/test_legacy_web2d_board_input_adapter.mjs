import assert from 'node:assert/strict';
import {
    BOARD_INPUT_COMMANDS,
    createBoardInputCommand
} from '../game/src/presentation/board_input_contract.js';
import { LegacyWeb2DBoardInputAdapter } from '../game/src/ui/legacy_web2d_board_input_adapter.js';

let passed = 0;
function test(name, fn) {
    fn();
    passed++;
    console.log(`  ✅ ${name}`);
}

console.log('🧭 Legacy Web 2D board input adapter tests');

function createUiStub({ trialActive = false, activeRouteId = 'route-a' } = {}) {
    const calls = [];
    const ui = {
        calls,
        trialPresentationState: {
            clearHoveredCell() { calls.push(['clearHoveredCell']); }
        },
        isTrialInteractionActive() { return trialActive; },
        getActiveTrialRoute() { return trialActive ? { id: activeRouteId } : null; },
        onCellClick(r, c) { calls.push(['onCellClick', r, c]); return { accepted: true }; },
        selectTrialInterceptionCell(r, c) { calls.push(['selectTrialInterceptionCell', r, c]); return true; },
        updateTrialInterceptionPreview(r, c) { calls.push(['updateTrialInterceptionPreview', r, c]); return { r, c }; },
        refreshTrialInterceptionPreview() { calls.push(['refreshTrialInterceptionPreview']); return { refreshed: true }; }
    };
    return ui;
}

test('normal SELECT_CELL delegates logical cell only to legacy UI entry point', () => {
    const ui = createUiStub();
    const adapter = new LegacyWeb2DBoardInputAdapter(ui);
    const command = createBoardInputCommand(BOARD_INPUT_COMMANDS.SELECT_CELL, { cell: { r: 2, c: 3 } });
    const result = adapter.dispatch(command);

    assert.equal(result.success, true);
    assert.deepEqual(ui.calls, [['onCellClick', 2, 3]]);
});

test('SELECT_CELL is rejected during Trial so renderer must emit Trial command explicitly', () => {
    const ui = createUiStub({ trialActive: true });
    const adapter = new LegacyWeb2DBoardInputAdapter(ui);
    const command = createBoardInputCommand(BOARD_INPUT_COMMANDS.SELECT_CELL, { cell: { r: 1, c: 1 } });
    const result = adapter.dispatch(command);

    assert.deepEqual(result, {
        success: false,
        type: BOARD_INPUT_COMMANDS.SELECT_CELL,
        reason: 'TRIAL_INPUT_REQUIRES_TRIAL_COMMAND'
    });
    assert.deepEqual(ui.calls, []);
});

test('Trial interception command validates active route and delegates logical cell', () => {
    const ui = createUiStub({ trialActive: true, activeRouteId: 'route-a' });
    const adapter = new LegacyWeb2DBoardInputAdapter(ui);
    const command = createBoardInputCommand(BOARD_INPUT_COMMANDS.SELECT_TRIAL_INTERCEPTION, {
        routeId: 'route-a',
        cell: { r: 4, c: 0 }
    });
    const result = adapter.dispatch(command);

    assert.equal(result.success, true);
    assert.deepEqual(ui.calls, [['selectTrialInterceptionCell', 4, 0]]);
});

test('Trial command never silently switches to a different route', () => {
    const ui = createUiStub({ trialActive: true, activeRouteId: 'route-a' });
    const adapter = new LegacyWeb2DBoardInputAdapter(ui);
    const command = createBoardInputCommand(BOARD_INPUT_COMMANDS.SELECT_TRIAL_INTERCEPTION, {
        routeId: 'route-b',
        cell: { r: 0, c: 0 }
    });
    const result = adapter.dispatch(command);

    assert.equal(result.success, false);
    assert.equal(result.reason, 'TRIAL_ROUTE_NOT_ACTIVE');
    assert.deepEqual(ui.calls, []);
});

test('Trial hover and clear remain command-driven without DOM events', () => {
    const ui = createUiStub({ trialActive: true, activeRouteId: 'route-a' });
    const adapter = new LegacyWeb2DBoardInputAdapter(ui);

    const hover = adapter.dispatch(createBoardInputCommand(
        BOARD_INPUT_COMMANDS.HOVER_TRIAL_INTERCEPTION,
        { routeId: 'route-a', cell: { r: 3, c: 2 } }
    ));
    assert.equal(hover.success, true);

    const clear = adapter.dispatch(createBoardInputCommand(BOARD_INPUT_COMMANDS.CLEAR_TRIAL_HOVER));
    assert.equal(clear.success, true);
    assert.deepEqual(ui.calls, [
        ['updateTrialInterceptionPreview', 3, 2],
        ['clearHoveredCell'],
        ['refreshTrialInterceptionPreview']
    ]);
});

test('adapter rejects renderer-independent commands it does not own', () => {
    const ui = createUiStub();
    const adapter = new LegacyWeb2DBoardInputAdapter(ui);
    const result = adapter.dispatch(createBoardInputCommand(BOARD_INPUT_COMMANDS.CLEAR_SELECTION));

    assert.equal(result.success, false);
    assert.equal(result.reason, 'LEGACY_WEB2D_INPUT_UNSUPPORTED');
});

console.log(`\n✅ Legacy Web 2D board input adapter: ${passed}/${passed} tests passed`);
