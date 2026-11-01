import assert from 'node:assert/strict';
import fs from 'node:fs';
import { test } from 'node:test';
import { GameEngine } from '../game/src/core/game_engine.js';
import { enemyArmyTraitSelectorFixture } from './enemy_army_trait_selector_test_fixture.mjs';

test('normal Run remains disconnected even when a trait policy is supplied as an unknown dependency', () => {
    const { selectionPolicy } = enemyArmyTraitSelectorFixture();
    const engine = GameEngine.createGame({ runSeed: 42, firstRun: true, enemyArmyTraitSelectionPolicy: selectionPolicy });
    assert.equal(engine.enemyArmyBlueprintBootstrap.status, 'POLICY_NOT_CONFIGURED');
    assert.equal(Object.hasOwn(engine.state, 'enemyArmyBlueprintState'), false);
    assert.equal(engine.enemyArmyBlueprintLifecycleService.getBlueprint(1), null);
});
test('existing Trial1 suppression, one-force introduction, and Truth remain unchanged', () => {
    const engine = GameEngine.createGame({ runSeed: 42, firstRun: true });
    const truth = engine.enemyTruthReadModel.getSnapshot();
    assert.equal(truth.strategicSuppression, 20);
    assert.equal(truth.forces.length, 1);
    assert.equal(engine.enemyArmyBlueprintBootstrap.status, 'POLICY_NOT_CONFIGURED');
});

test('production Bootstrap and GameEngine contain no trait selector connection', () => {
    const engineSource = fs.readFileSync(new URL('../game/src/core/game_engine.js', import.meta.url), 'utf8');
    const bootstrapSource = fs.readFileSync(new URL('../game/src/trial/integration/enemy_army_blueprint_new_run_bootstrap.js', import.meta.url), 'utf8');
    for (const source of [engineSource, bootstrapSource]) {
        assert.equal(source.includes('enemy_army_trait_selector'), false);
        assert.equal(source.includes('enemyArmyTraitSelectionPolicy'), false);
    }
});
