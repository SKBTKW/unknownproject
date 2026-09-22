import assert from 'node:assert/strict';
import {
    Web25DPhaseCRenderer,
    resolveWeb25DProductionMarker
} from '../game/src/presentation/web25d_phase_c_renderer.js';

const landCell = {
    display: {
        role: 'LAND_PRIMARY',
        production: { primaryYield: { resource: 'food', amount: 4 } }
    }
};
const socketCell = {
    display: {
        role: 'SOCKET',
        production: { primaryYield: { resource: 'mystic', amount: 2 } }
    }
};
const cleanCell = {
    display: {
        role: 'CLEAN',
        production: { primaryYield: { resource: 'wood', amount: 9 } }
    }
};

assert.deepEqual(
    resolveWeb25DProductionMarker(landCell),
    {
        role: 'LAND_PRIMARY',
        resource: 'food',
        amount: 4,
        label: 'F4',
        yOffset: 5
    }
);

assert.deepEqual(
    resolveWeb25DProductionMarker(socketCell),
    {
        role: 'SOCKET',
        resource: 'mystic',
        amount: 2,
        label: 'X2',
        yOffset: 8
    }
);

assert.equal(resolveWeb25DProductionMarker(cleanCell), null);
assert.equal(resolveWeb25DProductionMarker({
    display: { role: 'LAND_PRIMARY', production: { primaryYield: null } }
}), null);
assert.equal(resolveWeb25DProductionMarker({
    display: {
        role: 'SOCKET',
        production: { primaryYield: { resource: 'food', amount: 0 } }
    }
}), null);

const textCalls = [];
const ctx = {
    fillRect() {},
    strokeRect() {},
    fillText(text, x, y) {
        textCalls.push({ text, x, y });
    }
};
const canvas = {
    width: 160,
    height: 120,
    getContext() { return ctx; }
};
const bridge = { dispatch() {} };
const renderer = new Web25DPhaseCRenderer({ canvas, bridge });

renderer.drawProductionMarker(landCell, { x: 50, y: 50 });
renderer.drawProductionMarker(socketCell, { x: 50, y: 50 });
renderer.drawProductionMarker(cleanCell, { x: 50, y: 50 });

assert.deepEqual(textCalls.map(call => call.text), ['F4', 'X2']);
assert.ok(
    textCalls[1].y > textCalls[0].y,
    'Socket production marker must sit below the resolved-resource landmark'
);

renderer.drawLandPrimaryMarker(landCell, { x: 50, y: 50 });
assert.equal(textCalls.at(-1).text, 'F4', 'legacy marker method remains a compatibility alias');

console.log('WEB25D_LANDMARK_PRODUCTION_VALIDATION_OK');
