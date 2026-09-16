import assert from "node:assert/strict";
import { CivilizationDevelopmentSnapshotService } from "../systems/civilization_development_snapshot_service.js";
import { TrialThreatResolver } from "../systems/trial_threat_resolver.js";

function buildState() {
    const mergeLinks = new Set(["1::2", "2::3"]);
    return {
        ember: 20,
        maxEmber: 20,
        currentDefense: 10,
        maxDefense: 10,
        food: 50,
        wood: 30,
        mystic: 0,
        placedBlockCount: 4,
        stage: { id: 2 },
        getTerritoryTileCount() {
            return 12;
        },
        mergedBlocks: {
            1: {
                groupId: 1,
                mergeType: "2x2",
                cells: [{ r: 0, c: 0 }, { r: 0, c: 1 }, { r: 1, c: 0 }, { r: 1, c: 1 }]
            },
            2: {
                groupId: 2,
                mergeType: "1x3",
                cells: [{ r: 2, c: 0 }, { r: 2, c: 1 }, { r: 2, c: 2 }]
            },
            3: {
                groupId: 3,
                mergeType: "T_SHAPE",
                cells: [{ r: 3, c: 0 }, { r: 3, c: 1 }, { r: 3, c: 2 }, { r: 4, c: 1 }]
            }
        },
        mergeLinks,
        gridEngine: {
            getMergeLinkCount() {
                return mergeLinks.size;
            }
        }
    };
}

const snapshotService = new CivilizationDevelopmentSnapshotService();
const state = buildState();
const snapshot = snapshotService.capture(state);

assert.deepEqual(snapshot, {
    stage: 2,
    placedBlockCount: 4,
    territoryTiles: 12,
    completedZones: 2,
    links: 2
});

// 1x3 is an intermediate merge group, not a completed zone.
assert.equal(snapshot.completedZones, 2);

// Resource stock, Ember and Defense are intentionally outside development threat input.
state.ember = 1;
state.maxEmber = 99;
state.currentDefense = 99;
state.maxDefense = 120;
state.food = 999;
state.wood = 999;
state.mystic = 999;
assert.deepEqual(snapshotService.capture(state), snapshot);

const resolver = new TrialThreatResolver({
    baseThreatByTrial: { 1: 10, 2: 20, 3: 30 },
    territoryWeight: 1,
    completedZoneWeight: 3,
    linkWeight: 4,
    stageWeight: 5
});

const result = resolver.resolve({ trialIndex: 2, development: snapshot });
assert.deepEqual(result.breakdown, {
    baseThreat: 20,
    placedBlockThreat: 0,
    territoryThreat: 12,
    completedZoneThreat: 6,
    linkThreat: 8,
    stageThreat: 5
});
assert.equal(result.strategicSuppression, 51);
assert.equal(
    result.strategicSuppression,
    Object.values(result.breakdown).reduce((sum, value) => sum + value, 0)
);

const placedBlockOnly = new TrialThreatResolver({
    baseThreatByTrial: { 2: 20 },
    placedBlockWeight: 2
}).resolve({ trialIndex: 2, development: snapshot });
assert.equal(placedBlockOnly.breakdown.placedBlockThreat, 8);
assert.equal(placedBlockOnly.strategicSuppression, 28);

// Default resolver must be behavior-neutral until balancing coefficients are explicitly supplied.
assert.equal(
    new TrialThreatResolver().resolve({ trialIndex: 3, development: snapshot }).strategicSuppression,
    0
);

console.log("diagnose_trial_threat_resolver: PASS");
