const CHANGE_KEYS = Object.freeze({
    INCREASED: "INVESTIGATION_HISTORY_SCALE_INCREASED",
    DECREASED: "INVESTIGATION_HISTORY_SCALE_DECREASED",
    UNCHANGED_OR_UNKNOWN: "INVESTIGATION_HISTORY_SCALE_UNCHANGED_OR_UNKNOWN"
});

function clone(value) {
    if (value === undefined) return undefined;
    return JSON.parse(JSON.stringify(value));
}

function validTag(value) {
    return typeof value === "string" && value.length > 0;
}

function orderedReports(reports) {
    return (Array.isArray(reports) ? reports : [])
        .map((report, index) => ({ report, index }))
        .filter(({ report }) => report && typeof report === "object")
        .sort((a, b) => {
            const av = Number.isInteger(a.report.observedAtVerse) ? a.report.observedAtVerse : Number.MAX_SAFE_INTEGER;
            const bv = Number.isInteger(b.report.observedAtVerse) ? b.report.observedAtVerse : Number.MAX_SAFE_INTEGER;
            return av === bv ? a.index - b.index : av - bv;
        });
}

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

    presentHistory(reportsOrState) {
        const reports = Array.isArray(reportsOrState)
            ? reportsOrState
            : reportsOrState?.reports;
        const seenTags = new Set();

        return orderedReports(reports).map(({ report }, order) => {
            const observations = Array.isArray(report.observations)
                ? report.observations
                    .filter(item => validTag(item?.tag))
                    .map(item => ({
                        facet: typeof item?.facet === "string" ? item.facet : "UNKNOWN",
                        tag: item.tag
                    }))
                : [];

            const newlyObserved = [];
            const reconfirmed = [];
            for (const observation of observations) {
                const target = seenTags.has(observation.tag) ? reconfirmed : newlyObserved;
                target.push({
                    ...observation,
                    valueKey: `INVESTIGATION_TAG_${observation.tag}`
                });
                seenTags.add(observation.tag);
            }

            return {
                order: order + 1,
                reportId: report?.id || null,
                observedAtVerse: Number.isInteger(report?.observedAtVerse) ? report.observedAtVerse : null,
                sourceType: typeof report?.sourceType === "string" ? report.sourceType : "UNKNOWN",
                newlyObserved,
                reconfirmed,
                snapshot: clone(report)
            };
        });
    }
}

export default InvestigationHistoryPresenter;
