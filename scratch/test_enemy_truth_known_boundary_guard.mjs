import assert from "node:assert/strict";
import { EnemyTruthObservableResolver } from "../game/src/trial/systems/enemy_truth_observable_resolver.js";
import { createKnownEnemyState, recordInvestigationReport } from "../game/src/warning/domain/known_enemy_state.js";

// Contract guard only: these assertions do not change Trial1's live 20-suppression/one-force policy.
const truth = {
  strategicSuppression: 90,
  commander: { id: "SECRET_COMMANDER", level: 4 },
  forceCount: 2,
  routes: ["NORTH"],
  forces: [
    { id: "A", strategicSuppression: 60, profile: { bodySize: "LARGE", equipment: ["HEAVY"] } },
    { id: "B", strategicSuppression: 30, profile: { bodySize: "SMALL", equipment: ["LIGHT"] } }
  ]
};
const resolver = new EnemyTruthObservableResolver();
const observable = resolver.resolve({ armyStructure: truth, previousEnemyState: { observable: { directionHints: ["NORTH_ACTIVITY"] } } });
assert.deepEqual(observable.physiqueTraits, ["LARGE_BODY_PRESENT", "SMALL_BODY_PRESENT"]);
assert.deepEqual(observable.equipmentTraits, ["HEAVY_EQUIPMENT", "LIGHT_EQUIPMENT"]);
assert.deepEqual(observable.directionHints, ["NORTH_ACTIVITY"]);
for (const forbidden of ["strategicSuppression", "forceCount", "forces", "commander", "routes", "ingress"]) {
  assert.equal(Object.hasOwn(observable, forbidden), false, `observable must not disclose ${forbidden}`);
}
const known = createKnownEnemyState({ trialIndex: 1 });
assert.deepEqual(known.reports, []);
assert.deepEqual(known.observedTags, []);
// Merely existing in Trial Truth must not reveal a trait to KnownEnemyState.
assert.equal(known.observedTags.includes("HEAVY_EQUIPMENT"), false);
const report = { observations: [{ tag: "LARGE_BODY_PRESENT" }], observedAtVerse: 9 };
recordInvestigationReport(known, report);
report.observations[0].tag = "HEAVY_EQUIPMENT";
assert.deepEqual(known.observedTags, ["LARGE_BODY_PRESENT"], "only explicitly reported observations may become known");
assert.equal(known.reports[0].observations[0].tag, "LARGE_BODY_PRESENT", "history must snapshot observations");
recordInvestigationReport(known, { observations: [{ tag: "LARGE_BODY_PRESENT" }] });
assert.deepEqual(known.observedTags, ["LARGE_BODY_PRESENT"], "reobservation must not duplicate known tags");
assert.equal(known.reports.length, 2, "reobservation may remain a separate history fact");
console.log("PASS: enemy truth / observable / known information separation");
