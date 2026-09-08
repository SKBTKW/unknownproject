import { TRIAL_ROUTE_PLAN_STATUSES, TRIAL_PLAN_REASONS } from "./trial_types.js";

function ensureDraftMap(drafts) {
    if (drafts instanceof Map) return drafts;
    if (Array.isArray(drafts)) {
        const map = new Map();
        for (const item of drafts) {
            if (item && item.routeId) map.set(item.routeId, item);
        }
        return map;
    }
    if (drafts && typeof drafts === "object") {
        const map = new Map();
        for (const [key, value] of Object.entries(drafts)) {
            if (value && typeof value === "object") {
                map.set(key, { routeId: key, ...value });
            }
        }
        return map;
    }
    return new Map();
}

function toCellCoordinates(cell) {
    if (!cell) return null;
    const r = Number.isInteger(cell.r) ? cell.r : (Number.isInteger(cell.row) ? cell.row : null);
    const c = Number.isInteger(cell.c) ? cell.c : (Number.isInteger(cell.column) ? cell.column : null);
    if (r == null || c == null) return null;
    return { r, c };
}

function findRoute(routes, routeId) {
    if (!Array.isArray(routes) || !routeId) return null;
    return routes.find(r => (r.id ?? r.routeId) === routeId) || null;
}

function getRoutePosition(route, r, c) {
    if (!route) return null;
    const cells = route.cells || route.path || [];
    const index = cells.findIndex(entry => {
        const row = Number.isInteger(entry.r) ? entry.r : entry.row;
        const col = Number.isInteger(entry.c) ? entry.c : entry.column;
        return row === r && col === c;
    });
    return index >= 0 ? { route, cells, index } : null;
}

export class TrialPlanningDraftService {
    static getRouteDecision(drafts, routeId) {
        const map = ensureDraftMap(drafts);
        if (map.has(routeId)) {
            const plan = map.get(routeId);
            return {
                routeId,
                status: plan.status || TRIAL_ROUTE_PLAN_STATUSES.UNDECIDED,
                interceptCell: plan.interceptCell ? { ...plan.interceptCell } : null,
                interceptBlockId: plan.interceptBlockId || null,
                defenseAllocation: Number(plan.defenseAllocation) || 0
            };
        }
        return {
            routeId,
            status: TRIAL_ROUTE_PLAN_STATUSES.UNDECIDED,
            interceptCell: null,
            interceptBlockId: null,
            defenseAllocation: 0
        };
    }

    static clearDecision(drafts, routeId) {
        const map = ensureDraftMap(drafts);
        const deleted = map.delete(routeId);
        return { success: true, deleted };
    }

    static getPlannedDefenseTotal(drafts) {
        const map = ensureDraftMap(drafts);
        let total = 0;
        for (const plan of map.values()) {
            if (plan.status === TRIAL_ROUTE_PLAN_STATUSES.INTERCEPT) {
                total += Math.max(0, Number(plan.defenseAllocation) || 0);
            }
        }
        return total;
    }

    static getRemainingDefense(drafts, availableDefense = 0) {
        const available = Math.max(0, Number(availableDefense) || 0);
        return Math.max(0, available - TrialPlanningDraftService.getPlannedDefenseTotal(drafts));
    }

    static getUndecidedRoutes(drafts, routes = []) {
        if (!Array.isArray(routes)) return [];
        return routes.filter(route => {
            const rId = route.id ?? route.routeId;
            return TrialPlanningDraftService.getRouteDecision(drafts, rId).status === TRIAL_ROUTE_PLAN_STATUSES.UNDECIDED;
        });
    }

    static isBlockPlannedByOtherRoute(drafts, routeId, blockId) {
        if (!blockId) return false;
        const map = ensureDraftMap(drafts);
        for (const [otherRouteId, plan] of map.entries()) {
            if (otherRouteId !== routeId && plan.status === TRIAL_ROUTE_PLAN_STATUSES.INTERCEPT) {
                if (plan.interceptBlockId && plan.interceptBlockId === blockId) {
                    return true;
                }
            }
        }
        return false;
    }

