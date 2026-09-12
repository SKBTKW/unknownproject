import { createBattleContext } from "../domain/battle_context.js";
import { createTrialState } from "../domain/trial_state.js";
import {
    TRIAL_PHASES,
    TRIAL_PLAN_REASONS,
    TRIAL_ROUTE_PLAN_STATUSES,
    TRIAL_BATTLE_STATUSES
} from "../domain/trial_types.js";
import { TrialPlanningDraftService } from "../domain/trial_planning_draft_service.js";
import { GAME_FACT_TYPES, GameFactHub } from "../../core/game_fact.js";
import { InterceptionPowerResolver } from "../systems/interception_power_resolver.js";
import { TrialCombatResolver } from "../systems/trial_combat_resolver.js";
import { TrialBattleSequenceService } from "../systems/trial_battle_sequence_service.js";
import { TrialEnemyAdvanceService } from "../systems/trial_enemy_advance_service.js";
import { TrialHqDamageResolver } from "../systems/trial_hq_damage_resolver.js";
import { TrialCompletionService } from "../systems/trial_completion_service.js";
import { TrialFlow } from "./trial_flow.js";

export class TrialController {
    constructor({
        powerResolver = new InterceptionPowerResolver(),
        combatResolver = new TrialCombatResolver(),
        sequenceService = new TrialBattleSequenceService(),
        enemyAdvanceService = new TrialEnemyAdvanceService(),
        damageResolver = new TrialHqDamageResolver(),
        completionService = new TrialCompletionService(),
        flow = new TrialFlow(),
        gameFactHub = new GameFactHub(),
        emberSystem = null
    } = {}) {
        this.powerResolver = powerResolver;
        this.combatResolver = combatResolver;
        this.sequenceService = sequenceService;
        this.enemyAdvanceService = enemyAdvanceService;
        this.damageResolver = damageResolver;
        this.completionService = completionService;
        this.flow = flow;
        this.gameFactHub = gameFactHub;
        this.emberSystem = emberSystem;
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
        if (this.state.interceptionPlan !== null) {
            return {
                success: false,
                errors: [TRIAL_PLAN_REASONS.ALREADY_CONFIRMED],
                warnings: []
            };
        }
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

    validateConfirmedInterceptionPlan(plan = this.state?.interceptionPlan) {
        if (!this.state) {
            return { valid: false, errors: ["TRIAL_NOT_STARTED"] };
        }
        if (!plan || !Array.isArray(plan.routes)) {
            return { valid: false, errors: [TRIAL_PLAN_REASONS.NO_CONFIRMED_PLAN] };
        }
        if (this.state.planActivated) {
            return { valid: false, errors: [TRIAL_PLAN_REASONS.PLAN_ALREADY_ACTIVATED] };
        }

        const errors = [];
        const totalAllocated = Number(plan.totalDefenseAllocated) || 0;
        const currentAvailable = this.state.human?.availableDefense ?? 0;

        if (totalAllocated > currentAvailable) {
            errors.push(TRIAL_PLAN_REASONS.PLAN_DEFENSE_EXCEEDS_AVAILABLE);
        }

        const usedBlocks = new Set();
        let calculatedTotal = 0;

        for (const routePlan of plan.routes) {
            if (!routePlan || typeof routePlan !== "object") {
                errors.push(TRIAL_PLAN_REASONS.INVALID_CONFIRMED_PLAN);
                continue;
            }
            if (routePlan.status === TRIAL_ROUTE_PLAN_STATUSES.SKIP) {
                continue;
            }
            if (routePlan.status !== TRIAL_ROUTE_PLAN_STATUSES.INTERCEPT) {
                errors.push(TRIAL_PLAN_REASONS.INVALID_CONFIRMED_PLAN);
                continue;
            }

            const alloc = Number(routePlan.defenseAllocation) || 0;
            calculatedTotal += alloc;
            if (alloc <= 0) {
                errors.push(TRIAL_PLAN_REASONS.INVALID_DEFENSE_ALLOCATION);
            }

            const routeId = routePlan.routeId;
            const route = this.getRoute(routeId);
            if (!route) {
                errors.push(TRIAL_PLAN_REASONS.UNKNOWN_ROUTE);
                continue;
            }

            const cell = routePlan.interceptCell;
            const r = cell?.r;
            const c = cell?.c;
            if (!Number.isInteger(r) || !Number.isInteger(c)) {
                errors.push(TRIAL_PLAN_REASONS.INVALID_INTERCEPT_CELL);
                continue;
            }

            const pos = this.getRoutePosition(routeId, r, c);
            if (!pos) {
                errors.push(TRIAL_PLAN_REASONS.CELL_NOT_ON_ROUTE);
                continue;
            }

            const blockId = routePlan.interceptBlockId || `cell:${r}:${c}`;
            if (usedBlocks.has(blockId)) {
                errors.push(TRIAL_PLAN_REASONS.BLOCK_ALREADY_PLANNED);
            }
            usedBlocks.add(blockId);
        }

        if (totalAllocated !== calculatedTotal && !errors.includes(TRIAL_PLAN_REASONS.INVALID_CONFIRMED_PLAN)) {
            errors.push(TRIAL_PLAN_REASONS.INVALID_CONFIRMED_PLAN);
        }

        return {
            valid: errors.length === 0,
            errors
        };
    }

    activateInterceptionPlan() {
        if (!this.state) {
            return { success: false, errors: ["TRIAL_NOT_STARTED"] };
        }
        if (this.state.planActivated) {
            return { success: false, errors: [TRIAL_PLAN_REASONS.PLAN_ALREADY_ACTIVATED] };
        }
        const plan = this.state.interceptionPlan;
        if (!plan) {
            return { success: false, errors: [TRIAL_PLAN_REASONS.NO_CONFIRMED_PLAN] };
        }

        const validation = this.validateConfirmedInterceptionPlan(plan);
        if (!validation.valid) {
            return { success: false, errors: validation.errors };
        }

        // 1. Build battle queue items (only INTERCEPT routes) as independent snapshot
        const battleQueue = [];
        for (const routePlan of plan.routes) {
            if (routePlan.status === TRIAL_ROUTE_PLAN_STATUSES.INTERCEPT) {
                battleQueue.push({
                    routeId: routePlan.routeId,
                    interceptCell: { r: routePlan.interceptCell.r, c: routePlan.interceptCell.c },
                    interceptBlockId: routePlan.interceptBlockId || null,
                    defenseAllocation: routePlan.defenseAllocation,
                    status: TRIAL_BATTLE_STATUSES.PENDING
                });
            }
        }

        // 2. Commit resource consumption
        const defenseToCommit = Number(plan.totalDefenseAllocated) || 0;
        this.state.human.availableDefense -= defenseToCommit;

        // 3. Establish activation state
        this.state.planActivated = true;
        this.state.battleQueue = battleQueue;
        this.state.currentBattleIndex = null;
        this.state.battleResults = null;

        // 4. Emit exactly 1 GameFact
        const factPayload = {
            totalDefenseCommitted: defenseToCommit,
            battleCount: battleQueue.length,
            routeIds: battleQueue.map(b => b.routeId)
        };
        this.gameFactHub.emit(GAME_FACT_TYPES.TRIAL_PLAN_ACTIVATED, factPayload);

        return {
            success: true,
            battleQueue: JSON.parse(JSON.stringify(battleQueue)),
            totalDefenseCommitted: defenseToCommit
        };
    }

    getCurrentBattle() {
        return this.sequenceService.getCurrentBattle(this.state);
    }

    isCurrentBattleResolved() {
        const current = this.getCurrentBattle();
        return Boolean(current && current.status === TRIAL_BATTLE_STATUSES.RESOLVED);
    }

    getCurrentBattleResult() {
        return this.state ? this.state.getCurrentBattleResult() : null;
    }

    getBattleResults() {
        return this.state ? this.state.getBattleResults() : null;
    }

    startNextBattle() {
        const startResult = this.sequenceService.startNextBattle(this.state);
        if (!startResult.success) {
            return startResult;
        }

        // Emit GameFact
        const factPayload = {
            battleIndex: startResult.battleIndex,
            routeId: startResult.currentBattle.routeId,
            interceptCell: { r: startResult.currentBattle.interceptCell.r, c: startResult.currentBattle.interceptCell.c },
            defenseAllocation: startResult.currentBattle.defenseAllocation
        };
        this.gameFactHub.emit(GAME_FACT_TYPES.TRIAL_BATTLE_STARTED, factPayload);

        return startResult;
    }

    resolveCurrentBattle() {
        if (!this.state) {
            return { success: false, errors: ["TRIAL_NOT_STARTED"] };
        }
        if (!this.state.planActivated) {
            return { success: false, errors: [TRIAL_PLAN_REASONS.PLAN_NOT_ACTIVATED] };
        }
        if (this.state.currentBattleIndex === null) {
            return { success: false, errors: [TRIAL_PLAN_REASONS.NO_ACTIVE_BATTLE] };
        }
        if (!Array.isArray(this.state.battleQueue)) {
            return { success: false, errors: [TRIAL_PLAN_REASONS.NO_CONFIRMED_PLAN] };
        }

        const currentBattle = this.state.battleQueue[this.state.currentBattleIndex];
        if (!currentBattle || typeof currentBattle !== "object") {
            return { success: false, errors: [TRIAL_PLAN_REASONS.INVALID_CURRENT_BATTLE] };
        }
        if (currentBattle.status === TRIAL_BATTLE_STATUSES.RESOLVED) {
            return { success: false, errors: [TRIAL_PLAN_REASONS.BATTLE_ALREADY_RESOLVED] };
        }
        if (currentBattle.status !== TRIAL_BATTLE_STATUSES.ACTIVE) {
            return { success: false, errors: [TRIAL_PLAN_REASONS.NO_ACTIVE_BATTLE] };
        }

        // 1. Build combat input from current battle snapshot
        const interceptionInput = this.createRouteInterceptionInput(
            currentBattle.routeId,
            currentBattle.interceptCell,
            currentBattle.defenseAllocation
        );
        if (!interceptionInput.success) {
            return { success: false, errors: [interceptionInput.reason || TRIAL_PLAN_REASONS.INVALID_CURRENT_BATTLE] };
        }

        // 2. Resolve combat via CombatResolver
        const context = this.createBattleContext({
            ...interceptionInput.input,
            skipAvailableCheck: true
        });
        const combatResult = this.combatResolver.resolve(context);
        if (!combatResult.success) {
            return { success: false, errors: [combatResult.reason || "COMBAT_RESOLUTION_FAILED"] };
        }

        // 3. Complete current battle state via sequenceService
        const completionResult = this.sequenceService.completeCurrentBattle(this.state, combatResult);
        if (!completionResult.success) {
            return completionResult;
        }

        // 4. Emit exactly 1 GameFact
        const factPayload = {
            battleIndex: this.state.currentBattleIndex,
            routeId: currentBattle.routeId,
            interceptCell: { r: currentBattle.interceptCell.r, c: currentBattle.interceptCell.c },
            outcome: combatResult.prediction.outcome,
            playerActualPower: combatResult.human.finalPower,
            enemyActualPower: combatResult.enemy.finalPower,
            margin: combatResult.prediction.margin
        };
        this.gameFactHub.emit(GAME_FACT_TYPES.TRIAL_BATTLE_RESOLVED, factPayload);

        return {
            success: true,
            battleIndex: this.state.currentBattleIndex,
            combatResult: completionResult.battleResult
        };
    }

    advanceAfterCurrentBattle() {
        if (!this.state) {
            return { success: false, errors: ["TRIAL_NOT_STARTED"] };
        }
        if (!this.state.planActivated) {
            return { success: false, errors: [TRIAL_PLAN_REASONS.PLAN_NOT_ACTIVATED] };
        }
        if (this.state.currentBattleIndex === null) {
            return { success: false, errors: [TRIAL_PLAN_REASONS.NO_ACTIVE_BATTLE] };
        }

        const advanceResult = this.enemyAdvanceService.advanceAfterBattle(this.state);
        if (!advanceResult.success) {
            return advanceResult;
        }

        // Emit exactly 1 GameFact
        this.gameFactHub.emit(GAME_FACT_TYPES.TRIAL_TRAVERSAL_RESOLVED, advanceResult.traversalResult);

        return advanceResult;
    }

    getCurrentTraversalResult() {
        return this.state ? this.state.getCurrentTraversalResult() : null;
    }

    getRouteProgress(routeId) {
        return this.state ? this.state.getRouteProgress(routeId) : null;
    }

    isCurrentTraversalApplied() {
        return this.state ? this.state.isCurrentTraversalApplied() : false;
    }

    transitionAfterCurrentBattle() {
        if (!this.state) {
            return { success: false, errors: ["TRIAL_NOT_STARTED"] };
        }
        if (!this.state.planActivated) {
            return { success: false, errors: [TRIAL_PLAN_REASONS.PLAN_NOT_ACTIVATED] };
        }
        if (this.state.currentBattleIndex === null) {
            return { success: false, errors: [TRIAL_PLAN_REASONS.NO_ACTIVE_BATTLE] };
        }

        const transitionResult = this.sequenceService.transitionAfterTraversal(this.state);
        if (!transitionResult.success) {
            return transitionResult;
        }

        // Emit exactly 1 GameFact
        this.gameFactHub.emit(GAME_FACT_TYPES.TRIAL_BATTLE_SEQUENCE_ADVANCED, transitionResult.transitionResult);

        return transitionResult;
    }

    isCurrentBattleSequenceAdvanced() {
        const battle = this.getCurrentBattle();
        return Boolean(battle?.sequenceAdvanced);
    }

    resolveRouteEndDamage(targetBattleIndex = null) {
        if (!this.state) {
            return { success: false, errors: ["TRIAL_NOT_STARTED"] };
        }
        if (!this.state.planActivated) {
            return { success: false, errors: [TRIAL_PLAN_REASONS.PLAN_NOT_ACTIVATED] };
        }

        let battleIndex = null;
        if (typeof targetBattleIndex === "number") {
            battleIndex = targetBattleIndex;
        } else if (this.state.currentBattleIndex !== null) {
            battleIndex = this.state.currentBattleIndex;
        } else if (Array.isArray(this.state.traversalResults)) {
            const foundIndex = this.state.traversalResults.findIndex(
                (t, idx) => t && t.reachedRouteEnd && !t.damageApplied && (!this.state.damageResults || !this.state.damageResults[idx])
            );
            if (foundIndex !== -1) {
                battleIndex = foundIndex;
            }
        }

        if (battleIndex === null || typeof battleIndex !== "number") {
            return { success: false, errors: [TRIAL_PLAN_REASONS.NO_ROUTE_END_DAMAGE] };
        }

        const traversalResult = Array.isArray(this.state.traversalResults) ? this.state.traversalResults[battleIndex] : null;
        if (!traversalResult || !traversalResult.reachedRouteEnd) {
            return { success: false, errors: [TRIAL_PLAN_REASONS.NO_ROUTE_END_DAMAGE] };
        }

        if (traversalResult.damageApplied || (Array.isArray(this.state.damageResults) && this.state.damageResults[battleIndex])) {
            return { success: false, errors: [TRIAL_PLAN_REASONS.DAMAGE_ALREADY_APPLIED] };
        }

        const battleResult = Array.isArray(this.state.battleResults) ? this.state.battleResults[battleIndex] : null;
        if (!battleResult) {
            return { success: false, errors: [TRIAL_PLAN_REASONS.INVALID_DAMAGE_SOURCE] };
        }

        const currentEmber = (this.emberSystem && typeof this.emberSystem.current === "number")
            ? this.emberSystem.current
            : (this.state.human?.ember ?? this.state.ember ?? 20);

        const calculation = this.damageResolver.resolve({
            battleIndex,
            routeId: traversalResult.routeId,
            traversalResult,
            battleResult,
            emberBefore: currentEmber
        });

        if (!calculation.success) {
            return calculation;
        }

        const damageResult = calculation.damageResult;

        // Formal State commit
        traversalResult.damageApplied = true;
        traversalResult.damage = JSON.parse(JSON.stringify(damageResult));

        if (Array.isArray(this.state.battleQueue) && this.state.battleQueue[battleIndex]) {
            this.state.battleQueue[battleIndex].damageApplied = true;
            this.state.battleQueue[battleIndex].damage = JSON.parse(JSON.stringify(damageResult));
        }

        if (!Array.isArray(this.state.damageResults)) {
            this.state.damageResults = [];
        }
        this.state.damageResults[battleIndex] = JSON.parse(JSON.stringify(damageResult));

        // Commit to Ember
        if (this.emberSystem && typeof this.emberSystem.applyDamage === "function") {
            this.emberSystem.applyDamage(damageResult.emberDamage);
        }
        if (this.state.human) {
            this.state.human.ember = damageResult.emberAfter;
        }
        this.state.ember = damageResult.emberAfter;

        // Emit exactly 1 GameFact
        this.gameFactHub.emit(GAME_FACT_TYPES.TRIAL_HQ_DAMAGE_RESOLVED, damageResult);

        return {
            success: true,
            battleIndex,
            damageResult: JSON.parse(JSON.stringify(damageResult))
        };
    }

    getCurrentDamageResult() {
        return this.state ? this.state.getCurrentDamageResult() : null;
    }

    getDamageResult(battleIndex) {
        return this.state ? this.state.getDamageResult(battleIndex) : null;
    }

    isDamageApplied(battleIndex) {
        if (!this.state || !Array.isArray(this.state.damageResults)) return false;
        return Boolean(this.state.damageResults[battleIndex]?.damageApplied);
    }

    createBattleContext(input) {
        if (!this.state) throw new Error("TRIAL_NOT_STARTED");
        const allocatedDefense = Math.max(0, Number(input.allocatedDefense) || 0);
        if (!input.skipAvailableCheck && !this.state.planActivated && allocatedDefense > this.state.human.availableDefense) {
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

    canCompleteTrial() {
        if (!this.state) return false;
        const validation = this.completionService.validateCompletion(this.state);
        return Boolean(validation.success);
    }

    completeTrial() {
        if (!this.state) {
            return { success: false, errors: ["TRIAL_NOT_STARTED"] };
        }

        const validation = this.completionService.validateCompletion(this.state);
        if (!validation.success) {
            return { success: false, errors: [validation.reason || "COMPLETION_VALIDATION_FAILED"] };
        }

        const completionResult = this.completionService.buildCompletionResult(this.state);

        // Advance flow to RESULT phase cleanly
        if (this.state.phase === TRIAL_PHASES.SETUP) {
            this.flow.advance(this.state); // -> DEPLOYMENT
        }
        if (this.state.phase === TRIAL_PHASES.DEPLOYMENT) {
            this.flow.advance(this.state); // -> BATTLE
        }
        if (this.state.phase === TRIAL_PHASES.BATTLE) {
            this.flow.advance(this.state); // -> RESULT
        } else if (this.state.phase !== TRIAL_PHASES.RESULT) {
            this.state.phase = TRIAL_PHASES.RESULT;
        }

        this.state.trialCompleted = true;
        this.state.result = JSON.parse(JSON.stringify(completionResult));

        // Emit exactly 1 GameFact
        this.gameFactHub.emit(GAME_FACT_TYPES.TRIAL_COMPLETED, completionResult);

        return {
            success: true,
            result: JSON.parse(JSON.stringify(completionResult))
        };
    }

    isTrialCompleted() {
        return Boolean(this.state && this.state.isTrialCompleted());
    }

    getTrialResult() {
        return this.state ? this.state.getTrialResult() : null;
    }
}
