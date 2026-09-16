import { BOARD_CAMERA_INTENTS } from './board_camera_intent_contract.js';

/**
 * Renderer-neutral camera intent dispatcher.
 *
 * It owns only logical focus semantics. Renderer-specific camera adapters may
 * subscribe through onIntent and translate the same intent into DOM pixels,
 * canvas projection offsets, or Unity camera motion.
 */
export class BoardCameraIntentDispatcher {
    constructor({ presentationState, onIntent = null } = {}) {
        if (!presentationState || typeof presentationState.focusOnCell !== 'function') {
            throw new Error('BOARD_PRESENTATION_STATE_REQUIRED');
        }
        this.presentationState = presentationState;
        this.onIntent = typeof onIntent === 'function' ? onIntent : null;
    }

    dispatch(intent) {
        if (!intent?.type) throw new Error('BOARD_CAMERA_INTENT_REQUIRED');

        switch (intent.type) {
            case BOARD_CAMERA_INTENTS.FOCUS_CELL:
                this.presentationState.focusOnCell(intent.cell);
                break;
            case BOARD_CAMERA_INTENTS.FOCUS_BLOCK:
                this.presentationState.focusOnCell(intent.cells[0]);
                break;
            case BOARD_CAMERA_INTENTS.CLEAR_FOCUS:
                this.presentationState.clearFocus();
                break;
            case BOARD_CAMERA_INTENTS.RESET:
                this.presentationState.clearFocus();
                break;
            default:
                throw new Error(`UNSUPPORTED_BOARD_CAMERA_INTENT:${intent.type}`);
        }

        const snapshot = this.presentationState.snapshot();
        this.onIntent?.(intent, snapshot);
        return snapshot;
    }
}

export default BoardCameraIntentDispatcher;
