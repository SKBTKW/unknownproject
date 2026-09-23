export const DEPLOYMENT_ORIGIN_REASONS = Object.freeze({
    BOARD_QUERY_UNAVAILABLE: "BOARD_QUERY_UNAVAILABLE",
    ORIGIN_UNAVAILABLE: "ORIGIN_UNAVAILABLE",
    DISTANCE_UNRESOLVED: "DISTANCE_UNRESOLVED"
});

function clone(value) {
    return value == null ? value : JSON.parse(JSON.stringify(value));
}

/**
 * Resolves deployment origins without hard-coding HQ-only APIs into Trial Core.
 * Board owns which candidates exist; Trial only chooses among semantic candidates.
 */
export class DeploymentOriginResolver {
    constructor({ boardQuery = null, distanceResolver = null, originSelector = null } = {}) {
        this.boardQuery = boardQuery || null;
        this.distanceResolver = typeof distanceResolver === "function" ? distanceResolver : null;
        this.originSelector = typeof originSelector === "function" ? originSelector : null;
    }

    resolveCandidates(context = {}) {
        if (!this.boardQuery || typeof this.boardQuery.listTrialDeploymentOrigins !== "function") {
            return { success: false, reason: DEPLOYMENT_ORIGIN_REASONS.BOARD_QUERY_UNAVAILABLE, candidates: [] };
        }
        const candidates = this.boardQuery.listTrialDeploymentOrigins(context);
        if (!Array.isArray(candidates) || candidates.length === 0) {
            return { success: false, reason: DEPLOYMENT_ORIGIN_REASONS.ORIGIN_UNAVAILABLE, candidates: [] };
        }
        return { success: true, candidates: clone(candidates) };
    }

    chooseOrigin({ target, context = {} } = {}) {
        const resolved = this.resolveCandidates(context);
        if (!resolved.success) return resolved;

        const measured = resolved.candidates.map(candidate => {
            let distance = null;
            if (this.distanceResolver) {
                distance = this.distanceResolver({ origin: candidate, target, context });
            } else if (typeof this.boardQuery?.measureTrialDeploymentDistance === "function") {
                distance = this.boardQuery.measureTrialDeploymentDistance(candidate, target, context);
            } else {
                const originCell = candidate?.cell || null;
                if (
                    Number.isInteger(originCell?.r)
                    && Number.isInteger(originCell?.c)
                    && Number.isInteger(target?.r)
                    && Number.isInteger(target?.c)
                ) {
                    distance = Math.abs(originCell.r - target.r) + Math.abs(originCell.c - target.c);
                }
            }
            return { candidate, distance };
        }).filter(entry => Number.isFinite(entry.distance) && entry.distance >= 0);

        if (measured.length === 0) {
            return {
                success: false,
                reason: DEPLOYMENT_ORIGIN_REASONS.DISTANCE_UNRESOLVED,
                candidates: resolved.candidates
            };
        }

        let selected = null;
        if (this.originSelector) {
            selected = this.originSelector({ candidates: measured, target, context }) || null;
        }
        if (!selected) {
            selected = measured.reduce((best, current) => (
                !best || current.distance < best.distance ? current : best
            ), null);
        }

        return {
            success: true,
            origin: clone(selected.candidate),
            distance: selected.distance,
            candidates: clone(resolved.candidates)
        };
    }
}

export default DeploymentOriginResolver;
