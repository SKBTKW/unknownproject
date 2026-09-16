function nonNegative(value) {
    return Math.max(0, Number(value) || 0);
}

function cloneData(value) {
    return value === undefined ? undefined : JSON.parse(JSON.stringify(value));
}

export class TrialRouteSuppressionAllocator {
    constructor({ weightResolver = null } = {}) {
        this.weightResolver = weightResolver;
    }

    allocate({ routes = [], enemySuppression = 0, trialIndex = 1, threat = null, gameState = null, ingresses = [] } = {}) {
        if (!Array.isArray(routes) || routes.length === 0) return [];
        if (typeof this.weightResolver !== "function") return [];

        const totalSuppression = nonNegative(enemySuppression);
        const weighted = routes.map((route, index) => ({
            route,
            index,
            weight: nonNegative(this.weightResolver({
                route: cloneData(route),
                routeIndex: index,
                trialIndex,
                threat,
                gameState,
                ingresses: cloneData(ingresses)
            }))
        }));

        const totalWeight = weighted.reduce((sum, entry) => sum + entry.weight, 0);
        if (!(totalWeight > 0)) return [];

        let allocated = 0;
        return weighted.map((entry, index) => {
            const strategicSuppression = index === weighted.length - 1
                ? Math.max(0, totalSuppression - allocated)
                : totalSuppression * (entry.weight / totalWeight);
            if (index !== weighted.length - 1) allocated += strategicSuppression;
            return {
                ...cloneData(entry.route),
                strategicSuppression
            };
        });
    }
}

export default TrialRouteSuppressionAllocator;
