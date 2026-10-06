function clone(value) {
    return value == null ? value : JSON.parse(JSON.stringify(value));
}

function coordinates(value) {
    const cell = value?.cell || value;
    const r = Number.isInteger(cell?.r) ? cell.r : cell?.row;
    const c = Number.isInteger(cell?.c) ? cell.c : cell?.column;
    return Number.isInteger(r) && Number.isInteger(c) ? { r, c } : null;
}

function sameCell(a, b) {
    const left = coordinates(a);
    const right = coordinates(b);
    return Boolean(left && right && left.r === right.r && left.c === right.c);
}

/**
 * Battle-local runtime boundary for semantic human engagement origins.
 *
 * The runtime never scans the board itself and never assigns tactic success.
 * Candidate discovery belongs to HumanEngagementOriginResolver. This layer only
 * keeps the current battle's candidate/selection state and validates selection.
 */
export class EngagementOriginRuntime {
    constructor({ originResolver = null } = {}) {
        this.originResolver = originResolver || null;
    }

    prepareBattle({ battleLocation = null, context = {} } = {}) {
        if (!this.originResolver || typeof this.originResolver.resolveCandidates !== "function") {
            return {
                applicable: false,
                candidates: [],
                selectedOrigin: null,
                autoSelected: false
            };
        }

        const resolved = this.originResolver.resolveCandidates({ battleLocation, context });
        const candidates = resolved?.success && Array.isArray(resolved.candidates)
            ? resolved.candidates
            : [];
        const selectedOrigin = candidates.length === 1 ? candidates[0] : null;

        return {
            applicable: true,
            success: resolved?.success === true,
            reason: resolved?.reason || null,
            candidates: clone(candidates),
            selectedOrigin: clone(selectedOrigin),
            autoSelected: candidates.length === 1
        };
    }

    selectOrigin({ candidates = [], origin = null } = {}) {
        const match = Array.isArray(candidates)
            ? candidates.find(candidate => sameCell(candidate, origin))
            : null;
        if (!match) {
            return {
                success: false,
                reason: "ENGAGEMENT_ORIGIN_NOT_CANDIDATE",
                selectedOrigin: null
            };
        }
        return {
            success: true,
            selectedOrigin: clone(match)
        };
    }

    readSelectedCell(selection) {
        return clone(selection?.cell || selection || null);
    }
}

export default EngagementOriginRuntime;
