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

const rule = (css, selector) => {
    const match = css.match(new RegExp(`(?:^|\\n)\\s*\\.${selector}\\s*\\{([^{}]*)\\}`));
    assert.ok(match, `missing .${selector}`);
    return Object.fromEntries(match[1].split(';').map(part => part.trim()).filter(Boolean)
        .map(part => { const split = part.indexOf(':'); return [part.slice(0, split).trim(), part.slice(split + 1).trim()]; }));
};

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
check('Player Tray temporary override and state selectors remain untouched', () => {
    assert.match(base, /#layerPlayerTray\.layer-player-tray\s*\{[^}]*z-index:\s*700\s*!important/s);
    assert.match(base, /#layerPlayerTray \.offering-section\s*\{[^}]*margin:\s*0\s*!important/s);
    assert.match(tray, /\.offering-section\.is-trial-collapsed\s*,/);
    assert.equal(UILayoutConfig.offeringCardArea.margin, '0 auto');
});

console.log(`Layout CSS Ownership: ${passed}/${passed} PASS`);
