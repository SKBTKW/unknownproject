import assert from "assert/strict";
import {
    FirstRunService,
    FIRST_RUN_DEMIHUMAN_TRACES_EVENT_ID,
    FIRST_RUN_DEMIHUMAN_TRACES_VERSE
} from "../game/src/tutorial/first_run_service.js";
import { OFFERING_GENERATION_REASONS } from "../game/src/systems/deck_manager.js";

{
    const scheduled = [];
    const state = {
        turn: 1,
        investigationUnlocked: false,
        warningState: { state: "CALM" }
    };
    const engine = {
        state,
        globalEventManager: {
            scheduleEvent(eventId, verse) {
                scheduled.push({ eventId, verse });
                return { success: true, alreadyScheduled: false, scheduledEvent: { eventId, verse } };
            }
        }
    };

    const service = new FirstRunService({ enabled: true });
    const attachment = service.attach({ engine });

    assert.equal(attachment.success, true);
    assert.deepEqual(scheduled, [{
        eventId: FIRST_RUN_DEMIHUMAN_TRACES_EVENT_ID,
        verse: FIRST_RUN_DEMIHUMAN_TRACES_VERSE
    }]);
    assert.equal(state.investigationUnlocked, false, "FirstRun must not unlock Investigation directly");
    assert.deepEqual(state.warningState, { state: "CALM" }, "FirstRun must not mutate Warning State directly");

    const verse1 = service.getMinimumRequirements({
        reason: OFFERING_GENERATION_REASONS.INITIAL,
        state
    });
    assert.equal(verse1.length, 1);
    assert.equal(verse1[0].category, "LAND");
    assert.equal(verse1[0].requirePlaceable, true);

    state.turn = 7;
    state.investigationUnlocked = true;
    assert.deepEqual(service.getMinimumRequirements({
        reason: OFFERING_GENERATION_REASONS.VERSE_START,
        state
    }), [], "Verse 7 Offering must not force Investigation");

    state.turn = 8;
    const verse8 = service.getMinimumRequirements({
        reason: OFFERING_GENERATION_REASONS.VERSE_START,
        state
    });
    assert.equal(verse8.length, 1);
    assert.equal(verse8[0].category, "INVESTIGATION");

    assert.deepEqual(service.getMinimumRequirements({
        reason: OFFERING_GENERATION_REASONS.MULLIGAN,
        state
    }), [], "Mulligan must remain ordinary RNG without FirstRun guarantee");
}

{
    const service = new FirstRunService({ enabled: true });
    const state = { turn: 8, investigationUnlocked: false };
    assert.deepEqual(service.getMinimumRequirements({
        reason: OFFERING_GENERATION_REASONS.VERSE_START,
        state
    }), [], "Investigation guarantee requires canonical unlock first");
}

{
    let scheduleCalls = 0;
    const service = new FirstRunService({ enabled: false });
    const attachment = service.attach({
        engine: {
            globalEventManager: {
                scheduleEvent() {
                    scheduleCalls += 1;
                    return { success: true };
                }
            }
        }
    });
    assert.equal(attachment.success, true);
    assert.equal(attachment.enabled, false);
    assert.equal(scheduleCalls, 0, "non-FirstRun must not schedule tutorial GE");
    assert.deepEqual(service.getMinimumRequirements({
        reason: OFFERING_GENERATION_REASONS.INITIAL,
        state: { turn: 1 }
    }), []);
}

console.log("✅ FirstRun orchestration contract: Verse1 LAND / Verse7 GE / Verse8 Investigation boundaries PASS");
