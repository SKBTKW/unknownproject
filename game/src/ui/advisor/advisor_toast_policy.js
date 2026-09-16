const REWARD_ICONS = Object.freeze({ food: "🌾", wood: "🧱", material: "🧱", defense: "🛡️", mystic: "✨", ember: "🔥" });

export function isAdvisorMeaningToast(toast) {
    return /^(MERGE_|LINK_)/.test(String(toast?.type || ""));
}

export function formatNumericRewards(rewards = {}) {
    const parts = [];
    Object.entries(REWARD_ICONS).forEach(([key, icon]) => {
        const amount = Number(rewards[key] || 0);
        if (amount > 0 && !parts.some(part => part.startsWith(icon))) parts.push(`${icon}+${amount}`);
    });
    const maxEmber = Number(rewards.maxEmber || 0);
    if (maxEmber > 0) parts.push(`🔥MAX+${maxEmber}`);
    return parts.join(" ");
}

export function resolveAdvisorAwareToast(toast, advisorEnabled) {
    if (!advisorEnabled || !isAdvisorMeaningToast(toast)) return toast;
    const numericText = formatNumericRewards(toast.rewards);
    return numericText ? { ...toast, text: numericText } : null;
}
