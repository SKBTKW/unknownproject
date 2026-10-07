/* =============================================================
   game/src/investigation/systems/investigation_composition_router.js
   Pure semantic category routing & composition boundary between
   Threat (Enemy Investigation) and World Discovery.

   Authorities remain completely separated:
   - THREAT -> KnownEnemyState (Warning Domain)
   - WORLD  -> DiscoveryLedger (World Discovery Domain)
   ============================================================= */

export const INVESTIGATION_CATEGORIES = Object.freeze({
    THREAT: "THREAT",
    TERRAIN: "TERRAIN",
    RESOURCE: "RESOURCE",
    WATER: "WATER",
    RUIN: "RUIN",
    NATURAL_HERITAGE: "NATURAL_HERITAGE"
});

export const WORLD_DISCOVERY_CATEGORIES = Object.freeze([
    INVESTIGATION_CATEGORIES.TERRAIN,
    INVESTIGATION_CATEGORIES.RESOURCE,
    INVESTIGATION_CATEGORIES.WATER,
    INVESTIGATION_CATEGORIES.RUIN,
    INVESTIGATION_CATEGORIES.NATURAL_HERITAGE
]);

export function isThreatInvestigationCategory(category) {
    return category === INVESTIGATION_CATEGORIES.THREAT;
}

export function isWorldDiscoveryCategory(category) {
    return WORLD_DISCOVERY_CATEGORIES.includes(category);
}

export function resolveInvestigationDomain(category) {
    if (isThreatInvestigationCategory(category)) {
        return "ENEMY_INVESTIGATION";
    }
    if (isWorldDiscoveryCategory(category)) {
        return "WORLD_DISCOVERY";
    }
    return null;
}

/**
 * Route an incoming investigation action or composition request to its
 * authoritative domain without merging their respective state stores.
 */
export function routeInvestigationRequest(request = {}) {
    if (!request || typeof request !== "object") {
        throw new TypeError("INVESTIGATION_REQUEST_REQUIRED");
    }
    const category = request.category;
    if (typeof category !== "string" || !category.trim()) {
        throw new TypeError("INVESTIGATION_CATEGORY_REQUIRED");
    }

    const domain = resolveInvestigationDomain(category);
    if (!domain) {
        throw new TypeError(`UNKNOWN_INVESTIGATION_CATEGORY: ${category}`);
    }

    return Object.freeze({
        category,
        domain,
        sourceType: request.sourceType || null,
        phase: request.phase || "BASIC",
        payload: request.payload || null
    });
}

/**
 * Normalizes follow-up investigation handoff data with a shared check result,
 * preventing subsystem-specific roll mutation.
 */
export function createFollowUpInvestigationHandoff({
    category,
    parentReportId,
    checkResult
} = {}) {
    if (!category || typeof category !== "string") {
        throw new TypeError("INVESTIGATION_CATEGORY_REQUIRED");
    }
    if (!parentReportId || typeof parentReportId !== "string") {
        throw new TypeError("PARENT_REPORT_ID_REQUIRED");
    }
    if (!checkResult || typeof checkResult !== "object") {
        throw new TypeError("SHARED_CHECK_RESULT_REQUIRED");
    }

    const domain = resolveInvestigationDomain(category);
    if (!domain) {
        throw new TypeError(`UNKNOWN_INVESTIGATION_CATEGORY: ${category}`);
    }

    return Object.freeze({
        category,
        domain,
        parentReportId,
        checkResult: Object.freeze(JSON.parse(JSON.stringify(checkResult)))
    });
}
