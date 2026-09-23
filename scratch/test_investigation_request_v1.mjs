import assert from "node:assert/strict";
import { GameplayRandomService } from "../game/src/core/gameplay_random_service.js";
import {
    createKnownEnemyState,
    createObservableEnemyProfile,
    InvestigationAvailabilityPolicy,
    InvestigationRequestService
} from "../game/src/warning/index.js";

const profile = createObservableEnemyProfile({
    trialIndex: 1,
    threatRevision: 4,
    scaleBand: "LARGE",
    directionHints: ["NORTH"],
    physiqueTraits: ["LARGE_BODY_PRESENT"],
    equipmentTraits: ["HEAVY_ARMOR"],
    movementTraits: ["NIGHT_MOVEMENT"],
    terrainTraits: ["FOREST_USE"]
});

const availability = new InvestigationAvailabilityPolicy();
assert.equal(availability.isAvailable({ investigationUnlocked: false }), false);
assert.equal(
    availability.isAvailable({ investigationUnlocked: true, warningState: { state: "CALM" } }),
    false
);
assert.equal(
    availability.isAvailable({ investigationUnlocked: true, warningState: { state: "OMEN" } }),
    true
);

const normalKnown = createKnownEnemyState({ trialIndex: 1 });
const normal = new InvestigationRequestService({
    randomSource: new GameplayRandomService(12345)
});
const normalResult = normal.perform({
    profile,
    knownEnemyState: normalKnown,
    observedAtVerse: 8,
    reportId: "investigation:normal:1"
});
assert.equal(normalResult.success, true);
assert.equal(normalResult.roll, null);
assert.ok(normalResult.fragmentsDiscovered.length >= 1);
assert.equal(normalKnown.reports.length, 1);

const snapshotTag = normalResult.report.observations[0].tag;
profile.directionHints.push("EAST");
profile.equipmentTraits[0] = "CHANGED_AFTER_REPORT";
assert.equal(normalResult.report.observations[0].tag, snapshotTag);

const lowRandom = { nextFloat: () => 0, nextInt: () => 1 };
const low = new InvestigationRequestService({ randomSource: lowRandom });
const lowResult = low.perform({
    profile,
    knownEnemyState: createKnownEnemyState({ trialIndex: 1 }),
    observedAtVerse: 9,
    reportId: "investigation:low:1",
    enhanced: true,
    costPaid: { food: 10 }
});
assert.equal(lowResult.success, true);
assert.equal(lowResult.roll.total, 2);
assert.equal(lowResult.critical, false);
assert.equal(lowResult.fragmentsDiscovered.length, 1, "low enhanced roll must keep base information");

const criticalRandom = { nextFloat: () => 0, nextInt: () => 6 };
const critical = new InvestigationRequestService({ randomSource: criticalRandom });
const criticalResult = critical.perform({
    profile,
    knownEnemyState: createKnownEnemyState({ trialIndex: 1 }),
    observedAtVerse: 10,
    reportId: "investigation:critical:1",
    enhanced: true
});
assert.equal(criticalResult.success, true);
assert.equal(criticalResult.roll.total, 12);
assert.equal(criticalResult.critical, true);
assert.ok(criticalResult.fragmentsDiscovered.length >= 2);
assert.ok(
    new Set(criticalResult.fragmentsDiscovered.map(fragment => fragment.facet)).size >= 2,
    "critical should span multiple observable facets when the profile permits it"
);

const known = createKnownEnemyState({ trialIndex: 1 });
known.observedTags.push("SCALE_LARGE");
const useful = new InvestigationRequestService({
    randomSource: { nextFloat: () => 0, nextInt: () => 1 }
});
const usefulResult = useful.perform({
    profile,
    knownEnemyState: known,
    observedAtVerse: 11,
    reportId: "investigation:useful:1"
});
assert.equal(usefulResult.success, true);
assert.notEqual(usefulResult.fragmentsDiscovered[0].tag, "SCALE_LARGE", "unknown fragments must be preferred");

const seedA = new InvestigationRequestService({ randomSource: new GameplayRandomService(777) });
const seedB = new InvestigationRequestService({ randomSource: new GameplayRandomService(777) });
const seededA = seedA.perform({
    profile,
    knownEnemyState: createKnownEnemyState({ trialIndex: 1 }),
    observedAtVerse: 12,
    reportId: "seed:a",
    enhanced: true
});
const seededB = seedB.perform({
    profile,
    knownEnemyState: createKnownEnemyState({ trialIndex: 1 }),
    observedAtVerse: 12,
    reportId: "seed:b",
    enhanced: true
});
assert.deepEqual(seededA.fragmentsDiscovered, seededB.fragmentsDiscovered);
assert.deepEqual(seededA.roll, seededB.roll);

const emptyProfile = createObservableEnemyProfile({ trialIndex: 1 });
const empty = normal.perform({
    profile: emptyProfile,
    knownEnemyState: createKnownEnemyState({ trialIndex: 1 }),
    observedAtVerse: 13,
    reportId: "investigation:empty:1"
});
assert.equal(empty.success, false);
assert.equal(empty.reason, "NO_OBSERVABLE_FRAGMENTS");

console.log("PASS investigation request v1");
