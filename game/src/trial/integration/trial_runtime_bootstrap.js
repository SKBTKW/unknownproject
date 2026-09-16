import { GameFactHub } from "../../core/game_fact.js";
import { attachWarningSubsystem } from "../../warning/integration/warning_bootstrap.js";
import { WarningTimingBridge } from "../../warning/systems/warning_timing_bridge.js";
import { TrialDueStateService } from "../systems/trial_due_state_service.js";
import { attachTrialTimingSubsystem } from "./trial_timing_bootstrap.js";

/**
 * Live-runtime composition boundary for Trial timing + semantic Warning.
 *
 * GameEngine currently initializes Investigation before a shared GameFactHub is
 * guaranteed to exist. Investigation runtime/unlock can still attach, while the
 * Warning bootstrap correctly refuses to attach without the hub. This boundary
 * completes only the missing live wiring after GameEngine construction:
 *
 *   shared GameFactHub -> exact Trial timing -> semantic Warning lifecycle
 *                                      -> pending Trial start request
 *
 * It deliberately does not re-run Investigation bootstrap, avoiding duplicate
 * unlock/event bridges during the migration.
 */
export function attachTrialRuntimeSubsystems(engine, {
    gameFactHub = null,
    timingOptions = {},
    warningOptions = {},
    warningTimingOptions = {}
} = {}) {
    if (!engine?.state) {
        return { success: false, reason: "TRIAL_RUNTIME_ENGINE_REQUIRED" };
    }

    const factHub = gameFactHub || engine.gameFactHub || new GameFactHub();
    engine.gameFactHub = factHub;

    const timing = attachTrialTimingSubsystem(engine, timingOptions);
    if (!timing.success) {
        return {
            success: false,
            reason: timing.reason,
            gameFactHub: factHub
        };
    }

    const warning = attachWarningSubsystem(engine, warningOptions);
    if (!warning.success) {
        return {
            success: false,
            reason: warning.reason,
            gameFactHub: factHub,
            timingAttached: true
        };
    }

    if (!engine.warningTimingBridge) {
        engine.warningTimingBridge = new WarningTimingBridge({
            gameFactHub: factHub,
            timingAuthority: engine.trialTimingAuthorityService,
            warningStateService: engine.warningStateService,
            ...warningTimingOptions
        });
    }

    if (!engine.trialDueStateService) {
        engine.trialDueStateService = new TrialDueStateService({
            gameFactHub: factHub,
            timingAuthority: engine.trialTimingAuthorityService
        });
    }

    // The constructor-side Investigation bootstrap may have reported failure
    // only because Warning lacked a shared GameFactHub. Preserve the already
    // attached Investigation runtime/unlock and reflect the now-complete state.
    if (engine.investigationSubsystem?.runtimeAttached && engine.investigationSubsystem?.unlockAttached) {
        engine.investigationSubsystem = {
            ...engine.investigationSubsystem,
            success: true,
            reason: null,
            warningAttached: true
        };
    }

    engine.__trialRuntimeSubsystemsAttached = true;
    return {
        success: true,
        gameFactHub: factHub,
        timingAuthority: engine.trialTimingAuthorityService,
        timingAttached: true,
        warningAttached: true,
        warningTimingAttached: true,
        trialDueAttached: true
    };
}

export default attachTrialRuntimeSubsystems;
