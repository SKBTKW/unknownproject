import assert from "node:assert/strict";
import {
    TurnLifecycleService,
    TURN_LIFECYCLE_PHASES
} from "../../core/turn_lifecycle_service.js";
import { GlobalEventChoiceComponent } from "../../ui/global_event_choice_component.js";

function createState() {
    return {
        turn: 4,
        food: 10,
        wood: 7,
        material: 7,
        mystic: 2,
        hasPickedThisTurn: true,
        hasReservedThisTurn: true,
        hasMulliganedThisTurn: true,
        stage: { id: 1, name: "Stage 1", size: 5, maxTiles: 24 },
        trialSchedule: { trial1: 15, trial2: 30, trial3: 50 },
        nextTrialTurn: 15,
        grid: [],
        processTurnEndMaintenance() {
            return { success: true };
        },
        addLog() {}
    };
}

function createEngine(calls, retryPendingTrialLaunch) {
    const state = createState();
    return {
        state,
        retryPendingTrialLaunch,
        previewTurnEndMaintenance: () => ({
            production: { grossFood: 0, foodCost: 0, totalWood: 0, totalMystic: 0 },
            automaticPlan: null,
            hypotheticalFallbackPlan: { canFullyCover: false }
        }),
        globalEventManager: {
            tickTurn: () => calls.push("global.tick"),
            onTurnStart: () => calls.push("global.start")
        },
        deckManager: {
            generateOfferingCards: () => calls.push("deck.offering")
        },
        historySnapshotService: {
            capture: () => calls.push("history.capture"),
            captureRestorePoint: () => calls.push("history.restore")
        },
        transactionManager: { clearHistory() {} },
        undoSystem: { clearSnapshot() {} }
    };
}

{
    const calls = [];
    let lifecycle = null;
    const engine = createEngine(calls, () => {
        calls.push(`trial.retry:${lifecycle.getPhase()}:${engine.state.turn}`);
        return { started: false, reason: "TRIAL_LAUNCH_PRESENTATION_BLOCKED" };
    });
    lifecycle = new TurnLifecycleService(engine);

    const result = lifecycle.advance();
    assert.equal(result, 5);
    assert.equal(lifecycle.getPhase(), TURN_LIFECYCLE_PHASES.ACTIVE);
    assert.equal(engine.state.turn, 5);
    assert.ok(calls.indexOf("deck.offering") < calls.indexOf("global.start"));
    assert.ok(calls.indexOf("global.start") < calls.indexOf("history.restore"));
    assert.ok(calls.indexOf("history.restore") < calls.indexOf("trial.retry:ACTIVE:5"));
    assert.deepEqual(engine.lastTrialLaunchAttempt, {
        started: false,
        reason: "TRIAL_LAUNCH_PRESENTATION_BLOCKED"
    });
}

{
    const calls = [];
    const engine = createEngine(calls, () => {
        throw new Error("synthetic launch failure");
    });
    const lifecycle = new TurnLifecycleService(engine);

    assert.equal(lifecycle.advance(), 5);
    assert.equal(lifecycle.getPhase(), TURN_LIFECYCLE_PHASES.ACTIVE);
    assert.equal(engine.state.turn, 5);
    assert.equal(engine.lastTrialLaunchAttempt?.started, false);
    assert.equal(engine.lastTrialLaunchAttempt?.reason, "TRIAL_LAUNCH_UNEXPECTED_ERROR");
    assert.equal(engine.lastTrialLaunchAttempt?.errorMessage, "synthetic launch failure");
}

{
    let closeCount = 0;
    const closeButton = { onclick: null };
    const component = new GlobalEventChoiceComponent({
        i18n: { t: key => key },
        onClose: () => { closeCount += 1; }
    });
    component.root = {
        hidden: false,
        innerHTML: "",
        querySelector: selector => selector === ".ge-choice-close" ? closeButton : null
    };

    component.showResolution({ choiceId: "A" });
    assert.equal(closeCount, 0, "resolution presentation does not retry before dismissal");
    assert.equal(component.root.hidden, false);
    assert.equal(typeof closeButton.onclick, "function");

    closeButton.onclick();
    assert.equal(component.root.hidden, true, "resolution presentation closes first");
    assert.equal(closeCount, 1, "dismissal triggers exactly one pending Trial retry callback");
}

console.log("diagnose_trial_launch_trigger_order: PASS");
