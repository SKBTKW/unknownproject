import assert from 'node:assert/strict';
import fs from 'node:fs';

import {
    BOARD_PRESENTATION_PROFILES,
    BOARD_VIEW_PRESET_EMPHASIS,
    BOARD_VISIBILITY
} from '../game/src/presentation/board_presentation_profile.js';

const read = path => fs.readFileSync(new URL(path, import.meta.url), 'utf8');

const expectedFields = Object.freeze([
    'terrain',
    'zones',
    'links',
    'roads',
    'hq',
    'yields',
    'developmentHints',
    'sockets',
    'trialRoutes',
    'invasionEntry',
    'interception',
    'defenseAllocation',
    'battleMarkers',
    'tacticalEffects'
]);

const profileFieldSet = new Set();
for (const profile of Object.values(BOARD_PRESENTATION_PROFILES)) {
    for (const key of Object.keys(profile)) profileFieldSet.add(key);
}
assert.deepEqual(
    [...profileFieldSet].sort(),
    [...expectedFields].sort(),
    'every board profile field must be explicitly classified by the consumption audit'
);

for (const emphasis of Object.values(BOARD_VIEW_PRESET_EMPHASIS)) {
    for (const key of Object.keys(emphasis)) {
        assert.equal(profileFieldSet.has(key), true, `view preset field must belong to the profile contract: ${key}`);
    }
}

const phaseC = read('../game/src/presentation/web25d_phase_c_renderer.js');
const zoneLink = read('../game/src/presentation/web25d_zone_link_overlay_renderer.js');
const trialOverlay = read('../game/src/presentation/web25d_trial_overlay_renderer.js');
const presentationGrid = read('../game/src/ui/board_presentation_grid_component.js');
const boardAwareUi = read('../game/src/ui/board_aware_ui_controller.js');
const legacyGrid = read('../game/src/ui/board_grid_component.js');
const trialAdapter = read('../game/src/presentation/trial_board_semantic_adapter.js');
const routeCostPolicy = read('../game/src/trial/scenario/trial_route_cost_policy.js');

assert.match(zoneLink, /readModel\.profile\?\.zones/, 'zones must have an active renderer consumer');
assert.match(zoneLink, /readModel\.profile\?\.links/, 'links must have an active renderer consumer');
assert.match(phaseC, /this\.readModel\?\.profile\?\.yields/, 'yields must have an active 2.5D consumer');
assert.match(phaseC, /this\.readModel\?\.profile\?\.sockets/, 'sockets must have an active 2.5D consumer');
assert.match(presentationGrid, /data-board-yields-visibility/, 'yields must have an active 2D consumer');
assert.match(presentationGrid, /data-board-sockets-visibility/, 'sockets must have an active 2D consumer');

assert.match(boardAwareUi, /profile\.developmentHints/, 'developmentHints must gate presentation generation');
assert.match(legacyGrid, /shouldShowBoardDevelopmentHints/, '2D development hints must consume the presentation gate');

for (const key of ['trialRoutes', 'invasionEntry', 'interception', 'battleMarkers']) {
    assert.match(
        trialOverlay,
        new RegExp(`profile\\.${key}`),
        `${key} must have an active 2.5D Trial overlay consumer`
    );
}
for (const attribute of [
    'data-board-trial-routes-visibility',
    'data-board-invasion-entry-visibility',
    'data-board-interception-visibility',
    'data-board-battle-markers-visibility'
]) {
    assert.match(
        presentationGrid,
        new RegExp(attribute),
        `${attribute} must expose Trial profile emphasis to the 2D board`
    );
}

assert.match(
    trialAdapter,
    /defenseAllocation:/,
    'defenseAllocation is carried as renderer-neutral Trial board data even though it has no board glyph yet'
);
assert.doesNotMatch(
    trialOverlay,
    /profile\.defenseAllocation/,
    'defenseAllocation remains data-carried, not falsely treated as an implemented 2.5D board layer'
);

assert.match(
    routeCostPolicy,
    /roadResolver = null/,
    'roads remain explicitly reserved until a canonical GameState road resolver exists'
);
assert.match(
    routeCostPolicy,
    /GameState does[\s\S]*not yet own a canonical road representation/,
    'road reservation must retain its canonical-state boundary explanation'
);

assert.doesNotMatch(
    trialOverlay,
    /profile\.tacticalEffects/,
    'tacticalEffects remains reserved until renderer-neutral board tactical-effect semantics exist'
);

for (const profile of Object.values(BOARD_PRESENTATION_PROFILES)) {
    assert.notEqual(profile.terrain, BOARD_VISIBILITY.HIDDEN);
    assert.notEqual(profile.terrain, BOARD_VISIBILITY.SUPPRESSED);
    assert.notEqual(profile.hq, BOARD_VISIBILITY.HIDDEN);
    assert.notEqual(profile.hq, BOARD_VISIBILITY.SUPPRESSED);
}

console.log('BOARD_PRESENTATION_PROFILE_CONSUMPTION_CONTRACT_OK');
