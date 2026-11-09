import assert from 'node:assert/strict';
import { test } from 'node:test';
import { GameState } from '../game/src/v2_unity_ready_main.js';
import { GameEngine } from '../game/src/core/game_engine.js';
import { serializeGameState } from '../game/src/core/state_serializer.js';
import { hydrateGameState } from '../game/src/core/hydrate_game_state.js';
import { bootstrapEnemyArmyBlueprintNewRun as bootstrap } from '../game/src/trial/integration/enemy_army_blueprint_new_run_bootstrap.js';
import { generateEnemyArmyBlueprint } from '../game/src/trial/systems/enemy_army_blueprint_generator.js';
import { fixturePolicy } from './enemy_army_blueprint_test_fixture.mjs';
const make = (extra = {}) => GameEngine.createGame({ runSeed: 42, firstRun: true, enemyArmyBlueprintPolicy: fixturePolicy(), ...extra });
const cardOptions = engine => {
    const masters = [...engine.deckManager.getLandCardMaster(), ...(engine.getAdditionalCardMastersForRestore?.() || [])];
    return { resolveCardMaster: id => masters.find(card => card.id === id) };
};

test('factory and direct constructor generate before initial Verse1 snapshot', () => {
    const factory = make();
    const direct = new GameEngine({ runSeed: 42, firstRun: true, enemyArmyBlueprintPolicy: fixturePolicy() });
    const expected = factory.enemyArmyBlueprintLifecycleService.getSnapshot();
    assert.equal(factory.enemyArmyBlueprintBootstrap.status, 'GENERATED');
    assert.deepEqual(direct.enemyArmyBlueprintLifecycleService.getSnapshot(), expected);
    assert.deepEqual(factory.historySnapshotService.getRestorePoint(1).gameState.enemyArmyBlueprintState, expected);
    assert.deepEqual(direct.historySnapshotService.getRestorePoint(1).gameState.enemyArmyBlueprintState, expected);
});
test('independent Blueprint series leaves initial world, Offering, GE state, both RNG and live Truth identical', () => {
    const baseline = GameEngine.createGame({ runSeed: 42, firstRun: true }); const active = make();
    const serialized = serializeGameState(active.state); delete serialized.enemyArmyBlueprintState;
    assert.deepEqual(serialized, serializeGameState(baseline.state));
    assert.deepEqual(active.gameplayRandom.getState(), baseline.gameplayRandom.getState());
    assert.deepEqual(active.checkSystem.getState(), baseline.checkSystem.getState());
    assert.deepEqual(active.trueEnemyStateService.getRestoreState(), baseline.trueEnemyStateService.getRestoreState());
    assert.deepEqual(active.historySnapshotService.getRestorePoint(1).runtime, baseline.historySnapshotService.getRestorePoint(1).runtime);
    assert.equal(active.enemyTruthReadModel.getSnapshot().strategicSuppression, 20);
    assert.equal(active.enemyTruthReadModel.getSnapshot().forces.length, 1);
});
test('injected state at Verse1 is Restore, even with a valid policy and throwing generator', () => {
    for (const occupied of [false, true]) {
        const source = occupied ? make() : GameEngine.createGame({ runSeed: 42 });
        const expected = source.enemyArmyBlueprintLifecycleService.getSnapshot();
        const restored = new GameEngine({ state: source.state, runSeed: 42, enemyArmyBlueprintPolicy: fixturePolicy(),
            enemyArmyBlueprintGenerator: () => { throw Error('RESTORE_MUST_NOT_GENERATE'); } });
        assert.deepEqual(restored.enemyArmyBlueprintLifecycleService.getSnapshot(), expected);
    }
});
test('JSON hydration and repeated History restore never invoke generator again', () => {
    let calls = 0;
    const engine = make({ enemyArmyBlueprintGenerator: args => { calls++; return generateEnemyArmyBlueprint(args); } });
    const expected = engine.enemyArmyBlueprintLifecycleService.getSnapshot();
    const saved = JSON.parse(JSON.stringify(serializeGameState(engine.state)));
    for (let i = 0; i < 2; i++) {
        hydrateGameState(engine.state, saved, cardOptions(engine));
        assert.equal(engine.historyRestoreService.restoreVerse(1).success, true);
        bootstrap({ gameState: engine.state, runSeed: 42, isNewRun: true, policy: fixturePolicy(), generator: () => { throw Error('REARMED'); } });
    }
    assert.equal(calls, 1);
    assert.deepEqual(engine.enemyArmyBlueprintLifecycleService.getSnapshot(), expected);
});
test('legacy or empty restore stays unregistered after common initialization, despite same seed/policy', () => {
    const legacy = GameEngine.createGame({ runSeed: 42, firstRun: true });
    const engine = make(); const options = cardOptions(engine);
    const saved = JSON.parse(JSON.stringify(serializeGameState(legacy.state)));
    for (const data of [saved, { ...saved, enemyArmyBlueprintState: { schemaVersion: 1, blueprints: [] } }]) {
        hydrateGameState(engine.state, data, options);
        bootstrap({ gameState: engine.state, runSeed: 42, isNewRun: true, policy: fixturePolicy(), generator: () => { throw Error('LEGACY_REPAIR'); } });
        assert.equal(engine.enemyArmyBlueprintLifecycleService.getBlueprint(1), null);
    }
    engine.historySnapshotService.restorePoints[0] = legacy.historySnapshotService.getRestorePoint(1);
    assert.equal(engine.historyRestoreService.restoreVerse(1).success, true);
    bootstrap({ gameState: engine.state, runSeed: 42, isNewRun: true, policy: fixturePolicy(), generator: () => { throw Error('HISTORY_REPAIR'); } });
    assert.equal(engine.enemyArmyBlueprintLifecycleService.getBlueprint(1), null);
});
test('corrupt restore is rejected, leaves truth untouched and never regenerates to repair', () => {
    let calls = 0; const engine = make({ enemyArmyBlueprintGenerator: args => { calls++; return generateEnemyArmyBlueprint(args); } });
    const before = serializeGameState(engine.state); const corrupt = structuredClone(before);
    corrupt.enemyArmyBlueprintState.blueprints[0].armyId = 'CORRUPT'; corrupt.food = 999;
    assert.throws(() => hydrateGameState(engine.state, corrupt, cardOptions(engine)), /ENEMY_BLUEPRINT/);
    assert.deepEqual(serializeGameState(engine.state), before); assert.equal(calls, 1);
});
test('Verse progress never regenerates; policy-free defaults remain explicitly disabled', () => {
    let calls = 0; const engine = make({ enemyArmyBlueprintGenerator: args => { calls++; return generateEnemyArmyBlueprint(args); } });
    const expected = engine.enemyArmyBlueprintLifecycleService.getSnapshot();
    engine.nextTurn(); engine.nextTurn();
    assert.deepEqual(engine.enemyArmyBlueprintLifecycleService.getSnapshot(), expected); assert.equal(calls, 1);
    const disabled = GameEngine.createGame({ runSeed: 42 });
    assert.equal(disabled.enemyArmyBlueprintBootstrap.status, 'POLICY_NOT_CONFIGURED');
    assert.equal(Object.hasOwn(disabled.state, 'enemyArmyBlueprintState'), false);
});

test('a separately hydrated GameState has a Restore-only first bootstrap session', () => {
    for (const occupied of [false, true]) {
        const source = occupied ? make() : GameEngine.createGame({ runSeed: 42 });
        const saved = JSON.parse(JSON.stringify(serializeGameState(source.state)));
        const detached = new GameState({ engine: source });
        hydrateGameState(detached, saved, cardOptions(source));
        const restored = GameEngine.createGame({ runSeed: 42, state: detached,
            enemyArmyBlueprintPolicy: fixturePolicy(), enemyArmyBlueprintGenerator: () => { throw Error('RESTORE_FIRST_BOOTSTRAP_GENERATION'); } });
        assert.equal(restored.enemyArmyBlueprintBootstrap.status, 'RESTORE_ONLY');
        assert.deepEqual(restored.enemyArmyBlueprintLifecycleService.getSnapshot(), source.enemyArmyBlueprintLifecycleService.getSnapshot());
    }
});
