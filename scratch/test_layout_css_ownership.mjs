import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { UILayoutConfig } from '../game/src/ui/layout_config.js';

const read = path => readFileSync(new URL(path, import.meta.url), 'utf8');
const base = read('../game/css/0_global_common/base_layout.css');
const header = read('../game/css/1_top_header/top_header.css');
const legacy = read('../game/css/layout.css');
const tray = read('../game/css/3_bottom_area/draw_card_select_area.css');
const html = read('../game/index.html');
let passed = 0;
function check(name, fn) { fn(); passed++; console.log(`  PASS: ${name}`); }

const namedRule = (css, selector) => {
    const escaped = selector.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    const matches = [...css.matchAll(new RegExp(`(?:^|\\n)\\s*${escaped}\\s*\\{([^{}]*)\\}`, 'g'))];
    assert.equal(matches.length, 1, `expected exactly one ${selector} rule`);
    return Object.fromEntries(matches[0][1].split(';').map(part => part.trim()).filter(Boolean)
        .map(part => { const split = part.indexOf(':'); return [part.slice(0, split).trim(), part.slice(split + 1).trim()]; }));
};
const rule = (css, selector) => namedRule(css, `.${selector}`);

check('Header has one owner in the dedicated stylesheet, after the global token', () => {
    assert.equal((header.match(/\.top-bar\s*\{/g) || []).length, 1);
    assert.doesNotMatch(legacy, /\.top-bar\s*\{/);
    assert.ok(html.indexOf('base_layout.css') < html.indexOf('top_header.css'));
    assert.ok(html.indexOf('top_header.css') < html.indexOf('css/layout.css'));
});
check('Header retains the effective 84px border-box height and visible overflow', () => {
    assert.match(base, /\*\s*\{\s*box-sizing:\s*border-box;/);
    assert.match(base, /--layout-header-height:\s*84px;/);
    const style = rule(header, 'top-bar');
    assert.equal(style.height, 'var(--layout-header-height, 84px)');
    assert.equal(style.overflow, 'visible');
    assert.equal(style.padding, '0 20px');
    assert.equal(style['box-shadow'], '0 4px 14px rgba(0,0,0,0.5)');
});
check('Logo CSS and inline config keep the prior 96px relative offset', () => {
    assert.match(base, /top:\s*calc\(var\(--layout-header-height\) \+ var\(--layout-app-gap\) \+ 4px\)/);
    assert.equal(UILayoutConfig.gameWallpaperArt.top,
        'calc(var(--layout-header-height, 84px) + var(--layout-app-gap, 8px) + 4px)');
    assert.equal(84 + 8 + 4, 80 + 8 + 8);
});
check('Player Tray has one geometry owner in the dedicated stylesheet', () => {
    assert.ok(html.indexOf('base_layout.css') < html.indexOf('draw_card_select_area.css'));
    assert.ok(html.indexOf('draw_card_select_area.css') < html.indexOf('css/layout.css'));
    assert.doesNotMatch(base, /#layerPlayerTray\.layer-player-tray\s*\{/);
    assert.doesNotMatch(base, /#layerPlayerTray \.offering-section\s*\{/);
    assert.doesNotMatch(legacy, /\.layer-player-tray-anchor\s*\{/);
    assert.match(html, /id="layerPlayerTray" class="layer-player-tray layer-player-tray-anchor"/);
});
check('Player Tray anchor declarations remain unchanged', () => {
    assert.deepEqual(rule(tray, 'layer-player-tray-anchor'), {
        position: 'absolute', bottom: '0', left: '0', width: '100%',
        height: '0', 'z-index': '500', 'pointer-events': 'none'
    });
});
check('Player Tray ID override retains exact geometry, specificity and priority', () => {
    assert.deepEqual(namedRule(tray.slice(0, tray.indexOf('@media (max-width: 768px)')), '#layerPlayerTray.layer-player-tray'), {
        left: 'var(--layout-edge-gap)', right: 'auto !important',
        bottom: 'var(--layout-edge-gap)', width: 'auto !important',
        'justify-content': 'flex-start !important', 'z-index': '700 !important'
    });
});
check('Player Tray narrow-viewport override is relocated without changing its conditions', () => {
    assert.doesNotMatch(base, /#layerPlayerTray\.layer-player-tray\s*\{/);
    assert.match(tray, /@media \(max-width: 768px\)\s*\{\s*#layerPlayerTray\.layer-player-tray\s*\{\s*left:\s*8px !important;\s*bottom:\s*8px !important;\s*\}\s*\}/);
});
check('Offering keeps its inline config and stronger dedicated CSS override', () => {
    assert.deepEqual(namedRule(tray, '#layerPlayerTray .offering-section'), {
        margin: '0 !important', 'z-index': '700 !important'
    });
    assert.equal(UILayoutConfig.offeringCardArea.margin, '0 auto');
    assert.equal(UILayoutConfig.offeringCardArea.zIndex, 500);
});
check('Collapsed, expanded and Trial Hand state selectors remain present', () => {
    assert.match(tray, /\.offering-section:not\(\.is-minimal\)\s*\{/);
    assert.match(tray, /\.offering-section\.is-minimal\s*\{/);
    assert.match(tray, /\.offering-section\.is-trial-collapsed\s*,/);
});

console.log(`Layout CSS Ownership: ${passed}/${passed} PASS`);
