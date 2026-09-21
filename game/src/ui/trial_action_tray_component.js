import { I18n } from "../i18n.js";
import { resolveModifierTag } from "./trial_interception_preview_component.js";
import { PLAYER_TRAY_MODES } from "./layout_state_manager.js";

export class TrialActionTrayComponent {
    constructor(uiController, { hostId = "trialActionTrayHost" } = {}) {
        this.ui = uiController;
        this.hostId = hostId;
    }

    getHost() {
        if (typeof document === "undefined") return null;
        return document.getElementById(this.hostId);
    }

    isActive() {
        return Boolean(
            this.ui?.trialPreviewConfig
            && this.ui?.trialController?.state
            && this.ui?.layoutStateManager?.getPlayerTrayMode?.() === PLAYER_TRAY_MODES.TRIAL
        );
    }

    render() {
        const root = this.getHost();
        if (!root) return;

        const active = this.isActive();
        root.classList.toggle("is-active", active);
        root.setAttribute("aria-hidden", active ? "false" : "true");
        if (!active) {
            root.innerHTML = "";
            return;
        }

        const available = this.ui.getTrialAvailableDefense();
        const remaining = this.ui.getTrialRemainingDefense();
        const activeRoute = this.ui.getActiveTrialRoute();
        const activeRouteId = activeRoute?.id || null;
        const activeRouteName = activeRoute
            ? I18n.t(activeRoute.nameKey || activeRoute.id)
            : I18n.t("UI_TRIAL_ROUTE_NONE");
        const enemySuppression = Number(activeRoute?.suppression ?? this.ui.trialController?.state?.enemySuppression ?? 0);
        const maxForActive = activeRouteId
            ? this.ui.trialPresentationState.getMaxAllocationForRoute(activeRouteId, available)
            : available;
        const allocated = this.ui.trialPresentationState.previewDefenseAllocation;
        const selectedCell = this.ui.trialPresentationState.selectedInterceptCell;
        const currentDecision = activeRouteId
            ? this.ui.trialPresentationState.getRouteDecision(activeRouteId)
            : { status: "UNDECIDED" };
        const tutorialPolicy = this.ui.getFirstRunTrialTutorialPolicy?.() || { tutorialActive: false };
        const tutorialStep = tutorialPolicy.step || null;

        const planningLocked = Boolean(
            this.ui.trialPresentationState.planningReviewRequested
            || this.ui.isTrialPlanningConfirmed?.()
            || this.ui.isTrialPlanActivated?.()
            || this.ui.isTrialBattleActive?.()
            || this.ui.isTrialBattleResolved?.()
            || this.ui.isTrialCompleted?.()
        );

        let pointHtml = `
            <div class="trial-action-tray-empty">
                <strong>${I18n.t("UI_TRIAL_INTERCEPT_UNSELECTED")}</strong>
                <span>${activeRouteName}</span>
            </div>
        `;

        if (selectedCell) {
            const coord = `${String.fromCharCode(65 + selectedCell.c)}${selectedCell.r + 1}`;
            const cellData = this.ui.getBoardDisplayGrid()?.[selectedCell.r]?.[selectedCell.c];
            const terrainKey = cellData?.terrain?.nameKey || cellData?.terrain?.id || "TERRAIN_PLAINS";
            const terrainName = I18n.t(terrainKey);
            const preview = this.ui.trialPresentationState.interceptionPreview;
            const outcome = preview?.prediction?.outcome;
            const qualitativeOutcomeKey = outcome === "REPEL"
                ? "UI_FIRST_RUN_TRIAL_FAVORABLE"
                : (outcome === "EXACT"
                    ? "UI_FIRST_RUN_TRIAL_BALANCED"
                    : "UI_FIRST_RUN_TRIAL_UNFAVORABLE");
            const outcomeText = tutorialPolicy.qualitativePreviewOnly
                ? (outcome ? I18n.t(qualitativeOutcomeKey) : "—")
                : (outcome ? I18n.t(`UI_TRIAL_OUTCOME_${outcome}`) : "—");
            const marginText = tutorialPolicy.qualitativePreviewOnly
                ? ""
                : (preview?.prediction ? `${I18n.t("UI_TRIAL_MARGIN")}: ${preview.prediction.margin}` : "");
            const modifierTags = (preview?.modifierRows || [])
                .map(resolveModifierTag)
                .filter(Boolean)
                .map(tag => `<span class="trial-action-tag ${tag.polarityClass}">${I18n.t(tag.labelKey)}</span>`)
                .join("");

            pointHtml = `
                <div class="trial-action-point-summary">
                    <div class="trial-action-point-heading">
                        <strong>${coord}</strong>
                        <span>${terrainName}</span>
                    </div>
                    <div class="trial-action-route-line">
                        <span>${I18n.t("UI_TRIAL_SELECTED_ROUTE")}</span>
                        <strong>${activeRouteName}</strong>
                    </div>
                    <div class="trial-action-prediction-line">
                        <span>${I18n.t(tutorialPolicy.qualitativePreviewOnly ? "UI_FIRST_RUN_TRIAL_FORECAST" : "UI_TRIAL_PREDICTION")}</span>
                        <strong>${outcomeText}</strong>
                        <small>${marginText}</small>
                    </div>
                    <div class="trial-action-tags">${modifierTags}</div>
                </div>
            `;
        }

        const canSetIntercept = Boolean(
            activeRouteId
            && selectedCell
            && allocated >= 1
            && !planningLocked
            && tutorialPolicy.allowInterceptionSelection !== false
            && tutorialPolicy.allowDefenseInput !== false
        );
        const canSkip = Boolean(activeRouteId && !planningLocked && tutorialPolicy.allowSkipRoute !== false);
        const canClear = Boolean(activeRouteId && currentDecision.status !== "UNDECIDED" && !planningLocked);
        const disabledSlider = planningLocked || !activeRouteId || tutorialPolicy.allowDefenseInput === false;

        const tutorialMessageKey = tutorialStep === "ROUTE_INTRO"
            ? "UI_FIRST_RUN_TRIAL_ROUTE_INTRO"
            : tutorialStep === "INTERCEPTION_INTRO"
                ? "UI_FIRST_RUN_TRIAL_INTERCEPTION_INTRO"
                : tutorialStep === "TERRAIN_COMPARE"
                    ? "UI_FIRST_RUN_TRIAL_TERRAIN_COMPARE"
                    : tutorialStep === "DEFENSE_ALLOCATION"
                        ? "UI_FIRST_RUN_TRIAL_DEFENSE"
                        : tutorialStep === "FINAL_REVIEW"
                            ? "UI_FIRST_RUN_TRIAL_REVIEW"
                            : null;
        const tutorialMessageHtml = tutorialPolicy.tutorialActive && tutorialMessageKey
            ? '<div class="trial-first-run-tutorial-hint" data-tutorial-step="' + tutorialStep + '">' + I18n.t(tutorialMessageKey) + '</div>'
            : "";

        root.innerHTML = `
            <section class="trial-action-tray" aria-label="${I18n.t("UI_TRIAL_DEFENSE_ALLOCATION")}">
                ${tutorialMessageHtml}
                ${pointHtml}

                <div class="trial-action-control-cluster">
                    <div class="trial-action-budget-line">
                        ${tutorialPolicy.qualitativePreviewOnly ? "" : '<span>' + I18n.t("UI_TRIAL_ENEMY_SUPPRESSION") + ' <strong>' + enemySuppression + '</strong></span>'}
                        <span>${I18n.t("UI_TRIAL_PLAN_DEFENSE_REMAINING", { remaining })}</span>
                    </div>
                    <div class="trial-action-allocation-value">
                        <span>${I18n.t("UI_TRIAL_DEFENSE_ALLOCATION")}</span>
                        <strong>🛡️ ${allocated} / ${maxForActive}</strong>
                    </div>
                    <div class="trial-action-slider-row">
                        <button type="button" data-trial-action="decrease" ${allocated <= 0 || disabledSlider ? "disabled" : ""}>−</button>
                        <input data-trial-action="slider" type="range" min="0" max="${maxForActive}" step="1" value="${allocated}" ${disabledSlider ? "disabled" : ""}>
                        <button type="button" data-trial-action="increase" ${allocated >= maxForActive || disabledSlider ? "disabled" : ""}>＋</button>
                        <button type="button" class="trial-action-max" data-trial-action="max" ${allocated >= maxForActive || disabledSlider ? "disabled" : ""}>${I18n.t("UI_TRIAL_DEFENSE_MAX")}</button>
                    </div>
                    <div class="trial-action-decision-row">
                        <button type="button" class="is-primary" data-trial-action="intercept" ${canSetIntercept ? "" : "disabled"}>${I18n.t("UI_TRIAL_BTN_SET_INTERCEPT")}</button>
                        <button type="button" data-trial-action="skip" ${canSkip ? "" : "disabled"}>${I18n.t("UI_TRIAL_BTN_SKIP")}</button>
                        <button type="button" data-trial-action="clear" ${canClear ? "" : "disabled"}>${I18n.t("UI_TRIAL_BTN_CLEAR")}</button>
                    </div>
                </div>
            </section>
        `;

        const query = action => root.querySelector(`[data-trial-action="${action}"]`);
        const decrease = query("decrease");
        const increase = query("increase");
        const max = query("max");
        const slider = query("slider");
        const intercept = query("intercept");
        const skip = query("skip");
        const clear = query("clear");

        if (decrease) decrease.onclick = () => this.ui.adjustTrialDefenseAllocation(-1);
        if (increase) increase.onclick = () => this.ui.adjustTrialDefenseAllocation(1);
        if (max) max.onclick = () => this.ui.setTrialDefenseAllocation(maxForActive);
        if (slider) slider.oninput = event => this.ui.setTrialDefenseAllocation(event?.target?.value);
        if (intercept) intercept.onclick = () => this.ui.setTrialActiveRouteIntercept();
        if (skip) skip.onclick = () => this.ui.setTrialActiveRouteSkip();
        if (clear) clear.onclick = () => this.ui.clearTrialActiveRouteDecision();
    }
}

export default TrialActionTrayComponent;
