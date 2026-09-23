import { DEPLOYMENT_COST_REASONS } from "../domain/trial_deployment_cost_policy.js";

export const TRIAL_DEPLOYMENT_REASONS = Object.freeze({
    TRIAL_SESSION_INACTIVE: "TRIAL_SESSION_INACTIVE",
    INVALID_INTERCEPT_POINT: "INVALID_INTERCEPT_POINT",
    INVALID_DEFENSE_ALLOCATION: "INVALID_DEFENSE_ALLOCATION",
    DEFENSE_BUDGET_EXCEEDED: "DEFENSE_BUDGET_EXCEEDED",
    BOARD_FACTS_UNAVAILABLE: "BOARD_FACTS_UNAVAILABLE",
    ORIGIN_UNRESOLVED: "ORIGIN_UNRESOLVED",
    COST_UNRESOLVED: "COST_UNRESOLVED",
    INSUFFICIENT_RESOURCES: "INSUFFICIENT_RESOURCES",
    STALE_PREVIEW: "STALE_PREVIEW",
    ALREADY_COMMITTED: "ALREADY_COMMITTED",
    INVALID_PLAN: "INVALID_PLAN"
});

function clone(value) {
    return value == null ? value : JSON.parse(JSON.stringify(value));
}

function stable(value) {
    if (Array.isArray(value)) return value.map(stable);
    if (value && typeof value === "object") {
        return Object.keys(value).sort().reduce((out, key) => {
            out[key] = stable(value[key]);
            return out;
        }, {});
    }
    return value;
}

function signature(value) {
    return JSON.stringify(stable(value));
}

function normalizeTarget(cell) {
    if (!cell) return null;
    const r = Number.isInteger(cell.r) ? cell.r : cell.row;
    const c = Number.isInteger(cell.c) ? cell.c : cell.column;
    return Number.isInteger(r) && Number.isInteger(c) ? { r, c } : null;
}

export class TrialDeploymentService {
    constructor({
        boardQuery = null,
        costPolicy = null,
        originResolver = null,
        resourcePayment = null
    } = {}) {
        this.boardQuery = boardQuery || null;
        this.costPolicy = costPolicy || null;
        this.originResolver = originResolver || null;
        this.resourcePayment = resourcePayment || null;
        this.trialState = null;
        this.deploymentHistory = [];
        this.committedPreviewTokens = new Set();
    }

    beginSession({ trialState } = {}) {
        this.trialState = trialState || null;
        this.deploymentHistory = [];
        this.committedPreviewTokens.clear();
        return { success: Boolean(this.trialState) };
    }

    endSession() {
        this.trialState = null;
        this.deploymentHistory = [];
        this.committedPreviewTokens.clear();
    }

    _sessionActive() {
        return Boolean(this.trialState);
    }

    validateAllocation({ interceptCell, requestedDefense } = {}) {
        if (!this._sessionActive()) {
            return { valid: false, reasons: [TRIAL_DEPLOYMENT_REASONS.TRIAL_SESSION_INACTIVE] };
        }
        const target = normalizeTarget(interceptCell);
        if (!target) {
            return { valid: false, reasons: [TRIAL_DEPLOYMENT_REASONS.INVALID_INTERCEPT_POINT] };
        }
        if (!Number.isInteger(requestedDefense) || requestedDefense < 1) {
            return { valid: false, reasons: [TRIAL_DEPLOYMENT_REASONS.INVALID_DEFENSE_ALLOCATION] };
        }
        const availableDefense = Number(this.trialState?.human?.availableDefense) || 0;
        if (requestedDefense > availableDefense) {
            return { valid: false, reasons: [TRIAL_DEPLOYMENT_REASONS.DEFENSE_BUDGET_EXCEEDED] };
        }
        return { valid: true, reasons: [], target };
    }