    static getPlannedCellInfo(drafts, r, c) {
        const map = ensureDraftMap(drafts);
        for (const plan of map.values()) {
            if (plan.status === TRIAL_ROUTE_PLAN_STATUSES.INTERCEPT && plan.interceptCell) {
                if (plan.interceptCell.r === r && plan.interceptCell.c === c) {
                    return plan;
                }
            }
        }
        return null;
    }

    static getMaxAllocationForRoute(drafts, routeId, availableDefense = 0) {
        const total = TrialPlanningDraftService.getPlannedDefenseTotal(drafts);
        const currentDecision = TrialPlanningDraftService.getRouteDecision(drafts, routeId);
        const currentAlloc = currentDecision.status === TRIAL_ROUTE_PLAN_STATUSES.INTERCEPT ? currentDecision.defenseAllocation : 0;
        const available = Math.max(0, Number(availableDefense) || 0);
        return Math.max(0, available - (total - currentAlloc));
    }

    static setIntercept(drafts, {
        routeId,
        interceptCell,
        defenseAllocation,
        availableDefense = Infinity,
        routes = null,
        cellResolver = null,
        domainValidator = null
    }) {
        const map = ensureDraftMap(drafts);

        if (!routeId || (routes && !findRoute(routes, routeId))) {
            return { success: false, reason: TRIAL_PLAN_REASONS.UNKNOWN_ROUTE };
        }

        const coords = toCellCoordinates(interceptCell);
        if (!coords) {
            return { success: false, reason: TRIAL_PLAN_REASONS.INVALID_INTERCEPT_CELL };
        }

        if (routes) {
            const route = findRoute(routes, routeId);
            if (!getRoutePosition(route, coords.r, coords.c)) {
                return { success: false, reason: TRIAL_PLAN_REASONS.CELL_NOT_ON_ROUTE };
            }
        }

        let cell = null;
        if (typeof cellResolver === "function") {
            cell = cellResolver(coords.r, coords.c);
            if (!cell?.placed || cell.isHQ) {
                return { success: false, reason: TRIAL_PLAN_REASONS.INTERCEPTION_NOT_ALLOWED };
            }
        }

        if (!Number.isInteger(defenseAllocation) || defenseAllocation < 1) {
            return { success: false, reason: TRIAL_PLAN_REASONS.INVALID_DEFENSE_ALLOCATION };
        }

        const available = Number.isFinite(Number(availableDefense)) ? Number(availableDefense) : Infinity;
        const currentTotal = TrialPlanningDraftService.getPlannedDefenseTotal(map);
        const existing = map.get(routeId);
        const existingAlloc = (existing?.status === TRIAL_ROUTE_PLAN_STATUSES.INTERCEPT) ? (Number(existing.defenseAllocation) || 0) : 0;
        if (currentTotal - existingAlloc + defenseAllocation > available) {
            return { success: false, reason: TRIAL_PLAN_REASONS.DEFENSE_BUDGET_EXCEEDED };
        }

        // Domain validation if provided (e.g. Combat / Terrain modifier check)
        let domainPreview = null;
        if (typeof domainValidator === "function") {
            const validation = domainValidator(routeId, coords, defenseAllocation);
            if (validation && validation.success === false) {
                return { success: false, reason: validation.reason || TRIAL_PLAN_REASONS.INTERCEPTION_NOT_ALLOWED, preview: validation.preview };
            }
            if (validation && validation.preview) {
                domainPreview = validation.preview;
            }
        }

        // Block identity: placementGroupId SSOT
        const blockId = cell?.placementGroupId != null
            ? `placement:${cell.placementGroupId}`
            : (interceptCell?.placementGroupId != null ? `placement:${interceptCell.placementGroupId}` : `cell:${coords.r}:${coords.c}`);

        // Check if another route already uses this block
        for (const [otherRouteId, otherPlan] of map.entries()) {
            if (otherRouteId !== routeId && otherPlan.status === TRIAL_ROUTE_PLAN_STATUSES.INTERCEPT) {
                if (otherPlan.interceptBlockId && otherPlan.interceptBlockId === blockId) {
                    return { success: false, reason: TRIAL_PLAN_REASONS.BLOCK_ALREADY_PLANNED };
                }
            }
        }

        const plan = {
            routeId,
            status: TRIAL_ROUTE_PLAN_STATUSES.INTERCEPT,
            interceptCell: coords,
            interceptBlockId: blockId,
            defenseAllocation
        };
        map.set(routeId, plan);

        return {
            success: true,
            plan: { ...plan, interceptCell: { ...plan.interceptCell } },
            preview: domainPreview
        };
    }

