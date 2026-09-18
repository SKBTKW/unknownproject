import assert from 'node:assert/strict';
import { Web25DMaterializationState } from '../game/src/presentation/web25d_materialization_state.js';

const state = new Web25DMaterializationState({
    durationMs: 500,
    groundEnd: 0.4,
    growthEnd: 0.8
});

const empty = {
    cells: [[
        { r: 0, c: 0, placed: false },
        { r: 0, c: 1, placed: false }
    ]]
};
const placed = {
    cells: [[
        { r: 0, c: 0, placed: true },
        { r: 0, c: 1, placed: true }
    ]]
};

assert.deepEqual(state.update(null, empty, 0), []);
assert.deepEqual(state.update(empty, placed, 100), [
    { r: 0, c: 0 },
    { r: 0, c: 1 }
]);
assert.deepEqual(state.update(placed, placed, 120), []);

let cell = state.getCellState(0, 0, 100);
assert.equal(cell.active, true);
assert.equal(cell.ground, 0);
assert.equal(cell.growth, 0);
assert.equal(cell.resource, 0);

const sibling = state.getCellState(0, 1, 100);
assert.equal(sibling.active, true);
assert.equal(sibling.progress, cell.progress);

cell = state.getCellState(0, 0, 300);
assert.equal(cell.active, true);
assert.equal(cell.ground, 1);
assert.equal(cell.growth, 0);
assert.equal(cell.resource, 0);

cell = state.getCellState(0, 0, 450);
assert.equal(cell.active, true);
assert.equal(cell.growth > 0, true);
assert.equal(cell.resource, 0);

cell = state.getCellState(0, 0, 550);
assert.equal(cell.active, true);
assert.equal(cell.resource > 0, true);

cell = state.getCellState(0, 0, 600);
assert.equal(cell.active, false);
assert.equal(state.hasActive(600), false);

console.log('web25d materialization state ok');
