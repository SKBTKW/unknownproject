import { RunTerminationService } from "../run_termination_service.js";
import { ActionTransactionManager } from "../transaction_manager.js";
import { EmberSystem } from "../../systems/ember_system.js";
import { serializeGameState } from "../state_serializer.js";
import { hydrateGameState } from "../hydrate_game_state.js";

function assert(condition, message) {
    if (!condition) throw new Error(message);
}

function makeState(overrides = {}) {
    return {
        turn: 18,
        ember: 2,
        maxEmber: 20,
        isGameOver: false,
        runTermination: null,
        grid: [],
        handOffering: [],
        reserveSlots: [],
        mergeLinks: new Set(),
        grantedConnectionPairs: new Set(),
        ...overrides
    };
}

const liveState = makeState({ ember: 1 });
const liveTermination = new RunTerminationService(liveState);
assert(liveTermination.evaluate({ source: "NON_FATAL" }) === null, "Ember > 0 must not terminate the run");
assert(liveState.isGameOver === false, "non-fatal evaluation must preserve isGameOver=false");

const state = makeState();
const engine = {};
const emberSystem = new EmberSystem(state, engine);
emberSystem.applyDamage(2);
assert(engine.runTerminationService instanceof RunTerminationService, "EmberSystem must expose run termination service");
assert(engine.runTerminationService.isTerminated(), "Ember 0 must terminate the run");
const first = engine.runTerminationService.getResult();
assert(first.outcome === "DEFEAT", "terminal outcome must be DEFEAT");
assert(first.reason === "EMBER_DEPLETED", "terminal reason must be Ember depletion");
assert(first.source === "EMBER_DAMAGE", "first terminal source must be retained");
assert(first.ember === 0 && state.ember === 0, "terminal Ember must be clamped to 0");
assert(state.isGameOver === true, "terminal state must keep legacy isGameOver compatibility");

const second = engine.runTerminationService.evaluate({ source: "SECOND_EVALUATION" });
assert(second?.source === "EMBER_DAMAGE", "repeat evaluation must retain the first termination source");
assert(JSON.stringify(second) === JSON.stringify(first), "repeat evaluation must not create a different terminal result");
assert(JSON.stringify(state.runTermination), "runTermination must remain plain serializable data");

const negativeState = makeState({ ember: -4 });
const negativeTermination = new RunTerminationService(negativeState);
const negativeResult = negativeTermination.evaluate({ source: "NEGATIVE_EMBER" });
assert(negativeResult?.terminated === true, "Ember < 0 equivalent must terminate the run");
assert(negativeResult?.ember === 0, "negative Ember must be clamped to 0 in the terminal result");

let executed = false;
const actionManager = new ActionTransactionManager(engine);
const blocked = actionManager.execute("TEST_ACTION", {
    validate: () => ({ can: true }),
    execute: () => {
        executed = true;
        return { success: true };
    }
});
assert(blocked.success === false && blocked.reason === "RUN_TERMINATED", "normal actions must be rejected after termination");
assert(executed === false, "terminal action guard must stop execution before the pipeline runs");

const serialized = serializeGameState(state);
assert(serialized.runTermination?.terminated === true, "termination result must serialize");
const restored = {};
hydrateGameState(restored, serialized, { resolveCardMaster: () => null });
assert(restored.isGameOver === true, "game-over flag must hydrate");
assert(restored.runTermination?.reason === "EMBER_DEPLETED", "termination result must hydrate");

const legacySerialized = { ...serialized };
delete legacySerialized.isGameOver;
delete legacySerialized.runTermination;
const legacyRestored = {};
hydrateGameState(legacyRestored, legacySerialized, { resolveCardMaster: () => null });
assert(legacyRestored.isGameOver === false, "legacy snapshots without isGameOver must hydrate safely");
assert(legacyRestored.runTermination === null, "legacy snapshots without runTermination must hydrate safely");

console.log("PASS: run termination is idempotent, action-safe, and restore-compatible");
