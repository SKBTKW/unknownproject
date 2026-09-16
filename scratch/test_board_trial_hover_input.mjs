import assert from 'node:assert/strict';
import { BoardPresentationState } from '../game/src/presentation/board_presentation_state.js';
import {
    BOARD_INPUT_COMMANDS,
    createBoardInputCommand
} from '../game/src/presentation/board_input_contract.js';
import { BoardInputDispatcher } from '../game/src/presentation/board_input_dispatcher.js';

const presentationState = new BoardPresentationState({
    selectedCell: { r: 1, c: 1 },
    hoveredCell: { r: 2, c: 2 },
    focusCell: { r: 3, c: 3 }
});

const seen = [];
const dispatcher = new BoardInputDispatcher({
    presentationState,
    handlers: {
        hoverTrialInterception: payload => {
            seen.push({ type: 'hover', payload });
            return { success: true };
        },
        clearTrialHover: () => {
            seen.push({ type: 'clear' });
            return { success: true };
        }
    }
});

const before = presentationState.snapshot();

dispatcher.dispatch(createBoardInputCommand(
    BOARD_INPUT_COMMANDS.HOVER_TRIAL_INTERCEPTION,
    { routeId: 'route:a', cell: { r: 4, c: 1 } }
));

dispatcher.dispatch(createBoardInputCommand(
    BOARD_INPUT_COMMANDS.CLEAR_TRIAL_HOVER
));

assert.deepEqual(seen, [
    { type: 'hover', payload: { routeId: 'route:a', cell: { r: 4, c: 1 } } },
    { type: 'clear' }
]);
assert.deepEqual(presentationState.snapshot(), before);

console.log('board trial hover input contract ok');
