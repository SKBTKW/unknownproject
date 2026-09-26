import assert from "node:assert/strict";

import {
    CARD_RUNTIME_ACTIVE_CATEGORIES,
    CARD_RUNTIME_DEFAULT_ACTIVE_CARD_IDS,
    attachCardRuntimePolicy,
    isCardRuntimeActive,
    resolveCardRuntimeActivationPolicy
} from "../game/src/systems/card_runtime_policy.js";
import { GameEngine } from "../game/src/core/game_engine.js";

console.log("\nCard runtime ID-scoped activation boundary");

const LAND = { id: "PLAINS", category: "LAND" };
const INVESTIGATION = { id: "INVESTIGATE_FOOTPRINTS", category: "INVESTIGATION" };
const LEVY = { id: "CMD_EMERGENCY_LEVY", category: "COMMAND" };
const VIGILANCE = { id: "CMD_VIGILANCE", category: "COMMAND" };
const REKINDLE = { id: "CMD_REKINDLE_EMBER", category: "MYSTIC" };
const BLOCKED = { id: "CMD_GRANARY", category: "COMMAND" };

assert.deepEqual([...CARD_RUNTIME_ACTIVE_CATEGORIES], ["LAND", "INVESTIGATION"]);
assert.deepEqual([...CARD_RUNTIME_DEFAULT_ACTIVE_CARD_IDS], [
    "CMD_WETLAND_RECLAMATION",
    "CMD_LOGGING_CAMP",
    "CMD_GRANARY",
    "CMD_AGRICULTURAL_REFORM"
]);

assert.equal(isCardRuntimeActive(LAND), true);
assert.equal(isCardRuntimeActive(INVESTIGATION), true);
assert.equal(isCardRuntimeActive(LEVY), false);
assert.equal(isCardRuntimeActive(VIGILANCE), false);
assert.equal(isCardRuntimeActive(REKINDLE), false);
assert.equal(isCardRuntimeActive(BLOCKED), true, "completed Board Investment IDs are active without category reactivation");

const explicit = {
    activeCardIds: [
        "CMD_EMERGENCY_LEVY",
        "CMD_VIGILANCE",
        "CMD_REKINDLE_EMBER",
        "CMD_VIGILANCE",
        ""
    ]
};
assert.equal(isCardRuntimeActive(LEVY, explicit), true);
assert.equal(isCardRuntimeActive(VIGILANCE, explicit), true);
assert.equal(isCardRuntimeActive(REKINDLE, explicit), true);
assert.equal(isCardRuntimeActive(BLOCKED, explicit), false);
assert.equal(
    isCardRuntimeActive({ id: "SOME_OTHER_COMMAND", category: "COMMAND" }, explicit),
    false,
    "ID allowlist must not reactivate COMMAND as a category"
);

let eligibilityCalls = 0;
let playCalls = 0;
const engine = {
    cardRuntimeActivationProvider: () => ({
        activeCardIds: ["CMD_EMERGENCY_LEVY"]
    })
};
const manager = {
    engine,
    state: { turn: 1 },
    isCardEligible(card) {
        eligibilityCalls += 1;
        return card.id !== "FORCE_INELIGIBLE";
    },
    playCommandCard(card) {
        playCalls += 1;
        return { success: true, cardId: card.id };
    }
};

const attached = attachCardRuntimePolicy(manager);
assert.equal(attached.success, true);
assert.equal(manager.isCardEligible(LEVY), true);
assert.equal(manager.isCardEligible(VIGILANCE), false);
assert.equal(eligibilityCalls, 1, "blocked ids must fail before legacy eligibility work");

assert.deepEqual(
    manager.playCommandCard(LEVY),
    { success: true, cardId: "CMD_EMERGENCY_LEVY" }
);
assert.deepEqual(
    manager.playCommandCard(VIGILANCE),
    { success: false, reason: "CARD_RUNTIME_DISABLED" }
);
assert.deepEqual(
    manager.playCommandCard(LAND),
    { success: false, reason: "NOT_A_COMMAND_CARD" }
);
assert.equal(playCalls, 1);

engine.cardRuntimeActivationProvider = () => ({
    activeCardIds: ["CMD_VIGILANCE"]
});
assert.equal(
    manager.isCardEligible(LEVY),
    false,
    "provider is resolved at call time so prototype config can be injected before a run without rewrapping DeckManager"
);
assert.equal(manager.isCardEligible(VIGILANCE), true);

const runtimePolicy = resolveCardRuntimeActivationPolicy(manager);
assert.deepEqual([...runtimePolicy.activeCardIds], ["CMD_VIGILANCE"]);
assert.equal(runtimePolicy.source, "PROVIDER");

const provider = () => ({
    activeCardIds: [
        "CMD_EMERGENCY_LEVY",
        "CMD_VIGILANCE",
        "CMD_REKINDLE_EMBER"
    ]
});
const liveEngine = GameEngine.createGame({
    runSeed: 20260924,
    cardRuntimeActivationProvider: provider
});
assert.equal(liveEngine.cardRuntimeActivationProvider, provider);
assert.equal(liveEngine.deckManager.__cardRuntimePolicyAttached, true);
assert.deepEqual(
    [...resolveCardRuntimeActivationPolicy(liveEngine.deckManager).activeCardIds],
    ["CMD_EMERGENCY_LEVY", "CMD_VIGILANCE", "CMD_REKINDLE_EMBER"]
);

const productionDefault = GameEngine.createGame({ runSeed: 20260925 });
assert.equal(productionDefault.cardRuntimeActivationProvider, null);
assert.deepEqual(
    [...resolveCardRuntimeActivationPolicy(productionDefault.deckManager).activeCardIds],
    []
);
assert.equal(
    isCardRuntimeActive(LEVY, resolveCardRuntimeActivationPolicy(productionDefault.deckManager)),
    false,
    "production default must keep dormant command cards disabled"
);

console.log("  explicit prototype IDs are opt-in only");
console.log("  whole legacy categories remain dormant");
console.log("  production default activeCardIds = []");
console.log("✅ Card runtime ID-scoped activation boundary PASS");
