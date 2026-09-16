function requireGameplayRandom(gameplayRandom) {
    if (!gameplayRandom || typeof gameplayRandom.nextInt !== "function") {
        throw new TypeError("TRIAL_TIMING_POLICY_GAMEPLAY_RANDOM_REQUIRED");
    }
    return gameplayRandom;
}

function clamp(value, min, max) {
    return Math.max(min, Math.min(max, value));
}

export const FIRST_RUN_TRIAL1_VERSE = 15;
export const FINAL_TRIAL_VERSE = 50;

/**
 * Build the internal three-Trial schedule for a Run.
 *
 * `firstRun` affects only Trial 1: tutorial/onboarding runs start Trial 1 at
 * Verse 15 exactly. Later runs preserve the current ±3 scheduling window.
 * Trial 2 keeps the current 27..33 window and Trial 3 remains fixed at 50.
 *
 * The returned schedule is simulation authority input. It must not be exposed
 * as a player-facing countdown.
 */
export function createTrialTimingSchedule({ gameplayRandom, firstRun = false } = {}) {
    const rng = requireGameplayRandom(gameplayRandom);

    const trial1 = firstRun
        ? FIRST_RUN_TRIAL1_VERSE
        : clamp(15 + rng.nextInt(-3, 3), 12, 18);
    const trial2 = clamp(30 + rng.nextInt(-3, 3), 27, 33);

    return Object.freeze({
        trial1,
        trial2,
        trial3: FINAL_TRIAL_VERSE
    });
}

export default createTrialTimingSchedule;
