import assert from 'node:assert/strict';
import { collectWorldObservationCandidates, projectThreatObservationSources } from '../game/src/investigation/systems/world_observation_boundary.js';
import { createObservableWorldProfile, createDiscoveryLedger, createWorldInvestigationReport } from '../game/src/investigation/domain/world_discovery.js';
import { INVESTIGATION_SOURCE_POLICIES } from '../game/src/data/investigation_sources_data.js';
const observation = { id: 'TEST_WORLD', category: 'TEST_CATEGORY', nameKey: 'TEST_NAME', descriptionKey: 'TEST_DESCRIPTION', enemyTruth: 100 };
const profile = createObservableWorldProfile({ observations: [observation] });
const definition = { id: 'TEST_SOURCE', category: 'TEST_CATEGORY', sourceType: 'TEST_OBSERVATION', discoveryIds: ['TEST_WORLD'], requirements: [{ type: 'RESOURCE_AT_LEAST', resource: 'wood', value: 30 }], allowRediscovery: false };
const state = { wood: 30, discoveryLedger: createDiscoveryLedger() };
const input = { profile, definitions: [definition], context: { state } };
const before = JSON.stringify(input);
const candidates = collectWorldObservationCandidates(input);
assert.equal(candidates.length, 1);
assert.equal(candidates[0].profile.observations[0].enemyTruth, undefined);
assert.ok(Object.isFrozen(candidates[0].profile.observations[0]));
assert.ok(Object.isFrozen(candidates));
assert.equal(JSON.stringify(input), before);
assert.deepEqual(collectWorldObservationCandidates(input), candidates);
assert.equal(collectWorldObservationCandidates({ ...input, context: { state: { ...state, wood: 29 } } }).length, 0);
for (const override of [ { requirements: [{ type: 'TEST_UNKNOWN_CONDITION' }] }, { discoveryIds: ['TEST_MISSING'] }, { category: 'TEST_OTHER' } ]) {
    assert.equal(collectWorldObservationCandidates({ ...input, definitions: [{ ...definition, ...override }] }).length, 0);
}
const ledger = createDiscoveryLedger([createWorldInvestigationReport({ id: 'TEST_REPORT', category: observation.category, sourceType: definition.sourceType, observedAtVerse: 8, discoveries: [observation] })]);
const known = { ...input, context: { state: { ...state, discoveryLedger: ledger } } };
assert.equal(collectWorldObservationCandidates(known).length, 0);
assert.equal(collectWorldObservationCandidates({ ...known, definitions: [{ ...definition, allowRediscovery: true }] }).length, 1);
for (const override of [{ requirements: null }, { requirements: [{}] }, { allowRediscovery: undefined }, { discoveryIds: [] }]) {
    assert.throws(() => collectWorldObservationCandidates({ ...input, definitions: [{ ...definition, ...override }] }));
}
assert.throws(() => collectWorldObservationCandidates({ ...input, profile: {} }));
assert.throws(() => collectWorldObservationCandidates({ ...input, definitions: [definition, definition] }));
assert.equal(collectWorldObservationCandidates({ profile }).length, 0);
const sources = projectThreatObservationSources();
assert.deepEqual(sources.map(({ sourceType, allowedFacets }) => ({ sourceType, allowedFacets })), INVESTIGATION_SOURCE_POLICIES);
assert.ok(sources.every(source => source.category === 'THREAT' && Object.isFrozen(source.allowedFacets)));
assert.ok(['FOOTPRINTS', 'CAMP_REMAINS', 'SCOUT_SIGHTING'].every(type => sources.some(source => source.sourceType === type)));
assert.deepEqual(collectWorldObservationCandidates(JSON.parse(JSON.stringify(input))), candidates);
console.log('World observation boundary: PASS');
