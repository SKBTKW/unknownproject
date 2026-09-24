import { I18n } from "../i18n.js";
import { resolveModifierTag } from "./trial_interception_preview_component.js";
import { MODIFIER_TARGETS, TRIAL_BATTLE_STATUSES } from "../trial/domain/trial_types.js";
import { PLAYER_TRAY_MODES } from "./layout_state_manager.js";

export class TrialActionTrayComponent {
    constructor(uiController, { hostId = "trialActionTrayHost" } = {}) {
        this.ui = uiController;
        this.hostId = hostId;
    }

    getHost() {
        if (typeof document === "undefined") return null;
        let host = document.getElementById(this.hostId);
        if (host) return host;

        host = document.createElement("div");
        host.id = this.hostId;
        host.setAttribute("aria-hidden", "true");
        const owner = document.getElementById("layerPlayerTray") || document.body;
        owner?.appendChild?.(host);
        return host;
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
        const plannedTotal = this.ui.getTrialPlannedDefenseTotal();
        const routes = this.ui.getTrialPlanningRoutes();
        const budgetUsedText = I18n.t("UI_TRIAL_PLAN_DEFENSE_USED", { used: plannedTotal, total: available });
        const budgetRemainingText = I18n.t("UI_TRIAL_PLAN_DEFENSE_REMAINING", { remaining });
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
            const outcomeText = outcome ? I18n.t(qualitativeOutcomeKey) : "—";
            // The Player Tray communicates battle outlook qualitatively. Exact
            // deterministic arithmetic stays out of the primary decision surface.
            const marginText = "";
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
        const isBattleResolved = Boolean(this.ui.isTrialBattleResolved?.());
        const isCompleted = Boolean(this.ui.isTrialCompleted?.());
        const reviewRequested = this.ui.trialPresentationState.planningReviewRequested;
        const isReviewMode = reviewRequested || isConfirmed || isActivated || isBattleActive || isBattleResolved || isCompleted;
        const deploymentPreview = isReviewMode
            ? (this.ui.getTrialPlanningDeploymentPreview?.() || null)
            : null;
        const deploymentApplicable = deploymentPreview?.applicable === true;
        const deploymentResolved = deploymentApplicable
            && deploymentPreview?.success === true
            && Number.isFinite(Number(deploymentPreview.foodCost))
            && Number.isFinite(Number(deploymentPreview.materialCost));
        const deploymentBlocksConfirm = deploymentApplicable
            && (
                !deploymentResolved
                || deploymentPreview.affordable !== true
            );

        if (isReviewMode) {
            const currentBattleSnapshot = (isBattleActive || isBattleResolved) ? this.ui.getCurrentTrialBattle?.() : null;
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

            let deploymentCostHtml = "";
            if (
                deploymentApplicable
                && !isActivated
                && !isBattleActive
                && !isBattleResolved
                && !isCompleted
            ) {
                if (deploymentResolved) {
                    const costText = I18n.t("UI_TRIAL_DEPLOYMENT_COST_RESOURCES", {
                        food: Math.max(0, Math.floor(Number(deploymentPreview.foodCost) || 0)),
                        material: Math.max(0, Math.floor(Number(deploymentPreview.materialCost) || 0))
                    });
                    const statusText = deploymentPreview.affordable === true
                        ? I18n.t("UI_TRIAL_DEPLOYMENT_COST_COMMIT_NOTE")
                        : I18n.t("UI_TRIAL_DEPLOYMENT_INSUFFICIENT_RESOURCES");
                    deploymentCostHtml = `
                        <div class="trial-deployment-cost-box ${deploymentPreview.affordable === true ? "" : "is-unaffordable"}"
                             id="trialDeploymentCostPreview">
                            <strong>${I18n.t("UI_TRIAL_DEPLOYMENT_COST_TITLE")}</strong>
                            <span class="trial-deployment-cost-resources">${costText}</span>
                            <small>${statusText}</small>
                        </div>
                    `;
                } else {
                    deploymentCostHtml = `
                        <div class="trial-deployment-cost-box is-unaffordable"
                             id="trialDeploymentCostPreview">
                            <strong>${I18n.t("UI_TRIAL_DEPLOYMENT_COST_TITLE")}</strong>
                            <small>${I18n.t("UI_TRIAL_DEPLOYMENT_COST_UNAVAILABLE")}</small>
                        </div>
                    `;
                }
            }

            let reviewActionsHtml = "";
            if (isCompleted) {
                const completionResult = this.ui.getTrialResult?.();
                const isSurvived = completionResult?.outcome === "SURVIVED";
                const outcomeBannerText = isSurvived
                    ? `🏆 ${I18n.t("UI_TRIAL_COMPLETED_SURVIVED")}`
                    : `💀 ${I18n.t("UI_TRIAL_COMPLETED_FAILED")}`;
                const bannerClass = isSurvived ? "trial-completed-survived" : "trial-completed-failed";
                const remainingEmberText = I18n.t("UI_TRIAL_REMAINING_EMBER", { amount: completionResult?.emberRemaining ?? 0 });
                const battlesText = I18n.t("UI_TRIAL_RESULT_BATTLES", {
                    resolved: completionResult?.resolvedBattleCount ?? 0,
                    total: completionResult?.battleCount ?? 0
                });
                const damageText = I18n.t("UI_TRIAL_RESULT_DAMAGE", { damage: completionResult?.totalEmberDamage ?? 0 });

                reviewActionsHtml = `
                    <div class="trial-completed-banner ${bannerClass}" id="trialCompletedBanner">
                        <div class="trial-completed-status">${outcomeBannerText}</div>
                        <div class="trial-completed-details">
                            <div class="trial-completed-ember">${remainingEmberText}</div>
                            <div class="trial-completed-stats">
                                <span>${battlesText}</span>
                                <span>${damageText}</span>
                            </div>
                        </div>
                    </div>
                `;
            } else if (!isConfirmed && !isActivated && !isBattleActive && !isBattleResolved) {
                reviewActionsHtml = `
                    <div class="trial-plan-review-requested-banner" id="trialPlanReviewRequestedBanner">
                        <span class="trial-plan-review-status">${I18n.t("UI_TRIAL_PLAN_REVIEW_REQUESTED")}</span>
                        <button type="button" id="btnTrialModifyPlan" class="btn-trial-action btn-modify-plan">
                            ${I18n.t("UI_TRIAL_PLAN_MODIFY")}
                        </button>
                    </div>
                    <div class="trial-review-actions">
                        <button type="button" id="btnTrialConfirmPlan" class="btn-trial-action btn-confirm-plan"
                            ${deploymentBlocksConfirm ? 'disabled aria-disabled="true"' : ""}>
                            ${I18n.t("UI_TRIAL_REVIEW_CONFIRM")}
                        </button>
                    </div>
                `;
            } else if (!isActivated && !isBattleActive && !isBattleResolved) {
                reviewActionsHtml = `
                    <div class="trial-plan-confirmed-banner" id="trialPlanConfirmedBanner">
                        <div class="trial-plan-confirmed-status">${I18n.t("UI_TRIAL_PLAN_CONFIRMED")}</div>
                        <button type="button" id="btnTrialActivatePlan" class="btn-trial-action btn-activate-plan"
                            ${deploymentBlocksConfirm ? 'disabled aria-disabled="true"' : ""}>
                            ${I18n.t("UI_TRIAL_ACTIVATE_PLAN")}
                        </button>
                    </div>
                `;
            } else if (!isBattleActive && !isBattleResolved) {
                const pendingBattlesCount = this.ui.getTrialBattleQueue()?.filter(b => b.status === TRIAL_BATTLE_STATUSES.PENDING).length ?? 0;
                let startBattleButtonHtml = "";
                let completeTrialButtonHtml = "";
                if (pendingBattlesCount > 0) {
                    startBattleButtonHtml = `
                        <button type="button" id="btnTrialStartBattle" class="btn-trial-action btn-start-battle">
                            ${I18n.t("UI_TRIAL_START_BATTLE")}
                        </button>
                    `;
                } else if (this.ui.canCompleteTrial?.()) {
                    completeTrialButtonHtml = `
                        <button type="button" id="btnTrialCompleteTrial" class="btn-trial-action btn-complete-trial">
                            ${I18n.t("UI_TRIAL_COMPLETE_TRIAL")}
                        </button>
                    `;
                }
                reviewActionsHtml = `
                    <div class="trial-plan-activated-banner" id="trialPlanActivatedBanner">
                        <div class="trial-plan-activated-status">${I18n.t("UI_TRIAL_PLAN_ACTIVATED")}</div>
                        <div class="trial-plan-battles-pending">${pendingBattlesCount > 0 ? I18n.t("UI_TRIAL_BATTLES_PENDING", { count: pendingBattlesCount }) : I18n.t("UI_TRIAL_NO_PENDING_BATTLES")}</div>
                        ${startBattleButtonHtml}
                        ${completeTrialButtonHtml}
                    </div>
                `;
            } else if (!isBattleResolved) {
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
                        <button type="button" id="btnTrialResolveBattle" class="btn-trial-action btn-resolve-battle">
                            ${I18n.t("UI_TRIAL_RESOLVE_BATTLE")}
                        </button>
                    </div>
                `;
            } else {
                const currentBattle = currentBattleSnapshot;
                const battleResult = this.ui.getCurrentTrialBattleResult?.();
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
                        </div>
                    `;
                }

                let outcomeText = "";
                let powerComparisonHtml = "";
                let tagsHtml = "";
                if (battleResult) {
                    const outcome = battleResult.prediction?.outcome;
                    const outcomeKey = outcome ? `UI_TRIAL_OUTCOME_${outcome}` : "UI_TRIAL_BATTLE_RESOLVED";
                    outcomeText = I18n.t(outcomeKey);

                    powerComparisonHtml = `
                        <div class="trial-battle-power-comparison">
                            <div class="trial-power-row trial-player-power">
                                <span>${I18n.t("UI_TRIAL_PLAYER_POWER")}</span>
                                <strong>⚔️ ${battleResult.human.basePower} → ${battleResult.human.finalPower}</strong>
                            </div>
                            <div class="trial-power-row trial-enemy-power">
                                <span>${I18n.t("UI_TRIAL_ENEMY_POWER")}</span>
                                <strong>⚔️ ${battleResult.enemy.basePower} → ${battleResult.enemy.finalPower}</strong>
                            </div>
                        </div>
                    `;

                    if (Array.isArray(battleResult.appliedModifiers)) {
                        const tags = battleResult.appliedModifiers.map(resolveModifierTag).filter(Boolean);
                        if (tags.length > 0) {
                            const tagsSpans = tags.map(t =>
                                `<span class="trial-modifier-tag ${t.polarityClass}">${I18n.t(t.labelKey)}</span>`
                            ).join("");
                            tagsHtml = `<div class="trial-battle-tags">${tagsSpans}</div>`;
                        }
                    }
                }

                const tutorialPolicy = this.ui.getFirstRunTrialTutorialPolicy?.() || { tutorialActive: false };
                const showTutorialCausality = tutorialPolicy.tutorialActive
                    && tutorialPolicy.step === "RESULT_CAUSALITY";
                let tutorialCausalityHtml = "";
                if (showTutorialCausality) {
                    const causality = this.ui.getCurrentTrialCausality?.() || { available: false, modifiers: [] };
                    const facts = (causality.modifiers || []).map(row => {
                        const tag = resolveModifierTag(row);
                        const effect = tag?.labelKey ? I18n.t(tag.labelKey) : (row.source || "—");
                        const key = row.target === MODIFIER_TARGETS.ENEMY_SUPPRESSION && row.after < row.before
                            ? "UI_FIRST_RUN_TRIAL_CAUSALITY_ENEMY_DOWN"
                            : (row.target === MODIFIER_TARGETS.HUMAN_INTERCEPTION && row.after > row.before
                                ? "UI_FIRST_RUN_TRIAL_CAUSALITY_HUMAN_UP"
                                : "UI_FIRST_RUN_TRIAL_CAUSALITY_NEUTRAL");
                        return `<li>${I18n.t(key, { effect })}</li>`;
                    });
                    if (facts.length === 0) {
                        facts.push(`<li>${I18n.t("UI_FIRST_RUN_TRIAL_CAUSALITY_NO_MODIFIER")}</li>`);
                    }
                    tutorialCausalityHtml = `
                        <div class="trial-first-run-causality" id="trialFirstRunCausality">
                            <strong>${I18n.t("UI_FIRST_RUN_TRIAL_CAUSALITY_TITLE")}</strong>
                            <ul>${facts.join("")}</ul>
                            <button type="button" id="btnFirstRunTrialCausalityConfirm" class="btn-trial-action">
                                ${I18n.t("UI_FIRST_RUN_TRIAL_CAUSALITY_CONFIRM")}
                            </button>
                        </div>
                    `;
                }

                const isTraversalApplied = Boolean(this.ui.isTrialTraversalApplied?.());
                let traversalControlsHtml = "";
                if (!isTraversalApplied) {
                    traversalControlsHtml = showTutorialCausality
                        ? ""
                        : `
                            <button type="button" id="btnTrialAdvanceEnemy" class="btn-trial-action btn-advance-enemy">
                                ${I18n.t("UI_TRIAL_ADVANCE_ENEMY")}
                            </button>
                        `;
                } else {
                    const traversalResult = this.ui.getCurrentTrialTraversalResult?.();
                    let statusBadgeHtml = "";
                    if (traversalResult) {
                        let statusText = "";
                        let statusClass = "";
                        if (traversalResult.stopped) {
                            statusText = `🛡️ ${I18n.t("UI_TRIAL_TRAVERSAL_STOPPED")}`;
                            statusClass = "status-stopped";
                        } else if (traversalResult.reachedRouteEnd) {
                            statusText = `⚠️ ${I18n.t("UI_TRIAL_TRAVERSAL_REACHED_END")}`;
                            statusClass = "status-reached-end";
                        } else if (traversalResult.advanced) {
                            statusText = `👣 ${I18n.t("UI_TRIAL_TRAVERSAL_ADVANCED")}`;
                            statusClass = "status-advanced";
                        }
                        if (statusText) {
                            statusBadgeHtml = `<div class="trial-traversal-status ${statusClass}">${statusText}</div>`;
                        }
                    }

                    const damageResult = this.ui.getCurrentTrialDamageResult?.();
                    let damageBadgeHtml = "";
                    if (damageResult && damageResult.reachedRouteEnd) {
                        damageBadgeHtml = `
                            <div class="trial-hq-damage-badge" id="trialHqDamageBadge">
                                ${I18n.t("UI_TRIAL_HQ_DAMAGE", { amount: damageResult.emberDamage, remaining: damageResult.emberAfter })}
                            </div>
                        `;
                    }

                    let nextBattleButtonHtml = "";
                    if (!currentBattle?.sequenceAdvanced) {
                        nextBattleButtonHtml = `
                            <button type="button" id="btnTrialNextBattle" class="btn-trial-action btn-next-battle">
                                ${I18n.t("UI_TRIAL_NEXT_BATTLE")}
                            </button>
                        `;
                    }

                    traversalControlsHtml = `
                        ${statusBadgeHtml}
                        ${damageBadgeHtml}
                        ${nextBattleButtonHtml}
                    `;
                }

                reviewActionsHtml = `
                    <div class="trial-battle-resolved-banner" id="trialBattleResolvedBanner">
                        <div class="trial-battle-resolved-status">🏁 ${outcomeText}</div>
                        ${battleDetailsHtml}
                        ${powerComparisonHtml}
                        ${tagsHtml}
                        ${tutorialCausalityHtml}
                        ${traversalControlsHtml}
                    </div>
                `;
            }

            root.innerHTML = `
                <section class="trial-action-tray trial-action-tray-progress" aria-label="${I18n.t("UI_TRIAL_REVIEW_TITLE")}">
                    <div class="trial-action-progress">
                <div class="trial-defense-allocation-heading">${I18n.t("UI_TRIAL_REVIEW_TITLE")}</div>

                <div class="trial-budget-bar">
                    <span class="trial-budget-used">${budgetUsedText}</span>
                    <span class="trial-budget-remaining">${budgetRemainingText}</span>
                </div>

                <div class="trial-route-list-header">${I18n.t("UI_TRIAL_ROUTE_LIST")}</div>
                <div class="trial-review-route-list" id="trialReviewRouteList">${reviewRoutesHtml}</div>

                ${deploymentCostHtml}
                ${errorsHtml}
                ${reviewActionsHtml}
                    </div>
                </section>
            `;

            const btnModify = document.getElementById("btnTrialModifyPlan");
            if (btnModify) btnModify.onclick = () => this.ui.clearTrialPlanningReviewRequest();

            const btnConfirm = document.getElementById("btnTrialConfirmPlan");
            if (btnConfirm) btnConfirm.onclick = () => this.ui.confirmTrialPlanning();

            const btnActivate = document.getElementById("btnTrialActivatePlan");
            if (btnActivate) btnActivate.onclick = () => this.ui.activateTrialPlan();

            const btnStartBattle = document.getElementById("btnTrialStartBattle");
            if (btnStartBattle) btnStartBattle.onclick = () => this.ui.startTrialBattle();

            const btnResolveBattle = document.getElementById("btnTrialResolveBattle");
            if (btnResolveBattle) btnResolveBattle.onclick = () => this.ui.resolveCurrentTrialBattle();

            const btnCausalityConfirm = document.getElementById("btnFirstRunTrialCausalityConfirm");
            if (btnCausalityConfirm) {
                btnCausalityConfirm.onclick = () => {
                    this.ui.acknowledgeFirstRunTrialCausality?.();
                    this.render();
                };
            }

            const btnAdvanceEnemy = document.getElementById("btnTrialAdvanceEnemy");
            if (btnAdvanceEnemy) btnAdvanceEnemy.onclick = () => this.ui.advanceCurrentTrialBattle();

            const btnNextBattle = document.getElementById("btnTrialNextBattle");
            if (btnNextBattle) btnNextBattle.onclick = () => this.ui.transitionTrialAfterCurrentBattle();

            const btnCompleteTrial = document.getElementById("btnTrialCompleteTrial");
            if (btnCompleteTrial) btnCompleteTrial.onclick = () => this.ui.completeTrial();

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
                        <button type="button" id="btnTrialDefenseDecrease" data-trial-action="decrease" ${allocated <= 0 || disabledSlider ? "disabled" : ""}>−</button>
                        <input id="trialDefenseAllocationSlider" data-trial-action="slider" type="range" min="0" max="${maxForActive}" step="1" value="${allocated}" ${disabledSlider ? "disabled" : ""}>
                        <button type="button" id="btnTrialDefenseIncrease" data-trial-action="increase" ${allocated >= maxForActive || disabledSlider ? "disabled" : ""}>＋</button>
                        <button type="button" id="btnTrialDefenseMax" class="trial-action-max" data-trial-action="max" ${allocated >= maxForActive || disabledSlider ? "disabled" : ""}>${I18n.t("UI_TRIAL_DEFENSE_MAX")}</button>
                    </div>
                    <div class="trial-action-decision-row">
                        <button type="button" id="btnTrialSetIntercept" class="is-primary" data-trial-action="intercept" ${canSetIntercept ? "" : "disabled"}>${I18n.t("UI_TRIAL_BTN_SET_INTERCEPT")}</button>
                        <button type="button" id="btnTrialSetSkip" data-trial-action="skip" ${canSkip ? "" : "disabled"}>${I18n.t("UI_TRIAL_BTN_SKIP")}</button>
                        <button type="button" id="btnTrialClearDecision" data-trial-action="clear" ${canClear ? "" : "disabled"}>${I18n.t("UI_TRIAL_BTN_CLEAR")}</button>
                    </div>
                </div>
                ${errorsHtml}
                ${finishControlsHtml}
                ${warningHtml}
            </section>
        `;

        const query = (action, id) =>
            root.querySelector?.(`[data-trial-action="${action}"]`)
            || document.getElementById(id);
        const decrease = query("decrease", "btnTrialDefenseDecrease");
        const increase = query("increase", "btnTrialDefenseIncrease");
        const max = query("max", "btnTrialDefenseMax");
        const slider = query("slider", "trialDefenseAllocationSlider");
        const intercept = query("intercept", "btnTrialSetIntercept");
        const skip = query("skip", "btnTrialSetSkip");
        const clear = query("clear", "btnTrialClearDecision");

        if (decrease) decrease.onclick = () => this.ui.adjustTrialDefenseAllocation(-1);
        if (increase) increase.onclick = () => this.ui.adjustTrialDefenseAllocation(1);
        if (max) max.onclick = () => this.ui.setTrialDefenseAllocation(maxForActive);
        if (slider) slider.oninput = event => this.ui.setTrialDefenseAllocation(event?.target?.value);
        if (intercept) intercept.onclick = () => this.ui.setTrialActiveRouteIntercept();
        if (skip) skip.onclick = () => this.ui.setTrialActiveRouteSkip();
        if (clear) clear.onclick = () => this.ui.clearTrialActiveRouteDecision();

        const btnFinish = document.getElementById("btnTrialFinishPlanning");
        if (btnFinish) btnFinish.onclick = () => this.ui.finishTrialPlanning();

        const btnWarningBack = document.getElementById("btnTrialWarningBack");
        if (btnWarningBack) btnWarningBack.onclick = () => this.ui.dismissTrialPlanningWarning();

        const btnWarningContinue = document.getElementById("btnTrialWarningContinue");
        if (btnWarningContinue) btnWarningContinue.onclick = () => this.ui.acceptTrialPlanningWarningAndProceed();
    }
}

export default TrialActionTrayComponent;
