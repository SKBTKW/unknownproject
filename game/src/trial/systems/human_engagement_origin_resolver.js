function clone(value) {
    return value == null ? value : JSON.parse(JSON.stringify(value));
}

function point(cell) {
    if (!cell) return null;
    const r = Number.isInteger(cell.r) ? cell.r : cell.row;
    const c = Number.isInteger(cell.c) ? cell.c : cell.column;
    return Number.isInteger(r) && Number.isInteger(c) ? { r, c } : null;
}

function uniqueCapabilities(...sources) {
    return [...new Set(sources.flat().filter(Boolean))];
}

export class HumanEngagementOriginResolver {
    constructor({
        cellResolver = null,
        boardQuery = null,
        linkedOriginResolver = null,
        networkOriginResolver = null
    } = {}) {
        this.cellResolver = typeof cellResolver === "function" ? cellResolver : null;
        this.boardQuery = boardQuery || null;
        this.linkedOriginResolver = typeof linkedOriginResolver === "function" ? linkedOriginResolver : null;
        this.networkOriginResolver = typeof networkOriginResolver === "function" ? networkOriginResolver : null;
    }

    _profile(cell, context) {
        if (!cell) return null;
        const fromBoard = this.boardQuery?.readTrialEngagementOriginProfile?.(cell, context) || null;
        const embedded = cell.trialEngagementOrigin || null;
        const capabilities = uniqueCapabilities(
            fromBoard?.capabilities || [],
            embedded?.capabilities || [],
            cell.trialEngagementCapabilities || []
        );
        if (fromBoard?.eligible === false || embedded?.eligible === false) return null;
        if (capabilities.length === 0 && fromBoard?.eligible !== true && embedded?.eligible !== true) return null;
        return {
            originType: fromBoard?.originType || embedded?.originType || "SEMANTIC_ORIGIN",
            capabilities
        };
    }

    resolveCandidates({ battleLocation = null, context = {} } = {}) {
        const center = point(battleLocation);
        if (!center) return { success: false, reason: "BATTLE_LOCATION_REQUIRED", candidates: [] };

        const raw = [];
        const cellResolver = this.cellResolver
            || (typeof context?.cellResolver === "function" ? context.cellResolver : null);
        if (cellResolver) {
            for (let dr = -1; dr <= 1; dr++) {
                for (let dc = -1; dc <= 1; dc++) {
                    if (dr === 0 && dc === 0) continue;
                    const cell = cellResolver(center.r + dr, center.c + dc);
                    if (cell) raw.push(cell);
                }
            }
        }

        for (const resolver of [this.linkedOriginResolver, this.networkOriginResolver]) {
            const extra = resolver?.({ battleLocation: center, context });
            if (Array.isArray(extra)) raw.push(...extra);
        }

        const seen = new Set();
        const candidates = [];
        for (const cell of raw) {
            const coords = point(cell);
            if (!coords) continue;
            const key = `${coords.r}:${coords.c}`;
            if (seen.has(key)) continue;
            const profile = this._profile(cell, context);
            if (!profile) continue;
            seen.add(key);
            candidates.push({
                cell: clone(cell),
                originType: profile.originType,
                capabilities: [...profile.capabilities]
            });
        }

        return {
            success: candidates.length > 0,
            reason: candidates.length > 0 ? null : "ENGAGEMENT_ORIGIN_UNAVAILABLE",
            candidates
        };
    }
}

export default HumanEngagementOriginResolver;
