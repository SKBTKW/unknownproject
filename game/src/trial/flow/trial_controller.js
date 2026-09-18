import { TrialController as TrialControllerBase } from "./trial_controller_base.js";
import { GAME_FACT_TYPES } from "../../core/game_fact.js";
import { TRIAL_PLAN_REASONS } from "../domain/trial_types.js";
import { TrialHqResolutionService } from "../systems/trial_hq_resolution_service.js";
import { TrialResultSettlementService } from "../systems/trial_result_settlement_service.js";
import { EnemyForceTerrainInteractionResolver } from "../systems/enemy_force_terrain_interaction_resolver.js";
import { EnemyForceDeploymentResolver } from "../systems/enemy_force_deployment_resolver.js";
import { EnemyTacticResolver } from "../systems/enemy_tactic_resolver.js";
import { EnemyTacticSelectionResolver } from "../systems/enemy_tactic_selection_resolver.js";
import { TrialLifecycleReadService } from "../read/trial_lifecycle_read_service.js";

function resolveTerrainId(cell) {
    const terrain = cell?.terrain || cell || {};
    return terrain.terrainId || terrain.id || cell?.terrainId || null;
}

function resolveForceProfile(route) {
    const profile = route?.forceProfile || route?.profile || null;
    return {
        ...(profile && typeof profile === "object" ? JSON.parse(JSON.stringify(profile)) : {}),
        bodySize: profile?.bodySize || route?.bodySize || "MEDIUM",
        equipment: profile?.equipment || route?.equipment || ["STANDARD"]
    };
}

export class TrialController extends TrialControllerBase {
    constructor(options = {}) {
        super(options);
        this.hqResolutionService = options.hqResolutionService || new TrialHqResolutionService({
            damageResolver: this.damageResolver,
            powerResolver: this.powerResolver
        });
        this.resultSettlementService = options.resultSettlementService || new TrialResultSettlementService();
        this.forceTerrainInteractionResolver = options.forceTerrainInteractionResolver
            || new EnemyForceTerrainInteractionResolver();
        this.forceDeploymentResolver = options.forceDeploymentResolver
            || new EnemyForceDeploymentResolver();
        this.enemyTacticResolver = options.enemyTacticResolver || new EnemyTacticResolver({
            interactionResolver: this.forceTerrainInteractionResolver
        });
        this.enemyTacticSelectionResolver = options.enemyTacticSelectionResolver
            || new EnemyTacticSelectionResolver();
        this.lifecycleReadService = options.lifecycleReadService || new TrialLifecycleReadService();
    }

    createRouteInterceptionInput(routeId, interceptCell, allocatedDefense = 0) {
        const resolved = super.createRouteInterceptionInput(routeId, interceptCell, allocatedDefense);
        if (!resolved.success) return resolved;

        const route = this.getRoute(routeId);
        const strategicSuppression = Number(route?.strategicSuppression);
        if (Number.isFinite(strategicSuppression) && strategicSuppression >= 0) {
            const profile = resolveForceProfile(route);
            const terrainId = resolveTerrainId(resolved.input.interceptCell);
            const interaction = this.forceTerrainInteractionResolver.resolve({
                bodySize: profile.bodySize,
                equipment: profile.equipment,
                terrainId
            });
            const deployment = this.forceDeploymentResolver.resolve({
                forceSuppression: strategicSuppression,
                interaction
            });
            const tacticResolution = this.enemyTacticResolver.resolve({
                terrainId,
                force: {
                    id: route?.forceId || null,
                    commander: route?.commander || null,
                    profile
                },
                armyStructure: this.state?.armyStructure || {
                    commander: this.state?.commander || null,
                    forces: this.state?.forces || [],
                    forceCount: Array.isArray(this.state?.forces) ? this.state.forces.length : 0
                }
            });
            const tacticSelection = this.enemyTacticSelectionResolver.resolve(tacticResolution);

            resolved.input.enemySuppression = this.powerResolver.resolveSuppression(
                deployment.deployedSuppression
            );
            resolved.input.enemyStrategicSuppression = strategicSuppression;
            resolved.input.enemyReserveSuppression = this.powerResolver.resolveSuppression(
                deployment.reserveSuppression
            );
            resolved.input.enemyDeployment = {
                profile,
                interaction,
                deployment,
                tactics: tacticResolution.tactics,
                selectedTactic: tacticSelection.selectedTactic,
                tacticAlternatives: tacticSelection.alternatives,
                tacticSelectionReason: tacticSelection.selectionReason
            };
            resolved.input.enemyTactics = tacticResolution.tactics;
            resolved.input.enemySelectedTactic = tacticSelection.selectedTactic;
        }
        return resolved;
    }

