/* =============================================================
   game/src/cards/legacy_command_execution_inventory.js

   Migration inventory for the remaining DeckManager command ID branches.

   This is intentionally not a runtime effect implementation. It makes the
   remaining legacy surface explicit so future refactors cannot silently move
   Board / Defense / Trial / Exploration ownership into Card Core.
   ============================================================= */

const LEGACY_COMMAND_EXECUTION_CLASS = Object.freeze({
    CURRENT_SSOT_LOCAL: "CURRENT_SSOT_LOCAL",
    DOMAIN_ACTION_REQUIRED: "DOMAIN_ACTION_REQUIRED",
    LEGACY_ONLY: "LEGACY_ONLY"
});

const DOMAIN_ACTION_OWNER = Object.freeze({
    BOARD: "BOARD",
    SPECIAL_BLOCK: "SPECIAL_BLOCK",
    DEFENSE: "DEFENSE",
    PROJECT: "PROJECT",
    EXPLORATION: "EXPLORATION"
});

const CURRENT_SSOT_LOCAL_IDS = Object.freeze([]);

const DOMAIN_ACTION_REQUIRED_IDS = Object.freeze([
    "CMD_TRANSMUTE_GOLDEN",
    "CMD_RESETTLEMENT",
    "CMD_GREAT_RAMPART_PROJECT",
    "CMD_WETLAND_RECLAMATION",
    "CMD_PASTORAL_FARM",
    "CMD_SAWMILL",
    "CMD_QUARRY",
    "CMD_MINE",
    "CMD_STABLE",
    "CMD_LIME_KILN",
    "CMD_MARKET",
    "CMD_DEPOT",
    "CMD_IRRIGATION",
    "CMD_WORKSHOP",
    "CMD_GRANARY_NETWORK",
    "CMD_INDUSTRIAL_ROAD",
    "CMD_IRRIGATION_NETWORK",
    "CMD_INDUSTRIAL_CLUSTER",
    "CMD_ABANDONED_SETTLEMENT"
]);

const LEGACY_ONLY_IDS = Object.freeze([
    "CMD_AGRICULTURAL_POLICY",
    "CMD_BLACK_MARKET",
    "CMD_BALLISTA_SET",
    "FAC_GREAT_WINDMILL",
    "LGD_DESPERATE_PACT",
    "CMD_LAND_FOCUS",
    "CMD_CONSERVE_EMBER",
    "CMD_GRAND_CULTIVATION",
    "CMD_SCORCHED_RETREAT",
    "CMD_OUTPOST",
    "CMD_GUIDED_DEFENSE",
    "CMD_HIGH_GROUND_FORMATION",
    "CMD_CAVALRY_HOST",
    "CMD_PASTORAL_EXPANSION",
    "CMD_LIME_CONSTRUCTION",
    "CMD_CAVALRY_SCOUTS",
    "CMD_LOCAL_IRON_ARMAMENT",
    "CMD_STONE_STRONGPOINT",
    "CMD_SINGLE_CLEARING",
    "CMD_SYSTEMATIC_LOGGING",
    "CMD_MUD_OBSTACLE",
    "CMD_OUTPOST_SIGNAL",
    "CMD_SCOUT_ENEMY",
    "CMD_OMEN_DREAM",
    "CMD_LAND_EXPLORATION"
]);

// These IDs currently occur more than once in playCommandCard ID references.
// RESETTLEMENT / GREAT_RAMPART have duplicate effect branches; ABANDONED_SETTLEMENT
// has an additional CheckSystem preflight reference before its effect branch.
// Keep every multi-reference case explicit until migration removes it.
const DUPLICATE_LEGACY_BRANCH_IDS = Object.freeze([
    "CMD_RESETTLEMENT",
    "CMD_GREAT_RAMPART_PROJECT",
    "CMD_ABANDONED_SETTLEMENT"
]);

