/* =============================================================
   game/src/core/board_damage_effect_policy.js
   Semantic effect-policy boundary for Board damage.

   v1 deliberately leaves numeric gameplay effects unresolved.
   Consumers may surface that damage is effect-relevant without changing
   production, capabilities, Special Block traits, or Trial values.
   ============================================================= */

import { BOARD_DAMAGE_TARGETS } from "./board_damage_service.js";

export const BOARD_DAMAGE_EFFECT_STATUS = Object.freeze({
    NONE: "NONE",
    UNRESOLVED: "UNRESOLVED",
    RESOLVED: "RESOLVED"
});

function recordsFor(cell, target) {
    return Array.isArray(cell?.damageRecords)
        ? cell.damageRecords.filter(record => record?.target === target)
        : [];
}

function freezeSnapshot(value) {
    return Object.freeze(JSON.parse(JSON.stringify(value)));
}

export class BoardDamageEffectPolicy {
    resolveLand(cell) {
        const records = recordsFor(cell, BOARD_DAMAGE_TARGETS.LAND);
        if (records.length === 0) {
            return Object.freeze({
                status: BOARD_DAMAGE_EFFECT_STATUS.NONE,
                affected: false,
                recordCount: 0,
                productionMultiplier: 1,
                flatYieldAdjustments: Object.freeze({})
            });
        }
        return Object.freeze({
            status: BOARD_DAMAGE_EFFECT_STATUS.UNRESOLVED,
            affected: true,
            recordCount: records.length,
            productionMultiplier: null,
            flatYieldAdjustments: null,
            records: Object.freeze(records.map(freezeSnapshot))
        });
    }

    resolveSpecialBlock(cell) {
        const records = recordsFor(cell, BOARD_DAMAGE_TARGETS.SPECIAL_BLOCK);
        if (records.length === 0) {
            return Object.freeze({
                status: BOARD_DAMAGE_EFFECT_STATUS.NONE,
                affected: false,
                recordCount: 0,
                productionMultiplier: 1,
                capabilitiesEnabled: true,
                trialTraitsEnabled: true
            });
        }
        return Object.freeze({
            status: BOARD_DAMAGE_EFFECT_STATUS.UNRESOLVED,
            affected: true,
            recordCount: records.length,
            productionMultiplier: null,
            capabilitiesEnabled: null,
            trialTraitsEnabled: null,
            records: Object.freeze(records.map(freezeSnapshot))
        });
    }

    resolveCell(cell) {
        return Object.freeze({
            land: this.resolveLand(cell),
            specialBlock: this.resolveSpecialBlock(cell)
        });
    }
}

const defaultPolicy = new BoardDamageEffectPolicy();

export function resolveLandDamageEffect(cell) {
    return defaultPolicy.resolveLand(cell);
}

export function resolveSpecialBlockDamageEffect(cell) {
    return defaultPolicy.resolveSpecialBlock(cell);
}

export function resolveBoardDamageEffects(cell) {
    return defaultPolicy.resolveCell(cell);
}

export default BoardDamageEffectPolicy;
