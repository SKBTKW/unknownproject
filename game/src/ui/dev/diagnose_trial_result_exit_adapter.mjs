import { GameFactHub, GAME_FACT_TYPES } from "../../core/game_fact.js";
import { TrialResultExitAdapter } from "../trial_result_exit_adapter.js";

function assert(condition, message) {
    if (!condition) throw new Error(message);
}

const hub = new GameFactHub();
let lifecycle = { resultReady: true, settlementConsumed: false, canExitTrial: false };
let exitCount = 0;

const adapter = new TrialResultExitAdapter({
    gameFactHub: hub,
    lifecycleProvider: () => lifecycle,
    onExitReady: () => { exitCount += 1; }
});

hub.emit(GAME_FACT_TYPES.TRIAL_COMPLETED, {});
assert(exitCount === 0, "TRIAL_COMPLETED must not release layout");

hub.emit(GAME_FACT_TYPES.TRIAL_EXIT_READY, {});
assert(exitCount === 0, "exit fact must be ignored while semantic contract is not ready");

lifecycle = { resultReady: true, settlementConsumed: true, canExitTrial: true };
hub.emit(GAME_FACT_TYPES.TRIAL_EXIT_READY, {});
assert(exitCount === 1, "settled exit-ready fact must release layout exactly once");

adapter.destroy();
hub.emit(GAME_FACT_TYPES.TRIAL_EXIT_READY, {});
assert(exitCount === 1, "destroyed adapter must stop receiving exit facts");

console.log("PASS: Browser layout exits only from renderer-neutral TRIAL_EXIT_READY");
