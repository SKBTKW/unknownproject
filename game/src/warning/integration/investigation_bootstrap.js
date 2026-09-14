import { attachInvestigationRuntime } from "./investigation_runtime_bridge.js";
import { InvestigationUnlockBridge } from "../systems/investigation_unlock_bridge.js";

/**
 * Single composition point for wiring Investigation into the live engine.
 *
 * This bootstrap intentionally does not discover Trial truth on its own.
 * The caller must inject an ObservableEnemyProfile provider so the
 * TrueEnemyState -> ObservableEnemyProfile firewall remains explicit.
 */
export function attachInvestigationSubsystem(engine, {
    observableProfileProvider,
    unlockBridge = new InvestigationUnlockBridge(),
    runtimeOptions = {}
} = {}) {
    if (!engine || !engine.state) {
        return { success: false, reason: "ENGINE_NOT_READY" };
    }

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

    engine.investigationUnlockBridge = unlockBridge;
    return {
        success: true,
        runtimeAttached: true,
        unlockAttached: true
    };
}

export default attachInvestigationSubsystem;
