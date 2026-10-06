export const FIRST_RUN_TRIAL1_RELATIVE_DEPLOYMENT_POLICY_V1 = Object.freeze({
    baseShare: 0.80,
    defenseShareWeight: 0.08,
    distanceShareWeight: 0.02,
    foodShareBonus: 0,
    minimumFoodReserve: 35,
    foodReserveShare: 0.10,
    maxShare: 0.90,
    stage1MaxDistance: 4
});

function finiteNonNegative(value) {
    const n = Number(value);
    return Number.isFinite(n) && n >= 0 ? n : null;
}

export function resolveFirstRunTrial1DeploymentBurdenShare({
    requestedDefense = 0,
    defenseAvailable = 0,
    distance = 0,
    policy = FIRST_RUN_TRIAL1_RELATIVE_DEPLOYMENT_POLICY_V1
} = {}) {
    const defense = finiteNonNegative(requestedDefense) ?? 0;
    const available = finiteNonNegative(defenseAvailable) ?? 0;
    const travel = finiteNonNegative(distance) ?? 0;
    const maxDistance = Math.max(0, Number(policy?.stage1MaxDistance) || 0);

    const defenseFraction = available > 0
        ? Math.min(1, defense / available)
        : 0;
    const distanceFraction = maxDistance > 0
        ? Math.min(1, travel / maxDistance)
        : 0;

    const share = (Number(policy?.baseShare) || 0)
        + ((Number(policy?.defenseShareWeight) || 0) * defenseFraction)
        + ((Number(policy?.distanceShareWeight) || 0) * distanceFraction);

    return Math.min(
        Math.max(0, Number(policy?.maxShare) || 0),
        Math.max(0, Number(share.toFixed(12)))
    );
}

/**
 * FirstRun Trial1-only deployment cost resolver.
 *
 * This policy intentionally derives food/material cost from the live balances
 * rather than fixed absolute coefficients. The provisional FirstRun target is
 * at least 80% of each resource held at deployment, independently of earlier
 * Board investments. Defense commitment and distance raise the share to 90%.
 *
 * Composition owns applicability. The resolver still fail-closes for any
 * non-Trial1 context so it cannot silently become a later-Trial balance rule.
 */
export function createFirstRunTrial1RelativeDeploymentCostResolver({
    balanceProvider = null,
    defenseBalanceProvider = null,
    policy = FIRST_RUN_TRIAL1_RELATIVE_DEPLOYMENT_POLICY_V1
} = {}) {
    if (typeof balanceProvider !== "function" || typeof defenseBalanceProvider !== "function") {
        return null;
    }

    return ({ requestedDefense, distance, context = {} } = {}) => {
        if (Number(context?.trialIndex) !== 1) return null;
        if (Number(context?.interceptionCount ?? 1) !== 1) return null;

        const balances = balanceProvider();
        const food = finiteNonNegative(balances?.food);
        const material = finiteNonNegative(balances?.material);
        const defenseAvailable = finiteNonNegative(
            context?.defenseAvailable ?? defenseBalanceProvider()
        );
        const defense = finiteNonNegative(requestedDefense);
        const travel = finiteNonNegative(distance);
        if (food === null || material === null || defenseAvailable === null || defense === null || travel === null) {
            return null;
        }

        const burdenShare = resolveFirstRunTrial1DeploymentBurdenShare({
            requestedDefense: defense,
            defenseAvailable,
            distance: travel,
            policy
        });
        const foodShare = Math.min(1, burdenShare + Math.max(0, Number(policy.foodShareBonus) || 0));

        const nominalFoodCost = Math.ceil(food * foodShare);
        const minimumFoodReserve = finiteNonNegative(policy.minimumFoodReserve) ?? 0;
        // Scale the reserve down at low balances so crossing the reserve
        // threshold cannot make a larger food balance cheaper to deploy.
        const foodReserveShare = Math.min(1, finiteNonNegative(policy.foodReserveShare) ?? 0);
        const protectedFoodReserve = Math.min(minimumFoodReserve, food * foodReserveShare);
        // Integer reserve rounding must not undercut the minimum deployment burden.
        const minimumFoodCost = Math.ceil(food * Math.max(0, Number(policy.baseShare) || 0));
        const foodCost = Math.max(minimumFoodCost, Math.min(nominalFoodCost,
            Math.max(food > 0 ? 1 : 0, Math.floor(food - protectedFoodReserve))));

        return {
            food: foodCost,
            material: Math.ceil(material * burdenShare),
            breakdown: {
                mode: "FIRST_RUN_TRIAL1_RELATIVE_V1",
                burdenShare,
                foodShare,
                nominalFoodCost,
                minimumFoodReserve,
                protectedFoodReserve,
                foodReserveDiscount: nominalFoodCost - foodCost,
                requestedDefense: defense,
                defenseAvailable,
                defenseFraction: defenseAvailable > 0 ? Math.min(1, defense / defenseAvailable) : 0,
                distance: travel,
                distanceFraction: policy.stage1MaxDistance > 0
                    ? Math.min(1, travel / policy.stage1MaxDistance)
                    : 0,
                balanceSnapshot: { food, material }
            }
        };
    };
}

export default createFirstRunTrial1RelativeDeploymentCostResolver;
