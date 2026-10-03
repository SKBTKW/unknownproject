import assert from 'node:assert/strict';
import { createObservableWorldProfile, createWorldInvestigationReport, createDiscoveryLedger,
    recordWorldDiscovery, hasRecordedDiscovery, projectWorldDiscoveryReport,
    isExplorationCategoryAvailable } from '../game/src/investigation/domain/world_discovery.js';
import { GameEngine } from '../game/src/core/game_engine.js';
import { serializeGameState } from '../game/src/core/state_serializer.js';
import { hydrateGameState } from '../game/src/core/hydrate_game_state.js';
import { ConditionEvaluator } from '../game/src/core/condition_evaluator.js';
import { CardOfferingEligibilityService } from '../game/src/cards/card_offering_eligibility_service.js';
const source = { id: 'TEST_DISCOVERY', category: 'TEST_CATEGORY', nameKey: 'TEST_NAME',
    descriptionKey: 'TEST_DESC', tags: ['TEST_TAG'], offeringUnlockKeys: ['TEST_UNLOCK'],
    strategicSuppression: 999, route: [1, 2] };
const profile = createObservableWorldProfile({ observations: [source] });
assert.equal(profile.observations[0].strategicSuppression, undefined);
assert.equal(profile.observations[0].route, undefined);
source.tags.push('MUTATED');
assert.deepEqual(profile.observations[0].tags, ['TEST_TAG']);
assert.equal(Object.isFrozen(profile.observations[0]), true);
const report = createWorldInvestigationReport({ id: 'test-r1', category: 'TEST_CATEGORY',
    observedAtVerse: 8, sourceType: 'TEST_SOURCE', discoveries: profile.observations });
assert.throws(() => createWorldInvestigationReport({ ...report, discoveries: [] }), /BASIC_DISCOVERY/);
assert.throws(() => createWorldInvestigationReport({ ...report, category: 'OTHER' }), /CROSS_CATEGORY/);
assert.throws(() => createWorldInvestigationReport({ ...report, checkResult: {} }), /BASIC_CHECK/);
let recorded = recordWorldDiscovery(createDiscoveryLedger(), report);
assert.deepEqual(recorded.newIds, ['TEST_DISCOVERY']);
assert.equal(recordWorldDiscovery(recorded.ledger, report).recorded, false);
assert.throws(() => recordWorldDiscovery(recorded.ledger, { ...report, observedAtVerse: 9 }), /ID_CONFLICT/);
const repeated = recordWorldDiscovery(recorded.ledger, { ...report, id: 'test-r2', observedAtVerse: 9 });
assert.deepEqual(repeated.repeatedIds, ['TEST_DISCOVERY']);
assert.equal(projectWorldDiscoveryReport(repeated.ledger, 'test-r2').discoveries[0].isNew, false);
assert.deepEqual(projectWorldDiscoveryReport(recorded.ledger, 'test-r1').potentialOfferingUnlockKeys, ['TEST_UNLOCK']);
// Zero additional discoveries is valid for a future low-roll follow-up. No roll occurs here.
const followUp = { ...report, id: 'test-follow', phase: 'FOLLOW_UP', parentReportId: report.id,
    discoveries: [], checkResult: { fixture: 'opaque-shared-check-result' } };
const followed = recordWorldDiscovery(recorded.ledger, followUp);
assert.throws(() => recordWorldDiscovery(followed.ledger, { ...followUp, id: 'again' }), /ALREADY_RECORDED/);
assert.throws(() => recordWorldDiscovery(recorded.ledger, { ...followUp, parentReportId: 'missing' }), /PARENT_REQUIRED/);
assert.equal(isExplorationCategoryAvailable({ firstRun: false }), true);
assert.equal(isExplorationCategoryAvailable({ firstRun: true }), false);
assert.equal(isExplorationCategoryAvailable({ firstRun: true, investigationUnlocked: true }), true);
assert.equal(isExplorationCategoryAvailable({}), false);
const engine = GameEngine.createGame({ firstRun: true, runSeed: 20261002 });
const enemyBefore = JSON.stringify(engine.state.knownEnemyState);
const rule = { type: 'DISCOVERY_RECORDED', discoveryId: 'TEST_DISCOVERY' };
assert.equal(ConditionEvaluator.evaluateStrict(rule, { state: engine.state }), false);
engine.state.discoveryLedger = followed.ledger;
const offering = new CardOfferingEligibilityService({ state: engine.state,
    requirementEvaluator: (requirement, context) => ConditionEvaluator.evaluateStrict(requirement, context) });
const fixtureCard = { id: 'TEST_ONLY', category: 'COMMAND', offering: { requirements: [rule] } };
assert.equal(offering.evaluate(fixtureCard).eligible, true);
assert.equal(offering.evaluate({ ...fixtureCard, offering: { requirements: [{ ...rule, discoveryId: 'UNKNOWN' }] } }).eligible, false);
assert.equal(ConditionEvaluator.evaluateStrict({ type: 'DISCOVERY_RECORDED' }, { state: engine.state }), false);
assert.equal(JSON.stringify(engine.state.knownEnemyState), enemyBefore);
const snapshot = JSON.parse(JSON.stringify(serializeGameState(engine.state)));
const restored = GameEngine.createGame({ firstRun: true, runSeed: 20261002 });
hydrateGameState(restored.state, snapshot, { resolveCardMaster: id => engine.deckManager.getLandCardMaster().find(c => c.id === id) });
assert.deepEqual(restored.state.discoveryLedger, followed.ledger);
assert.equal(Object.isFrozen(restored.state.discoveryLedger.reports[0].discoveries), true);
assert.deepEqual(projectWorldDiscoveryReport(restored.state.discoveryLedger, 'test-r1'), projectWorldDiscoveryReport(followed.ledger, 'test-r1'));
assert.equal(recordWorldDiscovery(restored.state.discoveryLedger, report).recorded, false);
assert.equal(hasRecordedDiscovery(restored.state.discoveryLedger, 'TEST_DISCOVERY'), true);
const oldSave = { ...snapshot }; delete oldSave.discoveryLedger;
hydrateGameState(restored.state, oldSave, { resolveCardMaster: id => engine.deckManager.getLandCardMaster().find(c => c.id === id) });
assert.deepEqual(restored.state.discoveryLedger, createDiscoveryLedger());
assert.equal(ConditionEvaluator.evaluateStrict(rule, { state: restored.state }), false);
assert.throws(() => hydrateGameState(restored.state, { ...snapshot, discoveryLedger: { schemaVersion: 999 } }), /LEDGER_INVALID/);
console.log('PASS world Discovery boundaries, immutable history, one follow-up, Offering predicate, save/restore and old saves');