const LEGACY_SHADOWED_BRANCH_IDS = Object.freeze([
    // First matching branch applies the 4T project form; the later permanent
    // form is unreachable in the current else-if chain.
    "CMD_GREAT_RAMPART_PROJECT"
]);

const DOMAIN_ACTION_OWNER_BY_ID = Object.freeze({
    CMD_TRANSMUTE_GOLDEN: DOMAIN_ACTION_OWNER.BOARD,
    CMD_RESETTLEMENT: DOMAIN_ACTION_OWNER.BOARD,
    CMD_GREAT_RAMPART_PROJECT: DOMAIN_ACTION_OWNER.PROJECT,
    CMD_WETLAND_RECLAMATION: DOMAIN_ACTION_OWNER.BOARD,
    CMD_PASTORAL_FARM: DOMAIN_ACTION_OWNER.SPECIAL_BLOCK,
    CMD_SAWMILL: DOMAIN_ACTION_OWNER.SPECIAL_BLOCK,
    CMD_QUARRY: DOMAIN_ACTION_OWNER.SPECIAL_BLOCK,
    CMD_MINE: DOMAIN_ACTION_OWNER.SPECIAL_BLOCK,
    CMD_STABLE: DOMAIN_ACTION_OWNER.SPECIAL_BLOCK,
    CMD_LIME_KILN: DOMAIN_ACTION_OWNER.SPECIAL_BLOCK,
    CMD_MARKET: DOMAIN_ACTION_OWNER.SPECIAL_BLOCK,
    CMD_DEPOT: DOMAIN_ACTION_OWNER.SPECIAL_BLOCK,
    CMD_IRRIGATION: DOMAIN_ACTION_OWNER.BOARD,
    CMD_WORKSHOP: DOMAIN_ACTION_OWNER.SPECIAL_BLOCK,
    CMD_GRANARY_NETWORK: DOMAIN_ACTION_OWNER.PROJECT,
    CMD_INDUSTRIAL_ROAD: DOMAIN_ACTION_OWNER.PROJECT,
    CMD_IRRIGATION_NETWORK: DOMAIN_ACTION_OWNER.PROJECT,
    CMD_INDUSTRIAL_CLUSTER: DOMAIN_ACTION_OWNER.PROJECT,
    CMD_ABANDONED_SETTLEMENT: DOMAIN_ACTION_OWNER.EXPLORATION
});

const CLASS_BY_ID = new Map([
    ...CURRENT_SSOT_LOCAL_IDS.map(id => [id, LEGACY_COMMAND_EXECUTION_CLASS.CURRENT_SSOT_LOCAL]),
    ...DOMAIN_ACTION_REQUIRED_IDS.map(id => [id, LEGACY_COMMAND_EXECUTION_CLASS.DOMAIN_ACTION_REQUIRED]),
    ...LEGACY_ONLY_IDS.map(id => [id, LEGACY_COMMAND_EXECUTION_CLASS.LEGACY_ONLY])
]);

function classifyLegacyCommandExecution(cardId) {
    return CLASS_BY_ID.get(cardId) || null;
}

function isDomainActionRequired(cardId) {
    return classifyLegacyCommandExecution(cardId) === LEGACY_COMMAND_EXECUTION_CLASS.DOMAIN_ACTION_REQUIRED;
}

function resolveDomainActionOwner(cardId) {
    return DOMAIN_ACTION_OWNER_BY_ID[cardId] || null;
}

export {
    LEGACY_COMMAND_EXECUTION_CLASS,
    DOMAIN_ACTION_OWNER,
    DOMAIN_ACTION_OWNER_BY_ID,
    CURRENT_SSOT_LOCAL_IDS,
    DOMAIN_ACTION_REQUIRED_IDS,
    LEGACY_ONLY_IDS,
    DUPLICATE_LEGACY_BRANCH_IDS,
    LEGACY_SHADOWED_BRANCH_IDS,
    classifyLegacyCommandExecution,
    isDomainActionRequired,
    resolveDomainActionOwner
};
