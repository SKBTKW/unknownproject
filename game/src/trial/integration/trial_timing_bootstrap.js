import { createLegacyCompatibleTrialTimingAuthority } from "../systems/trial_timing_authority_service.js";
import { TrialTimingFactBridge } from "../systems/trial_timing_fact_bridge.js";

/**
 * Attaches the exact internal Trial clock without making it a Trial trigger.
 *
 * Automatic legacy bootstrap is allowed only for a fresh Verse-1 state, where
 * current Trial index = 1 is unambiguous. Mid-run injected states must provide
 * an explicit timing authority so migration never guesses progression from
 * Stage or nextTrialTurn.
 */
export function attachTrialTimingSubsystem(engine, {
    timingAuthority = null,
    currentTrialIndex = 1
} = {}) {
    if (!engine?.state || !engine?.gameFactHub) {
        return { success: false, reason: "TRIAL_TIMING_RUNTIME_DEPENDENCY_REQUIRED" };
    }
    if (engine.__trialTimingSubsystemAttached) {
        return {
            success: true,
            alreadyAttached: true,
            timingAuthority: engine.trialTimingAuthorityService
        };
    }

    let authority = timingAuthority || engine.trialTimingAuthorityService || null;
    if (!authority) {
        const isFreshState = engine.state.turn === 1;
        if (!isFreshState) {
            return { success: false, reason: "TRIAL_TIMING_EXPLICIT_STATE_REQUIRED" };
        }
        if (!engine.state.trialSchedule) {
            return { success: false, reason: "TRIAL_TIMING_LEGACY_SCHEDULE_REQUIRED" };
        }
        authority = createLegacyCompatibleTrialTimingAuthority(engine.state, {
            currentTrialIndex
        });
    }

    const factBridge = new TrialTimingFactBridge({
        gameFactHub: engine.gameFactHub,
        timingAuthority: authority
    });

    engine.trialTimingAuthorityService = authority;
    engine.trialTimingFactBridge = factBridge;
    engine.__trialTimingSubsystemAttached = true;

    return {
        success: true,
        timingAuthority: authority,
        factBridgeAttached: true
    };
}

export default attachTrialTimingSubsystem;
