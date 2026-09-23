/* =============================================================
   game/src/cards/card_domain_migration_audit.js

   Read-only aggregate view over Card -> owning-domain migration blockers.
   ============================================================= */

import {
    PROJECT_MIGRATION_BLOCKED_IDS,
    getProjectCardMigrationAudit
} from "./project_card_migration_audit.js";
import {
    BOARD_MIGRATION_BLOCKED_IDS,
    getBoardCardMigrationAudit
} from "./board_card_migration_audit.js";
import {
    SPECIAL_BLOCK_MIGRATION_BLOCKED_IDS,
    getSpecialBlockCardMigrationAudit
} from "./special_block_card_migration_audit.js";
import {
    EXPLORATION_MIGRATION_BLOCKED_IDS,
    getExplorationCardMigrationAudit
} from "./exploration_card_migration_audit.js";

const DOMAIN_AUDIT_SOURCES = Object.freeze([
    Object.freeze({
        owner: "PROJECT",
        ids: PROJECT_MIGRATION_BLOCKED_IDS,
        getAudit: getProjectCardMigrationAudit
    }),
    Object.freeze({
        owner: "BOARD",
        ids: BOARD_MIGRATION_BLOCKED_IDS,
        getAudit: getBoardCardMigrationAudit
    }),
    Object.freeze({
        owner: "SPECIAL_BLOCK",
        ids: SPECIAL_BLOCK_MIGRATION_BLOCKED_IDS,
        getAudit: getSpecialBlockCardMigrationAudit
    }),
    Object.freeze({
        owner: "EXPLORATION",
        ids: EXPLORATION_MIGRATION_BLOCKED_IDS,
        getAudit: getExplorationCardMigrationAudit
    })
]);

const CARD_DOMAIN_MIGRATION_BLOCKED_IDS = Object.freeze(
    DOMAIN_AUDIT_SOURCES.flatMap(source => source.ids)
);

function getCardDomainMigrationBlocker(cardId) {
    for (const source of DOMAIN_AUDIT_SOURCES) {
        const audit = source.getAudit(cardId);
        if (!audit) continue;
        return Object.freeze({
            cardId,
            owner: source.owner,
            ...audit
        });
    }
    return null;
}

function listCardDomainMigrationBlockers() {
    return Object.freeze(
        CARD_DOMAIN_MIGRATION_BLOCKED_IDS.map(getCardDomainMigrationBlocker)
    );
}

export {
    CARD_DOMAIN_MIGRATION_BLOCKED_IDS,
    getCardDomainMigrationBlocker,
    listCardDomainMigrationBlockers
};
