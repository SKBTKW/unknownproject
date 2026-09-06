import { MODIFIER_TARGETS, TRIAL_OUTCOMES, TRIAL_TERRAIN_EFFECTS } from "../trial/domain/trial_types.js";

function modifierRow(I18n, row) {
    const targetClass = row.target === MODIFIER_TARGETS.HUMAN_INTERCEPTION ? "human" : "enemy";
    return `<div class="trial-preview-modifier is-${targetClass}"><span>${I18n.t(row.labelKey)}</span><strong>${row.before} → ${row.after}</strong></div>`;
}

export function resolveModifierTag(row) {
    if (!row || !row.source) return null;

    let isAdvantage = false;
    let labelKey = null;

    if (row.target === MODIFIER_TARGETS.HUMAN_INTERCEPTION) {
        isAdvantage = row.after > row.before;
        if (row.source === TRIAL_TERRAIN_EFFECTS.HIGH_GROUND) {
            labelKey = isAdvantage ? "UI_TRIAL_MODIFIER_HIGH_GROUND" : "UI_TRIAL_MODIFIER_LOW_GROUND";
        } else if (row.source === TRIAL_TERRAIN_EFFECTS.FOREST_DEPLOYMENT || row.source === TRIAL_TERRAIN_EFFECTS.DEEP_FOREST_DEPLOYMENT) {
            labelKey = "UI_TRIAL_MODIFIER_DEPLOYMENT_LIMIT";
        }
    } else if (row.target === MODIFIER_TARGETS.ENEMY_SUPPRESSION) {
        isAdvantage = row.after < row.before;
        if (row.source === TRIAL_TERRAIN_EFFECTS.WETLAND_EXIT) {
            labelKey = "UI_TRIAL_MODIFIER_MUD";
        } else if (row.source === TRIAL_TERRAIN_EFFECTS.DESERT_EXIT) {
            labelKey = "UI_TRIAL_MODIFIER_FATIGUE";
        } else if (row.source === TRIAL_TERRAIN_EFFECTS.HIGH_GROUND) {
            labelKey = isAdvantage ? "UI_TRIAL_MODIFIER_HIGH_GROUND" : "UI_TRIAL_MODIFIER_LOW_GROUND";
        } else if (row.source === TRIAL_TERRAIN_EFFECTS.FOREST_DEPLOYMENT || row.source === TRIAL_TERRAIN_EFFECTS.DEEP_FOREST_DEPLOYMENT) {
            labelKey = "UI_TRIAL_MODIFIER_DEPLOYMENT_LIMIT";
        }
    }

    if (!labelKey) return null;

    return {
        labelKey,
        isAdvantage,
        polarityClass: isAdvantage ? "is-advantage" : "is-disadvantage"
    };
}

function renderModifierTags(I18n, modifierRows) {
    if (!modifierRows || modifierRows.length === 0) return "";
    const tags = modifierRows
        .map(resolveModifierTag)
        .filter(Boolean);
    if (tags.length === 0) return "";

    const tagsHtml = tags.map(tag =>
        `<span class="trial-modifier-tag ${tag.polarityClass}">${I18n.t(tag.labelKey)}</span>`
    ).join("");
    return `<div class="trial-preview-tags">${tagsHtml}</div>`;
}

export class TrialInterceptionPreviewComponent {
    static renderHtml(preview, I18n) {
        if (!preview) return "";
        if (!preview.canIntercept) {
            const forbiddenMessage = preview.terrainNameKey
                ? I18n.t("UI_TRIAL_INTERCEPTION_FORBIDDEN_TERRAIN", { terrain: I18n.t(preview.terrainNameKey) })
                : I18n.t("UI_TRIAL_INTERCEPTION_FORBIDDEN");
            return `<section class="trial-interception-preview is-forbidden"><strong>${forbiddenMessage}</strong></section>`;
        }

        const modifierRows = preview.modifierRows || [];
        const tagsHtml = renderModifierTags(I18n, modifierRows);
        const humanRows = modifierRows
            .filter(row => row.target === MODIFIER_TARGETS.HUMAN_INTERCEPTION)
            .map(row => modifierRow(I18n, row))
            .join("");
        const enemyRows = modifierRows
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
                ${tagsHtml}
                <div class="trial-preview-outcome"><span>${I18n.t("UI_TRIAL_PREDICTION")}</span><strong>${I18n.t(outcomeKey)}</strong></div>
                <div class="trial-preview-margin">${I18n.t("UI_TRIAL_MARGIN")}: ${preview.prediction.margin}</div>
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
            </section>`;
    }
}
