import assert from 'node:assert/strict';
import fs from 'node:fs';
import { test } from 'node:test';
import { GameEngine } from '../game/src/core/game_engine.js';
import { RandomSource } from '../game/src/core/check_system/random_source.js';
import { hydrateGameState } from '../game/src/core/hydrate_game_state.js';
import { serializeGameState } from '../game/src/core/state_serializer.js';
import { EnemyArmyBlueprintLifecycleService } from '../game/src/trial/systems/enemy_army_blueprint_lifecycle_service.js';
import { generateEnemyArmyBlueprint } from '../game/src/trial/systems/enemy_army_blueprint_generator.js';
import {
    createEnemyArmyTraitProvenance,
    resolveEnemyArmyTraitGenerationPolicy,
    selectEnemyArmyTrait
} from '../game/src/trial/systems/enemy_army_trait_selector.js';
import { enemyArmyTraitSelectorFixture } from './enemy_army_trait_selector_test_fixture.mjs';

function make(seed = 42) {
    const fixture = enemyArmyTraitSelectorFixture();
    const selection = selectEnemyArmyTrait({ runSeed: seed, stageId: 1, policy: fixture.selectionPolicy });
    const policy = resolveEnemyArmyTraitGenerationPolicy({ selection, bindings: fixture.bindings });
    return {
        blueprint: generateEnemyArmyBlueprint({ runSeed: seed, stageId: 1, policy }),
        provenance: createEnemyArmyTraitProvenance(selection)
    };
}

test('21: normal Run and Verse progression do not create Blueprint or provenance', () => {
    const engine = GameEngine.createGame({ runSeed: 42, firstRun: true });
    for (const state of [engine.state, (engine.nextTurn(), engine.state)]) {
        assert.equal(Object.hasOwn(state, 'enemyArmyBlueprintState'), false);
        assert.equal(Object.hasOwn(state, 'enemyArmyTraitProvenanceState'), false);
    }
});

test('22: registration, save, hydration and History restore consume no RNG or live Truth', () => {
    const engine = GameEngine.createGame({ runSeed: 42, firstRun: true });
    const service = new EnemyArmyBlueprintLifecycleService({ gameState: engine.state });
    const army = make();
    const truth = engine.trueEnemyStateService.getRestoreState();
    const gameplay = engine.gameplayRandom.getState(); const checks = engine.checkSystem.getState();
    const cards = [...engine.deckManager.getLandCardMaster(), ...(engine.getAdditionalCardMastersForRestore?.() || [])];
    const originalRandom = Math.random; const originalFloat = RandomSource.prototype.nextFloat;
    Math.random = () => { throw new Error('NONDETERMINISTIC_PROVENANCE_FORBIDDEN'); };
    RandomSource.prototype.nextFloat = () => { throw new Error('PROVENANCE_RNG_CONSUMPTION_FORBIDDEN'); };
    try {
        service.registerBlueprint(1, army.blueprint, army.provenance);
        const saved = JSON.parse(JSON.stringify(serializeGameState(engine.state)));
        hydrateGameState(engine.state, saved, { resolveCardMaster: id => cards.find(card => card.id === id) });
        engine.historySnapshotService.captureRestorePoint({ verse: 1 });
        assert.equal(engine.historyRestoreService.restoreVerse(1).success, true);
    } finally { Math.random = originalRandom; RandomSource.prototype.nextFloat = originalFloat; }
    assert.deepEqual(engine.gameplayRandom.getState(), gameplay);
    assert.deepEqual(engine.checkSystem.getState(), checks);
    assert.deepEqual(engine.trueEnemyStateService.getRestoreState(), truth);
});

test('23: existing Trial1 suppression and one-force introduction remain unchanged', () => {
    const engine = GameEngine.createGame({ runSeed: 42, firstRun: true });
    const service = new EnemyArmyBlueprintLifecycleService({ gameState: engine.state });
    const army = make(); service.registerBlueprint(1, army.blueprint, army.provenance);
    const truth = engine.enemyTruthReadModel.getSnapshot();
    assert.equal(truth.strategicSuppression, 20);
    assert.equal(truth.forces.length, 1);
    assert.equal(engine.enemyArmyBlueprintBootstrap.status, 'POLICY_NOT_CONFIGURED');
});

test('24: production Bootstrap and GameEngine remain disconnected from trait selection', () => {
    const engineSource = fs.readFileSync(new URL('../game/src/core/game_engine.js', import.meta.url), 'utf8');
    const bootstrapSource = fs.readFileSync(new URL('../game/src/trial/integration/enemy_army_blueprint_new_run_bootstrap.js', import.meta.url), 'utf8');
    for (const source of [engineSource, bootstrapSource]) {
        assert.equal(source.includes('enemy_army_trait_selector'), false);
        assert.equal(source.includes('enemyArmyTraitProvenanceState'), false);
    }
});

test('25: save and restore paths never import Selector or Generator', () => {
    for (const path of ['../game/src/core/state_serializer.js', '../game/src/core/hydrate_game_state.js']) {
        const source = fs.readFileSync(new URL(path, import.meta.url), 'utf8');
        assert.equal(source.includes('enemy_army_trait_selector'), false);
        assert.equal(source.includes('enemy_army_blueprint_generator'), false);
        assert.equal(source.includes('selectEnemyArmyTrait'), false);
        assert.equal(source.includes('generateEnemyArmyBlueprint'), false);
    }
});
