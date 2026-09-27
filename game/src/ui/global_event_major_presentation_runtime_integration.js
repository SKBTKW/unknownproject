import { I18n } from "../i18n.js";
import GlobalEventPublicPresentationBridge from "../presentation/global_event/global_event_public_presentation_bridge.js";
import GlobalEventMajorPresentationComponent from "./global_event_major_presentation_component.js";

export class GlobalEventMajorPresentationRuntimeIntegration {
    constructor({ engine = null, container = null, component = null } = {}) {
        this.engine = engine;
        this.manager = engine?.globalEventManager || null;
        this.component = component || (typeof document !== "undefined"
            ? new GlobalEventMajorPresentationComponent({ i18n: I18n })
            : null);
        this.container = container;
        this.bridge = new GlobalEventPublicPresentationBridge({
            sink: presentation => this.present(presentation)
        });
        this.attachResult = null;

        if (this.component && typeof document !== "undefined") {
            this.component.mount(container || document.body);
        }
        if (this.manager) this.attachResult = this.bridge.attach({ globalEventManager: this.manager });
    }

    present(presentation) {
        if (!this.component) return false;
        return this.component.show(presentation);
    }

    destroy() {
        this.bridge.detach();
        this.component?.hide?.();
    }
}

export default GlobalEventMajorPresentationRuntimeIntegration;
