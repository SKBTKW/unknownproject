import assert from "node:assert/strict";
import fs from "node:fs";

import {
    CARD_RUNTIME_ACTIVE_CATEGORIES,
    isCardRuntimeActive
} from "../game/src/systems/card_runtime_policy.js";
import { COMMAND_CARDS_MASTER } from "../game/src/data/command_cards_data.js";

const readJson = path => JSON.parse(fs.readFileSync(new URL(path, import.meta.url), "utf8"));
const read = path => fs.readFileSync(new URL(path, import.meta.url), "utf8");

const economy = readJson("../game/src/data/economy_cards.json");
const military = readJson("../game/src/data/military_cards.json");
const mystic = readJson("../game/src/data/mystic_cards.json");
const defenseSource = read("../game/src/systems/defense_system.js");
const maintenanceSource = read("../game/src/systems/maintenance_fallback_system.js");
const stateSource = read("../game/src/v2_unity_ready_main.js");
const deckSource = read("../game/src/systems/deck_manager.js");

const stage1 = [...economy, ...military, ...mystic]
    .filter(card => Number(card.minStage ?? 1) === 1);
const byId = new Map(stage1.map(card => [card.id, card]));
const generatedById = new Map(COMMAND_CARDS_MASTER.map(card => [card.id, card]));

const PROTOTYPE = Object.freeze([
    "CMD_EMERGENCY_LEVY",
    "CMD_VIGILANCE",
    "CMD_REKINDLE_EMBER"
]);
const SUPPORT = Object.freeze([
    "CMD_RATIONING",
    "CMD_MEDITATION",
    "CMD_ABANDONED_SETTLEMENT"
]);
const BLOCKED = Object.freeze([
    "CMD_WETLAND_RECLAMATION",
    "CMD_LOGGING_CAMP",
    "CMD_GRANARY",
    "CMD_AGRICULTURAL_REFORM",
    "CMD_PASTORAL_FARM",
    "CMD_MILITARY_FOCUS",
    "CMD_FILL_THE_VOID",
    "CMD_VOICE_BENEATH_EARTH",
    "CMD_MYSTIC_FOCUS"
]);

const effect = (id, type, predicate = () => true) =>
    (byId.get(id)?.effects || []).find(item => item?.type === type && predicate(item));

console.log("\nStage1 non-LAND live candidate audit");

assert.equal(stage1.length, 15, "Stage1 source JSON must expose exactly 15 dormant non-LAND definitions");
assert.equal(new Set([...PROTOTYPE, ...SUPPORT, ...BLOCKED]).size, 15);
assert.deepEqual(
    [...new Set([...PROTOTYPE, ...SUPPORT, ...BLOCKED])].sort(),
    [...byId.keys()].sort(),
    "every Stage1 non-LAND source card must have an explicit audit disposition"
);

assert.deepEqual(
    [...CARD_RUNTIME_ACTIVE_CATEGORIES],
    ["LAND", "INVESTIGATION"],
    "audit must not silently reactivate legacy categories"
);
for (const id of PROTOTYPE) {
    assert.equal(isCardRuntimeActive(byId.get(id)), false, `${id} remains dormant until an explicit activation change`);
}

{
    const card = byId.get("CMD_EMERGENCY_LEVY");
    assert.equal(card.cost.food, 20);
    assert.ok(effect("CMD_EMERGENCY_LEVY", "RESOURCE_DELTA",
        item => item.resource === "wood" && item.amount === 15));
    assert.equal(Boolean(effect("CMD_EMERGENCY_LEVY", "STATE_SET")), false,
        "Emergency Levy v1 must not schedule a future maintenance penalty");
    assert.equal(Boolean(effect("CMD_EMERGENCY_LEVY", "BUFF_ADD")), false,
        "Emergency Levy v1 is immediate-only");
}

for (const id of ["CMD_RATIONING", "CMD_EMERGENCY_LEVY", "CMD_REKINDLE_EMBER"]) {
    assert.deepEqual(
        generatedById.get(id),
        byId.get(id),
        `${id} generated command master must match source JSON`
    );
}

{
    const card = byId.get("CMD_VIGILANCE");
    assert.equal(card.reqTrialOrLowDefense, undefined,
        "Vigilance must not retain the legacy trial-or-low-defense gate");
    assert.deepEqual(card.offering?.requirements, [{
        id: "VIGILANCE_WARNING_TENSE",
        type: "WARNING_STATE",
        state: "TENSE"
    }], "Vigilance Offering must use semantic Warning state");
    const generatedCopies = COMMAND_CARDS_MASTER.filter(candidate => candidate.id === "CMD_VIGILANCE");
    assert.equal(generatedCopies.length, 1,
        "combined command master must expose one canonical Vigilance definition");
    assert.deepEqual(generatedCopies[0].offering?.requirements, card.offering?.requirements,
        "Vigilance source/generated Offering requirements must stay in parity");
    assert.equal(card.cost.wood, 15);
    assert.ok(effect("CMD_VIGILANCE", "STATE_SET",
        item => item.key === "vigilanceTurns" && item.value === 2));
    assert.ok(effect("CMD_VIGILANCE", "STATE_SET",
        item => item.key === "vigilanceStartsNextTurn" && item.value === true));
    assert.ok(defenseSource.includes("state.vigilanceTurns > 0"));
    assert.ok(stateSource.includes("this.vigilanceTurns -= 1"));
}

