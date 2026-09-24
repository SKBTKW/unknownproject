export const TRIAL_DEPLOYMENT_COST_PROFILE_STATUS = Object.freeze({
    RESOLVED: "RESOLVED",
    UNRESOLVED: "UNRESOLVED"
});

export const TRIAL_DEPLOYMENT_COST_PROFILE_REASONS = Object.freeze({
    PROFILE_UNRESOLVED: "PROFILE_UNRESOLVED",
    INVALID_PROFILE: "INVALID_PROFILE"
});

function finiteNonNegative(value) {
    return Number.isFinite(Number(value)) && Number(value) >= 0;
}

function normalizeLinearTerms(value) {
    if (!value || typeof value !== "object") return null;
    const keys = ["base", "perDefense", "perDistance"];
    const result = {};
    for (const key of keys) {
        const raw = value[key] ?? 0;
        if (!finiteNonNegative(raw)) return null;
        result[key] = Number(raw);
    }
    return Object.freeze(result);
}

function additiveModifier(entity) {
    const modifier = entity?.trialTraits?.deploymentCost || null;
    if (!modifier || typeof modifier !== "object") {
        return { food: 0, material: 0 };
    }
    const food = Number(modifier.foodDelta ?? 0);
    const material = Number(modifier.materialDelta ?? 0);
    return {
        food: Number.isFinite(food) ? food : 0,
        material: Number.isFinite(material) ? material : 0
    };
}

export function normalizeTrialDeploymentCostProfile(profile) {
    if (!profile || profile.status !== TRIAL_DEPLOYMENT_COST_PROFILE_STATUS.RESOLVED) {
        return {
            resolved: false,
            reason: TRIAL_DEPLOYMENT_COST_PROFILE_REASONS.PROFILE_UNRESOLVED,
            profile: null
        };
    }

    const food = normalizeLinearTerms(profile.food);
    const material = normalizeLinearTerms(profile.material);
    if (!food || !material) {
        return {
            resolved: false,
            reason: TRIAL_DEPLOYMENT_COST_PROFILE_REASONS.INVALID_PROFILE,
            profile: null
        };
    }

    return {
        resolved: true,
        profile: Object.freeze({
            status: TRIAL_DEPLOYMENT_COST_PROFILE_STATUS.RESOLVED,
            food,
            material
        })
    };
}

/**
 * Creates the canonical v1 deployment cost resolver.
 *
 * Formula shape is fixed; balance values are not:
 *   resource = base + requestedDefense * perDefense + distance * perDistance
 *              + Board semantic modifiers
 *
 * Board semantic modifiers are additive and arrive through
 * trialTraits.deploymentCost.{foodDelta, materialDelta}. This keeps facility /
 * Zone identity outside Trial while allowing Board-owned capabilities to affect
 * logistics or setup cost.
 */
export function createTrialDeploymentCostResolver(profile) {
    const normalized = normalizeTrialDeploymentCostProfile(profile);
    if (!normalized.resolved) return null;

    const terms = normalized.profile;
    return ({ requestedDefense, distance, boardFacts, origin } = {}) => {
        const defense = Number(requestedDefense);
        const travel = Number(distance);
        if (!Number.isFinite(defense) || defense < 0 || !Number.isFinite(travel) || travel < 0) {
            return null;
        }

        const targetModifier = additiveModifier({ trialTraits: boardFacts?.trialTraits });
        const originModifier = additiveModifier(origin);

        const rawFood = terms.food.base
            + (defense * terms.food.perDefense)
            + (travel * terms.food.perDistance)
            + targetModifier.food
            + originModifier.food;
        const rawMaterial = terms.material.base
            + (defense * terms.material.perDefense)
            + (travel * terms.material.perDistance)
            + targetModifier.material
            + originModifier.material;

        return {
            food: Math.max(0, Math.ceil(rawFood)),
            material: Math.max(0, Math.ceil(rawMaterial)),
            breakdown: {
                requestedDefense: defense,
                distance: travel,
                food: {
                    base: terms.food.base,
                    defense: defense * terms.food.perDefense,
                    distance: travel * terms.food.perDistance,
                    targetModifier: targetModifier.food,
                    originModifier: originModifier.food
                },
                material: {
                    base: terms.material.base,
                    defense: defense * terms.material.perDefense,
                    distance: travel * terms.material.perDistance,
                    targetModifier: targetModifier.material,
                    originModifier: originModifier.material
                }
            }
        };
    };
}

export default createTrialDeploymentCostResolver;
