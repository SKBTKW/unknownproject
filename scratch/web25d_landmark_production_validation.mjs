import assert from 'node:assert/strict';
import {
    WEB25D_RESOURCE_VISUAL_FAMILIES,
    Web25DPhaseCRenderer,
    resolveWeb25DProductionMarker,
    resolveWeb25DProductionMarkerAnchor,
    resolveWeb25DProductionMarkerMetrics,
    resolveWeb25DProfileOpacity,
    resolveWeb25DResourceVisualFamily
} from '../game/src/presentation/web25d_phase_c_renderer.js';
import { Web25DProjectionAdapter } from '../game/src/presentation/web25d_projection_adapter.js';
import { BOARD_VISIBILITY } from '../game/src/presentation/board_presentation_profile.js';

assert.equal(resolveWeb25DProfileOpacity(BOARD_VISIBILITY.PRIMARY), 1);
assert.equal(resolveWeb25DProfileOpacity(BOARD_VISIBILITY.VISIBLE), 1);
assert.equal(resolveWeb25DProfileOpacity(BOARD_VISIBILITY.SECONDARY), 0.55);
assert.equal(resolveWeb25DProfileOpacity(BOARD_VISIBILITY.SUPPRESSED), 0);
assert.equal(resolveWeb25DProfileOpacity(BOARD_VISIBILITY.HIDDEN), 0);
assert.equal(
    resolveWeb25DProfileOpacity(BOARD_VISIBILITY.SUPPRESSED, { suppressed: 0.28 }),
    0.28
);

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

const projection = new Web25DProjectionAdapter({ originX: 100, originY: 50 });
const rearProjected = projection.projectCellView({ r: 0, c: 0 });
const frontProjected = projection.projectCellView({ r: 1, c: 1 });
const rearProductionAnchor = resolveWeb25DProductionMarkerAnchor(rearProjected);
const frontProductionAnchor = resolveWeb25DProductionMarkerAnchor(frontProjected);

assert.deepEqual(rearProductionAnchor, { x: 100, y: 50 });
assert.deepEqual(frontProductionAnchor, { x: 100, y: 80 });
assert.equal(
    frontProductionAnchor.y - rearProductionAnchor.y,
    30,
    'production metadata must preserve projected base spacing regardless of terrain elevation'
);
assert.equal(
    resolveWeb25DProductionMarkerAnchor({ screenCenter: { x: NaN, y: 0 } }),
    null
);


assert.deepEqual(
    resolveWeb25DProductionMarkerMetrics({ tileWidth: 60, amount: 4, role: 'LAND_PRIMARY' }),
    { compact: false, width: 24, height: 12, fontSize: 10, yOffset: 5 }
);
assert.deepEqual(
    resolveWeb25DProductionMarkerMetrics({ tileWidth: 60, amount: 12, role: 'SOCKET' }),
    { compact: false, width: 28, height: 12, fontSize: 10, yOffset: 8 }
);
assert.deepEqual(
    resolveWeb25DProductionMarkerMetrics({ tileWidth: 38, amount: 4, role: 'LAND_PRIMARY' }),
    { compact: true, width: 18, height: 8, fontSize: 8, yOffset: 4 }
);
assert.deepEqual(
    resolveWeb25DProductionMarkerMetrics({ tileWidth: 38, amount: 12, role: 'SOCKET' }),
    { compact: true, width: 22, height: 8, fontSize: 8, yOffset: 4 }
);

