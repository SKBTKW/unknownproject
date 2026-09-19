import assert from "assert/strict";
import { GameEngine } from "../game/src/core/game_engine.js";
import { OFFERING_GENERATION_REASONS } from "../game/src/systems/deck_manager.js";
import { WARNING_STATES } from "../game/src/warning/domain/warning_state.js";
import {
    FIRST_RUN_DEMIHUMAN_TRACES_EVENT_ID,
    FIRST_RUN_DEMIHUMAN_TRACES_VERSE
} from "../game/src/tutorial/first_run_service.js";

const engine = GameEngine.createGame({
    runSeed: 20260919,
    firstRun: true
});

assert.equal(engine.firstRunAttachment?.success, true, "FirstRun must attach on explicit firstRun mode");
assert.equal(engine.firstRunAttachment?.enabled, true);

const scheduled = engine.state.scheduledGlobalEvents || [];
assert.equal(
    scheduled.some(item =>
        item?.eventId === FIRST_RUN_DEMIHUMAN_TRACES_EVENT_ID
        && item?.verse === FIRST_RUN_DEMIHUMAN_TRACES_VERSE
    ),
    true,
    "FirstRun must schedule the canonical demihuman traces GE for Verse 7"
);

assert.equal(engine.state.investigationUnlocked, false, "FirstRun attach must not unlock Investigation directly");
assert.equal(engine.warningStateService.getState(), WARNING_STATES.CALM, "FirstRun attach must not mutate Warning directly");

const initialOffering = engine.state.handOffering || [];
assert.equal(initialOffering.length > 0, true);
assert.equal(
    initialOffering.some(card => {
        const definition = card?.terrain || card;
        return definition?.category === "LAND" && engine.deckManager._isCardPlaceableNow(card);
    }),
    true,
    "Verse 1 Offering must contain at least one actually placeable LAND"
);
assert.equal(engine.deckManager.lastOfferingGeneration?.reason, OFFERING_GENERATION_REASONS.INITIAL);

engine.state.turn = FIRST_RUN_DEMIHUMAN_TRACES_VERSE;
const triggered = engine.globalEventManager.onTurnStart();
assert.equal(triggered?.definitionId, FIRST_RUN_DEMIHUMAN_TRACES_EVENT_ID, "Verse 7 must trigger the scheduled traces event");
assert.equal(engine.state.investigationUnlocked, true, "canonical InvestigationUnlockBridge must unlock on GE START");
assert.equal(engine.state.investigationUnlockedAtVerse, FIRST_RUN_DEMIHUMAN_TRACES_VERSE);
assert.equal(engine.warningStateService.getState(), WARNING_STATES.OMEN, "canonical WarningOmenBridge must enter OMEN on GE START");

engine.state.turn = 8;
const verse8Offering = engine.deckManager.generateOfferingCards({
    reason: OFFERING_GENERATION_REASONS.VERSE_START
});
assert.equal(
    verse8Offering.some(card => (card?.terrain || card)?.category === "INVESTIGATION"),
    true,
    "Verse 8 Offering must contain at least one normally eligible Investigation card after canonical unlock"
);

const normalEngine = GameEngine.createGame({
    runSeed: 20260919,
    firstRun: false
});
assert.equal(normalEngine.firstRunService, null, "normal Run must not attach FirstRun policy");
assert.equal(
    (normalEngine.state.scheduledGlobalEvents || []).some(item => item?.eventId === FIRST_RUN_DEMIHUMAN_TRACES_EVENT_ID),
    false,
    "normal Run must not schedule the FirstRun trace event"
);

console.log("✅ FirstRun GameEngine integration: Verse1 -> Verse7 GE -> OMEN/unlock -> Verse8 Investigation PASS");