    static setSkip(drafts, routeId, routes = null) {
        const map = ensureDraftMap(drafts);
        if (!routeId || (routes && !findRoute(routes, routeId))) {
            return { success: false, reason: TRIAL_PLAN_REASONS.UNKNOWN_ROUTE };
        }
        const plan = {
            routeId,
            status: TRIAL_ROUTE_PLAN_STATUSES.SKIP,
            interceptCell: null,
            interceptBlockId: null,
            defenseAllocation: 0
        };
        map.set(routeId, plan);
        return { success: true, plan: { ...plan } };
    }

    static validateDraft(drafts, {
        routes = [],
        availableDefense = Infinity,
        cellResolver = null,
        domainValidator = null
    } = {}) {
        const map = ensureDraftMap(drafts);
        const errors = [];
        const warnings = [];

        const validRouteIds = Array.isArray(routes) && routes.length > 0
            ? new Set(routes.map(r => r.id ?? r.routeId))
            : null;

        const seenBlocks = new Set();
        let totalAllocated = 0;

        for (const plan of map.values()) {
            if (!plan || !plan.routeId) {
                errors.push("MALFORMED_DRAFT");
                continue;
            }

            if (validRouteIds && !validRouteIds.has(plan.routeId)) {
                errors.push(TRIAL_PLAN_REASONS.UNKNOWN_ROUTE);
            }

            if (plan.status === TRIAL_ROUTE_PLAN_STATUSES.INTERCEPT) {
                const coords = toCellCoordinates(plan.interceptCell);
                if (!coords) {
                    errors.push(TRIAL_PLAN_REASONS.INVALID_INTERCEPT_CELL);
                } else if (routes && routes.length > 0) {
                    const route = findRoute(routes, plan.routeId);
                    if (route && !getRoutePosition(route, coords.r, coords.c)) {
                        errors.push(TRIAL_PLAN_REASONS.CELL_NOT_ON_ROUTE);
                    }
                }

                if (coords && typeof cellResolver === "function") {
                    const cell = cellResolver(coords.r, coords.c);
                    if (!cell?.placed || cell.isHQ) {
                        errors.push(TRIAL_PLAN_REASONS.INTERCEPTION_NOT_ALLOWED);
                    }
                }

                if (typeof domainValidator === "function" && coords) {
                    const validation = domainValidator(plan.routeId, coords, plan.defenseAllocation);
                    if (validation && validation.success === false) {
                        errors.push(validation.reason || TRIAL_PLAN_REASONS.INTERCEPTION_NOT_ALLOWED);
                    }
                }

                if (!Number.isInteger(plan.defenseAllocation) || plan.defenseAllocation < 1) {
                    errors.push(TRIAL_PLAN_REASONS.INVALID_DEFENSE_ALLOCATION);
                } else {
                    totalAllocated += plan.defenseAllocation;
                }

                if (plan.interceptBlockId) {
                    if (seenBlocks.has(plan.interceptBlockId)) {
                        errors.push(TRIAL_PLAN_REASONS.BLOCK_ALREADY_PLANNED);
                    } else {
                        seenBlocks.add(plan.interceptBlockId);
                    }
                }
            } else if (plan.status === TRIAL_ROUTE_PLAN_STATUSES.SKIP) {
                // skip is valid with 0 defense
            } else {
                errors.push("MALFORMED_DRAFT");
            }
        }

        const maxDefense = Number.isFinite(Number(availableDefense)) ? Number(availableDefense) : Infinity;
        if (totalAllocated > maxDefense) {
            errors.push(TRIAL_PLAN_REASONS.DEFENSE_BUDGET_EXCEEDED);
        }

        // Warnings check: UNDECIDED routes
        if (Array.isArray(routes) && routes.length > 0) {
            const undecided = TrialPlanningDraftService.getUndecidedRoutes(map, routes);
            if (undecided.length > 0) {
                warnings.push("ROUTES_UNDECIDED");
            }
        }

        return {
            valid: errors.length === 0,
            errors,
            warnings
        };
    }
}
