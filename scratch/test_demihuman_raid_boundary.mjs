import assert from "node:assert/strict";
import fs from "node:fs";
import { GLOBAL_EVENTS_MASTER } from "../game/src/data/global_events.js";

const raid = GLOBAL_EVENTS_MASTER.find(def => def.id === "EVENT_DEMIHUMAN_RAID");
assert.ok(raid, "EVENT_DEMIHUMAN_RAID must exist");

assert.equal(raid.category, "THREAT");
assert.equal(raid.minStage, 2);
assert.equal(raid.duration, 1);
assert.equal(
    raid.choiceEventId ?? null,
    null,
    "Raid must not silently reuse Captured Scout choice flow"
);

assert.ok(
    raid.conditions.some(condition =>
        condition.type === "HAS_HISTORY"
        && condition.historyType === "TRIAL_SURVIVED"
    ),
    "Raid must remain gated by canonical survived-Trial history"
);

assert.deepEqual(
    raid.effects,
    [],
    "Raid must fail closed while no dedicated Minor Raid encounter port exists"
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
    "startScenario",
    "settleTrial",
    "settlement",
    "stageProgression",
    "postTrialReward",
    "postTrial"
]) {
    assert.equal(
        Object.hasOwn(raid, forbiddenKey),
        false,
        `Raid GE definition must not own Trial lifecycle key: ${forbiddenKey}`
    );
}

const geRuntimeSource = fs.readFileSync(
    new URL("../game/src/systems/global_event_system.js", import.meta.url),
    "utf8"
);

for (const forbiddenRuntimeCall of [
    ".startScenario(",
    ".settleTrialResult(",
    ".completeTrial(",
    ".completeAfterPresentationCleanup(",
    "postTrialProgression",
    "postTrialReward",
    "stageProgressionService"
]) {
    assert.equal(
        geRuntimeSource.includes(forbiddenRuntimeCall),
        false,
        `Global Event runtime must not call normal Trial lifecycle directly: ${forbiddenRuntimeCall}`
    );
}

console.log("PASS demihuman raid boundary");
