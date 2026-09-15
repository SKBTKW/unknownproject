import assert from 'node:assert/strict';
import { BoardPresentationState } from '../game/src/presentation/board_presentation_state.js';
import {
    BOARD_CAMERA_INTENTS,
    createBoardCameraIntent
} from '../game/src/presentation/board_camera_intent_contract.js';
import { BoardCameraIntentDispatcher } from '../game/src/presentation/board_camera_intent_dispatcher.js';

const state = new BoardPresentationState();
const seen = [];
const dispatcher = new BoardCameraIntentDispatcher({
    presentationState: state,
    onIntent: intent => seen.push(intent.type)
});

dispatcher.dispatch(createBoardCameraIntent(
    BOARD_CAMERA_INTENTS.FOCUS_CELL,
    { cell: { r: 2, c: 3 } }
));
assert.deepEqual(state.focusCell, { r: 2, c: 3 });

state.setViewMode('2_5D');
assert.deepEqual(state.focusCell, { r: 2, c: 3 });

dispatcher.dispatch(createBoardCameraIntent(
    BOARD_CAMERA_INTENTS.FOCUS_BLOCK,
    { blockId: 'b1', cells: [{ r: 1, c: 1 }, { r: 1, c: 2 }] }
));
assert.deepEqual(state.focusCell, { r: 1, c: 1 });

dispatcher.dispatch(createBoardCameraIntent(BOARD_CAMERA_INTENTS.RESET));
assert.equal(state.focusCell, null);
assert.deepEqual(seen, ['FOCUS_CELL', 'FOCUS_BLOCK', 'RESET']);

console.log('board camera intent contract ok');
