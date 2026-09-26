import assert from "node:assert/strict";

import { GameEngine } from "../game/src/core/game_engine.js";
import { GLOBAL_EVENT_CHOICE_MASTER } from "../game/src/data/global_event_choices.js";
import { GLOBAL_EVENTS_MASTER } from "../game/src/data/global_events.js";
import { ECONOMY_COST_AUTHORING_ANCHORS_V1 } from "./economy_cost_authoring_anchors_v1.mjs";

const ECONOMIC_KEYS = Object.freeze(["food", "wood", "material"]);

function validateEconomicMap(map, label) {
    if (!map || typeof map !== "object" || Array.isArray(map)) {
        return Object.freeze({ valid: false, label, food: 0, material: 0 });
    }

    for (const key of ECONOMIC_KEYS) {
        if (map[key] === undefined) continue;
        assert.equal(
            typeof map[key] === "number" && Number.isFinite(map[key]) && map[key] >= 0,
            true,
            `${label}.${key} must be a finite non-negative number`
        );
    }

    return Object.freeze({
        valid: true,
        label,
        food: Number(map.food || 0),
        material: Number(map.material ?? map.wood ?? 0)
    });
}

function collectExplicitEconomicSpends(value, path = "root", rows = []) {
    if (!value || typeof value !== "object") return rows;

    if (Array.isArray(value)) {
        value.forEach((entry, index) => collectExplicitEconomicSpends(entry, `${path}[${index}]`, rows));
        return rows;
    }

    if (Object.prototype.hasOwnProperty.call(value, "cost")) {
        const normalized = validateEconomicMap(value.cost, `${path}.cost`);
        if (normalized.food > 0 || normalized.material > 0) {
            rows.push(Object.freeze({
                source: "COST",
                path: `${path}.cost`,
                id: value.id || null,
                food: normalized.food,
                material: normalized.material
            }));
        }
    }

    if (
        value.type === "RESOURCE_DELTA"
        && ECONOMIC_KEYS.includes(value.resource)
        && Number(value.amount) < 0
    ) {
        assert.equal(Number.isFinite(Number(value.amount)), true, `${path}.amount must be finite`);
        const amount = Math.abs(Number(value.amount));
        rows.push(Object.freeze({
            source: "NEGATIVE_RESOURCE_DELTA",
            path,
            id: value.id || null,
            food: value.resource === "food" ? amount : 0,
            material: value.resource === "wood" || value.resource === "material" ? amount : 0
        }));
    }

    for (const [key, child] of Object.entries(value)) {
        if (key === "cost") continue;
        collectExplicitEconomicSpends(child, `${path}.${key}`, rows);
    }
    return rows;
}

function summarizeZoneDefinition(definition) {
    const creationCost = definition?.creationCost || null;
    const maintenance = definition?.maintenance || null;

    let creationEconomic = null;
    if (creationCost?.status === "RESOLVED") {
        creationEconomic = validateEconomicMap(
            creationCost.base || {},
            `zone:${definition.id}:creationCost.base`
        );
    }

    let maintenanceEconomic = null;
    if (maintenance?.status === "RESOLVED") {
        maintenanceEconomic = validateEconomicMap(
            maintenance.resources || {},
            `zone:${definition.id}:maintenance.resources`
        );
    }

    return Object.freeze({
        id: definition?.id || null,
        creationStatus: creationCost?.status || "MISSING",
        creationFood: creationEconomic?.food || 0,
        creationMaterial: creationEconomic?.material || 0,
        maintenanceStatus: maintenance?.status || "MISSING",
        maintenanceFood: maintenanceEconomic?.food || 0,
        maintenanceMaterial: maintenanceEconomic?.material || 0
    });
}

console.log("\n=== Economy unpriced-domain inventory ===");

const stage1Events = GLOBAL_EVENTS_MASTER.filter(event => Number(event?.minStage || 1) <= 1);
const stage1EventSpends = collectExplicitEconomicSpends(stage1Events, "STAGE1_GLOBAL_EVENTS");
const choiceSpends = collectExplicitEconomicSpends(
    GLOBAL_EVENT_CHOICE_MASTER,
    "GLOBAL_EVENT_CHOICE_MASTER"
);

