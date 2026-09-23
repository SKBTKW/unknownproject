/* =============================================================
   game/src/core/board_domain_adapter.js
   Side-effect-free Board read/query boundary for Card Core and other domains.
   ============================================================= */

import { resolvePlacementGeometry } from './placement_geometry.js';
import { readCellCapabilities } from './special_block_domain.js';
import { SpecialBlockService } from '../systems/special_block_service.js';

function resolveLandSemantic(definition) {
    return definition?.terrain || definition || null;
}

export class BoardDomainAdapter {
    constructor({ state, gridEngine, specialBlockService = null } = {}) {
        this.state = state || gridEngine?.state || null;
        this.gridEngine = gridEngine || null;
        this.specialBlockService = specialBlockService || new SpecialBlockService(this.state);
    }

    validateLandPlacement(definition, anchor) {
        if (!this.gridEngine?.canPlaceShape || !definition || !anchor) {
            return { valid: false, reason: 'BOARD_QUERY_UNAVAILABLE', reasons: ['BOARD_QUERY_UNAVAILABLE'] };
        }

        const geometry = resolvePlacementGeometry(definition, anchor.r, anchor.c);
        const semantic = resolveLandSemantic(definition);
        const result = this.gridEngine.canPlaceShape(
            geometry.startR,
            geometry.startC,
            geometry.shape,
            semantic,
            geometry.attributeCells
        );
        return {
            valid: result.can === true,
            reason: result.reason || null,
            reasons: [...(result.reasons || [])],
            placement: geometry
        };
    }

    enumerateLegalLandPlacements(definition) {
        if (!Array.isArray(this.state?.grid) || !this.gridEngine?.canPlaceShape) return [];
        const legal = [];
        for (let r = 0; r < this.state.grid.length; r++) {
            const row = this.state.grid[r];
            for (let c = 0; c < (row?.length || 0); c++) {
                const result = this.validateLandPlacement(definition, { r, c });
                if (result.valid) legal.push({ anchor: { r, c }, placement: result.placement });
            }
        }
        return legal;
    }

    hasAnyLegalLandPlacement(definition) {
        if (!Array.isArray(this.state?.grid) || !this.gridEngine?.canPlaceShape) return false;
        for (let r = 0; r < this.state.grid.length; r++) {
            const row = this.state.grid[r];
            for (let c = 0; c < (row?.length || 0); c++) {
                if (this.validateLandPlacement(definition, { r, c }).valid) return true;
            }
        }
        return false;
    }

    validateSpecialBlockTarget(typeOrDefinition, target, context = {}) {
        return this.specialBlockService.validateTarget(typeOrDefinition, target, context);
    }

    enumerateLegalSpecialBlockTargets(typeOrDefinition, context = {}) {
        return this.specialBlockService.enumerateLegalTargets(typeOrDefinition, context);
    }

    hasAnyLegalSpecialBlockTarget(typeOrDefinition, context = {}) {
        return this.specialBlockService.hasAnyLegalTarget(typeOrDefinition, context);
    }

    createSpecialBlock(type, target, context = {}) {
        return this.specialBlockService.createSpecialBlock(type, target, context);
    }

    readCapabilities(target) {
        if (Number.isInteger(target?.r) && Number.isInteger(target?.c)) {
            return this.specialBlockService.readCapabilities(target);
        }
        return readCellCapabilities(target);
    }

    readTrialTraits(entityOrTarget) {
        return this.specialBlockService.readTrialTraits(entityOrTarget);
    }

    isHQVicinity(r, c) {
        if (typeof this.gridEngine?.isHQVicinity === 'function') {
            return this.gridEngine.isHQVicinity(r, c);
        }
        return this.specialBlockService.isHQVicinity(r, c);
    }
}

export default BoardDomainAdapter;
