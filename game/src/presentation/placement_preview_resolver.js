import { resolvePlacementGeometry } from '../core/placement_geometry.js';

function getBoardSize(gameState) {
    if (gameState?.stage?.size) return Number(gameState.stage.size);
    if (Array.isArray(gameState?.grid)) return gameState.grid.length;
    return 5;
}

function normalizeCheck(check) {
    if (check && typeof check === 'object') {
        const reasons = Array.isArray(check.reasons)
            ? check.reasons.slice()
            : (check.reason ? [check.reason] : []);
        return Object.freeze({
            can: Boolean(check.can),
            reasons: Object.freeze(reasons)
        });
    }
    return Object.freeze({ can: check === true, reasons: Object.freeze([]) });
}

function freezeCell(cell) {
    return Object.freeze({ r: cell.r, c: cell.c });
}

function freezePlacement(placement) {
    return Object.freeze({
        startR: placement.startR,
        startC: placement.startC,
        shape: placement.shape,
        cells: Object.freeze((placement.cells || []).map(freezeCell))
    });
}

/**
 * Renderer-neutral placement preview resolver.
 *
 * This module does not own placement rules. It asks the existing GameState
 * placement API for the verdict, then converts the result into logical board
 * coordinates that can be consumed by either the 2D DOM adapter or the 2.5D
 * renderer.
 */
export class PlacementPreviewResolver {
    resolveAnchor(card, gameState, r, c) {
        if (!card || !gameState) return null;
        const terrain = card.terrain || card;
        const placement = resolvePlacementGeometry(card, r, c);
        const rawCheck = typeof gameState.canPlaceShape === 'function'
            ? gameState.canPlaceShape(placement.startR, placement.startC, placement.shape, terrain)
            : gameState.gridEngine?.canPlaceShape?.(
                placement.startR,
                placement.startC,
                placement.shape,
                terrain
            );
        const check = normalizeCheck(rawCheck);

        return Object.freeze({
            anchor: Object.freeze({ r, c }),
            placement: freezePlacement(placement),
            valid: check.can,
            reasons: check.reasons
        });
    }

    resolveCandidates(card, gameState) {
        if (!card || !gameState || gameState.hasPickedThisTurn) return Object.freeze([]);
        const size = getBoardSize(gameState);
        const candidates = [];
        for (let r = 0; r < size; r++) {
            for (let c = 0; c < size; c++) {
                const result = this.resolveAnchor(card, gameState, r, c);
                if (result) candidates.push(result);
            }
        }
        return Object.freeze(candidates);
    }

    resolveHover(card, gameState, r, c) {
        if (!card || !gameState || gameState.hasPickedThisTurn) return null;
        return this.resolveAnchor(card, gameState, r, c);
    }
}

export default PlacementPreviewResolver;
