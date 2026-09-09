import { I18n } from "../i18n.js";
import { UILayoutConfig } from "./layout_config.js";
import { TrialInterceptionPreviewComponent, resolveModifierTag } from "./trial_interception_preview_component.js";

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

        const errors = this.ui.trialPresentationState.planningValidationErrors || [];
        let errorsHtml = "";
        if (errors.length > 0) {
            const errorItems = errors.map(err => `<li>${I18n.t(err)}</li>`).join("");
            errorsHtml = `
                <div class="trial-plan-errors-box" id="trialPlanErrorsBox">
                    <div class="trial-plan-errors-title">${I18n.t("UI_TRIAL_PLAN_ERRORS_EXIST")}</div>
                    <ul class="trial-plan-errors-list">${errorItems}</ul>
                </div>
            `;
        }

        const isConfirmed = Boolean(this.ui.isTrialPlanningConfirmed());
        const isActivated = Boolean(this.ui.isTrialPlanActivated());
        const isBattleActive = Boolean(this.ui.isTrialBattleActive?.());
        const reviewRequested = this.ui.trialPresentationState.planningReviewRequested;
        const isReviewMode = reviewRequested || isConfirmed || isActivated || isBattleActive;

        if (isReviewMode) {
            const currentBattleSnapshot = isBattleActive ? this.ui.getCurrentTrialBattle?.() : null;
            const reviewRoutesHtml = routes.map(r => {
                const rDecision = this.ui.trialPresentationState.getRouteDecision(r.id);
                const rStatus = rDecision.status || "UNDECIDED";
                const commanderMark = r.isCommanderRoute ? `<span class="trial-route-commander">★</span> ` : "";
                const routeName = I18n.t(r.nameKey || r.id);
                const isRouteActiveInBattle = Boolean(currentBattleSnapshot && currentBattleSnapshot.routeId === r.id);

                let detailsHtml = "";
                if (rStatus === "INTERCEPT" && rDecision.interceptCell) {
                    const cell = rDecision.interceptCell;
                    const coordStr = `${String.fromCharCode(65 + cell.c)}${cell.r + 1}`;
                    const cellData = this.ui.getBoardDisplayGrid()?.[cell.r]?.[cell.c];
                    const terrainNameKey = cellData?.terrain?.nameKey || cellData?.terrain?.id || "TERRAIN_PLAINS";
                    const terrainName = I18n.t(terrainNameKey);
                    detailsHtml = `
                        <span class="trial-review-location">[${coordStr}] ${terrainName}</span>
                        <span class="trial-review-defense">🛡️ ${rDecision.defenseAllocation}</span>
                    `;
                } else if (rStatus === "SKIP") {
                    detailsHtml = `<span class="trial-review-status status-skip">${I18n.t("UI_TRIAL_REVIEW_SKIP")}</span>`;
                } else {
                    detailsHtml = `<span class="trial-review-status status-undecided">${I18n.t("UI_TRIAL_REVIEW_UNDECIDED")}</span>`;
                }

                return `
                    <div class="trial-review-route-item ${isRouteActiveInBattle ? "is-battle-active" : ""}" data-route-id="${r.id}">
                        <span class="trial-route-name">${commanderMark}${routeName}</span>
                        <div class="trial-review-route-details">${detailsHtml}</div>
                    </div>
                `;
            }).join("");

            let reviewActionsHtml = "";
            if (!isConfirmed && !isActivated && !isBattleActive) {
                reviewActionsHtml = `
                    <div class="trial-plan-review-requested-banner" id="trialPlanReviewRequestedBanner">
                        <span class="trial-plan-review-status">${I18n.t("UI_TRIAL_PLAN_REVIEW_REQUESTED")}</span>
                        <button type="button" id="btnTrialModifyPlan" class="btn-trial-action btn-modify-plan">
                            ${I18n.t("UI_TRIAL_PLAN_MODIFY")}
                        </button>
                    </div>
                    <div class="trial-review-actions">
                        <button type="button" id="btnTrialConfirmPlan" class="btn-trial-action btn-confirm-plan">
                            ${I18n.t("UI_TRIAL_REVIEW_CONFIRM")}
                        </button>
                    </div>
                `;
            } else if (!isActivated && !isBattleActive) {
                reviewActionsHtml = `
                    <div class="trial-plan-confirmed-banner" id="trialPlanConfirmedBanner">
                        <div class="trial-plan-confirmed-status">${I18n.t("UI_TRIAL_PLAN_CONFIRMED")}</div>
                        <button type="button" id="btnTrialActivatePlan" class="btn-trial-action btn-activate-plan">
                            ${I18n.t("UI_TRIAL_ACTIVATE_PLAN")}
                        </button>
                    </div>
                `;
            } else if (!isBattleActive) {
                const pendingBattlesCount = this.ui.getTrialBattleQueue()?.length ?? 0;
                let startBattleButtonHtml = "";
                if (pendingBattlesCount > 0) {
                    startBattleButtonHtml = `
                        <button type="button" id="btnTrialStartBattle" class="btn-trial-action btn-start-battle">
                            ${I18n.t("UI_TRIAL_START_BATTLE")}
                        </button>
                    `;
                }
                reviewActionsHtml = `
                    <div class="trial-plan-activated-banner" id="trialPlanActivatedBanner">
                        <div class="trial-plan-activated-status">${I18n.t("UI_TRIAL_PLAN_ACTIVATED")}</div>
                        <div class="trial-plan-battles-pending">${pendingBattlesCount > 0 ? I18n.t("UI_TRIAL_BATTLES_PENDING", { count: pendingBattlesCount }) : I18n.t("UI_TRIAL_NO_PENDING_BATTLES")}</div>
                        ${startBattleButtonHtml}
                    </div>
                `;
            } else {
                const currentBattle = currentBattleSnapshot;
                let battleDetailsHtml = "";
                if (currentBattle) {
                    const targetRoute = routes.find(r => r.id === currentBattle.routeId);
                    const routeName = targetRoute ? I18n.t(targetRoute.nameKey || targetRoute.id) : currentBattle.routeId;
                    const cell = currentBattle.interceptCell;
                    const coordStr = `${String.fromCharCode(65 + cell.c)}${cell.r + 1}`;
                    battleDetailsHtml = `
                        <div class="trial-battle-active-route">${routeName}</div>
                        <div class="trial-battle-active-details">
                            <span class="trial-battle-active-cell">[${coordStr}]</span>
                            <span class="trial-battle-active-defense">🛡️ ${currentBattle.defenseAllocation}</span>
                        </div>
                    `;
                }
                reviewActionsHtml = `
                    <div class="trial-battle-active-banner" id="trialBattleActiveBanner">
                        <div class="trial-battle-active-status">⚔️ ${I18n.t("UI_TRIAL_BATTLE_ACTIVE")}</div>
                        ${battleDetailsHtml}
                    </div>
                `;
            }

            root.innerHTML = `
                <div class="trial-defense-allocation-heading">${I18n.t("UI_TRIAL_REVIEW_TITLE")}</div>

                <div class="trial-budget-bar">
                    <span class="trial-budget-used">${budgetUsedText}</span>
                    <span class="trial-budget-remaining">${budgetRemainingText}</span>
                </div>

                <div class="trial-route-list-header">${I18n.t("UI_TRIAL_ROUTE_LIST")}</div>
                <div class="trial-review-route-list" id="trialReviewRouteList">${reviewRoutesHtml}</div>

                ${errorsHtml}
                ${reviewActionsHtml}
            `;

            const btnModify = document.getElementById("btnTrialModifyPlan");
            if (btnModify) btnModify.onclick = () => this.ui.clearTrialPlanningReviewRequest();

            const btnConfirm = document.getElementById("btnTrialConfirmPlan");
            if (btnConfirm) btnConfirm.onclick = () => this.ui.confirmTrialPlanning();

            const btnActivate = document.getElementById("btnTrialActivatePlan");
            if (btnActivate) btnActivate.onclick = () => this.ui.activateTrialPlan();

            const btnStartBattle = document.getElementById("btnTrialStartBattle");
            if (btnStartBattle) btnStartBattle.onclick = () => this.ui.startTrialBattle();

            return;
        }

        const finishControlsHtml = `
            <div class="trial-plan-finish-controls">
                <button type="button" id="btnTrialFinishPlanning" class="btn-trial-action btn-finish-planning">
                    ${I18n.t("UI_TRIAL_PLAN_FINISH")}
                </button>
            </div>
        `;

        const warningOpen = this.ui.trialPresentationState.planningCompletionWarningOpen;
        const warningInfo = this.ui.trialPresentationState.planningWarningInfo;
        let warningHtml = "";
        if (warningOpen) {
            const undecidedCount = warningInfo?.count ?? 0;
            warningHtml = `
                <div class="trial-plan-warning-overlay" id="trialPlanWarningModal">
                    <div class="trial-plan-warning-dialog">
                        <div class="trial-plan-warning-title">${I18n.t("UI_TRIAL_PLAN_UNDECIDED_WARNING_TITLE")}</div>
                        <div class="trial-plan-warning-body">${I18n.t("UI_TRIAL_PLAN_UNDECIDED_WARNING")}</div>
                        <div class="trial-plan-warning-count">${I18n.t("UI_TRIAL_PLAN_UNDECIDED_COUNT", { count: undecidedCount })}</div>
                        <div class="trial-plan-warning-actions">
                            <button type="button" id="btnTrialWarningBack" class="btn-trial-action btn-warning-back">
                                ${I18n.t("UI_TRIAL_PLAN_WARNING_BACK")}
                            </button>
                            <button type="button" id="btnTrialWarningContinue" class="btn-trial-action btn-warning-continue">
                                ${I18n.t("UI_TRIAL_PLAN_WARNING_CONTINUE")}
                            </button>
                        </div>
                    </div>
                </div>
            `;
        }

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

            ${errorsHtml}
            ${finishControlsHtml}
            ${warningHtml}
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

        const btnFinish = document.getElementById("btnTrialFinishPlanning");
        if (btnFinish) btnFinish.onclick = () => this.ui.finishTrialPlanning();

        const btnWarningBack = document.getElementById("btnTrialWarningBack");
        if (btnWarningBack) btnWarningBack.onclick = () => this.ui.dismissTrialPlanningWarning();

        const btnWarningContinue = document.getElementById("btnTrialWarningContinue");
        if (btnWarningContinue) btnWarningContinue.onclick = () => this.ui.acceptTrialPlanningWarningAndProceed();

        const btnModify = document.getElementById("btnTrialModifyPlan");
        if (btnModify) btnModify.onclick = () => this.ui.clearTrialPlanningReviewRequest();
    }
}
