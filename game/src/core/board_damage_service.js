/* =============================================================
   game/src/core/board_damage_service.js
   Board-owned damage record boundary.

   v1 stores historical/semantic damage facts only.
   It deliberately does NOT change production, capabilities, terrain,
   Special Block traits, or Trial values.
   ============================================================= */

export const BOARD_DAMAGE_TARGETS = Object.freeze({
    LAND: "LAND",
    SPECIAL_BLOCK: "SPECIAL_BLOCK"
});

function clone(value, fallback = null) {
    if (value === undefined) return fallback;
    return JSON.parse(JSON.stringify(value));
}

function validTarget(value) {
    return Object.values(BOARD_DAMAGE_TARGETS).includes(value);
}

function normalizeSource(source = {}) {
    return {
        type: source?.type || "UNKNOWN",
        trialIndex: Number.isInteger(source?.trialIndex) ? source.trialIndex : null,
        scenarioId: source?.scenarioId || null,
        battleIndex: Number.isInteger(source?.battleIndex) ? source.battleIndex : null,
        battleSiteId: source?.battleSiteId || null
    };
}

function buildDamageId({ r, c, target, source }) {
    return [
        "BOARD_DAMAGE",
        r,
        c,
        target,
        source.type || "UNKNOWN",
        source.trialIndex ?? "NA",
        source.scenarioId || "NA",
        source.battleIndex ?? "NA"
    ].join("@");
}

export class BoardDamageService {
    constructor({ state } = {}) {
        this.state = state || null;
    }

    recordDamage({ r, c, target, source = {}, metadata = null } = {}) {
        if (!Number.isInteger(r) || !Number.isInteger(c) || !validTarget(target)) {
            return { success: false, reason: "INVALID_DAMAGE_REQUEST" };
        }
        const cell = this.state?.grid?.[r]?.[c] || null;
        if (!cell?.placed || cell.isHQ) {
            return { success: false, reason: "INVALID_DAMAGE_TARGET_CELL" };
        }
        if (target === BOARD_DAMAGE_TARGETS.SPECIAL_BLOCK && !cell.specialBlock) {
            return { success: false, reason: "SPECIAL_BLOCK_REQUIRED" };
        }

        const normalizedSource = normalizeSource(source);
        const id = buildDamageId({ r, c, target, source: normalizedSource });
        if (!Array.isArray(cell.damageRecords)) cell.damageRecords = [];

        const existing = cell.damageRecords.find(record => record?.id === id) || null;
        if (existing) {
            return { success: true, alreadyRecorded: true, record: clone(existing) };
        }

        const record = Object.freeze({
            id,
            target,
            source: Object.freeze(normalizedSource),
            metadata: metadata == null ? null : Object.freeze(clone(metadata, {}))
        });
        cell.damageRecords.push(record);

        return { success: true, alreadyRecorded: false, record: clone(record) };
    }

    getDamageRecords({ r, c, target = null } = {}) {
        if (!Number.isInteger(r) || !Number.isInteger(c)) return [];
        const cell = this.state?.grid?.[r]?.[c] || null;
        const records = Array.isArray(cell?.damageRecords) ? cell.damageRecords : [];
        return records
            .filter(record => !target || record?.target === target)
            .map(record => clone(record));
    }

    hasDamage({ r, c, target = null } = {}) {
        return this.getDamageRecords({ r, c, target }).length > 0;
    }
}

export default BoardDamageService;
