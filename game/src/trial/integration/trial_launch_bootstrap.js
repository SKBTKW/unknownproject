import { TrialIngressResolver } from "../scenario/trial_ingress_resolver.js";
import { TrialIngressSelectionPolicy } from "../scenario/trial_ingress_selection_policy.js";
import { TrialIngressJudgementResolver } from "../scenario/trial_ingress_judgement_resolver.js";
import { TrialRouteGenerator } from "../scenario/trial_route_generator.js";
import { TrialRouteCostPolicy } from "../scenario/trial_route_cost_policy.js";
import { TrialRouteSuppressionAllocator } from "../scenario/trial_route_suppression_allocator.js";
import { TrialScenarioFactory } from "../scenario/trial_scenario_factory.js";
import { EnemyArmyStructureResolver } from "../systems/enemy_army_structure_resolver.js";
import { TrialLaunchCoordinator } from "./trial_launch_coordinator.js";

function hasFunction(value) {
    return typeof value === "function";
}

function attemptPendingTrialLaunch(engine, coordinator) {
    if (!coordinator || !hasFunction(coordinator.tryStartPending)) {
        return { started: false, reason: "TRIAL_LAUNCH_COORDINATOR_UNAVAILABLE" };
    }

    let result;
    try {
        result = coordinator.tryStartPending({ gameState: engine?.state || null });
    } catch (error) {
        result = {
            started: false,
            reason: "TRIAL_LAUNCH_UNEXPECTED_ERROR",
            errorMessage: error?.message || String(error)
        };
    }
    if (engine) engine.lastTrialLaunchAttempt = result;
    return result;
}

/**
 * Presentation composition boundary for production Trial launch.
 *
 * Enemy army scale/route count/commander hierarchy are derived from
 * strategicSuppression. Production route costs now have a canonical default
 * policy that accounts for terrain, body size, equipment and terrain affinity.
 * Road effects remain opt-in until GameState owns a canonical road model.
 */
