/* =============================================================
   game/src/cards/special_block_card_migration_audit.js

   Migration blockers for current SPECIAL_BLOCK-owned command cards.

   A similarly named Special Block definition is not enough to justify
   migration: legacy effect semantics and Board entity semantics must match.
   ============================================================= */

const SPECIAL_BLOCK_CARD_MIGRATION_STATUS = Object.freeze({
    BLOCKED_SEMANTIC_MISMATCH: "BLOCKED_SEMANTIC_MISMATCH",
    BLOCKED_NO_DEFINITION: "BLOCKED_NO_DEFINITION",
    BLOCKED_UNRESOLVED_PRODUCTION: "BLOCKED_UNRESOLVED_PRODUCTION"
});

const SPECIAL_BLOCK_CARD_MIGRATION_AUDIT = Object.freeze({
    CMD_PASTORAL_FARM: Object.freeze({
        status: SPECIAL_BLOCK_CARD_MIGRATION_STATUS.BLOCKED_SEMANTIC_MISMATCH,
        candidateDefinition: "FARM",
        legacyStateKey: null,
        note: "Legacy grants immediate food +2; FARM creates a Board entity and its production is unresolved."
    }),
    CMD_SAWMILL: Object.freeze({
        status: SPECIAL_BLOCK_CARD_MIGRATION_STATUS.BLOCKED_SEMANTIC_MISMATCH,
        candidateDefinition: "LOGGING_CAMP",
        legacyStateKey: "sawmillCount",
        note: "Sawmill upgrade semantics are not equivalent to creating a logging camp."
    }),
    CMD_QUARRY: Object.freeze({
        status: SPECIAL_BLOCK_CARD_MIGRATION_STATUS.BLOCKED_NO_DEFINITION,
        candidateDefinition: null,
        legacyStateKey: null,
        note: "No QUARRY Special Block definition exists; legacy grants immediate material."
    }),
    CMD_MINE: Object.freeze({
        status: SPECIAL_BLOCK_CARD_MIGRATION_STATUS.BLOCKED_UNRESOLVED_PRODUCTION,
        candidateDefinition: "MINE",
        legacyStateKey: "mineCount",
        note: "MINE exists, but entity creation differs from legacy mineCount and production remains unresolved."
    }),
    CMD_STABLE: Object.freeze({
        status: SPECIAL_BLOCK_CARD_MIGRATION_STATUS.BLOCKED_NO_DEFINITION,
        candidateDefinition: null,
        legacyStateKey: "stableCount"
    }),
    CMD_LIME_KILN: Object.freeze({
        status: SPECIAL_BLOCK_CARD_MIGRATION_STATUS.BLOCKED_NO_DEFINITION,
        candidateDefinition: null,
        legacyStateKey: "limeKilnCount"
    }),
    CMD_MARKET: Object.freeze({
        status: SPECIAL_BLOCK_CARD_MIGRATION_STATUS.BLOCKED_NO_DEFINITION,
        candidateDefinition: null,
        legacyStateKey: "marketCount"
    }),
    CMD_DEPOT: Object.freeze({
        status: SPECIAL_BLOCK_CARD_MIGRATION_STATUS.BLOCKED_NO_DEFINITION,
        candidateDefinition: null,
        legacyStateKey: "depotCount"
    }),
    CMD_WORKSHOP: Object.freeze({
        status: SPECIAL_BLOCK_CARD_MIGRATION_STATUS.BLOCKED_NO_DEFINITION,
        candidateDefinition: null,
        legacyStateKey: "workshopCount"
    })
});

const SPECIAL_BLOCK_MIGRATION_BLOCKED_IDS = Object.freeze(
    Object.keys(SPECIAL_BLOCK_CARD_MIGRATION_AUDIT)
);

function getSpecialBlockCardMigrationAudit(cardId) {
    return SPECIAL_BLOCK_CARD_MIGRATION_AUDIT[cardId] || null;
}

export {
    SPECIAL_BLOCK_CARD_MIGRATION_STATUS,
    SPECIAL_BLOCK_CARD_MIGRATION_AUDIT,
    SPECIAL_BLOCK_MIGRATION_BLOCKED_IDS,
    getSpecialBlockCardMigrationAudit
};
