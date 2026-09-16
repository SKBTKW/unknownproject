const FACET_LABEL_KEYS = Object.freeze({
    DIRECTION: "INVESTIGATION_FACET_DIRECTION",
    SCALE: "INVESTIGATION_FACET_SCALE",
    PHYSIQUE: "INVESTIGATION_FACET_PHYSIQUE",
    EQUIPMENT: "INVESTIGATION_FACET_EQUIPMENT",
    MOVEMENT: "INVESTIGATION_FACET_MOVEMENT",
    TERRAIN: "INVESTIGATION_FACET_TERRAIN"
});

function normalizeTag(tag) {
    return typeof tag === "string" && tag.length > 0 ? tag : null;
}

/**
 * Converts an InvestigationReport into a localization-ready presentation model.
 *
 * Important boundary:
 * - reads InvestigationReport only;
 * - never reads ObservableEnemyProfile or Trial truth;
 * - never infers facts that are not already present in report.observations;
 * - returns i18n keys / semantic tags, not user-facing Japanese strings.
 */
export class InvestigationReportPresenter {
    present(report) {
        const sourceType = typeof report?.sourceType === "string" && report.sourceType.length > 0
            ? report.sourceType
            : "UNKNOWN";

        const observations = Array.isArray(report?.observations)
            ? report.observations
                .map(observation => {
                    const tag = normalizeTag(observation?.tag);
                    if (!tag) return null;
                    const facet = typeof observation?.facet === "string"
                        ? observation.facet
                        : "UNKNOWN";
                    return {
                        facet,
                        tag,
                        labelKey: FACET_LABEL_KEYS[facet] || "INVESTIGATION_FACET_UNKNOWN",
                        valueKey: `INVESTIGATION_TAG_${tag}`,
                        highlightToken: tag
                    };
                })
                .filter(Boolean)
            : [];

        return {
            reportId: report?.id || null,
            observedAtVerse: Number.isInteger(report?.observedAtVerse)
                ? report.observedAtVerse
                : null,
            trialIndex: Number.isInteger(report?.trialIndex)
                ? report.trialIndex
                : null,
            sourceType,
            sourceTitleKey: `INVESTIGATION_SOURCE_${sourceType}_TITLE`,
            sourceBodyKey: report?.textKey || `INVESTIGATION_SOURCE_${sourceType}_BODY`,
            observations,
            hasObservations: observations.length > 0
        };
    }
}

export default InvestigationReportPresenter;
