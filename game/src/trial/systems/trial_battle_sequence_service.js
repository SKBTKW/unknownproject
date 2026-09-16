import { TRIAL_PLAN_REASONS, TRIAL_BATTLE_STATUSES } from "../domain/trial_types.js";

function cloneData(value) {
    if (value === undefined) return undefined;
    return JSON.parse(JSON.stringify(value));
}

export class TrialBattleSequenceService {
    getCurrentBattle(state) {
        if (!state) return null;
        if (typeof state.getCurrentBattle === "function") {
            return state.getCurrentBattle();
        }
        if (!Array.isArray(state.battleQueue) || state.currentBattleIndex === null) {
            return null;
        }
        const item = state.battleQueue[state.currentBattleIndex];
        return item ? cloneData(item) : null;
    }

    startNextBattle(state) {
        if (!state) {
            return { success: false, errors: ["TRIAL_NOT_STARTED"] };
        }
        if (!state.planActivated) {
            return { success: false, errors: [TRIAL_PLAN_REASONS.PLAN_NOT_ACTIVATED] };
        }
        if (state.currentBattleIndex !== null) {
            return { success: false, errors: [TRIAL_PLAN_REASONS.BATTLE_ALREADY_ACTIVE] };
        }
        if (!Array.isArray(state.battleQueue)) {
            return { success: false, errors: [TRIAL_PLAN_REASONS.NO_CONFIRMED_PLAN] };
        }
        const targetIndex = state.battleQueue.findIndex(item => item && item.status === TRIAL_BATTLE_STATUSES.PENDING);
        if (targetIndex === -1) {
            return { success: false, errors: [TRIAL_PLAN_REASONS.NO_PENDING_BATTLES] };
        }
        const targetItem = state.battleQueue[targetIndex];

        if (!targetItem || typeof targetItem !== "object" || !targetItem.routeId || !targetItem.interceptCell ||
            typeof targetItem.interceptCell.r !== "number" || typeof targetItem.interceptCell.c !== "number" ||
            typeof targetItem.defenseAllocation !== "number") {
            return { success: false, errors: [TRIAL_PLAN_REASONS.INVALID_BATTLE_QUEUE_ITEM] };
        }

        // State commit
        state.currentBattleIndex = targetIndex;
        targetItem.status = TRIAL_BATTLE_STATUSES.ACTIVE;

        return {
            success: true,
            battleIndex: targetIndex,
            currentBattle: cloneData(targetItem)
        };
    }

    completeCurrentBattle(state, combatResult) {
        if (!state) {
            return { success: false, errors: ["TRIAL_NOT_STARTED"] };
        }
        if (!state.planActivated) {
            return { success: false, errors: [TRIAL_PLAN_REASONS.PLAN_NOT_ACTIVATED] };
        }
        if (state.currentBattleIndex === null) {
            return { success: false, errors: [TRIAL_PLAN_REASONS.NO_ACTIVE_BATTLE] };
        }
        if (!Array.isArray(state.battleQueue)) {
            return { success: false, errors: [TRIAL_PLAN_REASONS.NO_CONFIRMED_PLAN] };
        }
        const currentBattle = state.battleQueue[state.currentBattleIndex];
        if (!currentBattle || typeof currentBattle !== "object") {
            return { success: false, errors: [TRIAL_PLAN_REASONS.INVALID_CURRENT_BATTLE] };
        }
        if (currentBattle.status === TRIAL_BATTLE_STATUSES.RESOLVED) {
            return { success: false, errors: [TRIAL_PLAN_REASONS.BATTLE_ALREADY_RESOLVED] };
        }
        if (currentBattle.status !== TRIAL_BATTLE_STATUSES.ACTIVE) {
            return { success: false, errors: [TRIAL_PLAN_REASONS.NO_ACTIVE_BATTLE] };
        }
        if (!combatResult || typeof combatResult !== "object") {
            return { success: false, errors: ["INVALID_COMBAT_RESULT"] };
        }

        // State commit
        currentBattle.status = TRIAL_BATTLE_STATUSES.RESOLVED;

        if (!Array.isArray(state.battleResults)) {
            state.battleResults = [];
        }
        const clonedCombat = cloneData(combatResult);
        const resultSnapshot = {
            battleIndex: state.currentBattleIndex,
            routeId: currentBattle.routeId,
            interceptCell: cloneData(currentBattle.interceptCell),
            defenseAllocation: currentBattle.defenseAllocation,
            outcome: clonedCombat.prediction?.outcome || clonedCombat.outcome,
            playerActualPower: clonedCombat.human?.finalPower ?? clonedCombat.playerActualPower,
            enemyActualPower: clonedCombat.enemy?.finalPower ?? clonedCombat.enemyActualPower,
            margin: clonedCombat.prediction?.margin ?? clonedCombat.margin,
            modifiers: cloneData(clonedCombat.modifiers || []),
            ...clonedCombat
        };
        state.battleResults[state.currentBattleIndex] = resultSnapshot;

        return {
            success: true,
            battleIndex: state.currentBattleIndex,
            battleResult: cloneData(resultSnapshot)
        };
    }

