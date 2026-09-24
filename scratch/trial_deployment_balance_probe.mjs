import {
    TRIAL_DEPLOYMENT_COST_PROFILE_STATUS,
    createTrialDeploymentCostResolver
} from "../game/src/trial/domain/trial_deployment_cost_resolver.js";

function pct(part, whole) {
    if (!Number.isFinite(whole) || whole <= 0) return null;
    return (part / whole) * 100;
}

export function resolveDeploymentProbeRequestedDefense(sample = {}, plan = {}) {
    const available = Math.max(0, Number(sample.defense) || 0);
    const fraction = Number(plan.requestedDefenseFraction);
    let requested;

    if (Number.isFinite(fraction)) {
        const normalizedFraction = Math.min(1, Math.max(0, fraction));
        requested = Math.round(available * normalizedFraction);
        if (available > 0 && normalizedFraction > 0) {
            requested = Math.max(1, requested);
        }
    } else {
        requested = Number(plan.requestedDefense ?? available) || 0;
    }

    return Math.max(0, Math.min(available, requested));
}

export function evaluateDeploymentProfileAgainstSamples({
    profile,
    samples = [],
    plans = []
} = {}) {
    const resolver = createTrialDeploymentCostResolver(profile);
    if (typeof resolver !== "function") {
        return {
            success: false,
            reason: "PROFILE_UNRESOLVED",
            rows: []
        };
    }

    const rows = [];
    for (const sample of samples) {
        for (const plan of plans) {
            const requestedDefense = resolveDeploymentProbeRequestedDefense(sample, plan);
            const distance = Math.max(0, Number(plan.distance) || 0);
            const cost = resolver({
                requestedDefense,
                distance,
                boardFacts: {
                    trialTraits: plan.targetTrialTraits || null
                },
                origin: {
                    kind: plan.originKind || "HQ",
                    trialTraits: plan.originTrialTraits || null
                }
            });

            rows.push({
                sampleId: sample.id,
                planId: plan.id,
                foodAvailable: Number(sample.food) || 0,
                materialAvailable: Number(sample.material) || 0,
                defenseAvailable: Number(sample.defense) || 0,
                requestedDefense,
                distance,
                foodCost: cost.food,
                materialCost: cost.material,
                foodRemaining: Math.max(0, (Number(sample.food) || 0) - cost.food),
                materialRemaining: Math.max(0, (Number(sample.material) || 0) - cost.material),
                foodSharePct: pct(cost.food, Number(sample.food) || 0),
                materialSharePct: pct(cost.material, Number(sample.material) || 0),
                defenseSharePct: pct(requestedDefense, Number(sample.defense) || 0),
                affordable:
                    cost.food <= (Number(sample.food) || 0)
                    && cost.material <= (Number(sample.material) || 0)
                    && requestedDefense <= (Number(sample.defense) || 0)
            });
        }
    }

    return {
        success: true,
        rows
    };
}

export function summarizeDeploymentBalanceRows(rows = []) {
    if (!rows.length) {
        return {
            rowCount: 0,
            affordableCount: 0,
            maxFoodSharePct: null,
            maxMaterialSharePct: null,
            minFoodRemaining: null,
            minMaterialRemaining: null
        };
    }

    const finiteFood = rows.map(row => row.foodSharePct).filter(Number.isFinite);
    const finiteMaterial = rows.map(row => row.materialSharePct).filter(Number.isFinite);
    return {
        rowCount: rows.length,
        affordableCount: rows.filter(row => row.affordable).length,
        maxFoodSharePct: finiteFood.length ? Math.max(...finiteFood) : null,
        maxMaterialSharePct: finiteMaterial.length ? Math.max(...finiteMaterial) : null,
        minFoodRemaining: Math.min(...rows.map(row => row.foodRemaining)),
        minMaterialRemaining: Math.min(...rows.map(row => row.materialRemaining))
    };
}

export const STAGE1_TRIAL1_AUDIT_ENVELOPE_20260923 = Object.freeze([
    Object.freeze({
        id: "V15_MIN_OBSERVED",
        food: 413,
        material: 334,
        defense: 27
    }),
    Object.freeze({
        id: "V15_MAX_OBSERVED",
        food: 678,
        material: 467,
        defense: 39
    })
]);

export const STAGE1_TRIAL1_PROBE_PLANS = Object.freeze([
    Object.freeze({
        id: "HALF_DEFENSE_NEAR",
        requestedDefenseFraction: 0.5,
        distance: 2
    }),
    Object.freeze({
        id: "HALF_DEFENSE_FAR",
        requestedDefenseFraction: 0.5,
        distance: 4
    }),
    Object.freeze({
        id: "HEAVY_DEFENSE_FAR",
        requestedDefenseFraction: 0.8,
        distance: 4
    }),
    Object.freeze({
        id: "ALL_DEFENSE_FAR",
        requestedDefenseFraction: 1,
        distance: 4
    })
]);

export const UNRESOLVED_DEPLOYMENT_PROFILE = Object.freeze({
    status: TRIAL_DEPLOYMENT_COST_PROFILE_STATUS.UNRESOLVED
});


export function resolveFirstRunBurdenShare({
    requestedDefense = 0,
    defenseAvailable = 0,
    distance = 0,
    stage1MaxDistance = 4
} = {}) {
    const defense = Math.max(0, Number(requestedDefense) || 0);
    const available = Math.max(0, Number(defenseAvailable) || 0);
    const defenseFraction = available > 0
        ? Math.min(1, defense / available)
        : 0;
    const distanceFraction = stage1MaxDistance > 0
        ? Math.min(1, Math.max(0, Number(distance) || 0) / stage1MaxDistance)
        : 0;

    // FirstRun spectacle probe only:
    // - meaningful deployment starts expensive
    // - committing most defense drives the burden toward 75%
    // - a far deployment can push a full commitment to 80%
    // This is intentionally NOT a product balance rule yet.
    const share = 0.25
        + (0.45 * defenseFraction)
        + (0.10 * distanceFraction);

    return Math.min(0.80, Math.max(0, share));
}

export function evaluateFirstRunBurdenAgainstSamples({
    samples = [],
    plans = []
} = {}) {
    const rows = [];
    for (const sample of samples) {
        for (const plan of plans) {
            const defenseAvailable = Math.max(0, Number(sample.defense) || 0);
            const requestedDefense = resolveDeploymentProbeRequestedDefense(sample, plan);
            const distance = Math.max(0, Number(plan.distance) || 0);
            const burdenShare = resolveFirstRunBurdenShare({
                requestedDefense,
                defenseAvailable,
                distance
            });

            const foodAvailable = Math.max(0, Number(sample.food) || 0);
            const materialAvailable = Math.max(0, Number(sample.material) || 0);
            const foodCost = Math.ceil(foodAvailable * burdenShare);
            const materialCost = Math.ceil(materialAvailable * burdenShare);

            rows.push({
                sampleId: sample.id,
                planId: plan.id,
                requestedDefense,
                defenseAvailable,
                distance,
                burdenShare,
                foodAvailable,
                materialAvailable,
                foodCost,
                materialCost,
                foodRemaining: foodAvailable - foodCost,
                materialRemaining: materialAvailable - materialCost,
                affordable:
                    foodCost <= foodAvailable
                    && materialCost <= materialAvailable
                    && requestedDefense <= defenseAvailable
            });
        }
    }
    return { success: true, rows };
}
