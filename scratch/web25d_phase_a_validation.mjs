import assert from 'node:assert/strict';
import {
    Web25DProjectionAdapter,
    WEB25D_LOGICAL_EDGES
} from '../game/src/presentation/web25d_projection_adapter.js';

const adapter = new Web25DProjectionAdapter({ originX: 300, originY: 80 });

for (let r = 0; r < 5; r++) {
    for (let c = 0; c < 5; c++) {
        const center = adapter.projectCell(r, c);
        assert.deepEqual(
            adapter.hitTest(center.x, center.y, 5, 5),
            { r, c },
            `center hit must resolve logical cell ${r},${c}`
        );
    }
}

assert.equal(adapter.hitTest(-999, -999, 5, 5), null, 'outside point must not resolve a cell');

const a1 = adapter.projectCell(0, 0);
const b1 = adapter.projectCell(0, 1);
const a2 = adapter.projectCell(1, 0);
assert.deepEqual(b1, { x: a1.x + 30, y: a1.y + 15 });
assert.deepEqual(a2, { x: a1.x - 30, y: a1.y + 15 });

const edges = adapter.getProjectedEdges(0, 0);
assert.deepEqual(Object.keys(edges), [
    WEB25D_LOGICAL_EDGES.NORTH,
    WEB25D_LOGICAL_EDGES.EAST,
    WEB25D_LOGICAL_EDGES.SOUTH,
    WEB25D_LOGICAL_EDGES.WEST
]);

const labels = adapter.getCoordinateLabels(5, 5);
assert.deepEqual(labels.columns.map(item => item.label), ['A', 'B', 'C', 'D', 'E']);
assert.deepEqual(labels.rows.map(item => item.label), ['1', '2', '3', '4', '5']);

const projected = adapter.projectCellView(Object.freeze({ r: 2, c: 3, placed: false }));
assert.equal(projected.logicalCell.r, 2);
assert.equal(projected.logicalCell.c, 3);
assert.equal(projected.screenPolygon.length, 4);
assert.ok(Number.isFinite(projected.depthKey));

console.log('WEB25D_PHASE_A_VALIDATION_OK');
