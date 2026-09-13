export function resolveAdvisorAdvice(state, trialStatus = {}) {
    if (trialStatus.active) return { topic: "defense", severity: "high", factKeys: ["UI_ADVISOR_FACT_TRIAL_ACTIVE"], suggestionKey: "UI_ADVISOR_ADVICE_TRIAL_ACTIVE" };
    if (state?.emberSystem?.getStatus?.() === "CRISIS") return { topic: "ember", severity: "high", factKeys: ["UI_ADVISOR_FACT_EMBER_CRISIS"], suggestionKey: "UI_ADVISOR_ADVICE_EMBER_CRISIS" };
    return { topic: "development", severity: "low", factKeys: ["UI_ADVISOR_FACT_STABLE"], suggestionKey: "UI_ADVISOR_ADVICE_STABLE" };
}
