export const FIRST_RUN_TRIAL1_RELATIVE_DEPLOYMENT_POLICY_V1 = Object.freeze({
    baseShare: 0.30,
    defenseShareWeight: 0.45,
    distanceShareWeight: 0.10,
    maxShare: 0.80,
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
        Math.max(0, share)
    );
}

/**
 * FirstRun Trial1-only deployment cost resolver.
 *
 * This policy intentionally derives food/material cost from the live balances
 * rather than fixed absolute coefficients. Stage1 economy varies enough across
 * valid runs that a single linear profile cannot hold the intended dramatic
 * 70-80% heavy-mobilization band consistently.
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

        return {
            food: Math.ceil(food * burdenShare),
            material: Math.ceil(material * burdenShare),
            breakdown: {
                mode: "FIRST_RUN_TRIAL1_RELATIVE_V1",
                burdenShare,
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