const narrowProjection = new Web25DProjectionAdapter({
    tileWidth: 38,
    tileHeight: 19,
    originX: 100,
    originY: 50
});
const narrowA = narrowProjection.projectCell(0, 0);
const narrowB = narrowProjection.projectCell(1, 0);
const narrowMetrics = resolveWeb25DProductionMarkerMetrics({
    tileWidth: narrowProjection.tileWidth,
    amount: 12,
    role: 'SOCKET'
});
assert.ok(
    Math.abs(narrowB.y - narrowA.y) > narrowMetrics.height,
    'narrow 9x9 production rows keep vertical chip separation'
);

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
const rectCalls = [];
const ctx = {
    beginPath() { drawCalls.push('beginPath'); },
    moveTo() { drawCalls.push('moveTo'); },
    lineTo() { drawCalls.push('lineTo'); },
    closePath() { drawCalls.push('closePath'); },
    fill() { drawCalls.push('fill'); },
    stroke() { drawCalls.push('stroke'); },
    arc() { drawCalls.push('arc'); },
    ellipse() { drawCalls.push('ellipse'); },
    fillRect(x, y, width, height) {
        drawCalls.push('fillRect');
        rectCalls.push({ type: 'fill', x, y, width, height });
    },
    strokeRect(x, y, width, height) {
        drawCalls.push('strokeRect');
        rectCalls.push({ type: 'stroke', x, y, width, height });
    },
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

const opacitySamples = [];
ctx.globalAlpha = 1;
renderer.drawWithOpacity(0.55, () => opacitySamples.push(ctx.globalAlpha));
assert.deepEqual(opacitySamples, [0.55]);
assert.equal(ctx.globalAlpha, 1, 'profile opacity drawing must restore canvas alpha');

const phaseCSource = await import('node:fs/promises').then(fs =>
    fs.readFile(new URL('../game/src/presentation/web25d_phase_c_renderer.js', import.meta.url), 'utf8')
);
assert.match(
    phaseCSource,
    /this\.readModel\?\.profile\?\.yields/,
    '2.5D production visibility must consume the presentation profile'
);
assert.match(
    phaseCSource,
    /this\.readModel\?\.profile\?\.sockets/,
    '2.5D socket visibility must consume the presentation profile'
);

renderer.drawProductionMarker(landCell, { x: 50, y: 50 });
renderer.drawProductionMarker(socketCell, { x: 50, y: 50 });
renderer.drawProductionMarker(cleanCell, { x: 50, y: 50 });

assert.deepEqual(textCalls.map(call => call.text), ['🌾4', '✨2']);
assert.ok(
    textCalls[1].y > textCalls[0].y,
    'Socket production marker must sit below the resolved-resource landmark'
);

const productionRects = rectCalls.filter(call => call.type === 'fill').slice(0, 2);
assert.deepEqual(
    productionRects.map(call => ({ width: call.width, height: call.height })),
    [
        { width: 24, height: 12 },
        { width: 24, height: 12 }
    ],
    'single-digit production chips keep the minimum readable footprint'
);
assert.equal(ctx.font, '10px "Segoe UI Emoji", sans-serif');


const narrowRectCalls = [];
const narrowTextCalls = [];
const narrowCtx = {
    fillRect(x, y, width, height) { narrowRectCalls.push({ type: 'fill', x, y, width, height }); },
    strokeRect(x, y, width, height) { narrowRectCalls.push({ type: 'stroke', x, y, width, height }); },
    fillText(text, x, y) { narrowTextCalls.push({ text, x, y }); }
};
const narrowCanvas = {
    width: 400,
    height: 584,
    getContext() { return narrowCtx; }
};
const narrowRenderer = new Web25DPhaseCRenderer({
    canvas: narrowCanvas,
    bridge,
    projectionAdapter: narrowProjection
});
narrowRenderer.drawProductionMarker(landCell, { x: 50, y: 50 });
assert.deepEqual(
    narrowRectCalls[0],
    { type: 'fill', x: 41, y: 54, width: 18, height: 8 },
    'narrow single-digit production uses compact chip geometry'
);
assert.equal(narrowCtx.font, '8px "Segoe UI Emoji", sans-serif');
assert.equal(narrowTextCalls[0]?.text, '🌾4');

renderer.drawLandPrimaryMarker(landCell, { x: 50, y: 50 });
assert.equal(textCalls.at(-1).text, '🌾4', 'legacy marker method remains a compatibility alias');

const doubleDigitCell = {
    display: {
        role: 'LAND_PRIMARY',
        production: { primaryYield: { resource: 'food', amount: 12 } }
    }
};
const rectCountBeforeDoubleDigit = rectCalls.length;
renderer.drawProductionMarker(doubleDigitCell, { x: 50, y: 50 });
const doubleDigitFill = rectCalls.slice(rectCountBeforeDoubleDigit)
    .find(call => call.type === 'fill');
assert.equal(doubleDigitFill?.width, 28, 'double-digit production expands chip width');
assert.equal(doubleDigitFill?.height, 12);

const elevatedCell = {
    r: 0,
    c: 0,
    placed: true,
    elevation: 3,
    greenery: 0,
    terrainId: 'E3_MOUNTAIN',
    edges: [],
    interaction: {},
    display: {
        role: 'LAND_PRIMARY',
        production: { primaryYield: { resource: 'food', amount: 4 } }
    }
};
const elevatedProjected = projection.projectCellView(elevatedCell);
const productionAnchors = [];
const originalDrawProductionMarker = renderer.drawProductionMarker.bind(renderer);
renderer.drawProductionMarker = (cell, center) => {
    productionAnchors.push({ ...center });
};
renderer.drawPlacedTerrain(elevatedCell, elevatedProjected);
renderer.drawProductionMarker = originalDrawProductionMarker;
assert.deepEqual(
    productionAnchors.at(-1),
    elevatedProjected.screenCenter,
    'E3 terrain keeps production metadata on the unlifted logical cell base'
);
assert.equal(
    productionAnchors.at(-1).y,
    50,
    'production anchor must not inherit the 24px E3 visual lift'
);

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
