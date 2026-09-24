import GlobalEventPublicPresentationReadModel from "./global_event_public_presentation_read_model.js";

export class GlobalEventPublicPresentationBridge {
    constructor({
        readModel = new GlobalEventPublicPresentationReadModel(),
        sink = null
    } = {}) {
        this.readModel = readModel;
        this.sink = typeof sink === "function" ? sink : null;
        this.unsubscribe = null;
    }

    attach({ globalEventManager } = {}) {
        if (!globalEventManager || typeof globalEventManager.subscribe !== "function") {
            return { success: false, reason: "GLOBAL_EVENT_LIFECYCLE_REQUIRED" };
        }
        if (!this.sink) {
            return { success: false, reason: "PRESENTATION_SINK_REQUIRED" };
        }

        this.detach();
        this.unsubscribe = globalEventManager.subscribe(notification => {
            const presentation = this.readModel?.project?.(notification) || null;
            if (!presentation) return;
            this.sink(presentation);
        });

        return { success: true };
    }

    detach() {
        if (typeof this.unsubscribe === "function") this.unsubscribe();
        this.unsubscribe = null;
    }
}

export default GlobalEventPublicPresentationBridge;
