import { MODIFIER_TARGETS, TRIAL_OUTCOMES } from "../trial/domain/trial_types.js";

function modifierRow(I18n, row) {
    const targetClass = row.target === MODIFIER_TARGETS.HUMAN_INTERCEPTION ? "human" : "enemy";
    return `<div class="trial-preview-modifier is-${targetClass}"><span>${I18n.t(row.labelKey)}</span><strong>${row.before} → ${row.after}</strong></div>`;
}

export class TrialInterceptionPreviewComponent {
    static renderHtml(preview, I18n) {
        if (!preview) return "";
        if (!preview.canIntercept) {
            return `<section class="trial-interception-preview is-forbidden"><strong>${I18n.t("UI_TRIAL_INTERCEPTION_FORBIDDEN")}</strong></section>`;
        }

        const humanRows = preview.modifierRows
            .filter(row => row.target === MODIFIER_TARGETS.HUMAN_INTERCEPTION)
            .map(row => modifierRow(I18n, row))
            .join("");
        const enemyRows = preview.modifierRows
            .filter(row => row.target === MODIFIER_TARGETS.ENEMY_SUPPRESSION)
            .map(row => modifierRow(I18n, row))
            .join("");
        const outcomeKey = preview.prediction.outcome === TRIAL_OUTCOMES.REPEL
            ? "UI_TRIAL_OUTCOME_REPEL"
            : preview.prediction.outcome === TRIAL_OUTCOMES.BREAKTHROUGH
                ? "UI_TRIAL_OUTCOME_BREAKTHROUGH"
                : "UI_TRIAL_OUTCOME_EXACT";

        return `
            <section class="trial-interception-preview">
                <div class="trial-preview-heading">${I18n.t("UI_TRIAL_INTERCEPTION_PREVIEW")}</div>
                <div class="trial-preview-defense">${I18n.t("UI_TRIAL_DEPLOYED_DEFENSE")}: 🛡️${preview.deployedDefense}</div>
                <div class="trial-preview-side">
                    <span>${I18n.t("UI_TRIAL_BASE_INTERCEPTION_POWER")}</span><strong>⚔${preview.baseHumanPower}</strong>
                </div>
                ${humanRows}
                <div class="trial-preview-side is-final">
                    <span>${I18n.t("UI_TRIAL_FINAL_INTERCEPTION_POWER")}</span><strong>⚔${preview.finalHumanPower}</strong>
                </div>
                <div class="trial-preview-side">
                    <span>${I18n.t("UI_TRIAL_BASE_SUPPRESSION")}</span><strong>${preview.baseEnemyPower}</strong>
                </div>
                ${enemyRows}
                <div class="trial-preview-side is-final">
                    <span>${I18n.t("UI_TRIAL_FINAL_SUPPRESSION")}</span><strong>${preview.finalEnemyPower}</strong>
                </div>
                <div class="trial-preview-outcome"><span>${I18n.t("UI_TRIAL_PREDICTION")}</span><strong>${I18n.t(outcomeKey)}</strong></div>
                <div class="trial-preview-margin">${I18n.t("UI_TRIAL_MARGIN")}: ${preview.prediction.margin}</div>
            </section>`;
    }
}
