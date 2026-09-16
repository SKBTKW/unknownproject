import assert from 'node:assert/strict';
import { BoardPresentationState } from '../game/src/presentation/board_presentation_state.js';
import { BoardRendererBridge } from '../game/src/presentation/board_renderer_bridge.js';
import {
    BOARD_INPUT_COMMANDS,
    createBoardInputCommand
} from '../game/src/presentation/board_input_contract.js';

const presentationState = new BoardPresentationState();
const activated = [];
const bridge = new BoardRendererBridge({
    presentationState,
    inputHandlers: {
        selectCell: ({ cell }) => {
            activated.push(cell);
            return true;
        }
    }
});

const result = bridge.dispatch(createBoardInputCommand(
    BOARD_INPUT_COMMANDS.SELECT_CELL,
    { cell: { r: 2, c: 3 } }
));

assert.equal(result.success, true);
assert.deepEqual(presentationState.selectedCell, { r: 2, c: 3 });
assert.deepEqual(activated, [{ r: 2, c: 3 }]);

const presentationOnlyState = new BoardPresentationState();
const presentationOnlyBridge = new BoardRendererBridge({
    presentationState: presentationOnlyState
});
const presentationOnlyResult = presentationOnlyBridge.dispatch(createBoardInputCommand(
    BOARD_INPUT_COMMANDS.SELECT_CELL,
    { cell: { r: 1, c: 1 } }
));
assert.equal(presentationOnlyResult.success, true);
assert.deepEqual(presentationOnlyState.selectedCell, { r: 1, c: 1 });

console.log('WEB25D_BOARD_ACTION_GATEWAY_VALIDATION_OK');
