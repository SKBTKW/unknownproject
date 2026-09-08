export function resolveAdvisorStatus(state, trialStatus = {}) {
    const turn = Number(state?.turn || 1);
    const nextTrialTurn = Number(state?.nextTrialTurn || 0);
    const remaining = nextTrialTurn > 0 ? nextTrialTurn - turn : null;
    const urgency = [];
    const status = [];
    const outlook = [];

    if (trialStatus.active) urgency.push({ key: "UI_ADVISOR_STATUS_TRIAL_ACTIVE" });
    else if (remaining !== null && remaining >= 0 && remaining <= (state?.trialSchedule?.warningDuration ?? 5)) {
        urgency.push({ key: "UI_ADVISOR_STATUS_TRIAL_WARNING", params: { turns: remaining } });
    }
    if (state?.emberSystem?.getStatus?.() === "CRISIS") urgency.push({ key: "UI_ADVISOR_STATUS_EMBER_CRISIS" });

    const zoneCount = Object.keys(state?.mergedBlocks || {}).length;
    const linkCount = state?.mergeLinks instanceof Set ? state.mergeLinks.size : 0;
    if (zoneCount > 0) status.push({ key: "UI_ADVISOR_STATUS_ZONES", params: { count: zoneCount } });
    if (linkCount > 0) status.push({ key: "UI_ADVISOR_STATUS_LINKS", params: { count: linkCount } });
    if (state?.reserveSlots?.some(slot => slot && !slot.isBlank)) status.push({ key: "UI_ADVISOR_STATUS_RESERVE" });
    if (remaining !== null && remaining > 0) outlook.push({ key: "UI_ADVISOR_STATUS_NEXT_TRIAL", params: { turns: remaining } });
    if (urgency.length + status.length + outlook.length === 0) status.push({ key: "UI_ADVISOR_STATUS_STABLE" });

    const cap = 5;
    const combined = [...urgency, ...status, ...outlook].slice(0, cap);
    return {
        urgency: combined.filter(item => urgency.includes(item)),
        status: combined.filter(item => status.includes(item)),
        outlook: combined.filter(item => outlook.includes(item))
    };
}
