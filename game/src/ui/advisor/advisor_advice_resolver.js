export function resolveAdvisorAdvice(state, trialStatus = {}) {
    const remaining = Number(state?.nextTrialTurn || 0) - Number(state?.turn || 1);
    if (trialStatus.active) return { topic: "defense", severity: "high", factKeys: ["UI_ADVISOR_FACT_TRIAL_ACTIVE"], suggestionKey: "UI_ADVISOR_ADVICE_TRIAL_ACTIVE" };
    if (remaining >= 0 && remaining <= (state?.trialSchedule?.warningDuration ?? 5)) {
        return { topic: "defense", severity: remaining <= 1 ? "high" : "medium", factKeys: ["UI_ADVISOR_FACT_TRIAL_NEAR"], suggestionKey: "UI_ADVISOR_ADVICE_TRIAL_NEAR" };
    }
    if (state?.emberSystem?.getStatus?.() === "CRISIS") return { topic: "ember", severity: "high", factKeys: ["UI_ADVISOR_FACT_EMBER_CRISIS"], suggestionKey: "UI_ADVISOR_ADVICE_EMBER_CRISIS" };
    return { topic: "development", severity: "low", factKeys: ["UI_ADVISOR_FACT_STABLE"], suggestionKey: "UI_ADVISOR_ADVICE_STABLE" };
}
