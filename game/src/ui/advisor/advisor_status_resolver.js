function finiteCount(value) {
    const numeric = Number(value);
    return Number.isFinite(numeric) ? Math.max(0, Math.floor(numeric)) : null;
}

export function resolveAdvisorStatus(state, trialStatus = {}) {
    const urgency = [];
    const status = [];
    const outlook = [];

    if (trialStatus.active) {
        urgency.push({ key: "UI_ADVISOR_STATUS_TRIAL_ACTIVE" });

        const routeCount = finiteCount(trialStatus.routeCount);
        const decidedRouteCount = finiteCount(trialStatus.decidedRouteCount);
        if (routeCount !== null && routeCount > 0 && decidedRouteCount !== null) {
            status.push({
                key: "UI_ADVISOR_STATUS_TRIAL_ROUTES",
                params: { decided: Math.min(routeCount, decidedRouteCount), total: routeCount }
            });
        }

        const remainingDefense = finiteCount(trialStatus.remainingDefense);
        if (remainingDefense !== null) {
            status.push({
                key: "UI_ADVISOR_STATUS_TRIAL_DEFENSE_REMAINING",
                params: { count: remainingDefense }
            });
        }
    }

    if (state?.emberSystem?.getStatus?.() === "CRISIS") urgency.push({ key: "UI_ADVISOR_STATUS_EMBER_CRISIS" });

    const zoneCount = Object.keys(state?.mergedBlocks || {}).length;
    const linkCount = state?.mergeLinks instanceof Set ? state.mergeLinks.size : 0;
    if (zoneCount > 0) status.push({ key: "UI_ADVISOR_STATUS_ZONES", params: { count: zoneCount } });
    if (linkCount > 0) status.push({ key: "UI_ADVISOR_STATUS_LINKS", params: { count: linkCount } });
    if (state?.reserveSlots?.some(slot => slot && !slot.isBlank)) status.push({ key: "UI_ADVISOR_STATUS_RESERVE" });
    if (urgency.length + status.length + outlook.length === 0) status.push({ key: "UI_ADVISOR_STATUS_STABLE" });

    const cap = 5;
    const combined = [...urgency, ...status, ...outlook].slice(0, cap);
    return {
        urgency: combined.filter(item => urgency.includes(item)),
        status: combined.filter(item => status.includes(item)),
        outlook: combined.filter(item => outlook.includes(item))
    };
}
