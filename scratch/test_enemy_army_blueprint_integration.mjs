import assert from 'node:assert/strict';
import { test } from 'node:test';
import { generateEnemyArmyBlueprint as generate } from '../game/src/trial/systems/enemy_army_blueprint_generator.js';
import { fixturePolicy } from './enemy_army_blueprint_test_fixture.mjs';
import { GameEngine } from '../game/src/core/game_engine.js';
import { EnemyTruthReadModel } from '../game/src/trial/systems/enemy_truth_read_model.js';
import { InvestigationResolver } from '../game/src/warning/systems/investigation_resolver.js';
import { createKnownEnemyState, recordInvestigationReport } from '../game/src/warning/domain/known_enemy_state.js';

test('repeated real investigation consumes a redacted projection without mutating blueprint', () => {
    const blueprint = generate({ runSeed: 42, stageId: 1, policy: fixturePolicy() });
    const readModel = new EnemyTruthReadModel(blueprint);
    const before = blueprint.getSnapshot();
    // Test-only projection; no new production disclosure policy or runtime adapter.
    const profile = { physiqueTraits: readModel.getSnapshot().forces.flatMap(force =>
        force.composition.speciesComposition.map(entry => `${entry.type}_BODY_PRESENT`)) };
    const known = createKnownEnemyState();
    assert.deepEqual(known.observedTags, []);
    const resolver = new InvestigationResolver({ rng: () => 0 });
    for (let i = 0; i < 5; i++) {
        const report = resolver.resolve({ profile, knownEnemyState: known, observedAtVerse: i,
            sourcePolicy: { sourceType: 'TEST', allowedFacets: ['physiqueTraits'], maxObservations: 1 } });
        recordInvestigationReport(known, report);
    }
    assert.equal(known.reports.length, 5);
    assert.ok(known.observedTags.length > 0);
    readModel.getSnapshot().forces.length = 0;
    assert.deepEqual(blueprint.getSnapshot(), before);
});
test('independent generation leaves production Truth and both live RNG streams unchanged', () => {
    const engine = new GameEngine({ runSeed: 42, firstRun: true });
    const truth = engine.enemyTruthReadModel.getSnapshot();
    const gameplay = engine.gameplayRandom.getState();
    const checks = engine.checkSystem.getState();
    const blueprint = generate({ runSeed: engine.runSeed, stageId: 1, policy: fixturePolicy() });
    generate({ runSeed: 101, stageId: 1, policy: fixturePolicy() });
    assert.deepEqual(engine.enemyTruthReadModel.getSnapshot(), truth);
    assert.deepEqual(engine.gameplayRandom.getState(), gameplay);
    assert.deepEqual(engine.checkSystem.getState(), checks);
    assert.equal(truth.strategicSuppression, 20);
    assert.equal(truth.forces.length, 1);
    assert.equal(truth.armyStructure.routeCount, 1);
    assert.equal(blueprint.getSnapshot().forces.length, 3);
});
