import { TRIAL_ROUTE_PLAN_STATUSES, TRIAL_BATTLE_STATUSES } from '../trial/domain/trial_types.js';
import { createTrialBoardSemanticData } from './trial_board_semantic_data.js';

function toCell(cell) {
    if (!cell) return null;
    const r = Number.isInteger(cell.r) ? cell.r : cell.row;
    const c = Number.isInteger(cell.c) ? cell.c : cell.column;
    if (!Number.isInteger(r) || !Number.isInteger(c)) return null;
    return { r, c };
}

function inferEntrySide(entryCell, boardSize = null) {
    if (!entryCell || !boardSize) return null;
    const rows = Number(boardSize.rows);
    const columns = Number(boardSize.columns);
    if (!Number.isInteger(rows) || !Number.isInteger(columns) || rows < 1 || columns < 1) return null;
    if (entryCell.r === 0) return "north";
    if (entryCell.r === rows - 1) return "south";
    if (entryCell.c === 0) return "west";
    if (entryCell.c === columns - 1) return "east";
    return null;
}

function routeIdOf(route) { return route?.id ?? route?.routeId ?? null; }
function routeCellsOf(route) { return (route?.cells || route?.path || []).map(toCell).filter(Boolean); }

function normalizeDraftMap(drafts) {
    if (drafts instanceof Map) return drafts;
    if (Array.isArray(drafts)) return new Map(drafts.filter(Boolean).map(item => [item.routeId, item]));
    if (drafts && typeof drafts === "object") {
        return new Map(Object.entries(drafts).map(([routeId, item]) => [routeId, { routeId, ...(item || {}) }]));
    }
    return new Map();
}

function buildPlannedIntercepts(trialState, trialPresentationState) {
    const draftMap = normalizeDraftMap(trialPresentationState?.routePlanDrafts);
    const draftItems = [];
    for (const [routeId, draft] of draftMap.entries()) {
        if (draft?.status !== TRIAL_ROUTE_PLAN_STATUSES.INTERCEPT) continue;
        const cell = toCell(draft.interceptCell);
        if (!cell) continue;
        draftItems.push({ cell, routeId, defenseAllocation: Number(draft.defenseAllocation) || 0, interceptBlockId: draft.interceptBlockId || null, source: "DRAFT" });
    }
    if (draftItems.length > 0) return draftItems;
    const confirmed = Array.isArray(trialState?.interceptionPlan?.routes) ? trialState.interceptionPlan.routes : [];
    return confirmed.filter(plan => plan?.status === TRIAL_ROUTE_PLAN_STATUSES.INTERCEPT).map(plan => {
        const cell = toCell(plan.interceptCell);
        return cell ? { cell, routeId: plan.routeId ?? null, defenseAllocation: Number(plan.defenseAllocation) || 0, interceptBlockId: plan.interceptBlockId || null, source: "CONFIRMED" } : null;
    }).filter(Boolean);
}

function buildBattleMarkers(trialState) {
    const queue = Array.isArray(trialState?.battleQueue) ? trialState.battleQueue : [];
    const currentIndex = Number.isInteger(trialState?.currentBattleIndex) ? trialState.currentBattleIndex : null;
    return queue.map((battle, index) => {
        const cell = toCell(battle?.interceptCell);
        return cell ? { cell, routeId: battle.routeId ?? null, status: battle.status || TRIAL_BATTLE_STATUSES.PENDING, defenseAllocation: Number(battle.defenseAllocation) || 0, isCurrent: currentIndex === index } : null;
    }).filter(Boolean);
}

function buildEnemyState(trialState) {
    if (!trialState?.enemy) return null;
    return {
        strategicSuppression: Number(trialState.enemy.strategicSuppression) || 0,
        totalSuppression: Number(trialState.enemy.totalSuppression) || 0,
        commander: trialState.enemy.commander ? { ...trialState.enemy.commander } : null,
        forces: Array.isArray(trialState.enemy.forces) ? trialState.enemy.forces.map(force => ({ ...force })) : []
    };
}

export class TrialBoardSemanticAdapter {
    static fromRuntime({ trialState = null, trialPresentationState = null, boardSize = null, interceptionCandidates = [] } = {}) {
        if (!trialState) return createTrialBoardSemanticData({ available: false, interceptionCandidates });
        const currentBattle = typeof trialState.getCurrentBattle === "function"
            ? trialState.getCurrentBattle()
            : (Array.isArray(trialState.battleQueue) && Number.isInteger(trialState.currentBattleIndex) ? trialState.battleQueue[trialState.currentBattleIndex] || null : null);
        const activeRouteId = trialPresentationState?.activeEnemyRoute ?? currentBattle?.routeId ?? null;
        const routes = (trialState.routes || []).map(route => {
            const cells = routeCellsOf(route);
            const entryCell = toCell(route?.entryCell) || cells[0] || null;
            return { routeId: routeIdOf(route), cells, entryCell, entrySide: route?.entrySide || inferEntrySide(entryCell, boardSize) };
        });
        return createTrialBoardSemanticData({
            available: true,
            activeRouteId,
            routes,
            interceptionCandidates,
            plannedIntercepts: buildPlannedIntercepts(trialState, trialPresentationState),
            battleMarkers: buildBattleMarkers(trialState),
            enemyState: buildEnemyState(trialState)
        });
    }
}

export default TrialBoardSemanticAdapter;
