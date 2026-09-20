import {
    BOARD_INPUT_COMMANDS,
    createBoardInputCommand
} from './board_input_contract.js';
import { BOARD_CONTEXT_MODES } from './board_presentation_state.js';

export const BOARD_POINTER_ACTIONS = Object.freeze({
    CLICK: 'CLICK',
    HOVER: 'HOVER',
    LEAVE: 'LEAVE'
});

function isTrialContext(readModel) {
    return readModel?.presentation?.contextMode === BOARD_CONTEXT_MODES.TRIAL;
}

function getReadCell(readModel, cell) {
    if (!cell) return null;
    return readModel?.cells?.[cell.r]?.[cell.c] || null;
}

function getTrialRouteId(readModel, readCell) {
    return readCell?.trial?.route?.routeId
        || readModel?.trial?.activeRouteId
        || null;
}

function canIntercept(readCell) {
    return readCell?.trial?.interceptionCandidate?.canIntercept === true;
}

/**
 * Resolve renderer-neutral pointer intent into a portable BoardInputCommand.
 *
 * The caller owns hit-testing and renderer-local feedback. This resolver owns
 * only semantic command choice from logical {r,c} + BoardPresentationData.
 */
export function resolveBoardPointerCommand(action, {
    readModel = null,
    cell = null
} = {}) {
    const trialContext = isTrialContext(readModel);

    if (action === BOARD_POINTER_ACTIONS.LEAVE) {
        return createBoardInputCommand(
            trialContext
                ? BOARD_INPUT_COMMANDS.CLEAR_TRIAL_HOVER
                : BOARD_INPUT_COMMANDS.CLEAR_HOVER
        );
    }

    if (action === BOARD_POINTER_ACTIONS.HOVER) {
        if (!trialContext) {
            return cell
                ? createBoardInputCommand(BOARD_INPUT_COMMANDS.HOVER_CELL, { cell })
                : createBoardInputCommand(BOARD_INPUT_COMMANDS.CLEAR_HOVER);
        }

        const readCell = getReadCell(readModel, cell);
        const routeId = getTrialRouteId(readModel, readCell);
        if (!cell || !canIntercept(readCell) || !routeId) {
            return createBoardInputCommand(BOARD_INPUT_COMMANDS.CLEAR_TRIAL_HOVER);
        }
        return createBoardInputCommand(
            BOARD_INPUT_COMMANDS.HOVER_TRIAL_INTERCEPTION,
            { cell, routeId }
        );
    }

    if (action === BOARD_POINTER_ACTIONS.CLICK) {
        if (!cell) return null;
        if (!trialContext) {
            return createBoardInputCommand(BOARD_INPUT_COMMANDS.SELECT_CELL, { cell });
        }

        const readCell = getReadCell(readModel, cell);
        const routeId = getTrialRouteId(readModel, readCell);
        if (!canIntercept(readCell) || !routeId) return null;
        return createBoardInputCommand(
            BOARD_INPUT_COMMANDS.SELECT_TRIAL_INTERCEPTION,
            { cell, routeId }
        );
    }

    throw new Error(`UNKNOWN_BOARD_POINTER_ACTION:${action}`);
}

export default resolveBoardPointerCommand;
