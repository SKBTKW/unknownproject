import assert from 'node:assert/strict';
import { GameEngine } from '../game/src/core/game_engine.js';
import { EnemyArmyBlueprintLifecycleService } from '../game/src/trial/systems/enemy_army_blueprint_lifecycle_service.js';
import { generateEnemyArmyBlueprint } from '../game/src/trial/systems/enemy_army_blueprint_generator.js';
import {
    createEnemyArmyTraitProvenance,
    resolveEnemyArmyTraitGenerationPolicy,
    selectEnemyArmyTrait
} from '../game/src/trial/systems/enemy_army_trait_selector.js';
import { enemyArmyTraitSelectorFixture } from './enemy_army_trait_selector_test_fixture.mjs';

const originalCreate = GameEngine.createGame;
let captured = null;
let lifecycle = null;
let expectedBlueprint = null;
let expectedProvenance = null;
GameEngine.createGame = function(options) {
    const engine = originalCreate.call(this, options);
    assert.equal(captured, null, 'canonical certification creates one Run');
    captured = engine;
    lifecycle = new EnemyArmyBlueprintLifecycleService({ gameState: engine.state });
    const fixture = enemyArmyTraitSelectorFixture();
    const selection = selectEnemyArmyTrait({
        runSeed: engine.runSeed, stageId: 1, policy: fixture.selectionPolicy
    });
    const policy = resolveEnemyArmyTraitGenerationPolicy({ selection, bindings: fixture.bindings });
    const blueprint = generateEnemyArmyBlueprint({ runSeed: engine.runSeed, stageId: 1, policy });
    const provenance = createEnemyArmyTraitProvenance(selection);
    lifecycle.registerBlueprint(1, blueprint, provenance);
    expectedBlueprint = lifecycle.getSnapshot();
    expectedProvenance = lifecycle.getProvenanceSnapshot();
    return engine;
};
try {
    await import('./test_first_run_stage1_completion.mjs');
} finally { GameEngine.createGame = originalCreate; }
assert.ok(captured, '26: canonical FirstRun certification ran');
assert.equal(captured.state.stage.id, 2, 'FirstRun reaches Stage2');
assert.deepEqual(lifecycle.getSnapshot(), expectedBlueprint, 'Stage1 Blueprint remains unchanged');
assert.deepEqual(lifecycle.getProvenanceSnapshot(), expectedProvenance, 'Stage1 provenance remains unchanged');
assert.equal(lifecycle.getBlueprint(2), null, 'no Stage2 Blueprint generation');
assert.equal(lifecycle.getProvenance(2), null, 'no Stage2 provenance generation');
console.log('PASS: 26 provenance remains unchanged across canonical FirstRun Stage1 completion');
