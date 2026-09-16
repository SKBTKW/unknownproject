import {
    TRIAL_PHASES,
    TRIAL_PLAN_REASONS,
    TRIAL_ROUTE_PLAN_STATUSES,
    TRIAL_BATTLE_STATUSES,
    TRIAL_COMPLETION_OUTCOMES
} from "../domain/trial_types.js";

export class TrialCompletionService {
    validateCompletion(state) {
        if (!state) {
            return { success: false, reason: TRIAL_PLAN_REASONS.TRIAL_NOT_STARTED };
        }
        if (state.trialCompleted || state.phase === TRIAL_PHASES.RESULT) {
            return { success: false, reason: TRIAL_PLAN_REASONS.TRIAL_ALREADY_COMPLETED };
        }
        if (!state.planActivated || !state.interceptionPlan) {
            return { success: false, reason: TRIAL_PLAN_REASONS.PLAN_NOT_ACTIVATED };
        }
        if (state.currentBattleIndex !== null) {
            return { success: false, reason: TRIAL_PLAN_REASONS.INCOMPLETE_BATTLES };
        }

        const planRoutes = Array.isArray(state.interceptionPlan.routes)
            ? state.interceptionPlan.routes
            : [];
        const interceptRoutes = planRoutes.filter(r => r?.status === TRIAL_ROUTE_PLAN_STATUSES.INTERCEPT);
        const skippedRoutes = planRoutes.filter(r => r?.status === TRIAL_ROUTE_PLAN_STATUSES.SKIP);

        for (const skippedRoute of skippedRoutes) {
            const traversal = state.skippedRouteResults?.[skippedRoute.routeId] || null;
            if (!traversal?.reachedRouteEnd) {
                return { success: false, reason: TRIAL_PLAN_REASONS.UNRESOLVED_SKIPPED_ROUTE };
            }
        }

        if (!Array.isArray(state.battleQueue) || state.battleQueue.length !== interceptRoutes.length) {
            return { success: false, reason: TRIAL_PLAN_REASONS.INCOMPLETE_BATTLES };
        }

        for (let i = 0; i < state.battleQueue.length; i++) {
            const battle = state.battleQueue[i];
            if (!battle || battle.status !== TRIAL_BATTLE_STATUSES.RESOLVED) {
                return { success: false, reason: TRIAL_PLAN_REASONS.INCOMPLETE_BATTLES };
            }
            if (!battle.traversalApplied || !battle.sequenceAdvanced) {
                return { success: false, reason: TRIAL_PLAN_REASONS.INCOMPLETE_BATTLES };
            }
            const traversal = Array.isArray(state.traversalResults) ? state.traversalResults[i] : null;
            if (!traversal) {
                return { success: false, reason: TRIAL_PLAN_REASONS.INCOMPLETE_BATTLES };
            }
        }

        if (!state.hqDamageResolution?.damageApplied) {
            return { success: false, reason: TRIAL_PLAN_REASONS.INCOMPLETE_DAMAGE };
        }

        return { success: true };
    }

    buildCompletionResult(state) {
        const emberRemaining = Number.isFinite(state?.ember) ? Number(state.ember) : 0;
        const outcome = emberRemaining > 0
            ? TRIAL_COMPLETION_OUTCOMES.SURVIVED
            : TRIAL_COMPLETION_OUTCOMES.FAILED;

        const battleCount = Array.isArray(state?.battleQueue) ? state.battleQueue.length : 0;
        const resolvedBattleCount = Array.isArray(state?.battleQueue)
            ? state.battleQueue.filter(b => b?.status === TRIAL_BATTLE_STATUSES.RESOLVED).length
            : 0;
        const routeEndCount = Number(state?.hqDamageResolution?.routeEndCount) || 0;
        const totalEmberDamage = Number(state?.hqDamageResolution?.emberDamage) || 0;

        return {
            completed: true,
            outcome,
            emberRemaining,
            battleCount,
            resolvedBattleCount,
            routeEndCount,
            totalEmberDamage
        };
    }
}
