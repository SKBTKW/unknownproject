export const DEPLOYMENT_COST_REASONS = Object.freeze({
    COST_POLICY_UNRESOLVED: "COST_POLICY_UNRESOLVED",
    INVALID_REQUESTED_DEFENSE: "INVALID_REQUESTED_DEFENSE",
    BOARD_FACTS_UNAVAILABLE: "BOARD_FACTS_UNAVAILABLE",
    ORIGIN_UNAVAILABLE: "ORIGIN_UNAVAILABLE",
    DISTANCE_UNRESOLVED: "DISTANCE_UNRESOLVED",
    INVALID_COST_RESULT: "INVALID_COST_RESULT"
});

function normalizeCost(result) {
    if (!result || typeof result !== "object") return null;
    const food = Number(result.food);
    const material = Number(result.material);
    if (!Number.isFinite(food) || !Number.isFinite(material) || food < 0 || material < 0) {
        return null;
    }
    return {
        food: Math.trunc(food),
        material: Math.trunc(material),
        breakdown: result.breakdown && typeof result.breakdown === "object"
            ? JSON.parse(JSON.stringify(result.breakdown))
            : {}
    };
}

/**
 * Configurable policy boundary for Trial deployment economy.
 *
 * No production balance values live here. A caller injects costResolver once
 * tuning is decided. Until then this policy fails closed rather than silently
 * treating deployment as free.
 */
export class TrialDeploymentCostPolicy {
    constructor({ costResolver = null } = {}) {
        this.costResolver = typeof costResolver === "function" ? costResolver : null;
    }

    calculate({
        requestedDefense,
        boardFacts,
        origin,
        distance,
        context = {}
    } = {}) {
        if (!Number.isInteger(requestedDefense) || requestedDefense < 1) {
            return { resolved: false, reason: DEPLOYMENT_COST_REASONS.INVALID_REQUESTED_DEFENSE };
        }
        if (!boardFacts) {
            return { resolved: false, reason: DEPLOYMENT_COST_REASONS.BOARD_FACTS_UNAVAILABLE };
        }
        if (!origin) {
            return { resolved: false, reason: DEPLOYMENT_COST_REASONS.ORIGIN_UNAVAILABLE };
        }
        if (!Number.isFinite(distance) || distance < 0) {
            return { resolved: false, reason: DEPLOYMENT_COST_REASONS.DISTANCE_UNRESOLVED };
        }
        if (!this.costResolver) {
            return { resolved: false, reason: DEPLOYMENT_COST_REASONS.COST_POLICY_UNRESOLVED };
        }

        const raw = this.costResolver({
            requestedDefense,
            boardFacts,
            origin,
            distance,
            context: { ...context }
        });
        const normalized = normalizeCost(raw);
        if (!normalized) {
            return { resolved: false, reason: DEPLOYMENT_COST_REASONS.INVALID_COST_RESULT };
        }
        return {
            resolved: true,
            ...normalized
        };
    }
}

export default TrialDeploymentCostPolicy;
