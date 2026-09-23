/* =============================================================
   game/src/cards/project_card_migration_audit.js

   Explicit migration blockers for current PROJECT-tagged command cards.

   Card Core must not invent Project runtime behavior. These cards remain on
   the legacy path until an owning Project Domain exposes the corresponding
   consumer/action contract.
   ============================================================= */

const PROJECT_CARD_MIGRATION_STATUS = Object.freeze({
    BLOCKED_NO_PROJECT_DOMAIN: "BLOCKED_NO_PROJECT_DOMAIN",
    BLOCKED_SHADOWED_LEGACY: "BLOCKED_SHADOWED_LEGACY"
});

const PROJECT_CARD_MIGRATION_AUDIT = Object.freeze({
    CMD_GRANARY_NETWORK: Object.freeze({
        status: PROJECT_CARD_MIGRATION_STATUS.BLOCKED_NO_PROJECT_DOMAIN,
        legacyStateKey: "granaryNetworkActive",
        intendedEffect: "MAINTENANCE_EFFICIENCY"
    }),
    CMD_INDUSTRIAL_ROAD: Object.freeze({
        status: PROJECT_CARD_MIGRATION_STATUS.BLOCKED_NO_PROJECT_DOMAIN,
        legacyStateKey: "industrialRoadActive",
        intendedEffect: "INDUSTRY_PRODUCTION_MULTIPLIER"
    }),
    CMD_IRRIGATION_NETWORK: Object.freeze({
        status: PROJECT_CARD_MIGRATION_STATUS.BLOCKED_NO_PROJECT_DOMAIN,
        legacyStateKey: "irrigationNetworkActive",
        intendedEffect: "IRRIGATION_NETWORK_PRODUCTION"
    }),
    CMD_INDUSTRIAL_CLUSTER: Object.freeze({
        status: PROJECT_CARD_MIGRATION_STATUS.BLOCKED_NO_PROJECT_DOMAIN,
        legacyStateKey: "industrialClusterActive",
        intendedEffect: "PROJECT_COST_REDUCTION"
    }),
    CMD_GREAT_RAMPART_PROJECT: Object.freeze({
        status: PROJECT_CARD_MIGRATION_STATUS.BLOCKED_SHADOWED_LEGACY,
        legacyStateKey: "greatRampartTurns",
        intendedEffect: "TRIAL_ADVANCE_SUPPRESSION",
        note: "Reachable 4T project branch shadows a later permanent greatRampartActive branch."
    })
});

const PROJECT_MIGRATION_BLOCKED_IDS = Object.freeze(
    Object.keys(PROJECT_CARD_MIGRATION_AUDIT)
);

function getProjectCardMigrationAudit(cardId) {
    return PROJECT_CARD_MIGRATION_AUDIT[cardId] || null;
}

function isProjectCardMigrationBlocked(cardId) {
    return getProjectCardMigrationAudit(cardId) !== null;
}

export {
    PROJECT_CARD_MIGRATION_STATUS,
    PROJECT_CARD_MIGRATION_AUDIT,
    PROJECT_MIGRATION_BLOCKED_IDS,
    getProjectCardMigrationAudit,
    isProjectCardMigrationBlocked
};
