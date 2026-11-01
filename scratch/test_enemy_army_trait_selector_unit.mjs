import assert from 'node:assert/strict';
import { test } from 'node:test';
import {
    resolveEnemyArmyTraitGenerationPolicy,
    selectEnemyArmyTrait,
    validateEnemyArmyTraitSelectionPolicy
} from '../game/src/trial/systems/enemy_army_trait_selector.js';
import { enemyArmyTraitSelectorFixture } from './enemy_army_trait_selector_test_fixture.mjs';

test('same RunSeed, Stage and policy identity produces an immutable identical selection', () => {
    const fixture = enemyArmyTraitSelectorFixture();
    const inputBefore = structuredClone(fixture);
    const first = selectEnemyArmyTrait({ runSeed: 42, stageId: 1, policy: fixture.selectionPolicy });
    const second = selectEnemyArmyTrait({ runSeed: 42, stageId: 1, policy: fixture.selectionPolicy });
    assert.deepEqual(second, first);
    assert.deepEqual(fixture, inputBefore);
    assert.equal(first.selectionPolicy.id, fixture.selectionPolicy.id);
    assert.equal(first.selectionPolicy.version, fixture.selectionPolicy.version);
    const declared = fixture.selectionPolicy.traits.find(trait => trait.traitId === first.traitId);
    assert.deepEqual(first.generationPolicy, declared.generationPolicy);
    assert.equal(first.reproducibility.derivation, 'fnv1a-mulberry32-v1');
    assert.equal(first.reproducibility.namespace, fixture.selectionPolicy.seedNamespace);
    assert.equal(Object.isFrozen(first), true);
    assert.equal(Object.isFrozen(first.generationPolicy), true);
    assert.equal(Object.isFrozen(first.reproducibility), true);
    assert.throws(() => { first.traitId = 'changed'; }, TypeError);
});
test('different RunSeeds can select different traits and weights control the sample distribution', () => {
    const { selectionPolicy } = enemyArmyTraitSelectorFixture();
    const counts = Object.fromEntries(selectionPolicy.traits.map(trait => [trait.traitId, 0]));
    for (let runSeed = 0; runSeed < 10000; runSeed++) {
        counts[selectEnemyArmyTrait({ runSeed, stageId: 1, policy: selectionPolicy }).traitId]++;
    }
    assert.equal(Object.values(counts).reduce((sum, value) => sum + value, 0), 10000);
    assert.ok(new Set(Object.keys(counts).filter(key => counts[key] > 0)).size > 1);
    assert.ok(Math.abs(counts['medium-core'] / 10000 - 0.6) < 0.03);
    assert.ok(Math.abs(counts['large-leaning'] / 10000 - 0.2) < 0.03);
    assert.ok(Math.abs(counts['small-leaning'] / 10000 - 0.2) < 0.03);
});

test('invalid selection policies fail before RNG use and never mutate input', () => {
    const { selectionPolicy } = enemyArmyTraitSelectorFixture();
    for (const weight of [0, -1, Infinity, NaN]) {
        const invalid = structuredClone(selectionPolicy);
        invalid.traits[0].weight = weight;
        const before = structuredClone(invalid);
        assert.throws(() => validateEnemyArmyTraitSelectionPolicy(invalid), /WEIGHT/);
        assert.deepEqual(invalid, before);
    }
    const duplicate = structuredClone(selectionPolicy);
    duplicate.traits[1].traitId = duplicate.traits[0].traitId;
    assert.throws(() => validateEnemyArmyTraitSelectionPolicy(duplicate), /ID_INVALID/);
    assert.throws(() => selectEnemyArmyTrait({ runSeed: 1, stageId: 1 }), /SELECTION_POLICY_REQUIRED/);
    assert.throws(() => selectEnemyArmyTrait({ runSeed: -1, stageId: 1, policy: selectionPolicy }), /INPUT_INVALID/);
});

test('resolver requires an explicit trait-to-policy binding and rejects unknown or mismatched identities', () => {
    const fixture = enemyArmyTraitSelectorFixture();
    const selection = selectEnemyArmyTrait({ runSeed: 42, stageId: 1, policy: fixture.selectionPolicy });
    const resolved = resolveEnemyArmyTraitGenerationPolicy({ selection, bindings: fixture.bindings });
    assert.equal(resolved.id, selection.generationPolicy.id);
    assert.equal(resolved.version, selection.generationPolicy.version);
    assert.equal(Object.isFrozen(resolved), true);
    const unknown = structuredClone(selection);
    unknown.traitId = 'unknown-trait';
    assert.throws(() => resolveEnemyArmyTraitGenerationPolicy({ selection: unknown, bindings: fixture.bindings }), /TRAIT_UNKNOWN/);
    const mismatch = structuredClone(selection);
    mismatch.generationPolicy.id = 'different-policy';
    assert.throws(() => resolveEnemyArmyTraitGenerationPolicy({ selection: mismatch, bindings: fixture.bindings }), /IDENTITY_MISMATCH/);
    const malformed = structuredClone(fixture.bindings);
    malformed[0].generationPolicy.slots.A[0].weight = 0;
    assert.throws(() => resolveEnemyArmyTraitGenerationPolicy({ selection, bindings: malformed }), /WEIGHT_INVALID/);
});

test('selector uses its private RandomSource and never calls Math.random', () => {
    const { selectionPolicy } = enemyArmyTraitSelectorFixture();
    const original = Math.random;
    Math.random = () => { throw new Error('MATH_RANDOM_FORBIDDEN'); };
    try {
        assert.doesNotThrow(() => selectEnemyArmyTrait({ runSeed: 42, stageId: 1, policy: selectionPolicy }));
    } finally {
        Math.random = original;
    }
});
