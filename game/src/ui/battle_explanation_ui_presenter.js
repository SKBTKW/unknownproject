const CAUSE_LABEL_KEYS = Object.freeze({
    DEPLOYMENT_CONSTRAINED: "UI_TRIAL_BATTLE_CAUSE_DEPLOYMENT_CONSTRAINED",
    MOVEMENT_CONSTRAINED: "UI_TRIAL_BATTLE_CAUSE_MOVEMENT_CONSTRAINED",
    ENEMY_RESERVE_HELD_BACK: "UI_TRIAL_BATTLE_CAUSE_ENEMY_RESERVE_HELD_BACK",
    TERRAIN_ADVANTAGE: "UI_TRIAL_BATTLE_CAUSE_TERRAIN_ADVANTAGE",
    LOCAL_SUPERIORITY: "UI_TRIAL_BATTLE_CAUSE_LOCAL_SUPERIORITY",
    HUMAN_PRESSURE_ADVANTAGE: "UI_TRIAL_BATTLE_CAUSE_HUMAN_PRESSURE_ADVANTAGE",
    VANGUARD_ISOLATED: "UI_TRIAL_BATTLE_CAUSE_VANGUARD_ISOLATED"
});

const CONSEQUENCE_LABEL_KEYS = Object.freeze({
    SUPPORT_DELAYED: "UI_TRIAL_BATTLE_CONSEQUENCE_SUPPORT_DELAYED"
});

function escapeHtml(value) {
    return String(value ?? "")
        .replaceAll("&", "&amp;")
        .replaceAll("<", "&lt;")
        .replaceAll(">", "&gt;")
        .replaceAll('"', "&quot;")
        .replaceAll("'", "&#39;");
}

function translateOrFallback(I18n, key, fallback, params = {}) {
    if (!key || !I18n?.t) return fallback;
    const translated = I18n.t(key, params);
    return translated && translated !== key ? translated : fallback;
}

function humanizeIdentifier(value) {
    return String(value || "").replaceAll("_", " ").trim();
}

function semanticLabel(I18n, type, table) {
    const key = table[type] || null;
    return translateOrFallback(I18n, key, humanizeIdentifier(type));
}

function outcomeText(I18n, result) {
    const outcome = result?.outcome ?? result?.battleControl ?? null;
    if (!outcome) return "—";
    return translateOrFallback(I18n, `UI_TRIAL_OUTCOME_${outcome}`, humanizeIdentifier(outcome));
}

export function renderBattleExplanationHtml(readModel, I18n) {
    const explanation = readModel?.narrative?.explanation;
    if (!explanation) return "";

    const whyRows = Array.isArray(explanation.why) ? explanation.why : [];
    const consequenceRows = Array.isArray(explanation.consequences) ? explanation.consequences : [];
    const decisive = explanation.decisive || null;
    const fortune = explanation.fortune || null;

    const whatResult = outcomeText(I18n, explanation.what?.result);
    const whatSourceKey = explanation.what?.source === "FINAL_COMBAT_RESULT"
        ? "UI_TRIAL_BATTLE_FINAL_RESULT"
        : "UI_TRIAL_BATTLE_NORMAL_RESULT";
    const whatSource = translateOrFallback(
        I18n,
        whatSourceKey,
        explanation.what?.source === "FINAL_COMBAT_RESULT" ? "Final result" : "Normal result"
    );

    const whyHtml = whyRows.length > 0
        ? `<ul class="trial-battle-explanation-list">${whyRows.map(row =>
            `<li data-cause-id="${escapeHtml(row.causeId || "")}">${escapeHtml(semanticLabel(I18n, row.type, CAUSE_LABEL_KEYS))}</li>`
        ).join("")}</ul>`
        : `<span class="trial-battle-explanation-empty">${escapeHtml(translateOrFallback(I18n, "UI_TRIAL_BATTLE_NO_RECORDED_CAUSE", "No recorded major cause"))}</span>`;

    const decisiveHtml = decisive
        ? `<div class="trial-battle-explanation-row is-decisive">
            <strong>${escapeHtml(translateOrFallback(I18n, "UI_TRIAL_BATTLE_DECISIVE", "Decisive"))}</strong>
            <span>${escapeHtml(humanizeIdentifier(decisive.type || decisive.eventType || decisive.id || "—"))}</span>
        </div>`
        : "";

    const consequencesHtml = consequenceRows.length > 0
        ? `<div class="trial-battle-explanation-row">
            <strong>${escapeHtml(translateOrFallback(I18n, "UI_TRIAL_BATTLE_CONSEQUENCE", "Consequence"))}</strong>
            <ul class="trial-battle-explanation-list">${consequenceRows.map(row =>
                `<li>${escapeHtml(semanticLabel(I18n, row.type, CONSEQUENCE_LABEL_KEYS))}</li>`
            ).join("")}</ul>
        </div>`
        : "";

    let fortuneHtml = "";
    if (fortune?.present) {
        const rollTotal = fortune.roll?.total;
        const statusKey = `UI_TRIAL_BATTLE_FORTUNE_${fortune.status || "NONE"}`;
        const statusText = Number.isFinite(rollTotal)
            ? translateOrFallback(I18n, "UI_TRIAL_BATTLE_FORTUNE_ROLL", `2D6: ${rollTotal}`, { total: rollTotal })
            : translateOrFallback(I18n, statusKey, humanizeIdentifier(fortune.status));
        const normal = outcomeText(I18n, explanation.normalResult);
        const final = outcomeText(I18n, explanation.finalResult);
        const resultTransition = explanation.finalResult
            ? `<span>${escapeHtml(normal)} → ${escapeHtml(final)}</span>`
            : "";
        fortuneHtml = `<div class="trial-battle-explanation-row is-fortune">
            <strong>${escapeHtml(translateOrFallback(I18n, "UI_TRIAL_BATTLE_FORTUNE", "Intervention"))}</strong>
            <span>${escapeHtml(statusText)}</span>
            ${resultTransition}
        </div>`;
    }

    return `
        <section class="trial-battle-explanation" id="trialBattleExplanation">
            <div class="trial-battle-explanation-title">${escapeHtml(translateOrFallback(I18n, "UI_TRIAL_BATTLE_EXPLANATION_TITLE", "Battle explanation"))}</div>
            <div class="trial-battle-explanation-row is-what">
                <strong>${escapeHtml(translateOrFallback(I18n, "UI_TRIAL_BATTLE_WHAT", "What happened"))}</strong>
                <span>${escapeHtml(whatSource)}: ${escapeHtml(whatResult)}</span>
            </div>
            <div class="trial-battle-explanation-row is-why">
                <strong>${escapeHtml(translateOrFallback(I18n, "UI_TRIAL_BATTLE_WHY", "Why"))}</strong>
                ${whyHtml}
            </div>
            ${decisiveHtml}
            ${consequencesHtml}
            ${fortuneHtml}
        </section>
    `;
}

export default renderBattleExplanationHtml;
