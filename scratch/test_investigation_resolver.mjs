import assert from "node:assert/strict";
import { InvestigationResolver } from "../game/src/warning/systems/investigation_resolver.js";

const profile = {
    trialIndex: 2,
    threatRevision: 7,
    scaleBand: "LARGE",
    directionHints: ["NORTH"],
    physiqueTraits: ["LARGE_BODY_PRESENT"],
    equipmentTraits: ["HEAVY_ARMOR"],
    movementTraits: ["NIGHT_MOVEMENT"],
    terrainTraits: ["FOREST_ADAPTED"]
};

const resolver = new InvestigationResolver({ rng: () => 0 });

const footprintReport = resolver.resolve({
    profile,
    observedAtVerse: 12,
    reportId: "report:footprints:12",
    sourcePolicy: {
        sourceType: "FOOTPRINTS",
        allowedFacets: ["directionHints", "physiqueTraits"],
        maxObservations: 2,
        textKey: "INVESTIGATION_FOOTPRINTS"
    }
});

assert.equal(footprintReport.trialIndex, 2);
assert.equal(footprintReport.threatRevision, 7);
assert.equal(footprintReport.observedAtVerse, 12);
assert.equal(footprintReport.sourceType, "FOOTPRINTS");
assert.deepEqual(footprintReport.observations, [
    { facet: "DIRECTION", tag: "NORTH" },
    { facet: "PHYSIQUE", tag: "LARGE_BODY_PRESENT" }
]);

const scoutReport = resolver.resolve({
    profile,
    observedAtVerse: 13,
    sourcePolicy: {
        sourceType: "SCOUT_SIGHTING",
        allowedFacets: ["equipmentTraits"],
        maxObservations: 3
    }
});

assert.deepEqual(scoutReport.observations, [
    { facet: "EQUIPMENT", tag: "HEAVY_ARMOR" }
]);

const impossibleTraitReport = resolver.resolve({
    profile: {
        ...profile,
        equipmentTraits: []
    },
    observedAtVerse: 14,
    sourcePolicy: {
        sourceType: "SCOUT_SIGHTING",
        allowedFacets: ["equipmentTraits"],
        maxObservations: 2
    }
});

assert.deepEqual(impossibleTraitReport.observations, []);
assert.equal(
    impossibleTraitReport.observations.some(observation => observation.tag === "HEAVY_ARMOR"),
    false
);

const staleSnapshot = resolver.resolve({
    profile,
    observedAtVerse: 15,
    sourcePolicy: {
        sourceType: "CAMP_REMAINS",
        allowedFacets: ["scaleBand"],
        maxObservations: 1
    }
});

profile.threatRevision = 8;
profile.scaleBand = "VERY_LARGE";

assert.equal(staleSnapshot.threatRevision, 7);
assert.deepEqual(staleSnapshot.observations, [
    { facet: "SCALE", tag: "SCALE_LARGE" }
]);

console.log("PASS test_investigation_resolver");
