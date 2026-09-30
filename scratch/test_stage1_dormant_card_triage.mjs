import assert from "node:assert/strict";

import { readFileSync } from "node:fs";

const ECONOMY_CARDS_MASTER = JSON.parse(
    readFileSync(new URL("../game/src/data/economy_cards.json", import.meta.url), "utf8")
);
const MILITARY_CARDS_MASTER = JSON.parse(
    readFileSync(new URL("../game/src/data/military_cards.json", import.meta.url), "utf8")
);
const MYSTIC_CARDS_MASTER = JSON.parse(
    readFileSync(new URL("../game/src/data/mystic_cards.json", import.meta.url), "utf8")
);
import { isCardRuntimeActive } from "../game/src/systems/card_runtime_policy.js";

const TRIAGE = Object.freeze({
    LIGHT_FIX_RETURN: Object.freeze([
        "CMD_RATIONING",
        "CMD_ABANDONED_SETTLEMENT",
        "CMD_EMERGENCY_LEVY",
        "CMD_REKINDLE_EMBER"
    ]),
    REWORK_BEFORE_RETURN: Object.freeze([
        "CMD_PASTORAL_FARM",
        "CMD_VIGILANCE",
        "CMD_MEDITATION"
    ]),
    DEFER_UNTIL_SYSTEM_EXISTS: Object.freeze([
        "CMD_FILL_THE_VOID",
        "CMD_VOICE_BENEATH_EARTH"
    ]),
    MOVE_TO_DIRECTIVE_OR_REDESIGN: Object.freeze([
        "CMD_MILITARY_FOCUS",
        "CMD_MYSTIC_FOCUS"
    ])
});

const authoredStage1 = [
    ...ECONOMY_CARDS_MASTER,
    ...MILITARY_CARDS_MASTER,
    ...MYSTIC_CARDS_MASTER
].filter(card => Number(card?.minStage ?? 1) <= 1);

const dormantStage1 = authoredStage1.filter(card => !isCardRuntimeActive(card));
const dormantIds = dormantStage1.map(card => card.id).sort();
const triagedIds = Object.values(TRIAGE).flat().sort();

assert.equal(dormantIds.length, 11, "Stage1 dormant authored non-LAND baseline changed; revisit triage");
assert.deepEqual(
    triagedIds,
    dormantIds,
    "every current Stage1 dormant authored card must appear exactly once in the triage"
);
assert.equal(new Set(triagedIds).size, triagedIds.length, "triage IDs must be unique");

console.log("STAGE1_DORMANT_CARD_TRIAGE", JSON.stringify({
    dormantCount: dormantIds.length,
    groups: Object.fromEntries(
        Object.entries(TRIAGE).map(([key, ids]) => [key, ids.length])
    ),
    dormantIds
}));
console.log("✅ Stage1 dormant card triage inventory PASS");
