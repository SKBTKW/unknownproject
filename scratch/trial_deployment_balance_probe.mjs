import {
    TRIAL_DEPLOYMENT_COST_PROFILE_STATUS,
    createTrialDeploymentCostResolver
} from "../game/src/trial/domain/trial_deployment_cost_resolver.js";

function pct(part, whole) {
    if (!Number.isFinite(whole) || whole <= 0) return null;
    return (part / whole) * 100;
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
            const requestedDefense = Math.max(
                0,
                Math.min(
                    Number(sample.defense) || 0,
                    Number(plan.requestedDefense ?? sample.defense) || 0
                )
            );
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
        requestedDefense: 14,
        distance: 2
    }),
    Object.freeze({
        id: "HALF_DEFENSE_FAR",
        requestedDefense: 14,
        distance: 4
    }),
    Object.freeze({
        id: "HEAVY_DEFENSE_FAR",
        requestedDefense: 24,
        distance: 4
    }),
    Object.freeze({
        id: "ALL_DEFENSE_FAR",
        requestedDefense: Number.MAX_SAFE_INTEGER,
        distance: 4
    })
]);

export const UNRESOLVED_DEPLOYMENT_PROFILE = Object.freeze({
    status: TRIAL_DEPLOYMENT_COST_PROFILE_STATUS.UNRESOLVED
});
