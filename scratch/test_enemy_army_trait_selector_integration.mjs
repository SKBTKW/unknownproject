import assert from 'node:assert/strict';
import { test } from 'node:test';
import { GameEngine } from '../game/src/core/game_engine.js';
import { serializeGameState } from '../game/src/core/state_serializer.js';
import { hydrateGameState } from '../game/src/core/hydrate_game_state.js';
import { EnemyArmyBlueprintLifecycleService } from '../game/src/trial/systems/enemy_army_blueprint_lifecycle_service.js';
import { generateEnemyArmyBlueprint } from '../game/src/trial/systems/enemy_army_blueprint_generator.js';
import {
    resolveEnemyArmyTraitGenerationPolicy,
    selectEnemyArmyTrait
} from '../game/src/trial/systems/enemy_army_trait_selector.js';
import { enemyArmyTraitSelectorFixture } from './enemy_army_trait_selector_test_fixture.mjs';

function selectAndGenerate(runSeed) {
    const fixture = enemyArmyTraitSelectorFixture();
    const selection = selectEnemyArmyTrait({ runSeed, stageId: 1, policy: fixture.selectionPolicy });
    const policy = resolveEnemyArmyTraitGenerationPolicy({ selection, bindings: fixture.bindings });
    return { selection, blueprint: generateEnemyArmyBlueprint({ runSeed, stageId: 1, policy }) };
}

function cardOptions(engine) {
    const cards = [...engine.deckManager.getLandCardMaster(), ...(engine.getAdditionalCardMastersForRestore?.() || [])];
    return { resolveCardMaster: id => cards.find(card => card.id === id) };
}

test('Selector -> Resolver -> existing Generator is deterministic with stable A/B/C identities', () => {
    const first = selectAndGenerate(42);
    const second = selectAndGenerate(42);
    assert.deepEqual(second.selection, first.selection);
    assert.deepEqual(second.blueprint.getSnapshot(), first.blueprint.getSnapshot());
    const snapshot = first.blueprint.getSnapshot();
    assert.deepEqual(snapshot.generationPolicy, first.selection.generationPolicy);
    assert.deepEqual(snapshot.forces.map(force => force.slot), ['A', 'B', 'C']);
    assert.deepEqual(snapshot.forces.map(force => force.id), [
        `${snapshot.armyId}_A`, `${snapshot.armyId}_B`, `${snapshot.armyId}_C`
    ]);
});
test('selection and Blueprint generation do not consume Gameplay, Check, or live Truth state', () => {
    const engine = GameEngine.createGame({ runSeed: 42, firstRun: true });
    const gameplay = engine.gameplayRandom.getState();
    const checks = engine.checkSystem.getState();
    const truth = engine.trueEnemyStateService.getRestoreState();
    selectAndGenerate(42);
    assert.deepEqual(engine.gameplayRandom.getState(), gameplay);
    assert.deepEqual(engine.checkSystem.getState(), checks);
    assert.deepEqual(engine.trueEnemyStateService.getRestoreState(), truth);
});

test('saved Blueprint restores as authority without trait reselection or selector metadata', () => {
    const source = GameEngine.createGame({ runSeed: 42, firstRun: true });
    const sourceLifecycle = new EnemyArmyBlueprintLifecycleService({ gameState: source.state });
    const { blueprint } = selectAndGenerate(42);
    sourceLifecycle.registerBlueprint(1, blueprint);
    const saved = JSON.parse(JSON.stringify(serializeGameState(source.state)));
    assert.equal(Object.hasOwn(saved, 'enemyArmyTraitSelection'), false);
    const target = GameEngine.createGame({ runSeed: 42, firstRun: true });
    const targetLifecycle = new EnemyArmyBlueprintLifecycleService({ gameState: target.state });
    const original = Math.random;
    Math.random = () => { throw new Error('RESTORE_MUST_NOT_RESELECT'); };
    try {
        hydrateGameState(target.state, saved, cardOptions(target));
    } finally {
        Math.random = original;
    }
    assert.deepEqual(targetLifecycle.getBlueprint(1).getSnapshot(), blueprint.getSnapshot());
    const legacy = serializeGameState(GameEngine.createGame({ runSeed: 42 }).state);
    hydrateGameState(target.state, legacy, cardOptions(target));
    assert.equal(targetLifecycle.getBlueprint(1), null);
});
