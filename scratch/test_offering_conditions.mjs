import assert from "node:assert/strict";
import { GameEngine } from "../game/src/app.js";
import {
    CARD_RUNTIME_ACTIVE_CATEGORIES,
    isCardRuntimeActive
} from "../game/src/systems/card_runtime_policy.js";

console.log("Card Runtime Policy / Offering eligibility contract");

const engine = GameEngine.createGame({ runSeed: 0xA0713001 });
const deck = engine.deckManager;
const master = deck.getLandCardMaster();

assert.deepEqual(
    [...CARD_RUNTIME_ACTIVE_CATEGORIES],
    ["LAND", "INVESTIGATION"],
    "live runtime categories remain explicitly limited"
);

const activeLand = master.find(card => card.category === "LAND");
assert.ok(activeLand, "active LAND card must exist");
assert.equal(isCardRuntimeActive(activeLand), true);
assert.equal(
    deck.isCardEligible(activeLand, 1, 0, { ignoreCooldown: true, ignoreHold: true }),
    true,
    "an otherwise-eligible LAND card can enter Offering"
);

const dormantCommandIds = [
    "CMD_WETLAND_RECLAMATION",
    "CMD_GRANARY",
    "CMD_ABANDONED_SETTLEMENT",
    "CMD_TRANSMUTE_GOLDEN"
];

for (const id of dormantCommandIds) {
    const card = master.find(item => item.id === id);
    assert.ok(card, `${id} remains present for data/restore compatibility`);
    assert.equal(card.category, "COMMAND");
    assert.equal(isCardRuntimeActive(card), false, `${id} is dormant under current runtime policy`);
    assert.equal(
        deck.isCardEligible(card, 3, 99, { ignoreCooldown: true, ignoreHold: true }),
        false,
        `${id} must not re-enter live Offering`
    );
    const execution = engine.playCommandCard(card, { type: "OFFERING", index: -1 });
    assert.equal(execution.success, false, `${id} must not execute through legacy command runtime`);
    assert.equal(execution.reason, "CARD_RUNTIME_DISABLED");
}

// Policy must not accidentally classify ordinary legacy COMMAND data as live.
const liveCategoriesInMaster = new Set(
    master.filter(card => isCardRuntimeActive(card)).map(card => card.category)
);
assert.ok(liveCategoriesInMaster.has("LAND"));
assert.equal(liveCategoriesInMaster.has("COMMAND"), false);

console.log("Card Runtime Policy / Offering eligibility: PASS");
