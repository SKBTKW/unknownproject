import { TrialDeploymentCostPolicy } from "../domain/trial_deployment_cost_policy.js";
import { createTrialDeploymentCostResolver } from "../domain/trial_deployment_cost_resolver.js";
import { DeploymentOriginResolver } from "../domain/deployment_origin_resolver.js";
import { TrialDeploymentService } from "../systems/trial_deployment_service.js";
import { TrialDefenseReservation } from "../systems/trial_defense_reservation.js";
import { TrialResourcePayment } from "../systems/trial_resource_payment.js";

/**
 * Optional live composition boundary for deployment economy.
 *
 * Balance values remain caller-owned. The subsystem is attached only when a
 * costResolver is explicitly supplied; existing Trial behavior is therefore
 * unchanged while balance remains UNRESOLVED.
 */
export function attachTrialDeploymentEconomy(engine, {
    costResolver = null,
    costProfile = null,
    distanceResolver = null,
    originSelector = null
} = {}) {
    if (!engine?.state || !engine?.boardDomainAdapter) {
        return { success: false, reason: "TRIAL_DEPLOYMENT_ENGINE_BOUNDARIES_REQUIRED" };
    }
    if (
        typeof engine.getTrialAvailableDefense !== "function"
        || typeof engine.applyTrialDefenseLoss !== "function"
        || typeof engine.recoverCurrentDefense !== "function"
    ) {
        return { success: false, reason: "TRIAL_DEPLOYMENT_DEFENSE_BOUNDARY_REQUIRED" };
    }
    const resolvedCostResolver = typeof costResolver === "function"
        ? costResolver
        : createTrialDeploymentCostResolver(costProfile);
    if (typeof resolvedCostResolver !== "function") {
        return { success: false, reason: "TRIAL_DEPLOYMENT_COST_POLICY_UNRESOLVED" };
    }

    const resourcePayment = new TrialResourcePayment({ state: engine.state });
    const defenseReservation = engine.trialDefenseReservation || new TrialDefenseReservation({
        getAvailableDefense: () => engine.getTrialAvailableDefense(),
        applyDefenseLoss: amount => engine.applyTrialDefenseLoss(amount),
        recoverDefense: amount => engine.recoverCurrentDefense(amount)
    });
    engine.trialDefenseReservation = defenseReservation;
    const costPolicy = new TrialDeploymentCostPolicy({ costResolver: resolvedCostResolver });
    const originResolver = new DeploymentOriginResolver({
        boardQuery: engine.boardDomainAdapter,
        distanceResolver,
        originSelector
    });
    const deploymentService = new TrialDeploymentService({
        boardQuery: engine.boardDomainAdapter,
        costPolicy,
        originResolver,
        resourcePayment,
        defenseReservation
    });

    engine.trialDeploymentResourcePayment = resourcePayment;
    engine.trialDeploymentDefenseReservation = defenseReservation;
    engine.trialDeploymentCostPolicy = costPolicy;
    engine.trialDeploymentOriginResolver = originResolver;
    engine.trialDeploymentService = deploymentService;

    return {
        success: true,
        resourcePayment,
        defenseReservation,
        costPolicy,
        originResolver,
        deploymentService
    };
}

export default attachTrialDeploymentEconomy;