    transitionAfterTraversal(state) {
        if (!state) {
            return { success: false, errors: ["TRIAL_NOT_STARTED"] };
        }
        if (!state.planActivated) {
            return { success: false, errors: [TRIAL_PLAN_REASONS.PLAN_NOT_ACTIVATED] };
        }
        if (state.currentBattleIndex === null) {
            return { success: false, errors: [TRIAL_PLAN_REASONS.NO_ACTIVE_BATTLE] };
        }
        if (!Array.isArray(state.battleQueue)) {
            return { success: false, errors: [TRIAL_PLAN_REASONS.NO_CONFIRMED_PLAN] };
        }
        const currentBattle = state.battleQueue[state.currentBattleIndex];
        if (!currentBattle || typeof currentBattle !== "object") {
            return { success: false, errors: [TRIAL_PLAN_REASONS.INVALID_CURRENT_BATTLE] };
        }
        if (currentBattle.status !== TRIAL_BATTLE_STATUSES.RESOLVED) {
            return { success: false, errors: [TRIAL_PLAN_REASONS.NO_RESOLVED_BATTLE] };
        }
        if (!currentBattle.traversalApplied) {
            return { success: false, errors: [TRIAL_PLAN_REASONS.TRAVERSAL_NOT_APPLIED] };
        }
        if (!Array.isArray(state.traversalResults) || !state.traversalResults[state.currentBattleIndex]) {
            return { success: false, errors: [TRIAL_PLAN_REASONS.MISSING_TRAVERSAL_RESULT] };
        }
        if (currentBattle.sequenceAdvanced) {
            return { success: false, errors: [TRIAL_PLAN_REASONS.BATTLE_TRANSITION_ALREADY_APPLIED] };
        }

        const completedBattleIndex = state.currentBattleIndex;
        const completedRouteId = currentBattle.routeId;
        const traversalResult = state.traversalResults[completedBattleIndex];
        const reachedRouteEnd = Boolean(traversalResult?.reachedRouteEnd);

        // Find next pending battle
        const nextBattleIndex = state.battleQueue.findIndex(
            (item, idx) => idx !== completedBattleIndex && item && item.status === TRIAL_BATTLE_STATUSES.PENDING
        );
        const hasNextBattle = (nextBattleIndex !== -1);

        const transitionResult = {
            completedBattleIndex,
            completedRouteId,
            hasNextBattle,
            nextBattleIndex: hasNextBattle ? nextBattleIndex : null,
            reachedRouteEnd
        };

        // State commit
        currentBattle.sequenceAdvanced = true;
        currentBattle.sequenceTransition = cloneData(transitionResult);
        state.currentBattleIndex = null;

        return {
            success: true,
            transitionResult: cloneData(transitionResult)
        };
    }
}
