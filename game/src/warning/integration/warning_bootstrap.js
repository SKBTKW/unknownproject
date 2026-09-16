import { WarningStateService } from "../systems/warning_state_service.js";
import { WarningOmenBridge } from "../systems/warning_omen_bridge.js";
import { WarningInvestigationBridge } from "../systems/warning_investigation_bridge.js";
import { WarningSettlementBridge } from "../systems/warning_settlement_bridge.js";

/**
 * Composition point for semantic Warning lifecycle wiring.
 *
 * This bootstrap intentionally does not attach any exact-distance policy.
 * TENSE / IMMINENT progression will be supplied by a separate timing-to-warning
 * policy so exact Trial timing cannot leak into presentation by accident.
 */
export function attachWarningSubsystem(engine, {
    warningStateService = null,
    omenBridge = new WarningOmenBridge()
} = {}) {
    if (!engine?.gameFactHub || !engine?.globalEventManager) {
        return { success: false, reason: "WARNING_RUNTIME_DEPENDENCY_REQUIRED" };
    }
    if (engine.__warningSubsystemAttached) {
        return {
            success: true,
            alreadyAttached: true,
            warningStateService: engine.warningStateService
        };
    }

    const stateService = warningStateService
        || engine.warningStateService
        || new WarningStateService();

    const omen = omenBridge.attach({
        warningStateService: stateService,
        globalEventManager: engine.globalEventManager
    });
    if (!omen.success) return omen;

    const investigationBridge = new WarningInvestigationBridge({
        gameFactHub: engine.gameFactHub,
        warningStateService: stateService
    });
    const settlementBridge = new WarningSettlementBridge({
        gameFactHub: engine.gameFactHub,
        warningStateService: stateService
    });

    engine.warningStateService = stateService;
    engine.warningOmenBridge = omenBridge;
    engine.warningInvestigationBridge = investigationBridge;
    engine.warningSettlementBridge = settlementBridge;
    engine.__warningSubsystemAttached = true;

    return {
        success: true,
        warningStateService: stateService,
        omenAttached: true,
        investigationAttached: true,
        settlementAttached: true
    };
}

export default attachWarningSubsystem;
