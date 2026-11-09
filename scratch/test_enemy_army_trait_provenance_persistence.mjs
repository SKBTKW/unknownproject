import assert from 'node:assert/strict';
import { test } from 'node:test';
import { GameEngine } from '../game/src/core/game_engine.js';
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
function setup(seed = 42) {
    const engine = GameEngine.createGame({ runSeed: seed, firstRun: true });
    const service = new EnemyArmyBlueprintLifecycleService({ gameState: engine.state });
    const cards = [...engine.deckManager.getLandCardMaster(), ...(engine.getAdditionalCardMastersForRestore?.() || [])];
    return { engine, service, options: { resolveCardMaster: id => cards.find(card => card.id === id) } };
}

test('11: serializer emits a separate versioned provenance envelope associated with Blueprint', () => {
    const { engine, service } = setup(); const army = make();
    service.registerBlueprint(1, army.blueprint, army.provenance);
    const saved = serializeGameState(engine.state);
    assert.deepEqual(saved.enemyArmyBlueprintState, service.getSnapshot());
    assert.deepEqual(saved.enemyArmyTraitProvenanceState, service.getProvenanceSnapshot());
    assert.equal(saved.enemyArmyTraitProvenanceState.schemaVersion, 1);
});

test('12: Blueprint and provenance survive repeated JSON save and restore unchanged', () => {
    const source = setup(); const army = make();
    source.service.registerBlueprint(1, army.blueprint, army.provenance);
    const saved = JSON.parse(JSON.stringify(serializeGameState(source.engine.state)));
    const savedCopy = structuredClone(saved); const target = setup();
    for (let repeat = 0; repeat < 3; repeat++) {
        hydrateGameState(target.engine.state, saved, target.options);
        assert.deepEqual(target.service.getSnapshot(), source.service.getSnapshot());
        assert.deepEqual(target.service.getProvenanceSnapshot(), source.service.getProvenanceSnapshot());
    }
    assert.deepEqual(saved, savedCopy);
});

test('13: restore uses saved authority without requiring current selector definitions', () => {
    const source = setup(); const army = make();
    source.service.registerBlueprint(1, army.blueprint, army.provenance);
    const saved = serializeGameState(source.engine.state);
    const changedDevelopmentFixture = enemyArmyTraitSelectorFixture();
    changedDevelopmentFixture.selectionPolicy.id = 'future-selection-policy';
    changedDevelopmentFixture.selectionPolicy.version = 99;
    changedDevelopmentFixture.selectionPolicy.traits.length = 1;
    const target = setup();
    hydrateGameState(target.engine.state, saved, target.options);
    assert.deepEqual(target.service.getBlueprint(1).getSnapshot(), army.blueprint.getSnapshot());
    assert.deepEqual(target.service.getProvenance(1).getSnapshot(), army.provenance.getSnapshot());
});

test('14: a legacy save without Blueprint or provenance clears both future fields', () => {
    const target = setup(); const army = make();
    target.service.registerBlueprint(1, army.blueprint, army.provenance);
    const legacy = serializeGameState(setup().engine.state);
    assert.equal(Object.hasOwn(legacy, 'enemyArmyBlueprintState'), false);
    assert.equal(Object.hasOwn(legacy, 'enemyArmyTraitProvenanceState'), false);
    hydrateGameState(target.engine.state, legacy, target.options);
    assert.equal(target.service.getBlueprint(1), null);
    assert.equal(target.service.getProvenance(1), null);
});

test('15: a legacy Blueprint-only save restores without inferring provenance', () => {
    const source = setup(); const army = make(); source.service.registerBlueprint(1, army.blueprint);
    const saved = serializeGameState(source.engine.state);
    assert.equal(Object.hasOwn(saved, 'enemyArmyTraitProvenanceState'), false);
    const target = setup(); hydrateGameState(target.engine.state, saved, target.options);
    assert.deepEqual(target.service.getBlueprint(1).getSnapshot(), army.blueprint.getSnapshot());
    assert.equal(target.service.getProvenance(1), null);
});

test('16: provenance-only save is rejected without changing the live world', () => {
    const target = setup(); const before = serializeGameState(target.engine.state);
    const invalid = structuredClone(before);
    invalid.enemyArmyTraitProvenanceState = { schemaVersion: 1, provenances: [make().provenance.getSnapshot()] };
    invalid.food = 999;
    assert.throws(() => hydrateGameState(target.engine.state, invalid, target.options), /BLUEPRINT_REQUIRED/);
    assert.deepEqual(serializeGameState(target.engine.state), before);
});

