import assert from "node:assert/strict";
import { GAME_FACT_TYPES, GameFactHub } from "../../core/game_fact.js";
import { TrialThreatResolver } from "../systems/trial_threat_resolver.js";
import { TrialThreatStateService } from "../systems/trial_threat_state_service.js";

const gameFactHub = new GameFactHub();
const gameState = {
    turn: 5,
    placedBlockCount: 3,
    stage: { id: 1 },
    mergedBlocks: {},
    mergeLinks: new Set(),
    getTerritoryTileCount() { return 7; }
};

const threatResolver = new TrialThreatResolver({
    baseThreatByTrial: { 1: 10 },
    placedBlockWeight: 2,
    territoryWeight: 0,
    completedZoneWeight: 0,
    linkWeight: 0,
    stageWeight: 0
});

const service = new TrialThreatStateService({
    gameState,
    gameFactHub,
    threatResolver
});

assert.equal(service.getCurrentThreat().strategicSuppression, 16);
assert.equal(service.getReadModel().revision, 0);
assert.equal(service.isDirty(), false);

// Placement-related development change marks the state dirty but must not
// update Threat during the active Verse.
gameState.placedBlockCount = 4;
gameFactHub.emit(GAME_FACT_TYPES.CIVILIZATION_DEVELOPMENT_CHANGED, {
    source: "PLACE_LAND",
    turn: 5,
    placedBlockCount: 4
});
assert.equal(service.isDirty(), true);
assert.equal(service.getCurrentThreat().strategicSuppression, 16);
assert.equal(service.getReadModel().revision, 0);

// Repeated relevant changes in the same Verse still collapse into one
// recalculation at the Verse boundary.
gameState.placedBlockCount = 5;
gameFactHub.emit(GAME_FACT_TYPES.CIVILIZATION_DEVELOPMENT_CHANGED, {
    source: "PLACE_LAND",
    turn: 5,
    placedBlockCount: 5
});
assert.equal(service.getCurrentThreat().strategicSuppression, 16);

gameFactHub.emit(GAME_FACT_TYPES.VERSE_COMMITTED, {
    completedTurn: 5,
    nextTurn: 6
});
assert.equal(service.isDirty(), false);
assert.equal(service.getCurrentThreat().strategicSuppression, 20);
assert.equal(service.getReadModel().revision, 1);
assert.equal(service.getReadModel().lastCommittedVerse, 5);
assert.equal(service.getReadModel().current.development.placedBlockCount, 5);

// A Verse with no Threat-relevant change must not recalculate.
gameFactHub.emit(GAME_FACT_TYPES.VERSE_COMMITTED, {
    completedTurn: 6,
    nextTurn: 7
});
assert.equal(service.getReadModel().revision, 1);
assert.equal(service.getCurrentThreat().strategicSuppression, 20);

// Trial/UI-style unrelated facts do not mark civilization Threat dirty.
gameFactHub.emit(GAME_FACT_TYPES.TRIAL_PLAN_CONFIRMED, { routes: [] });
assert.equal(service.isDirty(), false);
assert.equal(service.getReadModel().revision, 1);

service.dispose();
console.log("diagnose_trial_threat_state_service: PASS");
