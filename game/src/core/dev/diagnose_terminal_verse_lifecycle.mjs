import { TurnLifecycleService, TURN_LIFECYCLE_PHASES } from "../turn_lifecycle_service.js";

function assert(condition, message) {
    if (!condition) throw new Error(message);
}

const calls = [];
const state = {
    turn: 12,
    ember: 1,
    maxEmber: 20,
    isGameOver: false,
    runTermination: null,
    food: 10,
    wood: 0,
    material: 0,
    mystic: 0,
    stage: { id: 1, name: "Stage 1", size: 5, maxTiles: 24 },
    trialSchedule: { trial1: 99, trial2: 199, trial3: 299 },
    processTurnEndMaintenance() {
        calls.push("maintenance");
        this.ember = 0;
        return { success: true };
    },
    addLog() {
        calls.push("log");
    }
};

const engine = {
    state,
    previewTurnEndMaintenance() {
        calls.push("preview");
        return {
            production: { grossFood: 0, foodCost: 0, totalWood: 0, totalMystic: 0 },
            automaticPlan: null,
            hypotheticalFallbackPlan: { canFullyCover: false }
        };
    },
    transactionManager: { clearHistory: () => calls.push("transaction.clear") },
    undoSystem: { clearSnapshot: () => calls.push("undo.clear") },
    globalEventManager: {
        tickTurn: () => calls.push("global.tick"),
        onTurnStart: () => calls.push("global.start")
    },
    deckManager: {
        generateOfferingCards: () => calls.push("deck.offering")
    }
};

const lifecycle = new TurnLifecycleService(engine);
const firstAdvance = lifecycle.advance();

assert(firstAdvance === 12, "fatal Verse commit must return the current turn");
assert(state.turn === 12, "fatal Verse commit must not increment turn");
assert(lifecycle.getPhase() === TURN_LIFECYCLE_PHASES.ACTIVE, "fatal Verse commit must settle back to ACTIVE");
assert(lifecycle.getLastCommittedBoundary()?.completedTurn === 12, "fatal Verse must still record the committed boundary");
assert(lifecycle.getLastCommittedBoundary()?.runTermination?.terminated === true, "fatal Verse boundary must retain termination result");
assert(state.isGameOver === true, "fatal Verse commit must set game over compatibility flag");
assert(state.runTermination?.outcome === "DEFEAT", "fatal Verse commit must terminate as DEFEAT");
assert(!calls.includes("global.tick"), "fatal Verse commit must not tick global events");
assert(!calls.includes("deck.offering"), "fatal Verse commit must not generate the next Offering");
assert(!calls.includes("global.start"), "fatal Verse commit must not fire next Verse start");

const maintenanceCount = calls.filter(call => call === "maintenance").length;
const previewCount = calls.filter(call => call === "preview").length;
const secondAdvance = lifecycle.advance();
assert(secondAdvance === 12, "advance after termination must remain on the terminal turn");
assert(state.turn === 12, "advance after termination must not increment turn");
assert(calls.filter(call => call === "maintenance").length === maintenanceCount, "advance after termination must not recommit maintenance");
assert(calls.filter(call => call === "preview").length === previewCount, "advance after termination must not re-preview commit work");
assert(lifecycle.getPhase() === TURN_LIFECYCLE_PHASES.ACTIVE, "repeat terminal advance must keep lifecycle ACTIVE");

console.log("PASS: terminal Verse commit stops before initialization and cannot recommit");
