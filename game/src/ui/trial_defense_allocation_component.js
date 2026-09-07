import { I18n } from "../i18n.js";
import { UILayoutConfig } from "./layout_config.js";
import { TrialInterceptionPreviewComponent } from "./trial_interception_preview_component.js";

export class TrialDefenseAllocationComponent {
    constructor(uiController) {
        this.ui = uiController;
        this.containerEl = null;
        if (typeof document !== "undefined") this.mount();
    }

    mount() {
        if (this.containerEl || typeof document === "undefined") return this.containerEl;
        const root = document.createElement("aside");
        root.id = "trialDefenseAllocationRoot";
        root.className = "trial-defense-allocation-panel";
        const layoutMode = (typeof window !== "undefined" && Number(window.innerWidth) <= 768)
            ? "mobile"
            : "desktop";
        const config = UILayoutConfig?.trialDefenseAllocation?.[layoutMode];
        if (config) Object.assign(root.style, config);
        document.body.appendChild(root);
        this.containerEl = root;
        return root;
    }

    render() {
        const root = this.mount();
        if (!root) return;
        const active = Boolean(this.ui?.trialPreviewConfig && this.ui?.trialController?.state);
        root.classList.toggle("is-active", active);
        if (!active) {
            root.innerHTML = "";
            return;
        }

        const available = this.ui.getTrialAvailableDefense();
        const allocated = this.ui.trialPresentationState.previewDefenseAllocation;
        const previewHtml = TrialInterceptionPreviewComponent.renderHtml(
            this.ui.trialPresentationState.interceptionPreview,
            I18n
        );
        const decreaseLabel = I18n.t("UI_TRIAL_DEFENSE_ALLOCATION_DECREASE");
        const increaseLabel = I18n.t("UI_TRIAL_DEFENSE_ALLOCATION_INCREASE");
        const maxLabel = I18n.t("UI_TRIAL_DEFENSE_MAX");

        root.innerHTML = `
            <div class="trial-defense-allocation-heading">${I18n.t("UI_TRIAL_DEFENSE_ALLOCATION")}</div>
            <div class="trial-defense-allocation-status">
                <strong>🛡️ ${allocated} / ${available}</strong>
                <span>${I18n.t("UI_TRIAL_AVAILABLE_DEFENSE")}</span>
            </div>
            <div class="trial-defense-allocation-controls">
                <button type="button" id="btnTrialDefenseDecrease" aria-label="${decreaseLabel}" title="${decreaseLabel}" ${allocated <= 0 ? "disabled" : ""}>−</button>
                <input id="trialDefenseAllocationSlider" type="range" min="0" max="${available}" step="1" value="${allocated}" aria-label="${I18n.t("UI_TRIAL_DEFENSE_ALLOCATION")}">
                <button type="button" id="btnTrialDefenseIncrease" aria-label="${increaseLabel}" title="${increaseLabel}" ${allocated >= available ? "disabled" : ""}>＋</button>
                <button type="button" id="btnTrialDefenseMax" aria-label="${maxLabel}" title="${maxLabel}" ${allocated >= available ? "disabled" : ""}>${maxLabel}</button>
            </div>
            <div class="trial-defense-allocation-preview">${previewHtml}</div>
        `;

        const decrease = document.getElementById("btnTrialDefenseDecrease");
        const increase = document.getElementById("btnTrialDefenseIncrease");
        const max = document.getElementById("btnTrialDefenseMax");
        const slider = document.getElementById("trialDefenseAllocationSlider");
        if (decrease) decrease.onclick = () => this.ui.adjustTrialDefenseAllocation(-1);
        if (increase) increase.onclick = () => this.ui.adjustTrialDefenseAllocation(1);
        if (max) max.onclick = () => this.ui.setTrialDefenseAllocation(available);
        if (slider) slider.oninput = event => this.ui.setTrialDefenseAllocation(event?.target?.value);
    }
}
