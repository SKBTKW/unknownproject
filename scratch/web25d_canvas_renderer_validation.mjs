import assert from 'node:assert/strict';
import { Web25DCanvasRenderer } from '../game/src/presentation/web25d_canvas_renderer.js';
import { Web25DProjectionAdapter } from '../game/src/presentation/web25d_projection_adapter.js';
import { BOARD_INPUT_COMMANDS } from '../game/src/presentation/board_input_contract.js';

class FakeContext2D {
    clearRect() {}
    beginPath() {}
    moveTo() {}
    lineTo() {}
    closePath() {}
    fill() {}
    stroke() {}
    fillText() {}
}

class FakeCanvas {
    constructor() {
        this.width = 640;
        this.height = 360;
        this.listeners = new Map();
        this.context = new FakeContext2D();
    }
    getContext(kind) { return kind === '2d' ? this.context : null; }
    getBoundingClientRect() { return { left: 0, top: 0, width: 640, height: 360 }; }
    addEventListener(type, handler) { this.listeners.set(type, handler); }
    removeEventListener(type) { this.listeners.delete(type); }
}

const commands = [];
const bridge = {
    dispatch(command) {
        commands.push(command);
        return { success: true, type: command.type };
    }
};
const projection = new Web25DProjectionAdapter({ originX: 320, originY: 70 });
const canvas = new FakeCanvas();
const renderer = new Web25DCanvasRenderer({ canvas, bridge, projectionAdapter: projection });

const cells = Array.from({ length: 5 }, (_, r) =>
    Array.from({ length: 5 }, (_, c) => ({
        r,
        c,
        placed: r === 2 && c === 2,
        interaction: { selected: false, hovered: false, focused: false }
    }))
);
renderer.setReadModel({
    board: { rows: 5, columns: 5 },
    presentation: { selectedCell: null, hoveredCell: null },
    cells
});

const target = projection.projectCell(3, 1);
const pointerEvent = { clientX: target.x, clientY: target.y };
assert.deepEqual(renderer.getLogicalCellAtCanvasPoint(target.x, target.y), { r: 3, c: 1 });
assert.deepEqual(renderer.handlePointerMove(pointerEvent), { r: 3, c: 1 });
assert.equal(commands.at(-1).type, BOARD_INPUT_COMMANDS.HOVER_CELL);
assert.deepEqual(commands.at(-1).payload.cell, { r: 3, c: 1 });

assert.deepEqual(renderer.handleClick(pointerEvent), { r: 3, c: 1 });
assert.equal(commands.at(-1).type, BOARD_INPUT_COMMANDS.SELECT_CELL);
assert.deepEqual(commands.at(-1).payload.cell, { r: 3, c: 1 });

renderer.handlePointerLeave();
assert.equal(commands.at(-1).type, BOARD_INPUT_COMMANDS.CLEAR_HOVER);

renderer.bind();
assert.equal(canvas.listeners.has('pointermove'), true);
assert.equal(canvas.listeners.has('pointerleave'), true);
assert.equal(canvas.listeners.has('click'), true);
renderer.unbind();
assert.equal(canvas.listeners.size, 0);

console.log('WEB25D_CANVAS_RENDERER_VALIDATION_OK');
