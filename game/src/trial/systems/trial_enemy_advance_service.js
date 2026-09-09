import { TRIAL_PLAN_REASONS, TRIAL_BATTLE_STATUSES, TRIAL_OUTCOMES } from "../domain/trial_types.js";

function cloneData(value) {
    if (value === undefined) return undefined;
    return JSON.parse(JSON.stringify(value));
}

export class TrialEnemyAdvanceService {
    advanceAfterBattle(state, combatResult = null) {
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

        const battleResult = combatResult || (Array.isArray(state.battleResults) ? state.battleResults[state.currentBattleIndex] : null);
        if (!battleResult || typeof battleResult !== "object") {
            return { success: false, errors: [TRIAL_PLAN_REASONS.MISSING_BATTLE_RESULT] };
        }

        // Duplicate traversal protection
        if (Array.isArray(state.traversalResults) && state.traversalResults[state.currentBattleIndex]) {
            return { success: false, errors: [TRIAL_PLAN_REASONS.TRAVERSAL_ALREADY_APPLIED] };
        }
        if (currentBattle.traversalApplied) {
            return { success: false, errors: [TRIAL_PLAN_REASONS.TRAVERSAL_ALREADY_APPLIED] };
        }

        // Route validation
        const route = Array.isArray(state.routes) ? state.routes.find(r => r.id === currentBattle.routeId) : null;
        if (!route || !Array.isArray(route.cells) || route.cells.length === 0) {
            return { success: false, errors: [TRIAL_PLAN_REASONS.INVALID_TRAVERSAL_ROUTE] };
        }

        const interceptIndex = route.cells.findIndex(
            c => c.r === currentBattle.interceptCell.r && c.c === currentBattle.interceptCell.c
        );
        if (interceptIndex === -1) {
            return { success: false, errors: [TRIAL_PLAN_REASONS.CELL_NOT_ON_ROUTE] };
        }

        // Determine outcome: REPEL vs BREAKTHROUGH / NOT_REPEL
        const outcome = battleResult.prediction?.outcome || battleResult.outcome;
        const isRepelled = (outcome === TRIAL_OUTCOMES.REPEL);

        const fromIndex = interceptIndex;
        let toIndex = interceptIndex;
        let stopped = false;
        let advanced = false;
        let reachedRouteEnd = false;

        const advance = isRepelled ? 0 : 1;
        if (isRepelled) {
            stopped = true;
            advanced = false;
            toIndex = interceptIndex;
            reachedRouteEnd = false;
        } else {
            stopped = false;
            advanced = true;
            toIndex = interceptIndex + 1;
            reachedRouteEnd = (toIndex >= route.cells.length - 1);
        }

        const cellIndexForCurrentCell = Math.min(toIndex, route.cells.length - 1);
        const currentCellData = route.cells[cellIndexForCurrentCell];
        const toCell = currentCellData ? { r: currentCellData.r, c: currentCellData.c } : { ...currentBattle.interceptCell };
        const interceptCell = { ...currentBattle.interceptCell };

        const traversalResult = {
            battleIndex: state.currentBattleIndex,
            routeId: currentBattle.routeId,
            outcome,
            advance,
            fromIndex,
            toIndex,
            interceptCell,
            toCell,
            stopped,
            advanced,
            reachedRouteEnd
        };

        // State commit
        currentBattle.traversalApplied = true;
        currentBattle.traversal = cloneData(traversalResult);

        if (!Array.isArray(state.traversalResults)) {
            state.traversalResults = [];
        }
        state.traversalResults[state.currentBattleIndex] = cloneData(traversalResult);

        if (!state.routeProgress) {
            state.routeProgress = {};
        }
        state.routeProgress[currentBattle.routeId] = {
            routeId: currentBattle.routeId,
            currentIndex: toIndex,
            currentCell: toCell,
            status: stopped ? "STOPPED" : (reachedRouteEnd ? "REACHED_END" : "ADVANCED"),
            stopped,
            advanced,
            reachedRouteEnd
        };

        return {
            success: true,
            battleIndex: state.currentBattleIndex,
            traversalResult: cloneData(traversalResult)
        };
    }
}
