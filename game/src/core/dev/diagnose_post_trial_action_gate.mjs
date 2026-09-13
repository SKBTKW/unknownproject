import { ActionTransactionManager } from "../transaction_manager.js";

function assert(condition, message) {
    if (!condition) throw new Error(message);
}

function makeEngine(runTermination = null) {
    const engine = {
        state: {
            ember: runTermination?.ember ?? 8,
            runTermination
        },
        runTerminationService: {
            getResult: () => runTermination
        },
        undoSystem: null
    };
    engine.transactionManager = new ActionTransactionManager(engine);
    return engine;
}

const survivedEngine = makeEngine(null);
let survivedExecuted = false;
const survived = survivedEngine.transactionManager.execute("POST_TRIAL_TEST", {
    execute() {
        survivedExecuted = true;
        return { success: true };
    }
});
assert(survived.success === true, "SURVIVED run must accept gameplay action");
assert(survivedExecuted === true, "SURVIVED action must execute");

const terminal = {
    terminated: true,
    outcome: "DEFEAT",
    reason: "EMBER_DEPLETED",
    source: "EMBER_DAMAGE",
    turn: 30,
    ember: 0
};
const failedEngine = makeEngine(terminal);
let failedExecuted = false;
const failed = failedEngine.transactionManager.execute("POST_TRIAL_TEST", {
    execute() {
        failedExecuted = true;
        return { success: true };
    }
});
assert(failed.success === false, "FAILED run must reject gameplay action");
assert(failed.reason === "RUN_TERMINATED", "FAILED rejection must expose RUN_TERMINATED");
assert(failedExecuted === false, "FAILED action must be rejected before mutation");

console.log("PASS: post-Trial transaction gate allows SURVIVED and blocks FAILED");
