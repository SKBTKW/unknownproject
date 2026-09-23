/* =============================================================
   game/src/cards/board_card_migration_audit.js

   Explicit migration blockers for current BOARD-owned command cards.

   Card Core must not recreate board mutation rules. These cards stay on the
   legacy path until Board exposes authoritative action/query contracts for
   their semantics.
   ============================================================= */

const BOARD_CARD_MIGRATION_STATUS = Object.freeze({
    BLOCKED_NO_MUTATION_API: "BLOCKED_NO_MUTATION_API",
    BLOCKED_SHADOWED_LEGACY: "BLOCKED_SHADOWED_LEGACY",
    BLOCKED_NO_EFFECT_CONSUMER: "BLOCKED_NO_EFFECT_CONSUMER"
});

const BOARD_CARD_MIGRATION_AUDIT = Object.freeze({
    CMD_TRANSMUTE_GOLDEN: Object.freeze({
        status: BOARD_CARD_MIGRATION_STATUS.BLOCKED_NO_MUTATION_API,
        intendedAction: "SOCKET_RESOURCE_TRANSMUTATION",
        note: "Legacy behavior mutates grid directly when targeted and falls back to mystic +10 when untargeted."
    }),
    CMD_RESETTLEMENT: Object.freeze({
        status: BOARD_CARD_MIGRATION_STATUS.BLOCKED_SHADOWED_LEGACY,
        intendedAction: "PLAINS_MERGE_RESETTLEMENT",
        note: "Two legacy branches disagree on persistent food bonus / Ember authority and neither targets the required merge."
    }),
    CMD_WETLAND_RECLAMATION: Object.freeze({
        status: BOARD_CARD_MIGRATION_STATUS.BLOCKED_NO_MUTATION_API,
        intendedAction: "WETLAND_TO_RECLAIMED_LAND",
        note: "Legacy behavior scans and mutates the first eligible grid cell directly; Board exposes no terrain-conversion action yet."
    }),
    CMD_IRRIGATION: Object.freeze({
        status: BOARD_CARD_MIGRATION_STATUS.BLOCKED_NO_EFFECT_CONSUMER,
        intendedAction: "IRRIGATION_DEVELOPMENT",
        note: "Legacy behavior only increments irrigationCount; no authoritative Board/Production consumer was found in current runtime paths."
    })
});

const BOARD_MIGRATION_BLOCKED_IDS = Object.freeze(
    Object.keys(BOARD_CARD_MIGRATION_AUDIT)
);

function getBoardCardMigrationAudit(cardId) {
    return BOARD_CARD_MIGRATION_AUDIT[cardId] || null;
}

function isBoardCardMigrationBlocked(cardId) {
    return getBoardCardMigrationAudit(cardId) !== null;
}

export {
    BOARD_CARD_MIGRATION_STATUS,
    BOARD_CARD_MIGRATION_AUDIT,
    BOARD_MIGRATION_BLOCKED_IDS,
    getBoardCardMigrationAudit,
    isBoardCardMigrationBlocked
};
