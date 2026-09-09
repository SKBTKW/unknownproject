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
        if (state.battleQueue.length === 0) {
            return { success: false, errors: [TRIAL_PLAN_REASONS.NO_PENDING_BATTLES] };
        }

        const targetIndex = 0;
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
}
