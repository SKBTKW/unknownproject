import { GAME_FACT_TYPES, GameFactHub } from "../game/src/core/game_fact.js";
import {
    GLOBAL_EVENT_CHOICE_IDS,
    GLOBAL_EVENT_CAPTURE_ZONES,
    GLOBAL_EVENT_CIVILIAN_MOODS,
    GLOBAL_EVENT_VISIBLE_FACTS
} from "../game/src/data/global_event_choices.js";
import { GlobalEventChoiceSystem } from "../game/src/systems/global_event_choice_system.js";

function assert(condition, message) {
    if (!condition) throw new Error(message);
}

const factHub = new GameFactHub();
const system = new GlobalEventChoiceSystem({ factHub });
const publicContext = {
    captureZone: GLOBAL_EVENT_CAPTURE_ZONES.INNER,
    visibleFacts: [
        GLOBAL_EVENT_VISIBLE_FACTS.NEAR_MAIN_ROAD,
        GLOBAL_EVENT_VISIBLE_FACTS.WATCHTOWER_SEEN,
        GLOBAL_EVENT_VISIBLE_FACTS.EXPERIENCED_SCOUT
    ],
    civilianMood: GLOBAL_EVENT_CIVILIAN_MOODS.ANGRY,
    publicEnemyTraits: ["RETALIATORY"],
    alertState: "WATCH"
};

const presentation = system.createPresentation(GLOBAL_EVENT_CHOICE_IDS.CAPTURED_SCOUT, publicContext);
assert(presentation.choices.length === 3, "captured scout must expose exactly three choices");
assert(presentation.publicContext.captureZone === "INNER", "public context must be preserved");

const resolution = system.resolveChoice(GLOBAL_EVENT_CHOICE_IDS.CAPTURED_SCOUT, "EXECUTE", publicContext);
assert(resolution.resultKey === "EVENT_CAPTURED_SCOUT_RESULT_EXECUTE", "resolved choice must expose its public result key");
assert(resolution.publicOutcomeTags.includes("RETALIATION_RISK"), "execute must expose retaliation risk");

const facts = factHub.getFacts();
assert(facts.length === 2, "presentation and resolution facts must both be emitted");
assert(facts[0].type === GAME_FACT_TYPES.GLOBAL_EVENT_CHOICE_PRESENTED, "first fact must be presentation");
assert(facts[1].type === GAME_FACT_TYPES.GLOBAL_EVENT_CHOICE_RESOLVED, "second fact must be resolution");

let hiddenRejected = false;
try {
    system.createPresentation(GLOBAL_EVENT_CHOICE_IDS.CAPTURED_SCOUT, {
        ...publicContext,
        nextTrialTurn: 27
    });
} catch (error) {
    hiddenRejected = String(error?.message || error).includes("GLOBAL_EVENT_PUBLIC_CONTEXT_FORBIDDEN_KEY");
}
assert(hiddenRejected, "hidden Trial schedule must never enter GE public context");

console.log("✅ Global Event choice public-context contract OK");
