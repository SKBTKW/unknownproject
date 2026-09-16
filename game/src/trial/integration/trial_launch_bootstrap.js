import { TrialIngressResolver } from "../scenario/trial_ingress_resolver.js";
import { TrialIngressSelectionPolicy } from "../scenario/trial_ingress_selection_policy.js";
import { TrialRouteGenerator } from "../scenario/trial_route_generator.js";
import { TrialScenarioFactory } from "../scenario/trial_scenario_factory.js";
import { TrialLaunchCoordinator } from "./trial_launch_coordinator.js";

function hasFunction(value) {
    return typeof value === "function";
}

/**
 * Presentation composition boundary for production Trial launch.
 *
 * Balance-sensitive policies deliberately have no fallback values here.
 * Until threat/truth, ingress count, and movement cost rules are explicitly
 * supplied by production composition, this function refuses to attach rather
 * than silently creating a zero-threat or arbitrary-route Trial.
 */
export function attachTrialLaunchSubsystem(engine, ui, {
    enemyTruthReadModel = null,
    ingressCountResolver = null,
    routeCostResolver = null,
    ingressSelectionPolicy = null,
    ingressResolver = null,
    routeGenerator = null,
    scenarioFactory = null,
    isTrialActive = null,
    isPresentationBlocked = null
} = {}) {
    if (!engine?.state || !ui || !hasFunction(ui.startTrialSession)) {
        return { success: false, reason: "TRIAL_LAUNCH_PRESENTATION_REQUIRED" };
    }
    if (!engine.trialDueStateService) {
        return { success: false, reason: "TRIAL_LAUNCH_DUE_STATE_REQUIRED" };
    }

    const truthReadModel = enemyTruthReadModel || engine.enemyTruthReadModel || null;
    if (!truthReadModel || !hasFunction(truthReadModel.getSnapshot)) {
        return { success: false, reason: "TRIAL_LAUNCH_ENEMY_TRUTH_REQUIRED" };
    }

    let resolvedIngressResolver = ingressResolver;
    if (!resolvedIngressResolver) {
        let selectionPolicy = ingressSelectionPolicy;
        if (!selectionPolicy) {
            if (!hasFunction(ingressCountResolver)) {
                return { success: false, reason: "TRIAL_LAUNCH_INGRESS_COUNT_POLICY_REQUIRED" };
            }
            selectionPolicy = new TrialIngressSelectionPolicy({
                countResolver: ingressCountResolver,
                randomService: engine.gameplayRandom || null
            });
        }
        resolvedIngressResolver = new TrialIngressResolver({
            selector: context => selectionPolicy.select(context)
        });
    }

    let resolvedRouteGenerator = routeGenerator;
    if (!resolvedRouteGenerator) {
        if (!hasFunction(routeCostResolver)) {
            return { success: false, reason: "TRIAL_LAUNCH_ROUTE_COST_POLICY_REQUIRED" };
        }
        resolvedRouteGenerator = new TrialRouteGenerator({
            costResolver: routeCostResolver
        });
    }

    const resolvedScenarioFactory = scenarioFactory || new TrialScenarioFactory({
        enemyTruthReadModel: truthReadModel,
        ingressResolver: resolvedIngressResolver,
        routeGenerator: resolvedRouteGenerator
    });

    // TrialController keeps state through RESULT/settlement until the session is
    // explicitly released. Any existing state therefore blocks a new launch.
    const activePredicate = isTrialActive || (() => Boolean(ui.trialController?.state));
    const blockedPredicate = isPresentationBlocked || (() => {
        const manager = engine.globalEventManager;
        return Boolean(manager?.active || manager?.getPendingChoice?.());
    });

    const coordinator = new TrialLaunchCoordinator({
        dueStateService: engine.trialDueStateService,
        enemyTruthReadModel: truthReadModel,
        scenarioFactory: resolvedScenarioFactory,
        startTrialSession: (scenario, options) => ui.startTrialSession(scenario, options),
        isTrialActive: activePredicate,
        isPresentationBlocked: blockedPredicate
    });

    engine.trialLaunchCoordinator = coordinator;
    return {
        success: true,
        coordinator,
        scenarioFactory: resolvedScenarioFactory,
        ingressResolver: resolvedIngressResolver,
        routeGenerator: resolvedRouteGenerator
    };
}

export default attachTrialLaunchSubsystem;
