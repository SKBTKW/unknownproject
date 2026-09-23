/* =============================================================
   game/src/cards/exploration_card_migration_audit.js

   Migration blocker for exploration/event-style command cards.
   Investigation is enemy-information acquisition and is not the owner of
   generic world exploration reward checks.
   ============================================================= */

const EXPLORATION_CARD_MIGRATION_STATUS = Object.freeze({
    BLOCKED_NO_EXPLORATION_DOMAIN: "BLOCKED_NO_EXPLORATION_DOMAIN"
});

const EXPLORATION_CARD_MIGRATION_AUDIT = Object.freeze({
    CMD_ABANDONED_SETTLEMENT: Object.freeze({
        status: EXPLORATION_CARD_MIGRATION_STATUS.BLOCKED_NO_EXPLORATION_DOMAIN,
        intendedAction: "RESOLVE_EXPLORATION_CHECK",
        checkId: "standard_2d6",
        note: "Legacy uses CheckSystem then maps the roll to resource rewards; Investigation services intentionally do not own generic exploration rewards."
    })
});

const EXPLORATION_MIGRATION_BLOCKED_IDS = Object.freeze(
    Object.keys(EXPLORATION_CARD_MIGRATION_AUDIT)
);

function getExplorationCardMigrationAudit(cardId) {
    return EXPLORATION_CARD_MIGRATION_AUDIT[cardId] || null;
}

export {
    EXPLORATION_CARD_MIGRATION_STATUS,
    EXPLORATION_CARD_MIGRATION_AUDIT,
    EXPLORATION_MIGRATION_BLOCKED_IDS,
    getExplorationCardMigrationAudit
};
