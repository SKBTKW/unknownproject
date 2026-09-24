import assert from "node:assert/strict";
import { GLOBAL_EVENTS_MASTER } from "../game/src/data/global_events.js";

const validTargets = new Set();
for (const def of GLOBAL_EVENTS_MASTER) {
    if (def?.id) validTargets.add(def.id);
    if (def?.category) validTargets.add(def.category);
}

const modifiers = [];
for (const def of GLOBAL_EVENTS_MASTER) {
    for (const timing of ["effects", "endEffects"]) {
        for (const effect of def?.[timing] || []) {
            if (effect?.type !== "EVENT_WEIGHT_MODIFIER") continue;
            modifiers.push({
                eventId: def.id,
                timing,
                target: effect.targetTag || effect.targetEventId || null
            });
        }
    }
}

assert.ok(modifiers.length > 0, "at least one EVENT_WEIGHT_MODIFIER fixture should exist");

for (const modifier of modifiers) {
    assert.ok(
        modifier.target,
        `${modifier.eventId} ${modifier.timing} EVENT_WEIGHT_MODIFIER must declare a target`
    );
    assert.equal(
        validTargets.has(modifier.target),
        true,
        `${modifier.eventId} ${modifier.timing} target must resolve to an existing Global Event id/category: ${modifier.target}`
    );
}

assert.equal(
    modifiers.some(modifier => modifier.target === "FOOD_CRISIS"),
    false,
    "dead FOOD_CRISIS target must not re-enter the GE master"
);

console.log("PASS global event weight target contract");
