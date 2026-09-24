/* =============================================================
   game/src/cards/card_domain_migration_audit.js

   Read-only projection over the canonical legacy command migration inventory.
   This file deliberately does not own duplicate card-id lists or blocker rules.
   ============================================================= */

import {
    DOMAIN_ACTION_REQUIRED_IDS,
    DOMAIN_ACTION_MIGRATION_BLOCKER,
    resolveDomainActionOwner,
    resolveDomainActionMigrationBlocker
} from "./legacy_command_execution_inventory.js";

function getCardDomainMigrationBlocker(cardId) {
    if (!DOMAIN_ACTION_REQUIRED_IDS.includes(cardId)) return null;
    const owner = resolveDomainActionOwner(cardId);
    const blocker = resolveDomainActionMigrationBlocker(cardId);
    if (!owner || !blocker) return null;
    const foundationReady =
        blocker === DOMAIN_ACTION_MIGRATION_BLOCKER.ZONE_CONVERSION_DEFINITION_MISSING;
    return Object.freeze({
        cardId,
        owner,
        blocker,
        foundationReady,
        remainingWork: foundationReady ? "AUTHOR_DOMAIN_DEFINITION" : "DOMAIN_FOUNDATION_OR_SEMANTICS"
    });
}

function listCardDomainMigrationBlockers() {
    return Object.freeze(
        DOMAIN_ACTION_REQUIRED_IDS.map(getCardDomainMigrationBlocker).filter(Boolean)
    );
}

export {
    getCardDomainMigrationBlocker,
    listCardDomainMigrationBlockers
};