    _previewAllocation({
        routeId = null,
        interceptCell,
        requestedDefense,
        redeployment = false,
        frontCount = 1,
        context = {}
    } = {}) {
        const validation = this.validateAllocation({ interceptCell, requestedDefense });
        if (!validation.valid) {
            return {
                success: false,
                requestedDefense,
                affordable: false,
                reasons: validation.reasons
            };
        }

        if (!this.boardQuery || typeof this.boardQuery.readTrialDeploymentFacts !== "function") {
            return {
                success: false,
                requestedDefense,
                affordable: false,
                reasons: [TRIAL_DEPLOYMENT_REASONS.BOARD_FACTS_UNAVAILABLE]
            };
        }

        const boardFacts = this.boardQuery.readTrialDeploymentFacts(validation.target);
        if (!boardFacts) {
            return {
                success: false,
                requestedDefense,
                affordable: false,
                reasons: [TRIAL_DEPLOYMENT_REASONS.BOARD_FACTS_UNAVAILABLE]
            };
        }

        const originResult = this.originResolver?.chooseOrigin?.({
            target: validation.target,
            context: { routeId, boardFacts, ...context }
        }) || { success: false };
        if (!originResult.success) {
            return {
                success: false,
                requestedDefense,
                affordable: false,
                boardFacts: clone(boardFacts),
                reasons: [originResult.reason || TRIAL_DEPLOYMENT_REASONS.ORIGIN_UNRESOLVED]
            };
        }

        const cost = this.costPolicy?.calculate?.({
            requestedDefense,
            boardFacts,
            origin: originResult.origin,
            distance: originResult.distance,
            redeployment,
            frontCount,
            context: { routeId, ...context }
        }) || { resolved: false, reason: DEPLOYMENT_COST_REASONS.COST_POLICY_UNRESOLVED };

        if (!cost.resolved) {
            return {
                success: false,
                requestedDefense,
                affordable: false,
                boardFacts: clone(boardFacts),
                origin: clone(originResult.origin),
                distance: originResult.distance,
                reasons: [cost.reason || TRIAL_DEPLOYMENT_REASONS.COST_UNRESOLVED]
            };
        }

        const affordability = this.resourcePayment?.canPay?.(cost) || {
            affordable: false,
            reasons: [TRIAL_DEPLOYMENT_REASONS.INSUFFICIENT_RESOURCES],
            balances: null
        };

        const snapshot = {
            routeId,
            target: validation.target,
            requestedDefense,
            redeployment: redeployment === true,
            frontCount,
            boardFacts,
            origin: originResult.origin,
            distance: originResult.distance,
            cost: { food: cost.food, material: cost.material, breakdown: cost.breakdown },
            balances: affordability.balances
        };

        return {
            success: true,
            routeId,
            interceptCell: validation.target,
            requestedDefense,
            foodCost: cost.food,
            materialCost: cost.material,
            breakdown: clone(cost.breakdown),
            affordable: affordability.affordable === true,
            reasons: [...(affordability.reasons || [])],
            boardFacts: clone(boardFacts),
            origin: clone(originResult.origin),
            distance: originResult.distance,
            previewToken: signature(snapshot)
        };
    }

    previewAllocation(request = {}) {
        return this._previewAllocation(request);
    }

    previewPlan(plan, context = {}) {
        if (!this._sessionActive()) {
            return { success: false, affordable: false, reasons: [TRIAL_DEPLOYMENT_REASONS.TRIAL_SESSION_INACTIVE] };
        }
        if (!plan || !Array.isArray(plan.routes)) {
            return { success: false, affordable: false, reasons: [TRIAL_DEPLOYMENT_REASONS.INVALID_PLAN] };
        }

        const intercepts = plan.routes.filter(route => route?.status === "INTERCEPT");
        const totalDefense = intercepts.reduce((sum, route) => sum + (Number(route.defenseAllocation) || 0), 0);
        const availableDefense = Number(this.trialState?.human?.availableDefense) || 0;
        if (totalDefense > availableDefense) {
            return {
                success: false,
                affordable: false,
                requestedDefense: totalDefense,
                reasons: [TRIAL_DEPLOYMENT_REASONS.DEFENSE_BUDGET_EXCEEDED]
            };
        }

        const previews = [];
        for (const route of intercepts) {
            const preview = this._previewAllocation({
                routeId: route.routeId,
                interceptCell: route.interceptCell,
                requestedDefense: route.defenseAllocation,
                redeployment: route.redeployment === true,
                frontCount: Math.max(1, intercepts.length),
                context
            });
            if (!preview.success) {
                return {
                    success: false,
                    affordable: false,
                    requestedDefense: totalDefense,
                    reasons: preview.reasons || [TRIAL_DEPLOYMENT_REASONS.COST_UNRESOLVED],
                    failedRouteId: route.routeId,
                    routePreview: preview
                };
            }
            previews.push(preview);
        }

        const foodCost = previews.reduce((sum, item) => sum + item.foodCost, 0);
        const materialCost = previews.reduce((sum, item) => sum + item.materialCost, 0);
        const affordability = this.resourcePayment?.canPay?.({ food: foodCost, material: materialCost }) || {
            affordable: false,
            reasons: [TRIAL_DEPLOYMENT_REASONS.INSUFFICIENT_RESOURCES],
            balances: null
        };

        const aggregateSnapshot = {
            plan: intercepts.map(route => ({
                routeId: route.routeId,
                interceptCell: normalizeTarget(route.interceptCell),
                defenseAllocation: route.defenseAllocation,
                redeployment: route.redeployment === true
            })),
            routePreviewTokens: previews.map(item => item.previewToken),
            totalDefense,
            foodCost,
            materialCost,
            balances: affordability.balances
        };

        return {
            success: true,
            requestedDefense: totalDefense,
            foodCost,
            materialCost,
            affordable: affordability.affordable === true,
            reasons: [...(affordability.reasons || [])],
            breakdown: {
                fronts: previews.map(item => ({
                    routeId: item.routeId,
                    food: item.foodCost,
                    material: item.materialCost,
                    distance: item.distance,
                    origin: clone(item.origin),
                    modifiers: clone(item.breakdown)
                }))
            },
            routes: previews,
            previewToken: signature(aggregateSnapshot)
        };
    }

