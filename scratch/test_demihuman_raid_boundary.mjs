import assert from "node:assert/strict";
import { GLOBAL_EVENTS_MASTER } from "../game/src/data/global_events.js";

const raid = GLOBAL_EVENTS_MASTER.find(def => def.id === "EVENT_DEMIHUMAN_RAID");
assert.ok(raid, "EVENT_DEMIHUMAN_RAID must exist");

assert.equal(raid.category, "THREAT");
assert.equal(raid.minStage, 2);
assert.equal(raid.duration, 1);
assert.equal(raid.choiceEventId ?? null, null,
    "Raid must not silently reuse the Captured Scout choice flow");

assert.ok(
    raid.conditions.some(condition =>
        condition.type === "HAS_HISTORY"
        && condition.historyType === "TRIAL_SURVIVED"
    ),
    "Raid must remain post-Trial history-gated"
);

assert.deepEqual(
    raid.effects,
    [],
    "Raid must remain effect-unresolved until a dedicated minor-raid encounter port exists"
);
assert.deepEqual(
    raid.endEffects,
    [],
    "Raid must not smuggle Trial settlement/progression through GE end effects"
);

for (const forbiddenKey of [
    "trialScenarioId",
    "trialIndex",
    "startTrial",
    "postTrialReward",
    "stageProgression",
    "settleTrial"
]) {
    assert.equal(
        Object.hasOwn(raid, forbiddenKey),
        false,
        `Raid GE data must not own Trial lifecycle key: ${forbiddenKey}`
    );
}

console.log("PASS demihuman raid boundary");
