import { attachCardRuntimePolicy } from "../../systems/card_runtime_policy.js";
import { attachInvestigationRuntime } from "./investigation_runtime_bridge.js";
import { attachWarningSubsystem } from "./warning_bootstrap.js";
import { InvestigationUnlockBridge } from "../systems/investigation_unlock_bridge.js";

/**
 * Single composition point for wiring Warning + Investigation into the live engine.
 *
 * This bootstrap intentionally does not discover Trial truth on its own.
 * The caller must inject an ObservableEnemyProfile provider so the
 * TrueEnemyState -> ObservableEnemyProfile firewall remains explicit.
 *
 * Semantic Warning state is attached here because the live engine already
 * enters this package through Investigation bootstrap. Exact Trial timing is
 * still owned elsewhere and is not exposed to this composition point.
 */
export function attachInvestigationSubsystem(engine, {
    observableProfileProvider,
    unlockBridge = new InvestigationUnlockBridge(),
    runtimeOptions = {},
    warningOptions = {}
} = {}) {
    if (!engine || !engine.state) {
        return { success: false, reason: "ENGINE_NOT_READY" };
    }

    const cardRuntimePolicy = attachCardRuntimePolicy(engine.deckManager);
    if (!cardRuntimePolicy.success) return cardRuntimePolicy;

    const runtime = attachInvestigationRuntime(engine, {
        ...runtimeOptions,
        observableProfileProvider
    });
    if (!runtime.success) return runtime;

    const unlock = unlockBridge.attach({
        state: engine.state,
        globalEventManager: engine.globalEventManager
    });
    if (!unlock.success) {
        return {
            success: false,
            reason: unlock.reason,
            runtimeAttached: true
        };
    }

    const warning = attachWarningSubsystem(engine, warningOptions);
    if (!warning.success) {
        return {
            success: false,
            reason: warning.reason,
            runtimeAttached: true,
            unlockAttached: true
        };
    }

    engine.investigationUnlockBridge = unlockBridge;
    return {
        success: true,
        runtimeAttached: true,
        unlockAttached: true,
        warningAttached: true,
        cardRuntimePolicyAttached: true
    };
}

export default attachInvestigationSubsystem;
