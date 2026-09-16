import { BOARD_CONTEXT_MODES } from './board_presentation_state.js';

export const BOARD_VISIBILITY = Object.freeze({
    PRIMARY: "PRIMARY",
    VISIBLE: "VISIBLE",
    SECONDARY: "SECONDARY",
    SUPPRESSED: "SUPPRESSED",
    HIDDEN: "HIDDEN"
});

/**
 * Semantic visibility only.
 *
 * This module never says where a panel is placed, how wide it is, which DOM
 * node is used, or where a Unity object lives in world space.
 *
 * Zone/link information intentionally survives in TRIAL context because it is
 * part of the board's structure, not merely an economy-only decoration.
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
        zones: BOARD_VISIBILITY.VISIBLE,
        links: BOARD_VISIBILITY.VISIBLE,
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

export function getBoardPresentationProfile(contextMode) {
    const profile = BOARD_PRESENTATION_PROFILES[contextMode];
    if (!profile) throw new Error(`INVALID_BOARD_CONTEXT_MODE:${contextMode}`);
    return profile;
}
