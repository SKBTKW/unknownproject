import { TrialDeploymentCostPolicy } from "../domain/trial_deployment_cost_policy.js";
import { createTrialDeploymentCostResolver } from "../domain/trial_deployment_cost_resolver.js";
import { DeploymentOriginResolver } from "../domain/deployment_origin_resolver.js";
import { TrialDeploymentService } from "../systems/trial_deployment_service.js";
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
    const resolvedCostResolver = typeof costResolver === "function"
        ? costResolver
        : createTrialDeploymentCostResolver(costProfile);
    if (typeof resolvedCostResolver !== "function") {
        return { success: false, reason: "TRIAL_DEPLOYMENT_COST_POLICY_UNRESOLVED" };
    }

    const resourcePayment = new TrialResourcePayment({ state: engine.state });
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
        resourcePayment
    });

    engine.trialDeploymentResourcePayment = resourcePayment;
    engine.trialDeploymentCostPolicy = costPolicy;
    engine.trialDeploymentOriginResolver = originResolver;
    engine.trialDeploymentService = deploymentService;

    return {
        success: true,
        resourcePayment,
        costPolicy,
        originResolver,
        deploymentService
    };
}

export default attachTrialDeploymentEconomy;
