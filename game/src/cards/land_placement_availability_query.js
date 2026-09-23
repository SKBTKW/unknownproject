/* =============================================================
   game/src/cards/land_placement_availability_query.js
   Offering-time LAND availability query. Placement legality remains owned
   by GameState.canPlaceShape(); this module only asks the domain whether at
   least one legal placement exists.
   ============================================================= */

import {
    resolvePlacementAnchor,
    resolvePlacementAttributeCells,
    resolvePlacementShape,
    rotatePlacementClockwise
} from '../core/placement_geometry.js';

function geometryKey(shape, anchor, attributeCells) {
    return JSON.stringify({ shape, anchor, attributeCells: attributeCells || null });
}

class LandPlacementAvailabilityQuery {
    constructor(state) {
        this.state = state;
    }

    hasAnyLegalPlacement(cardDefinition) {
        const state = this.state;
        if (!cardDefinition || cardDefinition.category !== "LAND") return false;
        if (!state?.grid || typeof state.canPlaceShape !== "function") return false;

        let shape = resolvePlacementShape(cardDefinition);
        let anchor = resolvePlacementAnchor(cardDefinition, shape);
        let attributeCells = resolvePlacementAttributeCells(cardDefinition);
        const seen = new Set();

        for (let rotation = 0; rotation < 4; rotation++) {
            const key = geometryKey(shape, anchor, attributeCells);
            if (!seen.has(key)) {
                seen.add(key);
                if (this._hasLegalPlacementForGeometry(cardDefinition, shape, anchor, attributeCells)) {
                    return true;
                }
            }
            const rotated = rotatePlacementClockwise(shape, anchor, attributeCells);
            shape = rotated.shape;
            anchor = rotated.anchor;
            attributeCells = rotated.attributeCells;
        }

        return false;
    }

    _hasLegalPlacementForGeometry(cardDefinition, shape, anchor, attributeCells) {
        for (let clickedR = 0; clickedR < this.state.grid.length; clickedR++) {
            const row = this.state.grid[clickedR];
            for (let clickedC = 0; clickedC < row.length; clickedC++) {
                const startR = clickedR - anchor.r;
                const startC = clickedC - anchor.c;
                try {
                    const result = this.state.canPlaceShape(
                        startR,
                        startC,
                        shape,
                        cardDefinition,
                        attributeCells
                    );
                    if (result?.can === true) return true;
                } catch {
                    // A malformed candidate is simply not Offering-eligible.
                }
            }
        }
        return false;
    }
}

export { LandPlacementAvailabilityQuery };
export default LandPlacementAvailabilityQuery;