export function attachTrialLaunchSubsystem(engine, ui, {
    enemyTruthReadModel = null,
    ingressCountResolver = null,
    routeCostResolver = null,
    routeCostPolicy = null,
    roadResolver = null,
    armyStructureResolver = null,
    ingressJudgementResolver = null,
    ingressSelectionPolicy = null,
    ingressResolver = null,
    routeGenerator = null,
    suppressionAllocator = null,
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

    if (engine.__trialLaunchSubsystemAttached && engine.trialLaunchCoordinator) {
        if (!hasFunction(engine.retryPendingTrialLaunch)) {
            engine.retryPendingTrialLaunch = () => attemptPendingTrialLaunch(
                engine,
                engine.trialLaunchCoordinator
            );
        }
        return {
            success: true,
            alreadyAttached: true,
            coordinator: engine.trialLaunchCoordinator,
            scenarioFactory: engine.trialLaunchScenarioFactory || null,
            ingressResolver: engine.trialLaunchIngressResolver || null,
            routeGenerator: engine.trialLaunchRouteGenerator || null,
            routeCostPolicy: engine.trialLaunchRouteCostPolicy || null,
            armyStructureResolver: engine.trialLaunchArmyStructureResolver || null,
            suppressionAllocator: engine.trialLaunchSuppressionAllocator || null,
            retryPendingTrialLaunch: engine.retryPendingTrialLaunch
        };
    }

    const truthReadModel = enemyTruthReadModel || engine.enemyTruthReadModel || null;
    if (!truthReadModel || !hasFunction(truthReadModel.getSnapshot)) {
        return { success: false, reason: "TRIAL_LAUNCH_ENEMY_TRUTH_REQUIRED" };
    }

    const resolvedArmyStructureResolver = armyStructureResolver || new EnemyArmyStructureResolver();
    const resolvedIngressJudgementResolver = ingressJudgementResolver || new TrialIngressJudgementResolver();

    let resolvedIngressResolver = ingressResolver;
    if (!resolvedIngressResolver) {
        const selectionPolicy = ingressSelectionPolicy || new TrialIngressSelectionPolicy({
            // countResolver is retained only as legacy/dev fallback. Production
            // count comes from armyStructure.routeCount (= forceCount).
            countResolver: ingressCountResolver,
            armyStructureResolver: resolvedArmyStructureResolver,
            ingressScoreResolver: context => resolvedIngressJudgementResolver.resolve(context),
            randomService: engine.gameplayRandom || null
        });
        resolvedIngressResolver = new TrialIngressResolver({
            selector: context => selectionPolicy.select(context)
        });
    }

    let resolvedRouteCostPolicy = routeCostPolicy;
    let resolvedRouteCostResolver = routeCostResolver;
    if (!hasFunction(resolvedRouteCostResolver)) {
        resolvedRouteCostPolicy = resolvedRouteCostPolicy || new TrialRouteCostPolicy({ roadResolver });
        resolvedRouteCostResolver = context => resolvedRouteCostPolicy.resolve(context);
    }

    let resolvedRouteGenerator = routeGenerator;
    if (!resolvedRouteGenerator) {
        resolvedRouteGenerator = new TrialRouteGenerator({
            costResolver: resolvedRouteCostResolver
        });
    }

    const resolvedSuppressionAllocator = suppressionAllocator || new TrialRouteSuppressionAllocator();
    const resolvedScenarioFactory = scenarioFactory || new TrialScenarioFactory({
        enemyTruthReadModel: truthReadModel,
        armyStructureResolver: resolvedArmyStructureResolver,
        ingressResolver: resolvedIngressResolver,
        routeGenerator: resolvedRouteGenerator,
        suppressionAllocator: resolvedSuppressionAllocator
    });

    // TrialController keeps state through RESULT/settlement until the session is
    // explicitly released. Any existing state therefore blocks a new launch.
    const activePredicate = isTrialActive || (() => Boolean(ui.trialController?.state));

    // Current GlobalEventManager exposes unresolved choice ownership through
    // getPendingChoice(). Ordinary active timed events do not own presentation
    // and therefore must not block Trial launch. Result presentation remains
    // responsible for delaying retries until its UI is explicitly dismissed.
    const blockedPredicate = isPresentationBlocked || (() => Boolean(
        engine.globalEventManager?.getPendingChoice?.()
    ));

    const coordinator = new TrialLaunchCoordinator({
        dueStateService: engine.trialDueStateService,
        enemyTruthReadModel: truthReadModel,
        scenarioFactory: resolvedScenarioFactory,
        startTrialSession: (scenario, options) => ui.startTrialSession(scenario, options),
        isTrialActive: activePredicate,
        isPresentationBlocked: blockedPredicate
    });

    engine.trialLaunchCoordinator = coordinator;
    engine.trialLaunchScenarioFactory = resolvedScenarioFactory;
    engine.trialLaunchIngressResolver = resolvedIngressResolver;
    engine.trialLaunchRouteGenerator = resolvedRouteGenerator;
    engine.trialLaunchRouteCostPolicy = resolvedRouteCostPolicy || null;
    engine.trialLaunchArmyStructureResolver = resolvedArmyStructureResolver;
    engine.trialLaunchSuppressionAllocator = resolvedSuppressionAllocator;
    engine.retryPendingTrialLaunch = () => attemptPendingTrialLaunch(engine, coordinator);
    engine.__trialLaunchSubsystemAttached = true;

    return {
        success: true,
        coordinator,
        scenarioFactory: resolvedScenarioFactory,
        ingressResolver: resolvedIngressResolver,
        routeGenerator: resolvedRouteGenerator,
        routeCostPolicy: resolvedRouteCostPolicy || null,
        armyStructureResolver: resolvedArmyStructureResolver,
        suppressionAllocator: resolvedSuppressionAllocator,
        retryPendingTrialLaunch: engine.retryPendingTrialLaunch
    };
}

export default attachTrialLaunchSubsystem;
