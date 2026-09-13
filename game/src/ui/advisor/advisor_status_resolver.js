export function resolveAdvisorStatus(state, trialStatus = {}) {
    const urgency = [];
    const status = [];
    const outlook = [];

    if (trialStatus.active) urgency.push({ key: "UI_ADVISOR_STATUS_TRIAL_ACTIVE" });
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
