import assert from "node:assert/strict";
import {
    GlobalEventPublicPresentationReadModel,
    EVENT_PUBLIC_PRESENTATION_POLICIES
} from "../game/src/presentation/global_event/global_event_public_presentation_read_model.js";

const readModel = new GlobalEventPublicPresentationReadModel();

const projected = readModel.project({
    timing: "START",
    eventId: "EVENT_DEMIHUMAN_TRACES",
    category: "THREAT",
    importance: "MAJOR",
    turn: 7
});

assert.ok(projected, "Traces START must project into public presentation metadata");
assert.equal(projected.eventId, "EVENT_DEMIHUMAN_TRACES");
assert.equal(projected.turn, 7);
assert.equal(projected.presentationKind, "MAJOR_EVENT");
assert.equal(projected.titleKey, "EVENT_DEMIHUMAN_TRACES_NAME");
assert.equal(projected.descriptionKey, "EVENT_DEMIHUMAN_TRACES_DESC");
assert.equal(projected.stillId, "STILL_DEMIHUMAN_TRACES");
assert.equal(projected.publicKnowledge, "DEMIHUMAN_ACTIVITY_NEAR_SURVIVAL_ZONE");

assert.equal(
    /DEMIHUMAN/.test(projected.titleKey) && /DEMIHUMAN/.test(projected.descriptionKey),
    true,
    "public copy must identify the traces as known Demihuman activity"
);

assert.equal(
    readModel.project({ timing: "END", eventId: "EVENT_DEMIHUMAN_TRACES", turn: 7 }),
    null,
    "END must not open a new major-event presentation"
);
assert.equal(
    readModel.project({ timing: "START", eventId: "EVENT_COLD_WAVE", turn: 7 }),
    null,
    "events without an explicit public presentation policy must fail closed"
);
assert.equal(readModel.project(null), null);

assert.deepEqual(
    EVENT_PUBLIC_PRESENTATION_POLICIES.EVENT_DEMIHUMAN_TRACES,
    {
        presentationKind: "MAJOR_EVENT",
        titleKey: "EVENT_DEMIHUMAN_TRACES_NAME",
        descriptionKey: "EVENT_DEMIHUMAN_TRACES_DESC",
        stillId: "STILL_DEMIHUMAN_TRACES",
        publicKnowledge: "DEMIHUMAN_ACTIVITY_NEAR_SURVIVAL_ZONE"
    },
    "Traces presentation policy must remain explicit and presentation-safe"
);

console.log("✅ Demihuman Traces public presentation read model OK");
