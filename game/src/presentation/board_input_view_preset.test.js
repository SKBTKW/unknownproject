import test from 'node:test';
import assert from 'node:assert/strict';
import { BOARD_INPUT_COMMANDS, createBoardInputCommand, parseBoardInputCommand, serializeBoardInputCommand } from './board_input_contract.js';
import { BoardInputDispatcher } from './board_input_dispatcher.js';
import { BOARD_CONTEXT_MODES, BOARD_VIEW_MODES, BOARD_VIEW_PRESETS, BoardPresentationState } from './board_presentation_state.js';

test('SET_VIEW_PRESET serializes and parses renderer-neutral payload', () => {
    const command = createBoardInputCommand(BOARD_INPUT_COMMANDS.SET_VIEW_PRESET, { viewPreset: BOARD_VIEW_PRESETS.TACTICAL });
    assert.deepEqual(command.payload, { viewPreset: BOARD_VIEW_PRESETS.TACTICAL });
    assert.deepEqual(parseBoardInputCommand(serializeBoardInputCommand(command)), command);
    assert.equal('screenX' in command.payload, false);
    assert.equal('worldX' in command.payload, false);
});

test('SET_VIEW_PRESET rejects unknown preset', () => {
    assert.throws(
        () => createBoardInputCommand(BOARD_INPUT_COMMANDS.SET_VIEW_PRESET, { viewPreset: 'DEBUG' }),
        /INVALID_BOARD_VIEW_PRESET:DEBUG/
    );
});

test('dispatcher changes only viewPreset and preserves other presentation axes/state', () => {
    const state = new BoardPresentationState({
        viewMode: BOARD_VIEW_MODES.TWO_POINT_FIVE_D,
        contextMode: BOARD_CONTEXT_MODES.TRIAL,
        viewPreset: BOARD_VIEW_PRESETS.WORLD,
        selectedCell: { r: 1, c: 2 },
        hoveredCell: { r: 2, c: 3 },
        focusCell: { r: 3, c: 4 }
    });
    const dispatcher = new BoardInputDispatcher({ presentationState: state });
    const result = dispatcher.dispatch(createBoardInputCommand(
        BOARD_INPUT_COMMANDS.SET_VIEW_PRESET,
        { viewPreset: BOARD_VIEW_PRESETS.DATA }
    ));
    assert.equal(result.success, true);
    assert.deepEqual(state.snapshot(), {
        viewMode: BOARD_VIEW_MODES.TWO_POINT_FIVE_D,
        contextMode: BOARD_CONTEXT_MODES.TRIAL,
        viewPreset: BOARD_VIEW_PRESETS.DATA,
        selectedCell: { r: 1, c: 2 },
        hoveredCell: { r: 2, c: 3 },
        focusCell: { r: 3, c: 4 }
    });
});

test('all declared presets are accepted through BoardInputContract', () => {
    for (const viewPreset of Object.values(BOARD_VIEW_PRESETS)) {
        const command = createBoardInputCommand(BOARD_INPUT_COMMANDS.SET_VIEW_PRESET, { viewPreset });
        assert.equal(command.payload.viewPreset, viewPreset);
    }
});
