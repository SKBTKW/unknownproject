import { createBattleContext } from "../domain/battle_context.js";
import { createTrialState } from "../domain/trial_state.js";
import {
    TRIAL_PHASES,
    TRIAL_PLAN_REASONS,
    TRIAL_ROUTE_PLAN_STATUSES
} from "../domain/trial_types.js";
import { GAME_FACT_TYPES, GameFactHub } from "../../core/game_fact.js";
import { InterceptionPowerResolver } from "../systems/interception_power_resolver.js";
import { TrialCombatResolver } from "../systems/trial_combat_resolver.js";
import { TrialFlow } from "./trial_flow.js";

export class TrialController {
    constructor({
        powerResolver = new InterceptionPowerResolver(),
        combatResolver = new TrialCombatResolver(),
        flow = new TrialFlow(),
        gameFactHub = new GameFactHub()
    } = {}) {
        this.powerResolver = powerResolver;
        this.combatResolver = combatResolver;
        this.flow = flow;
        this.gameFactHub = gameFactHub;
        this.state = null;
        this.cellResolver = null;
    }

    startScenario(scenario, { cellResolver = null } = {}) {
        this.state = createTrialState(scenario);
        this.cellResolver = typeof cellResolver === "function" ? cellResolver : null;
        this.state.enemy.totalSuppression = this.powerResolver.resolveSuppression(this.state.enemy.strategicSuppression);
        return this.state;
    }

    getRoute(routeId) {
        if (!this.state) return null;
        return this.state.routes.find(route => route.id === routeId) || null;
    }

    getRoutePosition(routeId, r, c) {
        const route = this.getRoute(routeId);
        if (!route) return null;
        const cells = route.cells || route.path || [];
        const index = cells.findIndex(entry => {
            const row = Number.isInteger(entry.r) ? entry.r : entry.row;
            const column = Number.isInteger(entry.c) ? entry.c : entry.column;
            return row === r && column === c;
        });
        return index >= 0 ? { route, cells, index } : null;
    }

    createRouteInterceptionInput(routeId, interceptCell, allocatedDefense = 0) {
        if (!this.getRoute(routeId)) return { success: false, reason: TRIAL_PLAN_REASONS.UNKNOWN_ROUTE };
        const r = interceptCell?.r;
        const c = interceptCell?.c;
        if (!Number.isInteger(r) || !Number.isInteger(c)) {
            return { success: false, reason: TRIAL_PLAN_REASONS.INVALID_INTERCEPT_CELL };
        }
        const position = this.getRoutePosition(routeId, r, c);
        if (!position) return { success: false, reason: TRIAL_PLAN_REASONS.CELL_NOT_ON_ROUTE };
        const cell = this.cellResolver?.(r, c);
        if (!cell?.placed || cell.isHQ) {
            return { success: false, reason: TRIAL_PLAN_REASONS.INTERCEPTION_NOT_ALLOWED };
        }
        const approachEntry = position.index > 0 ? position.cells[position.index - 1] : null;
        const approachR = approachEntry ? (Number.isInteger(approachEntry.r) ? approachEntry.r : approachEntry.row) : r;
        const approachC = approachEntry ? (Number.isInteger(approachEntry.c) ? approachEntry.c : approachEntry.column) : c;
        const approachCell = this.cellResolver?.(approachR, approachC) || cell;
        return {
            success: true,
            input: {
                allocatedDefense,
                interceptCell: { ...cell, cellId: `${r}:${c}` },
                approachCell: { ...approachCell, cellId: `${approachR}:${approachC}` }
            },
            blockId: cell.placementGroupId != null ? `placement:${cell.placementGroupId}` : `cell:${r}:${c}`
        };
    }

    validateRouteInterception(routeId, interceptCell, allocatedDefense = 0) {
        const resolved = this.createRouteInterceptionInput(routeId, interceptCell, allocatedDefense);
        if (!resolved.success) return resolved;
        const preview = this.previewInterception(resolved.input);
        if (preview.success === false) {
            return { success: false, reason: TRIAL_PLAN_REASONS.INTERCEPTION_NOT_ALLOWED, preview };
        }
        return { ...resolved, preview };
    }

    getRouteDecision(routeId) {
        return this.state?.plannedInterceptions.find(plan => plan.routeId === routeId) || {
            routeId,
            status: TRIAL_ROUTE_PLAN_STATUSES.UNDECIDED,
            interceptCell: null,
            defenseAllocation: 0
        };
    }

    getPlannedDefenseTotal() {
        return (this.state?.plannedInterceptions || []).reduce(
            (total, plan) => total + (plan.status === TRIAL_ROUTE_PLAN_STATUSES.INTERCEPT ? plan.defenseAllocation : 0),
            0
        );
    }

    getRemainingDefense() {
        return Math.max(0, (this.state?.human?.availableDefense || 0) - this.getPlannedDefenseTotal());
    }

    getPlanningRoutes() {
        if (!this.state) return [];
        return this.state.routes.map((route, index) => ({ route, index }))
            .sort((a, b) => {
                const aCommander = a.route.isCommanderRoute === true || a.route.commander === true;
                const bCommander = b.route.isCommanderRoute === true || b.route.commander === true;
                if (aCommander !== bCommander) return aCommander ? -1 : 1;
                const aSuppression = Number(a.route.suppression ?? a.route.enemySuppression ?? a.route.strategicSuppression) || 0;
                const bSuppression = Number(b.route.suppression ?? b.route.enemySuppression ?? b.route.strategicSuppression) || 0;
                return (bSuppression - aSuppression) || (a.index - b.index);
            })
            .map(entry => entry.route);
    }

