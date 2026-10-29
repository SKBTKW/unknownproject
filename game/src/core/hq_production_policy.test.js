import assert from 'node:assert/strict';
import test from 'node:test';
import { BASELINE_ECONOMY } from '../core/baseline_economy.js';
import { normalizeHQTerrain, resolveHQBaseYields } from '../core/hq_production_policy.js';
import { ProductionCalculator } from '../systems/production_calculator.js';

const expected = BASELINE_ECONOMY.hqYields;
const old = { id: 'HQ', nameKey: 'TERRAIN_HQ', food: 10, wood: 10, material: 10, defense: 10, mystic: 1 };

test('HQ defaults are rules-owned and legacy saved yields are normalized', () => {
    assert.deepEqual(resolveHQBaseYields(), expected);
    assert.deepEqual(normalizeHQTerrain(old), { id: 'HQ', nameKey: 'TERRAIN_HQ', ...expected });
});

test('HQ single-cell production ignores stale serialized terrain values', () => {
    const grid = Array.from({length: 5}, (_, r) => Array.from({length: 5}, (_, c) => ({ placed: false, isHQ: false, terrain: null, r, c })));
    grid[2][2] = { placed: true, isHQ: true, terrain: old };
    const state = { grid };
    const actual = ProductionCalculator.calculateCellYieldBreakdown(state, 2, 2);
    assert.deepEqual(actual.baseYields, expected);
    assert.deepEqual(actual.totalYields, expected);
});
