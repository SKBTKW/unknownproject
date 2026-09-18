import { CivilizationDevelopmentSnapshotService } from "../systems/civilization_development_snapshot_service.js";
import { TrialThreatResolver } from "../systems/trial_threat_resolver.js";
import {
    TRIAL_SCENARIO_BUILD_REASONS,
    validateTrialScenarioBuildInput
} from "./trial_scenario_contract.js";

function cloneData(value) {
    if (value === undefined) return undefined;
    return JSON.parse(JSON.stringify(value));
}

function nonNegativeFinite(value) {
    const num = Number(value);
    return Number.isFinite(num) && num >= 0 ? num : null;
}

function resolveHumanSnapshot(gameState) {
    const availableDefense = nonNegativeFinite(gameState?.currentDefense);
    const ember = nonNegativeFinite(gameState?.ember);
    const maxEmber = nonNegativeFinite(gameState?.maxEmber);
    const mystic = nonNegativeFinite(gameState?.mystic);

    if (
        availableDefense === null ||
        ember === null ||
        maxEmber === null ||
        maxEmber < 1 ||
        mystic === null
    ) {
        return null;
    }

    return {
        availableDefense,
        ember,
        maxEmber,
        mystic
    };
}

/**
 * 通常GameStateからTrialState互換scenarioを構築する境界。
 *
 * EnemyTruthReadModelが与えられた場合、敵戦力/編成はTruth snapshotを正本にする。
 * 未接続の旧診断・開発ハーネスのみ、従来のThreat直接解決へfallbackできる。
 * Warning/Intelは入力に要求しない。
 */
export class TrialScenarioFactory {
    constructor({
        developmentSnapshotService = new CivilizationDevelopmentSnapshotService(),
        threatResolver = new TrialThreatResolver(),
        enemyTruthReadModel = null,
        armyStructureResolver = null,
        ingressResolver = null,
        routeGenerator = null,
        suppressionAllocator = null,
        commanderResolver = null,
        forcesResolver = null,
        environmentResolver = null
    } = {}) {
        this.developmentSnapshotService = developmentSnapshotService;
        this.threatResolver = threatResolver;
        this.enemyTruthReadModel = enemyTruthReadModel;
        this.armyStructureResolver = armyStructureResolver;
        this.ingressResolver = ingressResolver;
        this.routeGenerator = routeGenerator;
        this.suppressionAllocator = suppressionAllocator;
        this.commanderResolver = commanderResolver;
        this.forcesResolver = forcesResolver;
        this.environmentResolver = environmentResolver;
    }

    build({ trialIndex, gameState, enemyTruth = null } = {}) {
        const input = validateTrialScenarioBuildInput({ trialIndex, gameState });
        if (!input.valid) {
            return { success: false, errors: input.errors };
        }

        const development = this.developmentSnapshotService.capture(gameState);
        const truth = cloneData(enemyTruth || this.enemyTruthReadModel?.getSnapshot?.() || null);
        const threat = truth
            ? { strategicSuppression: truth.strategicSuppression, source: "ENEMY_TRUTH" }
            : this.threatResolver?.resolve?.({ trialIndex, development });
        const enemySuppression = nonNegativeFinite(threat?.strategicSuppression);
        if (enemySuppression === null) {
            return { success: false, errors: [TRIAL_SCENARIO_BUILD_REASONS.THREAT_UNRESOLVED] };
        }

        const armyStructure = cloneData(
            truth?.armyStructure
            ?? this.armyStructureResolver?.resolve?.({
                strategicSuppression: enemySuppression,
                trialIndex,
                enemyTruth: truth,
                gameState
            })
            ?? null
        );

        if (!this.ingressResolver || typeof this.ingressResolver.resolve !== "function") {
            return { success: false, errors: [TRIAL_SCENARIO_BUILD_REASONS.INGRESS_RESOLVER_REQUIRED] };
        }

        const context = {
            trialIndex,
            gameState,
            development,
            threat,
            enemyTruth: truth,
            armyStructure
        };

        const ingresses = this.ingressResolver.resolve(context);
        if (!Array.isArray(ingresses) || ingresses.length === 0) {
            return { success: false, errors: [TRIAL_SCENARIO_BUILD_REASONS.INGRESS_UNRESOLVED] };
        }

        if (!this.routeGenerator || typeof this.routeGenerator.generate !== "function") {
            return { success: false, errors: [TRIAL_SCENARIO_BUILD_REASONS.ROUTE_GENERATOR_REQUIRED] };
        }

        let routes = this.routeGenerator.generate({ ...context, ingresses });
        if (!Array.isArray(routes) || routes.length === 0) {
            return { success: false, errors: [TRIAL_SCENARIO_BUILD_REASONS.ROUTES_UNRESOLVED] };
        }

        if (this.suppressionAllocator && typeof this.suppressionAllocator.allocate === "function") {
            routes = this.suppressionAllocator.allocate({
                ...context,
                ingresses,
                enemySuppression,
                routes
            });
            if (!Array.isArray(routes) || routes.length === 0) {
                return { success: false, errors: [TRIAL_SCENARIO_BUILD_REASONS.ROUTES_UNRESOLVED] };
            }
        }

        const human = resolveHumanSnapshot(gameState);
        if (!human) {
            return { success: false, errors: [TRIAL_SCENARIO_BUILD_REASONS.HUMAN_STATE_UNRESOLVED] };
        }

        const fallbackCommander = this.commanderResolver?.resolve?.(context) ?? null;
        const fallbackForces = this.forcesResolver?.resolve?.(context) ?? [];
        const scenario = {
            id: `TRIAL_${trialIndex}`,
            trialIndex,
            enemySuppression,
            routes: cloneData(routes),
            ...human,
            armyStructure: cloneData(armyStructure),
            commander: cloneData(
                truth?.commander
                ?? armyStructure?.commander
                ?? fallbackCommander
            ),
            forces: cloneData(
                Array.isArray(truth?.forces) && truth.forces.length > 0
                    ? truth.forces
                    : (Array.isArray(armyStructure?.forces) && armyStructure.forces.length > 0
                        ? armyStructure.forces
                        : fallbackForces)
            ),
            environment: cloneData(this.environmentResolver?.resolve?.(context) ?? {})
        };

        return {
            success: true,
            scenario,
            diagnostics: {
                development: cloneData(development),
                threat: cloneData(threat),
                enemyTruth: cloneData(truth),
                armyStructure: cloneData(armyStructure),
                ingresses: cloneData(ingresses)
            }
        };
    }
}

export default TrialScenarioFactory;