    commitPlan(plan, { expectedPreview = null, context = {} } = {}) {
        if (!this._sessionActive()) {
            return { success: false, reasons: [TRIAL_DEPLOYMENT_REASONS.TRIAL_SESSION_INACTIVE] };
        }
        if (!expectedPreview?.previewToken) {
            return { success: false, reasons: [TRIAL_DEPLOYMENT_REASONS.STALE_PREVIEW] };
        }
        if (this.committedPreviewTokens.has(expectedPreview.previewToken)) {
            return { success: false, reasons: [TRIAL_DEPLOYMENT_REASONS.ALREADY_COMMITTED] };
        }

        // Re-resolve Board facts, origin, distance, policy and balances from the
        // latest state. A preview is evidence, never authority.
        const latest = this.previewPlan(plan, context);
        if (!latest.success) return latest;
        if (latest.previewToken !== expectedPreview.previewToken) {
            return {
                success: false,
                reasons: [TRIAL_DEPLOYMENT_REASONS.STALE_PREVIEW],
                latestPreview: latest
            };
        }
        if (!latest.affordable) {
            return {
                success: false,
                reasons: latest.reasons?.length ? latest.reasons : [TRIAL_DEPLOYMENT_REASONS.INSUFFICIENT_RESOURCES],
                latestPreview: latest
            };
        }

        const availableDefense = Number(this.trialState?.human?.availableDefense) || 0;
        if (latest.requestedDefense > availableDefense) {
            return { success: false, reasons: [TRIAL_DEPLOYMENT_REASONS.DEFENSE_BUDGET_EXCEEDED] };
        }

        const payment = this.resourcePayment?.pay?.({
            food: latest.foodCost,
            material: latest.materialCost
        });
        if (!payment?.success) {
            return {
                success: false,
                reasons: payment?.reasons?.length ? payment.reasons : [TRIAL_DEPLOYMENT_REASONS.INSUFFICIENT_RESOURCES]
            };
        }

        this.trialState.human.availableDefense = availableDefense - latest.requestedDefense;
        this.committedPreviewTokens.add(expectedPreview.previewToken);
        const historyEntry = Object.freeze({
            sequence: this.deploymentHistory.length + 1,
            previewToken: expectedPreview.previewToken,
            defenseCommitted: latest.requestedDefense,
            foodPaid: latest.foodCost,
            materialPaid: latest.materialCost,
            routes: clone(latest.routes)
        });
        this.deploymentHistory.push(historyEntry);

        return {
            success: true,
            totalDefenseCommitted: latest.requestedDefense,
            payment,
            preview: latest,
            historyEntry: clone(historyEntry)
        };
    }

    getDeploymentHistory() {
        return clone(this.deploymentHistory);
    }
}

export default TrialDeploymentService;
