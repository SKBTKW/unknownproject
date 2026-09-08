import { createBattleContext } from "../domain/battle_context.js";
import { createTrialState } from "../domain/trial_state.js";
import {
    TRIAL_PHASES,
    TRIAL_PLAN_REASONS,
    TRIAL_ROUTE_PLAN_STATUSES
} from "../domain/trial_types.js";
import { TrialPlanningDraftService } from "../domain/trial_planning_draft_service.js";
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
        try {
            const preview = this.previewInterception(resolved.input);
            if (preview.success === false) {
                return { success: false, reason: TRIAL_PLAN_REASONS.INTERCEPTION_NOT_ALLOWED, preview };
            }
            return { ...resolved, preview };
        } catch (err) {
            const reason = err.message === "DEFENSE_ALLOCATION_EXCEEDS_AVAILABLE"
                ? TRIAL_PLAN_REASONS.DEFENSE_BUDGET_EXCEEDED
                : (err.message || TRIAL_PLAN_REASONS.INTERCEPTION_NOT_ALLOWED);
            return { success: false, reason };
        }
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

    getRouteDecision(drafts, routeId) {
        if (routeId === undefined && typeof drafts === "string") {
            routeId = drafts;
            drafts = null;
        }
        return TrialPlanningDraftService.getRouteDecision(drafts, routeId);
    }

    getPlannedDefenseTotal(drafts) {
        return TrialPlanningDraftService.getPlannedDefenseTotal(drafts);
    }

    getRemainingDefense(drafts) {
        return TrialPlanningDraftService.getRemainingDefense(drafts, this.state?.human?.availableDefense || 0);
    }

    getUndecidedRoutes(drafts) {
        return TrialPlanningDraftService.getUndecidedRoutes(drafts, this.getPlanningRoutes());
    }

    setRouteInterceptPlan(...args) {
        let drafts, routeId, interceptCell, defenseAllocation;
        if (args.length >= 4 && (args[0] instanceof Map || (typeof args[0] === "object" && args[0] !== null && !args[0].r))) {
            [drafts, routeId, interceptCell, defenseAllocation] = args;
        } else if (typeof args[0] === "string") {
            [routeId, interceptCell, defenseAllocation, drafts] = args;
        } else {
            [drafts, routeId, interceptCell, defenseAllocation] = args;
        }
        drafts = drafts || new Map();
        return TrialPlanningDraftService.setIntercept(drafts, {
            routeId,
            interceptCell,
            defenseAllocation,
            availableDefense: this.state?.human?.availableDefense ?? Infinity,
            routes: this.state?.routes,
            cellResolver: this.cellResolver,
            domainValidator: (rId, cell, alloc) => this.validateRouteInterception(rId, cell, alloc)
        });
    }

    setRouteSkipped(...args) {
        let drafts, routeId;
        if (args.length >= 2 && (args[0] instanceof Map || (typeof args[0] === "object" && args[0] !== null))) {
            [drafts, routeId] = args;
        } else {
            [routeId, drafts] = args;
        }
        drafts = drafts || new Map();
        return TrialPlanningDraftService.setSkip(drafts, routeId, this.state?.routes);
    }

    clearRouteDecision(...args) {
        let drafts, routeId;
        if (args.length >= 2 && (args[0] instanceof Map || (typeof args[0] === "object" && args[0] !== null))) {
            [drafts, routeId] = args;
        } else {
            [routeId, drafts] = args;
        }
        if (!drafts) return false;
        return TrialPlanningDraftService.clearDecision(drafts, routeId);
    }

    validatePlanningDraft(drafts, { cellResolver = this.cellResolver } = {}) {
        if (!this.state) return { valid: false, errors: ["TRIAL_NOT_STARTED"], warnings: [] };
        return TrialPlanningDraftService.validateDraft(drafts, {
            routes: this.getPlanningRoutes(),
            availableDefense: this.state?.human?.availableDefense ?? 0,
            cellResolver,
            domainValidator: (rId, cell, alloc) => {
                const prev = this.cellResolver;
                if (cellResolver) this.cellResolver = cellResolver;
                try {
                    return this.validateRouteInterception(rId, cell, alloc);
                } finally {
                    this.cellResolver = prev;
                }
            }
        });
    }

    confirmInterceptionPlan(drafts, { allowWarnings = false } = {}) {
        if (!this.state) return { success: false, errors: ["TRIAL_NOT_STARTED"], warnings: [] };
        const validation = this.validatePlanningDraft(drafts);
        if (!validation.valid || (validation.errors && validation.errors.length > 0)) {
            return { success: false, errors: validation.errors, warnings: validation.warnings };
        }
        if (validation.warnings && validation.warnings.length > 0 && !allowWarnings) {
            return { success: false, requiresConfirmation: true, warnings: validation.warnings };
        }

        const map = drafts instanceof Map
            ? drafts
            : new Map(Array.isArray(drafts) ? drafts.map(d => [d.routeId, d]) : Object.entries(drafts || {}));
        const confirmedRoutes = [];
        for (const route of this.state.routes) {
            const rId = route.id ?? route.routeId;
            const decision = map.get(rId);
            if (decision && (decision.status === TRIAL_ROUTE_PLAN_STATUSES.INTERCEPT || decision.status === TRIAL_ROUTE_PLAN_STATUSES.SKIP)) {
                confirmedRoutes.push({
                    routeId: rId,
                    status: decision.status,
                    interceptCell: decision.interceptCell ? { ...decision.interceptCell } : null,
                    interceptBlockId: decision.interceptBlockId || null,
                    defenseAllocation: Number(decision.defenseAllocation) || 0
                });
            }
        }

        const totalDefenseAllocated = confirmedRoutes.reduce(
            (sum, r) => sum + (r.status === TRIAL_ROUTE_PLAN_STATUSES.INTERCEPT ? r.defenseAllocation : 0),
            0
        );

        this.state.interceptionPlan = {
            routes: confirmedRoutes,
            totalDefenseAllocated
        };

        this.gameFactHub.emit(GAME_FACT_TYPES.TRIAL_PLAN_CONFIRMED, {
            routes: JSON.parse(JSON.stringify(confirmedRoutes)),
            totalDefenseAllocated
        });

        return {
            success: true,
            plan: this.state.interceptionPlan
        };
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
