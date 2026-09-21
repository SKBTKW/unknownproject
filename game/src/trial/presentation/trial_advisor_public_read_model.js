function cloneCell(cell) {
    if (!cell || !Number.isInteger(cell.r) || !Number.isInteger(cell.c)) return null;
    return Object.freeze({ r: cell.r, c: cell.c });
}

function nonNegativeInt(value) {
    const numeric = Number(value);
    return Number.isFinite(numeric) ? Math.max(0, Math.floor(numeric)) : 0;
}

function nullableNonNegativeInt(value) {
    const numeric = Number(value);
    return Number.isFinite(numeric) ? Math.max(0, Math.floor(numeric)) : null;
}

function publicPreview(preview) {
    if (!preview || typeof preview !== "object") return null;
    return Object.freeze({
        terrainNameKey: typeof preview.terrainNameKey === "string" ? preview.terrainNameKey : null,
        deployedDefense: nullableNonNegativeInt(preview.deployedDefense),
        outcome: preview.prediction?.outcome ?? null
    });
}

/**
 * Read-only Advisor projection for an active Trial.
 *
 * The input TrialState contains more information than an Advisor is allowed to
 * present. This model intentionally exposes only information that the Trial UI
 * already presents to the player. It never reads enemy truth, hidden intent,
 * scenario internals, or future results, and it owns no Trial mutation.
 */
export class TrialAdvisorPublicReadModel {
    project({ trialState = null, presentationState = null } = {}) {
        if (!trialState) return Object.freeze({ active: false });

        const routes = Array.isArray(trialState.routes) ? trialState.routes : [];
        const availableDefense = nonNegativeInt(trialState.human?.availableDefense);
        const summary = presentationState?.getInterceptionPlanSummary?.(availableDefense, routes) || {};
        const routeCount = routes.length;
        const undecidedRouteCount = Math.min(
            routeCount,
            nonNegativeInt(summary.undecidedCount ?? routeCount)
        );

        return Object.freeze({
            active: true,
            trialIndex: Number.isInteger(trialState.trialIndex) ? trialState.trialIndex : null,
            phase: typeof trialState.phase === "string" ? trialState.phase : null,
            routeCount,
            activeRouteId: presentationState?.activeEnemyRoute ?? null,
            decidedRouteCount: Math.max(0, routeCount - undecidedRouteCount),
            undecidedRouteCount,
            availableDefense,
            plannedDefense: nonNegativeInt(summary.plannedDefenseTotal),
            remainingDefense: nullableNonNegativeInt(summary.remainingDefense) ?? availableDefense,
            selectedInterceptCell: cloneCell(presentationState?.selectedInterceptCell),
            preview: publicPreview(presentationState?.interceptionPreview)
        });
    }
}

export default TrialAdvisorPublicReadModel;
