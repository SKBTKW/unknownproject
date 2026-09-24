import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import {
    SPECIAL_BLOCK_COST_STATUS,
    SPECIAL_BLOCK_DEFINITIONS,
    resolveSpecialBlockCreationCost
} from "../game/src/core/special_block_domain.js";

const economyCards = JSON.parse(
    readFileSync(new URL("../game/src/data/economy_cards.json", import.meta.url), "utf8")
);
const investigationCards = JSON.parse(
    readFileSync(new URL("../game/src/data/investigation_cards.json", import.meta.url), "utf8")
);
const specialBlockSource = readFileSync(
    new URL("../game/src/core/special_block_domain.js", import.meta.url),
    "utf8"
);
const globalEventChoiceSource = readFileSync(
    new URL("../game/src/data/global_event_choices.js", import.meta.url),
    "utf8"
);

const stage1 = economyCards.filter(card => Number(card.minStage) === 1);
assert.deepEqual(
    stage1.map(card => card.id),
    [
        "CMD_RATIONING",
        "CMD_WETLAND_RECLAMATION",
        "CMD_LOGGING_CAMP",
        "CMD_GRANARY",
        "CMD_AGRICULTURAL_REFORM",
        "CMD_PASTORAL_FARM",
        "CMD_ABANDONED_SETTLEMENT",
        "CMD_EMERGENCY_LEVY"
    ],
    "Stage1 sink portfolio audit must be updated when the Stage1 economy-card set changes"
);

const expectedCosts = new Map([
    ["CMD_RATIONING", {}],
    ["CMD_WETLAND_RECLAMATION", { wood: 15, ember: 1 }],
    ["CMD_LOGGING_CAMP", { ember: 1 }],
    ["CMD_GRANARY", { wood: 20 }],
    ["CMD_AGRICULTURAL_REFORM", { wood: 20 }],
    ["CMD_PASTORAL_FARM", { wood: 15 }],
    ["CMD_ABANDONED_SETTLEMENT", { ember: 1 }],
    ["CMD_EMERGENCY_LEVY", { food: 20 }]
]);

for (const card of stage1) {
    assert.deepEqual(
        card.cost || {},
        expectedCosts.get(card.id),
        `${card.id}: audit must be updated when current Stage1 card cost changes`
    );
}

assert.equal(
    investigationCards
        .filter(card => Number(card.minStage) === 1)
        .every(card => Object.keys(card.cost || {}).length === 0),
    true,
    "current Stage1 Investigation cards are resource-free; update portfolio audit when this changes"
);

for (const type of ["FARM", "LOGGING_CAMP", "ALTAR"]) {
    assert.equal(
        specialBlockSource.includes(`${type}: '${type}'`),
        true,
        `${type} Special Block must remain discoverable by the portfolio audit`
    );
}
assert.equal(
    /creationCost\s*:/.test(specialBlockSource),
    true,
    "Special Block domain must expose the canonical creation-cost boundary"
);
for (const type of ["FARM", "LOGGING_CAMP", "ALTAR"]) {
    assert.equal(
        resolveSpecialBlockCreationCost(SPECIAL_BLOCK_DEFINITIONS[type]).status,
        SPECIAL_BLOCK_COST_STATUS.UNRESOLVED,
        `${type} creation-cost balance must remain unresolved until explicitly authored`
    );
}
assert.equal(
    /maintenance\s*:|upkeep\s*:/.test(specialBlockSource),
    false,
    "Special Block domain currently has no canonical upkeep; update portfolio audit when maintenance is added"
);

assert.equal(
    /\bcost\s*:/.test(globalEventChoiceSource),
    false,
    "current choice GE definitions have no resource cost; update portfolio audit when GE spending is added"
);

console.log("test_stage1_resource_sink_portfolio: PASS");
