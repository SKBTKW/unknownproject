import { GLOBAL_EVENT_TIMINGS } from "../../systems/global_event_system.js";

export const DEFAULT_OMEN_EVENT_IDS = Object.freeze([
    "EVENT_DEMIHUMAN_TRACES"
]);

/**
 * Converts designated Global Event starts into the semantic OMEN state.
 *
 * This bridge does not unlock Investigation cards and does not inspect Trial
 * timing. Investigation unlock remains a separate subscriber to the same GE.
 */
export class WarningOmenBridge {
    constructor({ omenEventIds = DEFAULT_OMEN_EVENT_IDS } = {}) {
        this.omenEventIds = new Set(omenEventIds);
        this.unsubscribe = null;
    }

    attach({ warningStateService, globalEventManager } = {}) {
        if (!warningStateService || typeof warningStateService.markOmen !== "function") {
            return { success: false, reason: "WARNING_STATE_SERVICE_REQUIRED" };
        }
        if (!globalEventManager || typeof globalEventManager.subscribe !== "function") {
            return { success: false, reason: "GLOBAL_EVENT_LIFECYCLE_REQUIRED" };
        }

        this.detach();
        this.unsubscribe = globalEventManager.subscribe(notification => {
            if (!notification || notification.timing !== GLOBAL_EVENT_TIMINGS.START) return;
            if (!this.omenEventIds.has(notification.eventId)) return;
            warningStateService.markOmen({
                source: notification.eventId,
                verse: Number.isInteger(notification.turn) ? notification.turn : null
            });
        });

        return { success: true };
    }

    detach() {
        if (typeof this.unsubscribe === "function") this.unsubscribe();
        this.unsubscribe = null;
    }
}

export default WarningOmenBridge;
