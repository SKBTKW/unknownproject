import {
    TRIAL_PHASES,
    TRIAL_PLAN_REASONS,
    TRIAL_ROUTE_PLAN_STATUSES,
    TRIAL_BATTLE_STATUSES,
    TRIAL_COMPLETION_OUTCOMES
} from "../domain/trial_types.js";

function cloneData(value) {
    if (value === undefined) return undefined;
    return JSON.parse(JSON.stringify(value));
}

export class TrialCompletionService {
    /**
     * Validate whether the trial state can be completed.
     * @param {Object} state - The TrialState instance or plain object.
     * @returns {{ success: boolean, reason?: string, details?: any }}
     */
    validateCompletion(state) {
        if (!state) {
            return { success: false, reason: TRIAL_PLAN_REASONS.TRIAL_NOT_STARTED };
        }

        // Already completed
        if (state.trialCompleted || state.phase === TRIAL_PHASES.RESULT) {
            return { success: false, reason: TRIAL_PLAN_REASONS.TRIAL_ALREADY_COMPLETED };
        }

        // Plan activation required
        if (!state.planActivated || !state.interceptionPlan) {
            return { success: false, reason: TRIAL_PLAN_REASONS.PLAN_NOT_ACTIVATED };
        }

        // Must not be in the middle of a battle
        if (state.currentBattleIndex !== null) {
            return { success: false, reason: TRIAL_PLAN_REASONS.INCOMPLETE_BATTLES };
        }

        // Temporary safety gate for SKIP routes
        // SKIP routes currently lack traversal/damage simulation; trial cannot be safely marked as completed
        if (Array.isArray(state.interceptionPlan.routes)) {
            const hasSkipped = state.interceptionPlan.routes.some(
                r => r && r.status === TRIAL_ROUTE_PLAN_STATUSES.SKIP
            );
            if (hasSkipped) {
                return { success: false, reason: TRIAL_PLAN_REASONS.UNRESOLVED_SKIPPED_ROUTE };
            }
        }

        // Must have battle queue
        if (!Array.isArray(state.battleQueue)) {
            return { success: false, reason: TRIAL_PLAN_REASONS.INCOMPLETE_BATTLES };
        }

        const queueLength = state.battleQueue.length;
        if (queueLength === 0) {
            return { success: false, reason: TRIAL_PLAN_REASONS.INCOMPLETE_BATTLES };
        }

        // Check each battle in queue
        for (let i = 0; i < queueLength; i++) {
            const battle = state.battleQueue[i];
            if (!battle || battle.status !== TRIAL_BATTLE_STATUSES.RESOLVED) {
                return { success: false, reason: TRIAL_PLAN_REASONS.INCOMPLETE_BATTLES };
            }

            // Must have traversal applied
            if (!battle.traversalApplied) {
                return { success: false, reason: TRIAL_PLAN_REASONS.INCOMPLETE_BATTLES };
            }

            const traversal = Array.isArray(state.traversalResults) ? state.traversalResults[i] : null;
            if (!traversal) {
                return { success: false, reason: TRIAL_PLAN_REASONS.INCOMPLETE_BATTLES };
            }

            // Sequence must be advanced
            if (!battle.sequenceAdvanced) {
                return { success: false, reason: TRIAL_PLAN_REASONS.INCOMPLETE_BATTLES };
            }

            // If traversal reached route end, damage must have been applied
            if (traversal.reachedRouteEnd) {
                if (!battle.damageApplied) {
                    return { success: false, reason: TRIAL_PLAN_REASONS.INCOMPLETE_DAMAGE };
                }
                const damage = Array.isArray(state.damageResults) ? state.damageResults[i] : null;
                if (!damage) {
                    return { success: false, reason: TRIAL_PLAN_REASONS.INCOMPLETE_DAMAGE };
                }
            }
        }

        return { success: true };
    }

    /**
     * Build the immutable completion result payload.
     * @param {Object} state - The TrialState instance or plain object.
     * @returns {Object}
     */
    buildCompletionResult(state) {
        const emberRemaining = Number.isFinite(state?.ember) ? Number(state.ember) : 0;
        const outcome = emberRemaining > 0
            ? TRIAL_COMPLETION_OUTCOMES.SURVIVED
            : TRIAL_COMPLETION_OUTCOMES.FAILED;

        const battleCount = Array.isArray(state?.battleQueue) ? state.battleQueue.length : 0;
        const resolvedBattleCount = Array.isArray(state?.battleQueue)
            ? state.battleQueue.filter(b => b?.status === TRIAL_BATTLE_STATUSES.RESOLVED).length
            : 0;

        const routeEndCount = Array.isArray(state?.traversalResults)
            ? state.traversalResults.filter(t => Boolean(t?.reachedRouteEnd)).length
            : 0;

        const totalEmberDamage = Array.isArray(state?.damageResults)
            ? state.damageResults.reduce((sum, d) => sum + (Number(d?.emberDamage) || 0), 0)
            : 0;

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
