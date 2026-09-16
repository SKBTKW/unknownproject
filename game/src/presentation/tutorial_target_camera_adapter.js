import {
    BOARD_CAMERA_INTENTS,
    createBoardCameraIntent
} from './board_camera_intent_contract.js';
import { TUTORIAL_TARGET_TYPES } from './tutorial_target_ref.js';

/**
 * Converts semantic tutorial targets into semantic board-camera intents.
 * Non-board UI targets deliberately return null; their highlighting remains
 * owned by HUD/advisor presentation adapters rather than the board camera.
 */
export function tutorialTargetToCameraIntent(target) {
    if (!target?.type) return null;

    switch (target.type) {
        case TUTORIAL_TARGET_TYPES.BOARD_CELL:
            return createBoardCameraIntent(
                BOARD_CAMERA_INTENTS.FOCUS_CELL,
                { cell: target.cell }
            );
        case TUTORIAL_TARGET_TYPES.BOARD_BLOCK:
            return createBoardCameraIntent(
                BOARD_CAMERA_INTENTS.FOCUS_BLOCK,
                { blockId: target.blockId, cells: target.cells }
            );
        case TUTORIAL_TARGET_TYPES.TRIAL_INTERCEPTION:
            return createBoardCameraIntent(
                BOARD_CAMERA_INTENTS.FOCUS_CELL,
                { cell: target.cell }
            );
        default:
            return null;
    }
}

export default tutorialTargetToCameraIntent;
