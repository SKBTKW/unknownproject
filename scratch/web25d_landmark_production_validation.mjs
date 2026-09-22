import assert from 'node:assert/strict';
import {
    WEB25D_RESOURCE_VISUAL_FAMILIES,
    Web25DPhaseCRenderer,
    resolveWeb25DProductionMarker,
    resolveWeb25DResourceVisualFamily
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
        glyph: '🌾',
        label: '🌾4',
        yOffset: 5
    }
);

assert.deepEqual(
    resolveWeb25DProductionMarker(socketCell),
    {
        role: 'SOCKET',
        resource: 'mystic',
        amount: 2,
        glyph: '✨',
        label: '✨2',
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

const resourceFamilies = new Map([
    ['CAT_WATER', WEB25D_RESOURCE_VISUAL_FAMILIES.WATER],
    ['CAT_GRAIN', WEB25D_RESOURCE_VISUAL_FAMILIES.PLANT],
    ['CAT_GATHERING', WEB25D_RESOURCE_VISUAL_FAMILIES.PLANT],
    ['CAT_USEFUL_PLANT', WEB25D_RESOURCE_VISUAL_FAMILIES.PLANT],
    ['CAT_FUNGI', WEB25D_RESOURCE_VISUAL_FAMILIES.PLANT],
    ['CAT_LIVESTOCK', WEB25D_RESOURCE_VISUAL_FAMILIES.ANIMAL],
    ['CAT_STRATEGIC_LIVESTOCK', WEB25D_RESOURCE_VISUAL_FAMILIES.ANIMAL],
    ['CAT_HUNTING', WEB25D_RESOURCE_VISUAL_FAMILIES.ANIMAL],
    ['CAT_WOOD', WEB25D_RESOURCE_VISUAL_FAMILIES.TIMBER],
    ['CAT_STONE', WEB25D_RESOURCE_VISUAL_FAMILIES.STONE],
    ['CAT_STRATEGIC_MINERAL', WEB25D_RESOURCE_VISUAL_FAMILIES.ORE],
    ['CAT_PRECIOUS_METAL', WEB25D_RESOURCE_VISUAL_FAMILIES.ORE],
    ['CAT_SPECIAL_MINERAL', WEB25D_RESOURCE_VISUAL_FAMILIES.MYSTIC],
    ['CAT_SPECIAL_NATURE', WEB25D_RESOURCE_VISUAL_FAMILIES.MYSTIC],
    ['CAT_SALT', WEB25D_RESOURCE_VISUAL_FAMILIES.SALT]
]);

for (const [category, expectedFamily] of resourceFamilies) {
    assert.equal(resolveWeb25DResourceVisualFamily({ category }), expectedFamily, category);
}
assert.equal(
    resolveWeb25DResourceVisualFamily({ id: 'SOCKET_CRYSTAL', category: 'UNKNOWN_CATEGORY' }),
    WEB25D_RESOURCE_VISUAL_FAMILIES.UNKNOWN,
    'resource family resolution must not infer semantics from socket ids'
);

for (const [resource, glyph] of [
    ['food', '🌾'],
    ['wood', '🧱'],
    ['material', '🧱'],
    ['defense', '🛡️'],
    ['mystic', '✨']
]) {
    assert.equal(
        resolveWeb25DProductionMarker({
            display: {
                role: 'LAND_PRIMARY',
                production: { primaryYield: { resource, amount: 3 } }
            }
        })?.glyph,
        glyph,
        `${resource} production glyph`
    );
}

const textCalls = [];
const drawCalls = [];
const ctx = {
    beginPath() { drawCalls.push('beginPath'); },
    moveTo() { drawCalls.push('moveTo'); },
    lineTo() { drawCalls.push('lineTo'); },
    closePath() { drawCalls.push('closePath'); },
    fill() { drawCalls.push('fill'); },
    stroke() { drawCalls.push('stroke'); },
    arc() { drawCalls.push('arc'); },
    ellipse() { drawCalls.push('ellipse'); },
    fillRect() { drawCalls.push('fillRect'); },
    strokeRect() { drawCalls.push('strokeRect'); },
    save() { drawCalls.push('save'); },
    restore() { drawCalls.push('restore'); },
    fillText(text, x, y) {
        textCalls.push({ text, x, y });
        drawCalls.push('fillText');
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

assert.deepEqual(textCalls.map(call => call.text), ['🌾4', '✨2']);
assert.ok(
    textCalls[1].y > textCalls[0].y,
    'Socket production marker must sit below the resolved-resource landmark'
);

renderer.drawLandPrimaryMarker(landCell, { x: 50, y: 50 });
assert.equal(textCalls.at(-1).text, '🌾4', 'legacy marker method remains a compatibility alias');

for (const category of resourceFamilies.keys()) {
    const before = drawCalls.length;
    assert.doesNotThrow(
        () => renderer.drawResolvedResource({ category }, { x: 50, y: 50 }),
        `${category} landmark draw`
    );
    assert.ok(drawCalls.length > before, `${category} landmark must emit drawing operations`);
}

const unknownBefore = drawCalls.length;
assert.doesNotThrow(
    () => renderer.drawResolvedResource({ category: 'UNKNOWN_CATEGORY' }, { x: 50, y: 50 }),
    'unknown landmark fallback draw'
);
assert.ok(drawCalls.length > unknownBefore, 'unknown resource family must keep a visible fallback');

const hqBefore = drawCalls.length;
assert.doesNotThrow(() => renderer.drawHQ({ x: 50, y: 50 }), 'HQ silhouette draw');
assert.ok(drawCalls.length > hqBefore, 'HQ draw must emit drawing operations');

console.log('WEB25D_LANDMARK_PRODUCTION_VALIDATION_OK');
