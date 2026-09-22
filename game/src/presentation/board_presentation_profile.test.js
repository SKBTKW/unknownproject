import assert from 'node:assert/strict';
import test from 'node:test';

import {
    BOARD_CONTEXT_MODES,
    BOARD_VIEW_PRESETS
} from './board_presentation_state.js';
import {
    BOARD_PRESENTATION_PROFILES,
    BOARD_VISIBILITY,
    getBoardPresentationProfile
} from './board_presentation_profile.js';

test('WORLD preserves the context profile exactly', () => {
    assert.strictEqual(
        getBoardPresentationProfile(
            BOARD_CONTEXT_MODES.NORMAL,
            BOARD_VIEW_PRESETS.WORLD
        ),
        BOARD_PRESENTATION_PROFILES[BOARD_CONTEXT_MODES.NORMAL]
    );
    assert.strictEqual(
        getBoardPresentationProfile(
            BOARD_CONTEXT_MODES.TRIAL,
            BOARD_VIEW_PRESETS.WORLD
        ),
        BOARD_PRESENTATION_PROFILES[BOARD_CONTEXT_MODES.TRIAL]
    );
});

test('TRIAL WORLD keeps zones and links available but secondary to Trial operations', () => {
    const profile = getBoardPresentationProfile(
        BOARD_CONTEXT_MODES.TRIAL,
        BOARD_VIEW_PRESETS.WORLD
    );

    assert.equal(profile.zones, BOARD_VISIBILITY.SECONDARY);
    assert.equal(profile.links, BOARD_VISIBILITY.SECONDARY);
    assert.equal(profile.trialRoutes, BOARD_VISIBILITY.PRIMARY);
    assert.equal(profile.interception, BOARD_VISIBILITY.PRIMARY);
    assert.equal(profile.battleMarkers, BOARD_VISIBILITY.PRIMARY);
});

test('TRIAL TACTICAL may explicitly re-emphasize zone and link context', () => {
    const profile = getBoardPresentationProfile(
        BOARD_CONTEXT_MODES.TRIAL,
        BOARD_VIEW_PRESETS.TACTICAL
    );

    assert.equal(profile.zones, BOARD_VISIBILITY.VISIBLE);
    assert.equal(profile.links, BOARD_VISIBILITY.VISIBLE);
});

test('NORMAL plus TACTICAL never discloses Trial-only information', () => {
    const profile = getBoardPresentationProfile(
        BOARD_CONTEXT_MODES.NORMAL,
        BOARD_VIEW_PRESETS.TACTICAL
    );

    assert.equal(profile.trialRoutes, BOARD_VISIBILITY.HIDDEN);
    assert.equal(profile.invasionEntry, BOARD_VISIBILITY.HIDDEN);
    assert.equal(profile.interception, BOARD_VISIBILITY.HIDDEN);
    assert.equal(profile.defenseAllocation, BOARD_VISIBILITY.HIDDEN);
    assert.equal(profile.battleMarkers, BOARD_VISIBILITY.HIDDEN);
    assert.equal(profile.roads, BOARD_VISIBILITY.PRIMARY);
});

test('TRIAL plus DEVELOPMENT never revives hidden development hints', () => {
    const profile = getBoardPresentationProfile(
        BOARD_CONTEXT_MODES.TRIAL,
        BOARD_VIEW_PRESETS.DEVELOPMENT
    );

    assert.equal(profile.developmentHints, BOARD_VISIBILITY.HIDDEN);
    assert.equal(profile.yields, BOARD_VISIBILITY.PRIMARY);
    assert.equal(profile.sockets, BOARD_VISIBILITY.PRIMARY);
});

test('DATA may emphasize disclosed Trial economy data without bypassing context gate', () => {
    const profile = getBoardPresentationProfile(
        BOARD_CONTEXT_MODES.TRIAL,
        BOARD_VIEW_PRESETS.DATA
    );

    assert.equal(profile.yields, BOARD_VISIBILITY.PRIMARY);
    assert.equal(profile.sockets, BOARD_VISIBILITY.PRIMARY);
    assert.equal(profile.developmentHints, BOARD_VISIBILITY.HIDDEN);
    assert.equal(profile.trialRoutes, BOARD_VISIBILITY.SECONDARY);
});

test('NORMAL plus DATA emphasizes data while keeping Trial semantic hidden', () => {
    const profile = getBoardPresentationProfile(
        BOARD_CONTEXT_MODES.NORMAL,
        BOARD_VIEW_PRESETS.DATA
    );

    assert.equal(profile.sockets, BOARD_VISIBILITY.PRIMARY);
    assert.equal(profile.yields, BOARD_VISIBILITY.PRIMARY);
    assert.equal(profile.trialRoutes, BOARD_VISIBILITY.HIDDEN);
    assert.equal(profile.interception, BOARD_VISIBILITY.HIDDEN);
});

test('invalid ViewPreset is rejected before profile composition', () => {
    assert.throws(
        () => getBoardPresentationProfile(BOARD_CONTEXT_MODES.NORMAL, '2D_ONLY'),
        /INVALID_BOARD_VIEW_PRESET:2D_ONLY/
    );
});
