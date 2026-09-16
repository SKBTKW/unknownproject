export const TUTORIAL_TARGET_TYPES = Object.freeze({
    BOARD_CELL: 'BOARD_CELL',
    BOARD_BLOCK: 'BOARD_BLOCK',
    HAND: 'HAND',
    HAND_CARD: 'HAND_CARD',
    ADVISOR: 'ADVISOR',
    ADVISOR_ACTION: 'ADVISOR_ACTION',
    TRIAL_ROUTE: 'TRIAL_ROUTE',
    TRIAL_INTERCEPTION: 'TRIAL_INTERCEPTION',
    UI_CONTROL: 'UI_CONTROL'
});

function freezeCell(cell) {
    if (!cell || !Number.isInteger(cell.r) || !Number.isInteger(cell.c)) return null;
    return Object.freeze({ r: cell.r, c: cell.c });
}

function freezeCells(cells) {
    return Object.freeze((cells || []).map(freezeCell).filter(Boolean));
}

/**
 * Renderer-neutral tutorial target reference.
 *
 * Tutorial logic may point at semantic board/UI targets only. It must never
 * persist DOM nodes, pixels, zoom values or 2.5D projected coordinates.
 */
export function createTutorialTargetRef(type, payload = {}) {
    if (!Object.values(TUTORIAL_TARGET_TYPES).includes(type)) {
        throw new Error(`INVALID_TUTORIAL_TARGET_TYPE:${type}`);
    }

    switch (type) {
        case TUTORIAL_TARGET_TYPES.BOARD_CELL: {
            const cell = freezeCell(payload.cell);
            if (!cell) throw new Error('TUTORIAL_BOARD_CELL_REQUIRED');
            return Object.freeze({ type, cell });
        }
        case TUTORIAL_TARGET_TYPES.BOARD_BLOCK: {
            const cells = freezeCells(payload.cells);
            if (cells.length === 0) throw new Error('TUTORIAL_BOARD_BLOCK_CELLS_REQUIRED');
            return Object.freeze({ type, blockId: payload.blockId ?? null, cells });
        }
        case TUTORIAL_TARGET_TYPES.TRIAL_INTERCEPTION: {
            const cell = freezeCell(payload.cell);
            if (!cell) throw new Error('TUTORIAL_TRIAL_INTERCEPTION_CELL_REQUIRED');
            return Object.freeze({ type, routeId: payload.routeId ?? null, cell });
        }
        case TUTORIAL_TARGET_TYPES.TRIAL_ROUTE:
            if (payload.routeId == null) throw new Error('TUTORIAL_TRIAL_ROUTE_ID_REQUIRED');
            return Object.freeze({ type, routeId: payload.routeId });
        case TUTORIAL_TARGET_TYPES.HAND:
        case TUTORIAL_TARGET_TYPES.ADVISOR:
            return Object.freeze({ type });
        case TUTORIAL_TARGET_TYPES.HAND_CARD:
            if (payload.cardId == null && payload.slot == null) throw new Error('TUTORIAL_HAND_CARD_ID_OR_SLOT_REQUIRED');
            return Object.freeze({ type, cardId: payload.cardId ?? null, slot: payload.slot ?? null });
        case TUTORIAL_TARGET_TYPES.ADVISOR_ACTION:
            if (!payload.actionId) throw new Error('TUTORIAL_ADVISOR_ACTION_ID_REQUIRED');
            return Object.freeze({ type, actionId: payload.actionId });
        case TUTORIAL_TARGET_TYPES.UI_CONTROL:
            if (!payload.controlId) throw new Error('TUTORIAL_UI_CONTROL_ID_REQUIRED');
            return Object.freeze({ type, controlId: payload.controlId });
        default:
            throw new Error(`UNSUPPORTED_TUTORIAL_TARGET_TYPE:${type}`);
    }
}

export default TUTORIAL_TARGET_TYPES;