test('17: malformed or conflicting provenance preflight is atomic', () => {
    const target = setup(); const army = make();
    target.service.registerBlueprint(1, army.blueprint, army.provenance);
    const before = serializeGameState(target.engine.state);
    const mutations = [
        value => { value.enemyArmyTraitProvenanceState = null; },
        value => { value.enemyArmyTraitProvenanceState.schemaVersion = 2; },
        value => { value.enemyArmyTraitProvenanceState.provenances[0].traitId = ''; },
        value => { value.enemyArmyTraitProvenanceState.provenances[0].selectionPolicy.version = 0; },
        value => { value.enemyArmyTraitProvenanceState.provenances[0].generationPolicy.id = 'conflict'; },
        value => { value.enemyArmyTraitProvenanceState.provenances.push(
            structuredClone(value.enemyArmyTraitProvenanceState.provenances[0])
        ); },
        value => { delete value.enemyArmyBlueprintState; }
    ];
    for (const mutate of mutations) {
        const invalid = structuredClone(before); invalid.food = 999; mutate(invalid);
        const input = structuredClone(invalid);
        assert.throws(() => hydrateGameState(target.engine.state, invalid, target.options), /PROVENANCE/);
        assert.deepEqual(serializeGameState(target.engine.state), before);
        assert.deepEqual(invalid, input);
    }
});

test('18: base hydration failure does not install a validated replacement pair', () => {
    const target = setup(); const current = make();
    target.service.registerBlueprint(1, current.blueprint, current.provenance);
    const before = serializeGameState(target.engine.state);
    const source = setup(99); const replacement = make(99);
    source.service.registerBlueprint(1, replacement.blueprint, replacement.provenance);
    const invalid = serializeGameState(source.engine.state);
    invalid.handOffering = [{ cardMasterId: 'DOES_NOT_EXIST' }];
    assert.throws(() => hydrateGameState(target.engine.state, invalid, target.options), /HYDRATE_CARD_MASTER_NOT_FOUND/);
    assert.deepEqual(serializeGameState(target.engine.state), before);
});

test('19: both History capture paths and Verse restore preserve the associated pair', () => {
    const target = setup(); const original = make();
    target.service.registerBlueprint(1, original.blueprint, original.provenance);
    const expected = serializeGameState(target.engine.state);
    const point = target.engine.historySnapshotService.captureRestorePoint({ verse: 1 });
    const committed = target.engine.historySnapshotService.capture({ completedTurn: 1, nextTurn: 2 });
    assert.deepEqual(point.gameState.enemyArmyTraitProvenanceState, expected.enemyArmyTraitProvenanceState);
    assert.deepEqual(committed.gameState.enemyArmyTraitProvenanceState, expected.enemyArmyTraitProvenanceState);
    const replacement = make(99);
    target.service.restoreSnapshot(
        { schemaVersion: 1, blueprints: [replacement.blueprint.getSnapshot()] },
        { schemaVersion: 1, provenances: [replacement.provenance.getSnapshot()] }
    );
    assert.equal(target.engine.historyRestoreService.restoreVerse(1).success, true);
    assert.deepEqual(target.service.getBlueprint(1).getSnapshot(), original.blueprint.getSnapshot());
    assert.deepEqual(target.service.getProvenance(1).getSnapshot(), original.provenance.getSnapshot());
});

test('20: History late-failure rollback recovers the pre-restore pair', () => {
    const target = setup(); const original = make();
    target.service.registerBlueprint(1, original.blueprint, original.provenance);
    target.engine.historySnapshotService.captureRestorePoint({ verse: 1 });
    const replacement = make(99);
    target.service.restoreSnapshot(
        { schemaVersion: 1, blueprints: [replacement.blueprint.getSnapshot()] },
        { schemaVersion: 1, provenances: [replacement.provenance.getSnapshot()] }
    );
    target.engine.state.food = 123;
    const before = serializeGameState(target.engine.state);
    const originalSetter = target.engine.checkSystem.setState;
    target.engine.checkSystem.setState = () => { throw new Error('INJECTED_PROVENANCE_RESTORE_FAILURE'); };
    try {
        assert.throws(() => target.engine.historyRestoreService.restoreVerse(1), /INJECTED_PROVENANCE/);
    } finally { target.engine.checkSystem.setState = originalSetter; }
    assert.deepEqual(serializeGameState(target.engine.state), before);
});
