import {
    BOARD_CONTEXT_MODES,
    BOARD_VIEW_PRESETS,
    isBoardViewPreset
} from './board_presentation_state.js';

export const BOARD_VISIBILITY = Object.freeze({
    PRIMARY: "PRIMARY",
    VISIBLE: "VISIBLE",
    SECONDARY: "SECONDARY",
    SUPPRESSED: "SUPPRESSED",
    HIDDEN: "HIDDEN"
});

/**
 * Context profiles are the information-disclosure gate.
 *
 * ViewPreset is applied only after this gate and may change emphasis for
 * already-disclosed semantic. A preset must never revive a HIDDEN field.
 * Renderer choice is intentionally absent from this module.
 */
export const BOARD_PRESENTATION_PROFILES = Object.freeze({
    [BOARD_CONTEXT_MODES.NORMAL]: Object.freeze({
        terrain: BOARD_VISIBILITY.PRIMARY,
        zones: BOARD_VISIBILITY.VISIBLE,
        links: BOARD_VISIBILITY.VISIBLE,
        roads: BOARD_VISIBILITY.VISIBLE,
        hq: BOARD_VISIBILITY.PRIMARY,
        yields: BOARD_VISIBILITY.PRIMARY,
        developmentHints: BOARD_VISIBILITY.VISIBLE,
        sockets: BOARD_VISIBILITY.VISIBLE,
        trialRoutes: BOARD_VISIBILITY.HIDDEN,
        invasionEntry: BOARD_VISIBILITY.HIDDEN,
        interception: BOARD_VISIBILITY.HIDDEN,
        defenseAllocation: BOARD_VISIBILITY.HIDDEN,
        battleMarkers: BOARD_VISIBILITY.HIDDEN,
        tacticalEffects: BOARD_VISIBILITY.SECONDARY
    }),
    [BOARD_CONTEXT_MODES.TRIAL]: Object.freeze({
        terrain: BOARD_VISIBILITY.PRIMARY,
        zones: BOARD_VISIBILITY.SECONDARY,
        links: BOARD_VISIBILITY.SECONDARY,
        roads: BOARD_VISIBILITY.VISIBLE,
        hq: BOARD_VISIBILITY.PRIMARY,
        yields: BOARD_VISIBILITY.SUPPRESSED,
        developmentHints: BOARD_VISIBILITY.HIDDEN,
        sockets: BOARD_VISIBILITY.SECONDARY,
        trialRoutes: BOARD_VISIBILITY.PRIMARY,
        invasionEntry: BOARD_VISIBILITY.PRIMARY,
        interception: BOARD_VISIBILITY.PRIMARY,
        defenseAllocation: BOARD_VISIBILITY.PRIMARY,
        battleMarkers: BOARD_VISIBILITY.PRIMARY,
        tacticalEffects: BOARD_VISIBILITY.PRIMARY
    })
});

export const BOARD_VIEW_PRESET_EMPHASIS = Object.freeze({
    [BOARD_VIEW_PRESETS.WORLD]: Object.freeze({}),
    [BOARD_VIEW_PRESETS.DATA]: Object.freeze({
        terrain: BOARD_VISIBILITY.VISIBLE,
        zones: BOARD_VISIBILITY.VISIBLE,
        links: BOARD_VISIBILITY.VISIBLE,
        roads: BOARD_VISIBILITY.VISIBLE,
        hq: BOARD_VISIBILITY.VISIBLE,
        yields: BOARD_VISIBILITY.PRIMARY,
        developmentHints: BOARD_VISIBILITY.VISIBLE,
        sockets: BOARD_VISIBILITY.PRIMARY,
        trialRoutes: BOARD_VISIBILITY.SECONDARY,
        invasionEntry: BOARD_VISIBILITY.SECONDARY,
        interception: BOARD_VISIBILITY.SECONDARY,
        defenseAllocation: BOARD_VISIBILITY.SECONDARY,
        battleMarkers: BOARD_VISIBILITY.SECONDARY,
        tacticalEffects: BOARD_VISIBILITY.SECONDARY
    }),
    [BOARD_VIEW_PRESETS.TACTICAL]: Object.freeze({
        terrain: BOARD_VISIBILITY.PRIMARY,
        zones: BOARD_VISIBILITY.VISIBLE,
        links: BOARD_VISIBILITY.VISIBLE,
        roads: BOARD_VISIBILITY.PRIMARY,
        hq: BOARD_VISIBILITY.PRIMARY,
        yields: BOARD_VISIBILITY.SECONDARY,
        developmentHints: BOARD_VISIBILITY.SUPPRESSED,
        sockets: BOARD_VISIBILITY.SECONDARY,
        trialRoutes: BOARD_VISIBILITY.PRIMARY,
        invasionEntry: BOARD_VISIBILITY.PRIMARY,
        interception: BOARD_VISIBILITY.PRIMARY,
        defenseAllocation: BOARD_VISIBILITY.PRIMARY,
        battleMarkers: BOARD_VISIBILITY.PRIMARY,
        tacticalEffects: BOARD_VISIBILITY.PRIMARY
    }),
    [BOARD_VIEW_PRESETS.DEVELOPMENT]: Object.freeze({
        terrain: BOARD_VISIBILITY.PRIMARY,
        zones: BOARD_VISIBILITY.VISIBLE,
        links: BOARD_VISIBILITY.VISIBLE,
        roads: BOARD_VISIBILITY.VISIBLE,
        hq: BOARD_VISIBILITY.PRIMARY,
        yields: BOARD_VISIBILITY.PRIMARY,
        developmentHints: BOARD_VISIBILITY.PRIMARY,
        sockets: BOARD_VISIBILITY.PRIMARY,
        trialRoutes: BOARD_VISIBILITY.SUPPRESSED,
        invasionEntry: BOARD_VISIBILITY.SUPPRESSED,
        interception: BOARD_VISIBILITY.SUPPRESSED,
        defenseAllocation: BOARD_VISIBILITY.SUPPRESSED,
        battleMarkers: BOARD_VISIBILITY.SUPPRESSED,
        tacticalEffects: BOARD_VISIBILITY.SECONDARY
    })
});

function applyViewPreset(baseProfile, viewPreset) {
    if (viewPreset === BOARD_VIEW_PRESETS.WORLD) return baseProfile;

    const emphasis = BOARD_VIEW_PRESET_EMPHASIS[viewPreset];
    const resolved = {};
    for (const [key, contextVisibility] of Object.entries(baseProfile)) {
        resolved[key] = contextVisibility === BOARD_VISIBILITY.HIDDEN
            ? BOARD_VISIBILITY.HIDDEN
            : (emphasis[key] ?? contextVisibility);
    }
    return Object.freeze(resolved);
}

export function getBoardPresentationProfile(
    contextMode,
    viewPreset = BOARD_VIEW_PRESETS.WORLD
) {
    const baseProfile = BOARD_PRESENTATION_PROFILES[contextMode];
    if (!baseProfile) throw new Error(`INVALID_BOARD_CONTEXT_MODE:${contextMode}`);
    if (!isBoardViewPreset(viewPreset)) {
        throw new Error(`INVALID_BOARD_VIEW_PRESET:${viewPreset}`);
    }
    return applyViewPreset(baseProfile, viewPreset);
}
