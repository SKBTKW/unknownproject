import { normalizeBoardCell } from './board_presentation_state.js';

export const BOARD_CAMERA_INTENTS = Object.freeze({
    FOCUS_CELL: 'FOCUS_CELL',
    FOCUS_BLOCK: 'FOCUS_BLOCK',
    CLEAR_FOCUS: 'CLEAR_FOCUS',
    RESET: 'RESET'
});

function freezeCells(cells) {
    return Object.freeze((cells || [])
        .map(normalizeBoardCell)
        .filter(Boolean));
}

export function createBoardCameraIntent(type, payload = {}) {
    if (!Object.values(BOARD_CAMERA_INTENTS).includes(type)) {
        throw new Error(`INVALID_BOARD_CAMERA_INTENT:${type}`);
    }

    switch (type) {
        case BOARD_CAMERA_INTENTS.FOCUS_CELL: {
            const cell = normalizeBoardCell(payload.cell);
            if (!cell) throw new Error('BOARD_CAMERA_FOCUS_CELL_REQUIRED');
            return Object.freeze({ type, cell });
        }
        case BOARD_CAMERA_INTENTS.FOCUS_BLOCK: {
            const cells = freezeCells(payload.cells);
            if (cells.length === 0) throw new Error('BOARD_CAMERA_FOCUS_BLOCK_CELLS_REQUIRED');
            return Object.freeze({
                type,
                blockId: payload.blockId ?? null,
                cells
            });
        }
        case BOARD_CAMERA_INTENTS.CLEAR_FOCUS:
        case BOARD_CAMERA_INTENTS.RESET:
            return Object.freeze({ type });
        default:
            throw new Error(`UNSUPPORTED_BOARD_CAMERA_INTENT:${type}`);
    }
}

export default BOARD_CAMERA_INTENTS;
