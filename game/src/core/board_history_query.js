/* =============================================================
   game/src/core/board_history_query.js
   Board-owned read boundary for historical entities persisted on the board.

   This module does not create Battle Sites. It only reads an existing
   Board-owned BATTLE_SITE marker when another Board/Trial integration
   explicitly persists one.
   ============================================================= */

function cloneData(value, fallback = null) {
    if (value === undefined) return fallback;
    return JSON.parse(JSON.stringify(value));
}

function entityType(entity) {
    if (!entity || typeof entity !== "object") return "";
    return String(
        entity.entityType
        || entity.type
        || entity.definitionId
        || entity.kind
        || entity.id
        || ""
    ).toUpperCase();
}

function isBattleSiteEntity(entity) {
    const type = entityType(entity);
    return type === "BATTLE_SITE" || type.startsWith("BATTLE_SITE@");
}

function cellEntities(cell) {
    if (!cell || typeof cell !== "object") return [];
    return [
        cell.specialBlock,
        cell.entity,
        ...(Array.isArray(cell.entities) ? cell.entities : [])
    ].filter(Boolean);
}

function matchesQuery(site, query = {}) {
    if (Number.isInteger(query.trialIndex) && site.trialIndex !== query.trialIndex) {
        return false;
    }
    if (typeof query.scenarioId === "string" && query.scenarioId.length > 0
        && site.scenarioId !== query.scenarioId) {
        return false;
    }
    if (typeof query.outcome === "string" && query.outcome.length > 0
        && site.outcome !== query.outcome) {
        return false;
    }
    if (query.damaged === true && site.damaged !== true) return false;
    if (query.damaged === false && site.damaged === true) return false;
    return true;
}

export class BoardHistoryQuery {
    constructor({ state } = {}) {
        this.state = state || null;
    }

    getBattleSites(query = {}) {
        if (!Array.isArray(this.state?.grid)) return [];
        const results = [];

        for (let r = 0; r < this.state.grid.length; r++) {
            const row = this.state.grid[r];
            for (let c = 0; c < (row?.length || 0); c++) {
                const cell = row?.[c];
                for (const entity of cellEntities(cell)) {
                    if (!isBattleSiteEntity(entity)) continue;
                    const snapshot = {
                        r,
                        c,
                        ...cloneData(entity, {})
                    };
                    if (matchesQuery(snapshot, query)) results.push(Object.freeze(snapshot));
                }
            }
        }

        return results;
    }

    hasBattleSite(query = {}) {
        const minimumRaw = Number(query.minimum ?? query.count ?? 1);
        const minimum = Number.isFinite(minimumRaw)
            ? Math.max(1, Math.trunc(minimumRaw))
            : 1;
        return this.getBattleSites(query).length >= minimum;
    }
}

export default BoardHistoryQuery;
