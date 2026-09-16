import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { UILayoutConfig } from '../game/src/ui/layout_config.js';

const read = path => readFileSync(new URL(path, import.meta.url), 'utf8');
const base = read('../game/css/0_global_common/base_layout.css');
const tokens = read('../game/css/0_global_common/layout_tokens.css');
const layerContract = read('../game/css/0_global_common/layer_contract.css');
const header = read('../game/css/1_top_header/top_header.css');
const legacy = read('../game/css/layout.css');
const tray = read('../game/css/3_bottom_area/draw_card_select_area.css');
const trayPlacement = read('../game/css/3_bottom_area/player_tray_view_mode.css');
const html = read('../game/index.html');
const layoutSource = read('../game/src/ui/layout_config.js');
const focusSource = read('../game/src/ui/focus_layer_system.js');
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
    assert.ok(html.indexOf('base_layout.css') < html.indexOf('layout_tokens.css'));
    assert.ok(html.indexOf('layout_tokens.css') < html.indexOf('top_header.css'));
    assert.ok(html.indexOf('top_header.css') < html.indexOf('css/layout.css'));
    assert.equal(Object.hasOwn(UILayoutConfig, 'layers'), false);
});
check('Header retains the effective 120px border-box height and visible overflow', () => {
    assert.match(base, /\*\s*\{\s*box-sizing:\s*border-box;/);
    assert.match(tokens, /--layout-header-height:\s*120px;/);
    assert.doesNotMatch(base, /--layout-header-height\s*:/);
    const style = rule(header, 'top-bar');
    assert.equal(style.height, 'var(--layout-header-height)');
    assert.equal(style.overflow, 'visible');
    assert.equal(style.padding, '0 20px');
    assert.equal(style['box-shadow'], '0 4px 14px rgba(0,0,0,0.5)');
});
check('Main play area keeps the 4px header gap contract', () => {
    assert.match(tokens, /--layout-app-gap:\s*4px;/);
    assert.equal(UILayoutConfig.gameWallpaperArt.top,
        'calc(var(--layout-header-height, 120px) + var(--layout-app-gap, 4px) + 4px)');
});
check('Middle layout shell and composition have separate owners', () => {
    assert.deepEqual(rule(base, 'middle-layout'), {
        width: '100%', flex: '1', 'min-height': '0', position: 'relative', overflow: 'visible'
    });
    assert.deepEqual(rule(layerContract, 'middle-layout'), {
        display: 'grid', 'grid-template-areas': '"main-stack"',
        'align-items': 'start', 'justify-items': 'center'
    });
});
check('Board is positioned 60px below header and Verse is in header right', () => {
    const boardWrapper = rule(layerContract, 'board-container-wrapper');
    assert.deepEqual(boardWrapper, {
        position: 'relative', display: 'flex', 'flex-direction': 'column',
        'align-items': 'center', 'justify-content': 'flex-start',
        'margin-top': '60px', 'margin-bottom': 'auto'
    });
    assert.equal(Object.hasOwn(UILayoutConfig, 'boardWrapper'), false);
    assert.doesNotMatch(layoutSource, /Object\.assign\(boardWrapper\.style/);
    assert.match(layerContract, /\.top-bar #bgTurnWatermark\.bg-turn-watermark\s*\{[\s\S]*?margin-left:\s*auto;/);
    assert.match(html, /<div class="top-bar">[\s\S]*?id="bgTurnWatermark"[\s\S]*?<\/div>\s*<!-- 🕹️ 2\. Middle Board Area -->/);
    assert.equal(UILayoutConfig.bgTurnWatermark.position, 'relative');
    assert.equal(UILayoutConfig.bgTurnWatermark.marginLeft, 'auto');
    assert.equal(UILayoutConfig.buildIdentityBadge.desktop.left, '18px');
    assert.equal(UILayoutConfig.buildIdentityBadge.desktop.bottom, '16px');
    assert.equal(UILayoutConfig.buildIdentityBadge.desktop.top, 'auto');
    assert.equal(UILayoutConfig.buildIdentityBadge.desktop.right, 'auto');
    assert.equal(UILayoutConfig.diceWidget.desktop.right, '16px');
    assert.equal(UILayoutConfig.diceWidget.desktop.bottom, '80px');
});
check('Buff expansion and invisible headroom share Layout tokens', () => {
    assert.match(tokens, /--layout-buff-dropup-max-height:\s*min\(320px,\s*calc\(100vh - var\(--layout-header-height\) - 32px\)\);/);
    assert.match(tokens, /--layout-buff-panel-headroom:\s*calc\([\s\S]*?var\(--layout-buff-summary-height\)[\s\S]*?var\(--layout-buff-dropup-gap\)[\s\S]*?var\(--layout-buff-dropup-max-height\)[\s\S]*?\);/);
    assert.equal(UILayoutConfig.buffPanel.top, 'calc(-1 * var(--layout-buff-panel-headroom))');
    assert.equal(UILayoutConfig.buffPanel.height, 'var(--layout-buff-panel-headroom)');
    assert.match(layerContract, /\.buff-dropup-panel\s*\{[\s\S]*?max-height:\s*var\(--layout-buff-dropup-max-height\);[\s\S]*?overflow-y:\s*auto;/);
});
check('Legacy board container runtime is removed from Layout config', () => {
    assert.equal(Object.hasOwn(UILayoutConfig, 'boardContainer'), false);
    assert.doesNotMatch(layoutSource, /querySelector\(["']\.board-container["']\)/);
    assert.doesNotMatch(layoutSource, /board-blur-focus|card-container-active-focus/);
    assert.match(focusSource, /getElementById\('layerWorldBoard'\)|getElementById\("layerWorldBoard"\)/);
    assert.match(focusSource, /querySelector\('\.offering-section'\)|querySelector\("\.offering-section"\)/);
});
check('Player Tray has one geometry owner in the dedicated stylesheet', () => {
    assert.ok(html.indexOf('base_layout.css') < html.indexOf('draw_card_select_area.css'));
    assert.ok(html.indexOf('draw_card_select_area.css') < html.indexOf('player_tray_view_mode.css'));
    assert.ok(html.indexOf('draw_card_select_area.css') < html.indexOf('css/layout.css'));
    assert.doesNotMatch(base, /#layerPlayerTray\.layer-player-tray\s*\{/);
    assert.doesNotMatch(base, /#layerPlayerTray \.offering-section\s*\{/);
    assert.doesNotMatch(legacy, /\.layer-player-tray-anchor\s*\{/);
    assert.doesNotMatch(tray, /(?:^|\n)\s*\.layer-player-tray\s*\{/);
    assert.doesNotMatch(tray, /\.layer-player-tray-anchor\s*\{/);
    assert.doesNotMatch(tray, /#layerPlayerTray\.layer-player-tray\s*\{/);
    assert.match(html, /id="layerPlayerTray" class="layer-player-tray layer-player-tray-anchor"/);
});
check('Player Tray placement owner contains the complete host shell', () => {
    const style = namedRule(trayPlacement.slice(0, trayPlacement.indexOf('body[data-board-view="top"]')), '#layerPlayerTray.layer-player-tray');
    assert.equal(style.position, 'absolute');
    assert.equal(style['grid-area'], 'main-stack');
    assert.equal(style.left, 'var(--layout-player-tray-top-left)');
    assert.equal(style.right, 'auto');
    assert.equal(style.bottom, 'var(--layout-player-tray-bottom)');
    assert.equal(style.width, 'auto');
    assert.equal(style.height, 'auto');
    assert.equal(style.display, 'flex');
    assert.equal(style['justify-content'], 'center');
    assert.equal(style.transform, 'translateX(-50%)');
    assert.equal(style['pointer-events'], 'none');
});
check('Player Tray quarter hand anchors and transition belong to the placement owner', () => {
    assert.match(trayPlacement, /@media \(min-width: 769px\)[\s\S]*?data-board-view="quarter"[\s\S]*?data-hand-state="expanded"[\s\S]*?var\(--layout-quarter-hand-standard-left\)/);
    assert.match(trayPlacement, /data-board-view="quarter"\]\[data-hand-state="collapsed"\][\s\S]*?var\(--layout-quarter-hand-minimal-left\)/);
    assert.match(trayPlacement, /transition:[\s\S]*?var\(--layout-player-tray-motion-easing\)/);
});
check('Player Tray responsive geometry and reduced motion remain placement-owned', () => {
    assert.match(trayPlacement, /@media \(max-width: 768px\)[\s\S]*?var\(--layout-player-tray-mobile-left\)[\s\S]*?var\(--layout-player-tray-mobile-bottom\)/);
    assert.match(trayPlacement, /@media \(prefers-reduced-motion: reduce\)[\s\S]*?transition:\s*none/);
    assert.doesNotMatch(trayPlacement, /!important/);
});
check('Global layer contract owns only the Player Tray stacking band', () => {
    assert.deepEqual(namedRule(layerContract, '#layerPlayerTray.layer-player-tray'), {
        'z-index': 'var(--z-player) !important'
    });
    assert.doesNotMatch(layerContract, /data-board-view="quarter"[^\{]*#layerPlayerTray/);
});
check('Offering geometry is owned by CSS without runtime inline configuration', () => {
    assert.deepEqual(namedRule(tray, '#layerPlayerTray .offering-section'), {
        margin: '0 !important', 'z-index': '700 !important'
    });
    const offering = rule(tray, 'offering-section');
    assert.equal(offering.position, 'relative');
    assert.equal(offering.bottom, 'auto');
    assert.equal(offering.left, 'auto');
    assert.equal(offering.margin, '0 auto');
    assert.equal(offering['z-index'], '500');
    assert.equal(offering['pointer-events'], 'auto');
    assert.doesNotMatch(layoutSource, /offeringCardArea|Object\.assign\(offeringSec\.style/);
    assert.doesNotMatch(layoutSource, /playerTray\s*:/);
    assert.equal(Object.hasOwn(UILayoutConfig, 'playerTray'), false);
    assert.equal(Object.hasOwn(UILayoutConfig, 'offeringCardArea'), false);
});
check('Focus layer state leaves Board, Player Tray, and Offering z-index to CSS', () => {
    assert.doesNotMatch(focusSource, /playerTray\.style\.zIndex/);
    assert.doesNotMatch(focusSource, /offeringSectionEl\.style\.zIndex/);
    assert.doesNotMatch(focusSource, /boardContainerEl\.style\.zIndex/);
    assert.match(focusSource, /offeringSectionEl\.classList\.add\('layer-active-front'\)/);
    assert.match(focusSource, /offeringSectionEl\.classList\.add\('layer-dim-blur'\)/);
});
check('Collapsed, expanded and Trial Hand state selectors remain present', () => {
    assert.match(tray, /\.offering-section:not\(\.is-minimal\)\s*\{/);
    assert.match(tray, /\.offering-section\.is-minimal\s*\{/);
    assert.match(tray, /\.offering-section\.is-trial-collapsed\s*,/);
    assert.match(tray, /#layerPlayerTray \.offering-section\s*\{\s*margin:\s*0 !important;\s*z-index:\s*700 !important;/);
    assert.match(tray, /\.offering-section\.layer-active-front,[\s\S]*?z-index:\s*700 !important;/);
    assert.match(tray, /\.offering-section\.layer-dim-blur\s*\{\s*z-index:\s*50 !important;/);
    assert.match(tray, /\.offering-section\.has-popover-open\s*\{\s*z-index:\s*2500 !important;/);
});

console.log(`Layout CSS Ownership: ${passed}/${passed} PASS`);
