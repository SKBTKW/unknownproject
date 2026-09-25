import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { resolveCardEffectHandlerRouter } from "../game/src/cards/card_effect_handler_router.js";
import {
    DOMAIN_ACTION_REQUIRED_IDS,
    LEGACY_ONLY_IDS,
    resolveDomainActionOwner,
    resolveDomainActionMigrationBlocker
} from "../game/src/cards/legacy_command_execution_inventory.js";
import { isCardRuntimeVisible } from "../game/src/cards/card_runtime_visibility_policy.js";
import { listCardDomainMigrationBlockers } from "../game/src/cards/card_domain_migration_audit.js";

const router = resolveCardEffectHandlerRouter({});

for (const id of LEGACY_ONLY_IDS) {
    assert.equal(router.has(id), true, `compatibility handler missing: ${id}`);
    assert.equal(isCardRuntimeVisible({ id }), false, `legacy-only card became Offering-visible: ${id}`);
}

const deckSource = readFileSync(
    new URL("../game/src/systems/deck_manager.js", import.meta.url),
    "utf8"
);
for (const id of LEGACY_ONLY_IDS) {
    assert.equal(
        deckSource.includes(`cId === "${id}"`),
        false,
        `compatibility-only branch remains in DeckManager: ${id}`
    );
}

const blockers = listCardDomainMigrationBlockers();
assert.equal(blockers.length, DOMAIN_ACTION_REQUIRED_IDS.length);
assert.equal(new Set(blockers.map(entry => entry.cardId)).size, blockers.length);
for (const id of DOMAIN_ACTION_REQUIRED_IDS) {
    assert.equal(typeof resolveDomainActionOwner(id), "string");
    assert.equal(typeof resolveDomainActionMigrationBlocker(id), "string");
    const entry = blockers.find(item => item.cardId === id);
    assert.ok(entry, `missing blocker projection: ${id}`);
    assert.equal(entry.owner, resolveDomainActionOwner(id));
    assert.equal(entry.blocker, resolveDomainActionMigrationBlocker(id));
}

assert.equal(
    blockers.some(entry => entry.cardId === "CMD_RESETTLEMENT"),
    false,
    "Resettlement must leave the migration blocker projection after canonical Zone Conversion migration"
);
assert.equal(resolveDomainActionOwner("CMD_RESETTLEMENT"), null);
assert.equal(resolveDomainActionMigrationBlocker("CMD_RESETTLEMENT"), null);

for (const entry of blockers) {
    assert.equal(
        entry.foundationReady,
        false,
        `${entry.cardId} must not report foundation-ready until its blocker narrows accordingly`
    );
}

// Spot-check routed compatibility behavior after extraction.
{
    const state = { wood: 0, mystic: 0, activeBuffs: [], logs: [], addLog(v){ this.logs.push(v); } };
    const result = router.execute({ id: "CMD_BLACK_MARKET" }, {
        state,
        cardName: "Black Market",
        cardDescription: "legacy"
    });
    assert.equal(result.success, true);
    assert.equal(state.wood, 35);
    assert.equal(state.mystic, 10);
}

console.log("test_card_domain_actions_v2_replay: PASS");
