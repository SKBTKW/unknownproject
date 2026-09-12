import { TrialController as TrialControllerBase } from "./trial_controller_base.js";
import { GAME_FACT_TYPES } from "../../core/game_fact.js";
import { TRIAL_PLAN_REASONS } from "../domain/trial_types.js";
import { TrialHqResolutionService } from "../systems/trial_hq_resolution_service.js";

export class TrialController extends TrialControllerBase {
    constructor(options = {}) {
        super(options);
        this.hqResolutionService = options.hqResolutionService || new TrialHqResolutionService({
            damageResolver: this.damageResolver
        });
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
        if (!this.state) {
            return { success: false, errors: ["TRIAL_NOT_STARTED"] };
        }

        const currentEmber = (this.emberSystem && typeof this.emberSystem.current === "number")
            ? this.emberSystem.current
            : (this.state.human?.ember ?? this.state.ember ?? 20);

        const resolved = this.hqResolutionService.resolve(this.state, {
            emberBefore: currentEmber
        });
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
        if (this.state.hqDamageResolution?.damageApplied) {
            return super.canCompleteTrial();
        }
        return this.hqResolutionService.canResolve(this.state);
    }

    completeTrial() {
        if (!this.state) {
            return { success: false, errors: ["TRIAL_NOT_STARTED"] };
        }

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
                || null
        };
    }
}

export default TrialController;
