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
        const plannedTotal = this.ui.getTrialPlannedDefenseTotal();
        const remaining = this.ui.getTrialRemainingDefense();

        const routes = this.ui.getTrialPlanningRoutes();
        const activeRoute = this.ui.getActiveTrialRoute();
        const activeRouteId = activeRoute?.id || null;

        const maxForActive = activeRouteId
            ? this.ui.trialPresentationState.getMaxAllocationForRoute(activeRouteId, available)
            : available;
        const allocated = this.ui.trialPresentationState.previewDefenseAllocation;
        const selectedCell = this.ui.trialPresentationState.selectedInterceptCell;
        const currentDecision = activeRouteId
            ? this.ui.trialPresentationState.getRouteDecision(activeRouteId)
            : { status: "UNDECIDED" };

        const previewHtml = TrialInterceptionPreviewComponent.renderHtml(
            this.ui.trialPresentationState.interceptionPreview,
            I18n
        );
        const decreaseLabel = I18n.t("UI_TRIAL_DEFENSE_ALLOCATION_DECREASE");
        const increaseLabel = I18n.t("UI_TRIAL_DEFENSE_ALLOCATION_INCREASE");
        const maxLabel = I18n.t("UI_TRIAL_DEFENSE_MAX");

        const routeListHtml = routes.map(r => {
            const isActive = r.id === activeRouteId;
            const rDecision = this.ui.trialPresentationState.getRouteDecision(r.id);
            const rStatus = rDecision.status || "UNDECIDED";
            let statusText = I18n.t(`UI_TRIAL_STATUS_${rStatus}`);
            if (rStatus === "INTERCEPT") {
                statusText += ` (🛡️ ${rDecision.defenseAllocation})`;
            }
            const commanderMark = r.isCommanderRoute ? `<span class="trial-route-commander">★</span> ` : "";
            const routeName = I18n.t(r.nameKey || r.id);

            return `
                <div class="trial-route-item ${isActive ? "is-active" : ""}" data-route-id="${r.id}">
                    <span class="trial-route-name">${commanderMark}${routeName}</span>
                    <span class="trial-route-status status-${rStatus.toLowerCase()}">${statusText}</span>
                </div>
            `;
        }).join("");

        const budgetUsedText = I18n.t("UI_TRIAL_PLAN_DEFENSE_USED", { used: plannedTotal, total: available });
        const budgetRemainingText = I18n.t("UI_TRIAL_PLAN_DEFENSE_REMAINING", { remaining });

        const canSetIntercept = Boolean(activeRouteId && selectedCell && allocated >= 1);
        const canSkip = Boolean(activeRouteId);
        const canClear = Boolean(activeRouteId && currentDecision.status !== "UNDECIDED");

        root.innerHTML = `
            <div class="trial-defense-allocation-heading">${I18n.t("UI_TRIAL_DEFENSE_ALLOCATION")}</div>

            <div class="trial-budget-bar">
                <span class="trial-budget-used">${budgetUsedText}</span>
                <span class="trial-budget-remaining">${budgetRemainingText}</span>
            </div>

            <div class="trial-route-list-header">${I18n.t("UI_TRIAL_ROUTE_LIST")}</div>
            <div class="trial-route-list">${routeListHtml}</div>

            <div class="trial-defense-allocation-status">
                <strong>🛡️ ${allocated} / ${maxForActive}</strong>
                <span>${I18n.t("UI_TRIAL_AVAILABLE_DEFENSE")}</span>
            </div>
            <div class="trial-defense-allocation-controls">
                <button type="button" id="btnTrialDefenseDecrease" aria-label="${decreaseLabel}" title="${decreaseLabel}" ${allocated <= 0 ? "disabled" : ""}>−</button>
                <input id="trialDefenseAllocationSlider" type="range" min="0" max="${maxForActive}" step="1" value="${allocated}" aria-label="${I18n.t("UI_TRIAL_DEFENSE_ALLOCATION")}">
                <button type="button" id="btnTrialDefenseIncrease" aria-label="${increaseLabel}" title="${increaseLabel}" ${allocated >= maxForActive ? "disabled" : ""}>＋</button>
                <button type="button" id="btnTrialDefenseMax" aria-label="${maxLabel}" title="${maxLabel}" ${allocated >= maxForActive ? "disabled" : ""}>${maxLabel}</button>
            </div>

            <div class="trial-route-decision-actions">
                <button type="button" id="btnTrialSetIntercept" class="btn-trial-action btn-intercept" ${canSetIntercept ? "" : "disabled"}>
                    ${I18n.t("UI_TRIAL_BTN_SET_INTERCEPT")}
                </button>
                <button type="button" id="btnTrialSetSkip" class="btn-trial-action btn-skip" ${canSkip ? "" : "disabled"}>
                    ${I18n.t("UI_TRIAL_BTN_SKIP")}
                </button>
                <button type="button" id="btnTrialClearDecision" class="btn-trial-action btn-clear" ${canClear ? "" : "disabled"}>
                    ${I18n.t("UI_TRIAL_BTN_CLEAR")}
                </button>
            </div>

            <div class="trial-defense-allocation-preview">${previewHtml}</div>
        `;

        const routeItems = root.querySelectorAll(".trial-route-item");
        routeItems.forEach(item => {
            item.onclick = () => {
                const rId = item.getAttribute("data-route-id");
                if (rId) this.ui.selectTrialRoute(rId);
            };
        });

        const decrease = document.getElementById("btnTrialDefenseDecrease");
        const increase = document.getElementById("btnTrialDefenseIncrease");
        const max = document.getElementById("btnTrialDefenseMax");
        const slider = document.getElementById("trialDefenseAllocationSlider");
        if (decrease) decrease.onclick = () => this.ui.adjustTrialDefenseAllocation(-1);
        if (increase) increase.onclick = () => this.ui.adjustTrialDefenseAllocation(1);
        if (max) max.onclick = () => this.ui.setTrialDefenseAllocation(maxForActive);
        if (slider) slider.oninput = event => this.ui.setTrialDefenseAllocation(event?.target?.value);

        const btnIntercept = document.getElementById("btnTrialSetIntercept");
        const btnSkip = document.getElementById("btnTrialSetSkip");
        const btnClear = document.getElementById("btnTrialClearDecision");
        if (btnIntercept) btnIntercept.onclick = () => this.ui.setTrialActiveRouteIntercept();
        if (btnSkip) btnSkip.onclick = () => this.ui.setTrialActiveRouteSkip();
        if (btnClear) btnClear.onclick = () => this.ui.clearTrialActiveRouteDecision();
    }
}