    getUndecidedRoutes() {
        return this.getPlanningRoutes().filter(route => this.getRouteDecision(route.id).status === TRIAL_ROUTE_PLAN_STATUSES.UNDECIDED);
    }

    setRouteInterceptPlan(routeId, interceptCell, defenseAllocation) {
        if (!Number.isInteger(defenseAllocation) || defenseAllocation < 1) {
            return { success: false, reason: TRIAL_PLAN_REASONS.INVALID_DEFENSE_ALLOCATION };
        }
        const available = this.state?.human?.availableDefense || 0;
        if (defenseAllocation > available) {
            return { success: false, reason: TRIAL_PLAN_REASONS.INVALID_DEFENSE_ALLOCATION };
        }
        const candidate = this.validateRouteInterception(routeId, interceptCell, defenseAllocation);
        if (!candidate.success) return candidate;
        const duplicate = this.state.plannedInterceptions.find(plan =>
            plan.routeId !== routeId
            && plan.status === TRIAL_ROUTE_PLAN_STATUSES.INTERCEPT
            && plan.interceptBlockId === candidate.blockId
        );
        if (duplicate) return { success: false, reason: TRIAL_PLAN_REASONS.BLOCK_ALREADY_PLANNED };
        const existing = this.state.plannedInterceptions.find(plan => plan.routeId === routeId);
        const existingAllocation = existing?.status === TRIAL_ROUTE_PLAN_STATUSES.INTERCEPT ? existing.defenseAllocation : 0;
        if (this.getPlannedDefenseTotal() - existingAllocation + defenseAllocation > available) {
            return { success: false, reason: TRIAL_PLAN_REASONS.DEFENSE_BUDGET_EXCEEDED };
        }
        const plan = {
            routeId,
            status: TRIAL_ROUTE_PLAN_STATUSES.INTERCEPT,
            interceptCell: { r: interceptCell.r, c: interceptCell.c },
            interceptBlockId: candidate.blockId,
            defenseAllocation
        };
        this.replaceRouteDecision(plan);
        this.gameFactHub.emit(GAME_FACT_TYPES.TRIAL_INTERCEPTION_PLANNED, plan);
        return { success: true, plan, preview: candidate.preview };
    }

    setRouteSkipped(routeId) {
        if (!this.getRoute(routeId)) return { success: false, reason: TRIAL_PLAN_REASONS.UNKNOWN_ROUTE };
        const plan = { routeId, status: TRIAL_ROUTE_PLAN_STATUSES.SKIP, interceptCell: null, defenseAllocation: 0 };
        this.replaceRouteDecision(plan);
        this.gameFactHub.emit(GAME_FACT_TYPES.TRIAL_ROUTE_SKIPPED, plan);
        return { success: true, plan };
    }

    clearRouteDecision(routeId) {
        if (!this.getRoute(routeId)) return false;
        this.state.plannedInterceptions = this.state.plannedInterceptions.filter(plan => plan.routeId !== routeId);
        return true;
    }

    replaceRouteDecision(plan) {
        this.state.plannedInterceptions = this.state.plannedInterceptions.filter(item => item.routeId !== plan.routeId);
        this.state.plannedInterceptions.push(plan);
    }

    validatePlanningDraft() {
        if (!this.state) return { valid: false, reasons: ["TRIAL_NOT_STARTED"] };
        const reasons = [];
        if (this.getUndecidedRoutes().length > 0) reasons.push("ROUTES_UNDECIDED");
        if (this.getPlannedDefenseTotal() > this.state.human.availableDefense) reasons.push(TRIAL_PLAN_REASONS.DEFENSE_BUDGET_EXCEEDED);
        return { valid: reasons.length === 0, reasons };
    }

    createBattleContext(input) {
        if (!this.state) throw new Error("TRIAL_NOT_STARTED");
        const allocatedDefense = Math.max(0, Number(input.allocatedDefense) || 0);
        if (allocatedDefense > this.state.human.availableDefense) {
            throw new Error("DEFENSE_ALLOCATION_EXCEEDS_AVAILABLE");
        }
        return createBattleContext({
            ...input,
            allocatedDefense,
            baseInterceptionPower: this.powerResolver.resolveDefense(allocatedDefense),
            enemySuppression: input.enemySuppression ?? this.state.enemy.totalSuppression,
            enemy: input.enemy || this.state.enemy,
            environment: input.environment || this.state.environment
        });
    }

    previewInterception(input) {
        if (!this.state) throw new Error("TRIAL_NOT_STARTED");
        const context = this.createBattleContext(input);
        return this.combatResolver.resolve(context);
    }

    resolveBattle(input) {
        if (!this.state) throw new Error("TRIAL_NOT_STARTED");
        if (this.state.phase === TRIAL_PHASES.SETUP) this.flow.advance(this.state);
        if (this.state.phase === TRIAL_PHASES.DEPLOYMENT) this.flow.advance(this.state);
        if (this.state.phase !== TRIAL_PHASES.BATTLE) throw new Error("TRIAL_NOT_IN_BATTLE_PHASE");

        const context = this.createBattleContext(input);
        const result = this.combatResolver.resolve(context);
        this.state.interceptions.push({ context, result });
        this.state.result = result;
        this.flow.advance(this.state);
        return result;
    }
}