    resolveRouteEndDamage(targetBattleIndex = null) {
        if (!this.state) return { success: false, errors: ["TRIAL_NOT_STARTED"] };
        if (!this.state.planActivated) return { success: false, errors: [TRIAL_PLAN_REASONS.PLAN_NOT_ACTIVATED] };

        let battleIndex = null;
        if (typeof targetBattleIndex === "number") {
            battleIndex = targetBattleIndex;
        } else if (this.state.currentBattleIndex !== null) {
            battleIndex = this.state.currentBattleIndex;
        } else if (Array.isArray(this.state.traversalResults)) {
            const foundIndex = this.state.traversalResults.findIndex(t => t?.reachedRouteEnd);
            if (foundIndex !== -1) battleIndex = foundIndex;
        }

        if (battleIndex === null || typeof battleIndex !== "number") {
            return { success: false, errors: [TRIAL_PLAN_REASONS.NO_ROUTE_END_DAMAGE] };
        }
        const traversalResult = Array.isArray(this.state.traversalResults)
            ? this.state.traversalResults[battleIndex]
            : null;
        if (!traversalResult?.reachedRouteEnd) {
            return { success: false, errors: [TRIAL_PLAN_REASONS.NO_ROUTE_END_DAMAGE] };
        }

        return {
            success: true,
            battleIndex,
            routeId: traversalResult.routeId,
            arrivalRecorded: true,
            pendingAggregation: true
        };
    }

    resolveAggregatedHqDamage() {
        if (!this.state) return { success: false, errors: ["TRIAL_NOT_STARTED"] };

        const currentEmber = (this.emberSystem && typeof this.emberSystem.current === "number")
            ? this.emberSystem.current
            : (this.state.human?.ember ?? this.state.ember ?? 20);

        const resolved = this.hqResolutionService.resolve(this.state, { emberBefore: currentEmber });
        if (!resolved.success) return resolved;

        const damageResult = resolved.damageResult;
        if (this.emberSystem && typeof this.emberSystem.applyDamage === "function") {
            this.emberSystem.applyDamage(damageResult.emberDamage);
        }
        if (this.state.human) this.state.human.ember = damageResult.emberAfter;
        this.state.ember = damageResult.emberAfter;

        this.gameFactHub.emit(GAME_FACT_TYPES.TRIAL_HQ_DAMAGE_RESOLVED, damageResult);

        return {
            success: true,
            damageResult: JSON.parse(JSON.stringify(damageResult)),
            runTermination: this.emberSystem?.engine?.runTerminationService?.getResult?.() || null
        };
    }

    canCompleteTrial() {
        if (!this.state) return false;
        if (this.state.hqDamageResolution?.damageApplied) return super.canCompleteTrial();
        return this.hqResolutionService.canResolve(this.state);
    }

    completeTrial() {
        if (!this.state) return { success: false, errors: ["TRIAL_NOT_STARTED"] };

        let hqResolution = null;
        if (!this.state.hqDamageResolution?.damageApplied) {
            hqResolution = this.resolveAggregatedHqDamage();
            if (!hqResolution.success) return hqResolution;
        }

        const completion = super.completeTrial();
        if (!completion.success) return completion;

        return {
            ...completion,
            hqDamage: JSON.parse(JSON.stringify(this.state.hqDamageResolution)),
            runTermination: hqResolution?.runTermination
                || this.emberSystem?.engine?.runTerminationService?.getResult?.()
                || null,
            lifecycle: this.getLifecycleReadModel()
        };
    }

    settleTrialResult() {
        if (!this.state) return { success: false, errors: ["TRIAL_NOT_STARTED"] };

        const engine = this.emberSystem?.engine || null;
        const settlementTurn = Number.isInteger(engine?.state?.turn)
            ? engine.state.turn
            : null;
        const settled = this.resultSettlementService.settle(this.state, {
            runTerminationService: engine?.runTerminationService || null,
            chronicleSystem: engine?.chronicleSystem || null,
            turn: settlementTurn
        });
        if (!settled.success) return settled;
        if (settled.alreadySettled) {
            return {
                ...settled,
                lifecycle: this.getLifecycleReadModel()
            };
        }

        this.gameFactHub.emit(GAME_FACT_TYPES.TRIAL_RESULT_SETTLED, {
            scenarioId: this.state.scenarioId || null,
            trialIndex: this.state.trialIndex,
            turn: settlementTurn,
            outcome: this.state.result?.outcome || null,
            result: this.state.result ? JSON.parse(JSON.stringify(this.state.result)) : null,
            settlement: settled.settlement
        });

        if (settled.settlement?.canExitTrial) {
            this.gameFactHub.emit(GAME_FACT_TYPES.TRIAL_EXIT_READY, {
                scenarioId: this.state.scenarioId || null,
                outcome: this.state.result?.outcome || null,
                runTerminated: Boolean(settled.runTermination?.terminated)
            });
        }

        return {
            ...settled,
            lifecycle: this.getLifecycleReadModel()
        };
    }

    getLifecycleReadModel() {
        const runTermination = this.emberSystem?.engine?.runTerminationService?.getResult?.() || null;
        return this.lifecycleReadService.read(this.state, { runTermination });
    }
}

export default TrialController;
