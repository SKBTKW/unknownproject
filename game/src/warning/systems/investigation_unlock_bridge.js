import { GLOBAL_EVENT_TIMINGS } from "../../systems/global_event_system.js";

const DEFAULT_UNLOCK_EVENT_IDS = Object.freeze([
    "EVENT_DEMIHUMAN_TRACES",
    "EVENT_DEMIHUMAN_SCOUTS"
]);

/**
 * Unlocks investigation Offering access from public Global Event lifecycle facts.
 *
 * Boundary rules:
 * - listens only to public GlobalEventManager lifecycle notifications;
 * - never reads Trial schedule, Trial truth, ingress, routes, or Warning State;
 * - unlocking is idempotent;
 * - event selection/scheduling remains owned by GlobalEventManager.
 */
export class InvestigationUnlockBridge {
    constructor({ unlockEventIds = DEFAULT_UNLOCK_EVENT_IDS } = {}) {
        this.unlockEventIds = new Set(unlockEventIds);
        this.unsubscribe = null;
    }

    attach({ state, globalEventManager } = {}) {
        if (!state || !globalEventManager || typeof globalEventManager.subscribe !== "function") {
            return { success: false, reason: "GLOBAL_EVENT_LIFECYCLE_REQUIRED" };
        }

        this.detach();
        this.unsubscribe = globalEventManager.subscribe(notification => {
            if (!notification || notification.timing !== GLOBAL_EVENT_TIMINGS.START) return;
            if (!this.unlockEventIds.has(notification.eventId)) return;
            state.investigationUnlocked = true;
            if (!Number.isInteger(state.investigationUnlockedAtVerse)) {
                state.investigationUnlockedAtVerse = Number.isInteger(notification.turn)
                    ? notification.turn
                    : (state.turn || 1);
            }
        });

        return { success: true };
    }

    detach() {
        if (typeof this.unsubscribe === "function") this.unsubscribe();
        this.unsubscribe = null;
    }
}

export { DEFAULT_UNLOCK_EVENT_IDS };
export default InvestigationUnlockBridge;