console.log(
    "GE_COST_INVENTORY",
    JSON.stringify({
        stage1EventCount: stage1Events.length,
        stage1ExplicitFoodMaterialSpendCount: stage1EventSpends.length,
        choiceDefinitionCount: GLOBAL_EVENT_CHOICE_MASTER.length,
        choiceExplicitFoodMaterialSpendCount: choiceSpends.length
    })
);

for (const row of [...stage1EventSpends, ...choiceSpends]) {
    console.log(
        "GE_COST",
        row.id || row.path,
        `source=${row.source}`,
        `🌾${row.food}`,
        `🧱${row.material}`
    );
}

const engine = GameEngine.createGame({
    runSeed: 20260924,
    firstRun: true
});
const zoneConversionService = engine.zoneConversionService;

assert.ok(
    zoneConversionService
        && typeof zoneConversionService.listDefinitionIds === "function"
        && typeof zoneConversionService.getDefinition === "function",
    "canonical ZoneConversionService must expose Board-owned definition authority reads"
);

const zoneRows = zoneConversionService
    .listDefinitionIds()
    .map(definitionId => zoneConversionService.getDefinition(definitionId))
    .filter(Boolean)
    .map(summarizeZoneDefinition);
const resolvedCreationRows = zoneRows.filter(row =>
    row.creationStatus === "RESOLVED"
    && (row.creationFood > 0 || row.creationMaterial > 0)
);
const resolvedMaintenanceRows = zoneRows.filter(row =>
    row.maintenanceStatus === "RESOLVED"
    && (row.maintenanceFood > 0 || row.maintenanceMaterial > 0)
);

console.log(
    "ZONE_COST_INVENTORY",
    JSON.stringify({
        runtimeDefinitionCount: zoneRows.length,
        resolvedFoodMaterialCreationCostCount: resolvedCreationRows.length,
        resolvedFoodMaterialMaintenanceCostCount: resolvedMaintenanceRows.length
    })
);

for (const row of zoneRows) {
    console.log(
        "ZONE_COST",
        row.id,
        `creation=${row.creationStatus}:🌾${row.creationFood}/🧱${row.creationMaterial}`,
        `maintenance=${row.maintenanceStatus}:🌾${row.maintenanceFood}/🧱${row.maintenanceMaterial}`
    );
}

const strategicSpace = ECONOMY_COST_AUTHORING_ANCHORS_V1.pve.strategicAuthoringSpace;
console.log(
    "UNPRICED_DOMAIN_AUTHORING_SPACE",
    JSON.stringify({
        routineStage1CardMaxPve: ECONOMY_COST_AUTHORING_ANCHORS_V1.pve.routineStage1CardMax,
        strategicOpenMinPve: strategicSpace.min,
        strategicOpenMaxExclusivePve: strategicSpace.maxExclusive,
        firstRunTrial1HeavyMinPve: ECONOMY_COST_AUTHORING_ANCHORS_V1.pve.firstRunTrial1Heavy.min,
        currentStage1GeChoicePricingState:
            stage1EventSpends.length === 0 && choiceSpends.length === 0
                ? "UNPRICED_FOOD_MATERIAL"
                : "PARTIALLY_PRICED",
        currentZoneConversionPricingState:
            zoneRows.length === 0
                ? "NO_CANONICAL_RUNTIME_DEFINITIONS"
                : (resolvedCreationRows.length === zoneRows.length ? "PRICED" : "PARTIALLY_PRICED")
    })
);

// Inventory only. Do not require GE or Zone costs to remain absent: future
// authoring should be allowed to populate the open strategic PVE band.
assert.equal(
    [...stage1EventSpends, ...choiceSpends].every(row =>
        row.food >= 0
        && row.material >= 0
        && Number.isFinite(row.food)
        && Number.isFinite(row.material)
    ),
    true
);

console.log("✅ Economy unpriced-domain inventory PASS");