{
    const card = byId.get("CMD_REKINDLE_EMBER");
    assert.equal(card.cost.mystic, 10);
    assert.equal(card.maxEmber, 5);
    assert.ok(effect("CMD_REKINDLE_EMBER", "RESOURCE_DELTA",
        item => item.resource === "ember" && item.amount === 3));
    assert.equal(Boolean(effect("CMD_REKINDLE_EMBER", "STATE_SET")), false,
        "Rekindle v1 must not write reserve-upkeep waiver state");
    assert.equal(Boolean(effect("CMD_REKINDLE_EMBER", "BUFF_ADD")), false,
        "Rekindle v1 is immediate-only and must not leave a duration buff");
}

{
    const card = byId.get("CMD_RATIONING");
    assert.deepEqual(card.cost, {});
    assert.ok(effect("CMD_RATIONING", "STATE_SET",
        item => item.key === "foodCostHalvedTurns" && item.value === 1));
    assert.equal(Boolean(effect("CMD_RATIONING", "STATE_SET",
        item => item.key === "foodCostRationingActive" || item.key === "foodCostRationingDiscount")), false,
        "Rationing v1 uses one canonical halving state");
    assert.ok(maintenanceSource.includes("state.foodCostHalvedTurns > 0"));
}

{
    const card = byId.get("CMD_MEDITATION");
    assert.deepEqual(card.cost, {});
    assert.ok(effect("CMD_MEDITATION", "RESOURCE_DELTA",
        item => item.resource === "mystic" && item.amount === 3));
    assert.ok(effect("CMD_MEDITATION", "DRAW_BIAS_SET",
        item => item.bias?.targetCategory === "LAND"));
}

{
    const card = byId.get("CMD_ABANDONED_SETTLEMENT");
    assert.equal(card.cost.ember, 1);
    assert.equal((card.effects || []).length, 0);
    assert.ok(deckSource.includes('cId === "CMD_ABANDONED_SETTLEMENT"'));
    assert.ok(deckSource.includes("checkSystem.resolve"));
}

{
    const card = byId.get("CMD_LOGGING_CAMP");
    assert.ok(card.tags.includes("SPECIAL_BLOCK"));
    assert.equal(Boolean(effect("CMD_LOGGING_CAMP", "DOMAIN_ACTION")), false);
    assert.ok(effect("CMD_LOGGING_CAMP", "RESOURCE_DELTA",
        item => item.resource === "wood" && item.amount === 8));
}

{
    const card = byId.get("CMD_GRANARY");
    assert.ok(effect("CMD_GRANARY", "STATE_INCREMENT",
        item => item.key === "granaryCount" && item.amount === 1));
    assert.equal(maintenanceSource.includes("granaryCount"), false);
}

{
    const card = byId.get("CMD_AGRICULTURAL_REFORM");
    assert.ok(effect("CMD_AGRICULTURAL_REFORM", "STATE_INCREMENT",
        item => item.key === "permanentPlainsFoodBonus" && item.amount === 1));
    assert.equal(Boolean(effect("CMD_AGRICULTURAL_REFORM", "DOMAIN_ACTION")), false);
}

for (const id of ["CMD_WETLAND_RECLAMATION", "CMD_PASTORAL_FARM"]) {
    assert.equal((byId.get(id)?.effects || []).length, 0, `${id} still depends on legacy execution semantics`);
}

{
    const card = byId.get("CMD_MILITARY_FOCUS");
    assert.ok(effect("CMD_MILITARY_FOCUS", "DRAW_BIAS_SET",
        item => item.bias?.targetCategory === "MILITARY"));
    assert.equal(CARD_RUNTIME_ACTIVE_CATEGORIES.includes("MILITARY"), false);
}

for (const [id, key] of [
    ["CMD_FILL_THE_VOID", "fillTheVoidTurns"],
    ["CMD_VOICE_BENEATH_EARTH", "voiceBeneathEarthTurns"]
]) {
    assert.ok(effect(id, "STATE_SET", item => item.key === key));
}

{
    const card = byId.get("CMD_MYSTIC_FOCUS");
    assert.ok(effect("CMD_MYSTIC_FOCUS", "DRAW_BIAS_SET",
        item => item.bias?.targetCategory === "MYSTIC"));
    assert.equal(CARD_RUNTIME_ACTIVE_CATEGORIES.includes("MYSTIC"), false);
}

console.log("  prototype candidates:", PROTOTYPE.join(", "));
console.log("  support / migration:", SUPPORT.join(", "));
console.log("  blocked until semantic repair:", BLOCKED.join(", "));
console.log("✅ Stage1 non-LAND live candidate audit PASS");
