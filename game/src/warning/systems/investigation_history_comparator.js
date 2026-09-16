const SCALE_ORDER = Object.freeze({
    SCALE_SMALL: 0,
    SCALE_MEDIUM: 1,
    SCALE_LARGE: 2,
    SCALE_VERY_LARGE: 3
});

function observationTags(report) {
    if (!Array.isArray(report?.observations)) return [];
    return report.observations
        .map(observation => observation?.tag)
        .filter(tag => typeof tag === "string" && tag.length > 0);
}

function unique(values) {
    return [...new Set(values)];
}

function findScaleTag(tags) {
    return tags.find(tag => Object.prototype.hasOwnProperty.call(SCALE_ORDER, tag)) || null;
}

function compareScale(previousTag, currentTag) {
    if (!previousTag || !currentTag || previousTag === currentTag) return "UNCHANGED_OR_UNKNOWN";
    const previousRank = SCALE_ORDER[previousTag];
    const currentRank = SCALE_ORDER[currentTag];
    if (!Number.isInteger(previousRank) || !Number.isInteger(currentRank)) return "UNCHANGED_OR_UNKNOWN";
    return currentRank > previousRank ? "INCREASED" : "DECREASED";
}

/**
 * Compares two historical InvestigationReports.
 *
 * Boundary rules:
 * - compares known reports only;
 * - never reads current ObservableEnemyProfile or Trial truth;
 * - never treats absence in a later report as proof that an enemy trait disappeared;
 *   `missingTags` are informational differences only;
 * - only scale tags have an ordered semantic comparison.
 */
export class InvestigationHistoryComparator {
    compare(previousReport, currentReport) {
        const previousTags = unique(observationTags(previousReport));
        const currentTags = unique(observationTags(currentReport));
        const previousSet = new Set(previousTags);
        const currentSet = new Set(currentTags);

        const newTags = currentTags.filter(tag => !previousSet.has(tag));
        const missingTags = previousTags.filter(tag => !currentSet.has(tag));
        const repeatedTags = currentTags.filter(tag => previousSet.has(tag));

        const previousScaleTag = findScaleTag(previousTags);
        const currentScaleTag = findScaleTag(currentTags);

        return {
            previousReportId: previousReport?.id || null,
            currentReportId: currentReport?.id || null,
            previousVerse: Number.isInteger(previousReport?.observedAtVerse)
                ? previousReport.observedAtVerse
                : null,
            currentVerse: Number.isInteger(currentReport?.observedAtVerse)
                ? currentReport.observedAtVerse
                : null,
            newTags,
            missingTags,
            repeatedTags,
            scale: {
                previousTag: previousScaleTag,
                currentTag: currentScaleTag,
                change: compareScale(previousScaleTag, currentScaleTag)
            },
            hasComparableChange:
                newTags.length > 0 ||
                (previousScaleTag && currentScaleTag && previousScaleTag !== currentScaleTag)
        };
    }
}

export default InvestigationHistoryComparator;
