import assert from 'node:assert/strict';
import { test } from 'node:test';
import { generateEnemyArmyBlueprint as generate } from '../game/src/trial/systems/enemy_army_blueprint_generator.js';
import { EnemyArmyBlueprint } from '../game/src/trial/domain/enemy_army_blueprint.js';
import { fixturePolicy } from './enemy_army_blueprint_test_fixture.mjs';
const make = (runSeed = 42, policy = fixturePolicy()) => generate({ runSeed, stageId: 1, policy });

test('same inputs replay independently of intervening calls', () => {
    const before = make().getSnapshot();
    make(999);
    assert.deepEqual(make().getSnapshot(), before);
    // Locks the stream derivation and candidate order for schema v1.
    assert.deepEqual(before.forces.map(force => force.composition.speciesComposition[0].type), ['SMALL', 'MEDIUM', 'LARGE']);
});
test('seed can change composition, not merely metadata', () => {
    const signatures = new Set(Array.from({ length: 32 }, (_, seed) => JSON.stringify(make(seed).getSnapshot().forces.map(f => f.composition))));
    assert.ok(signatures.size > 1);
});
test('stable A/B/C identities, order and allowed composition values', () => {
    const snapshot = make().getSnapshot();
    assert.deepEqual(snapshot.forces.map(f => f.slot), ['A', 'B', 'C']);
    assert.deepEqual(snapshot.forces.map(f => f.id), ['A', 'B', 'C'].map(slot => `${snapshot.armyId}_${slot}`));
    for (let seed = 0; seed < 32; seed++) for (const force of make(seed).getSnapshot().forces) {
        for (const entry of force.composition.speciesComposition) assert.ok(['LARGE', 'MEDIUM', 'SMALL'].includes(entry.type));
        for (const entry of force.composition.equipmentComposition) assert.ok(['LIGHT', 'STANDARD', 'HEAVY'].includes(entry.type));
    }
});
test('explicit policy is mandatory and invalid candidates fail before selection', () => {
    assert.throws(() => generate({ runSeed: 42, stageId: 1 }), /ENEMY_BLUEPRINT/);
    assert.throws(() => make(42, null), /ENEMY_BLUEPRINT/);
    const mutations = [
        p => { p.slots.A = []; }, p => { delete p.slots.C; },
        p => { p.slots.D = p.slots.A; }, p => { p.version = 0; },
        p => { p.id = ''; }, p => { p.slots.B[2].weight = 0; },
        p => { p.slots.C[2].weight = -1; }, p => { p.slots.C[2].weight = NaN; },
        p => { p.slots.C[2].weight = Infinity; },
        p => { p.slots.A.forEach(c => { c.weight = Number.MAX_VALUE; }); },
        p => { p.slots.B[2].composition.speciesComposition[0].type = 'GIANT'; },
        p => { p.slots.B[2].composition.equipmentComposition[0].type = 'MOUNTED'; },
        p => { p.slots.A[0].composition.speciesComposition[0].share = 0.5; },
        p => { p.slots.A[0].composition.speciesComposition.push({ type: 'LARGE', share: 1 }); },
        p => { p.slots.A[0].composition.equipmentComposition = []; },
        p => { p.slots.A[0].composition.speciesComposition[0].share = -1; },
        p => { p.slots.A[0].composition.commander = {}; }
    ];
    for (const mutate of mutations) {
        const policy = fixturePolicy(); mutate(policy);
        assert.throws(() => make(42, policy), /ENEMY_BLUEPRINT/);
    }
});
test('strict seed and Stage1 scope', () => {
    for (const runSeed of [-1, 1.5, NaN, Infinity, '42', 0x100000000, undefined]) {
        assert.throws(() => generate({ runSeed, stageId: 1, policy: fixturePolicy() }), /INPUT_INVALID/);
    }
    assert.throws(() => generate({ runSeed: 42, stageId: 2, policy: fixturePolicy() }), /INPUT_INVALID/);
    make(0); make(0xffffffff);
});
test('snapshots, per-force reads and input policy cannot mutate truth', () => {
    const policy = fixturePolicy(); const blueprint = make(42, policy); const before = blueprint.getSnapshot();
    blueprint.getSnapshot().forces[0].composition.speciesComposition[0].type = 'SMALL';
    blueprint.getForce('A').composition.equipmentComposition.length = 0;
    policy.slots.A[0].composition.speciesComposition[0].type = 'SMALL';
    assert.deepEqual(blueprint.getSnapshot(), before);
    assert.ok(Object.isFrozen(blueprint));
    assert.throws(() => blueprint.getForce('D'), /SLOT_INVALID/);
});
test('JSON restore preserves composition and ownership, rejects unsupported schemas', () => {
    const original = make(); const saved = JSON.parse(JSON.stringify(original.getSnapshot()));
    const restored = EnemyArmyBlueprint.fromSnapshot(saved);
    assert.deepEqual(restored.getSnapshot(), original.getSnapshot());
    saved.forces.length = 0;
    assert.deepEqual(restored.getSnapshot(), original.getSnapshot());
    for (const mutate of [s => { s.schemaVersion = 2; }, s => { s.forces.reverse(); },
        s => { s.armyId = 'other'; }, s => { s.forces[0].composition.speciesComposition[0].share = NaN; }]) {
        const invalid = original.getSnapshot(); mutate(invalid);
        assert.throws(() => EnemyArmyBlueprint.fromSnapshot(invalid), /ENEMY_BLUEPRINT/);
    }
});

test('per-slot streams and original instances survive later policy generation', () => {
    const original = make(); const before = original.getSnapshot();
    const policy = fixturePolicy(); policy.slots.B.reverse();
    const later = make(42, policy);
    assert.deepEqual(later.getForce('A'), original.getForce('A'));
    assert.deepEqual(later.getForce('C'), original.getForce('C'));
    assert.deepEqual(original.getSnapshot(), before);
});
