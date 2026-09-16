const CHANGE_KEYS = Object.freeze({
    INCREASED: "INVESTIGATION_HISTORY_SCALE_INCREASED",
    DECREASED: "INVESTIGATION_HISTORY_SCALE_DECREASED",
    UNCHANGED_OR_UNKNOWN: "INVESTIGATION_HISTORY_SCALE_UNCHANGED_OR_UNKNOWN"
});

/**
 * Converts a report-to-report comparison into localization-ready presentation.
 *
 * Important:
 * - consumes comparison output only;
 * - missingTags are not presented as enemy traits disappearing;
 * - newTags mean newly observed evidence, not necessarily newly created reality.
 */
export class InvestigationHistoryPresenter {
    present(comparison) {
        const newTags = Array.isArray(comparison?.newTags) ? comparison.newTags : [];
        const repeatedTags = Array.isArray(comparison?.repeatedTags) ? comparison.repeatedTags : [];
        const scaleChange = comparison?.scale?.change || "UNCHANGED_OR_UNKNOWN";

        return {
            previousVerse: Number.isInteger(comparison?.previousVerse)
                ? comparison.previousVerse
                : null,
            currentVerse: Number.isInteger(comparison?.currentVerse)
                ? comparison.currentVerse
                : null,
            scaleChange,
            scaleChangeKey: CHANGE_KEYS[scaleChange] || CHANGE_KEYS.UNCHANGED_OR_UNKNOWN,
            newlyObserved: newTags.map(tag => ({
                tag,
                valueKey: `INVESTIGATION_TAG_${tag}`,
                prefixKey: "INVESTIGATION_HISTORY_NEW_EVIDENCE"
            })),
            reconfirmed: repeatedTags.map(tag => ({
                tag,
                valueKey: `INVESTIGATION_TAG_${tag}`,
                prefixKey: "INVESTIGATION_HISTORY_RECONFIRMED"
            })),
            hasMeaningfulUpdate:
                newTags.length > 0 ||
                scaleChange === "INCREASED" ||
                scaleChange === "DECREASED"
        };
    }
}

export default InvestigationHistoryPresenter;
