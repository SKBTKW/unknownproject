const SOURCE_INTRO_KEYS = Object.freeze({
    FOOTPRINTS: "INVESTIGATION_NARRATIVE_FOOTPRINTS_INTRO",
    CAMP_REMAINS: "INVESTIGATION_NARRATIVE_CAMP_REMAINS_INTRO",
    SCOUT_SIGHTING: "INVESTIGATION_NARRATIVE_SCOUT_SIGHTING_INTRO"
});

const FACET_ORDER = Object.freeze([
    "DIRECTION",
    "SCALE",
    "PHYSIQUE",
    "EQUIPMENT",
    "MOVEMENT",
    "TERRAIN",
    "UNKNOWN"
]);

function facetRank(facet) {
    const index = FACET_ORDER.indexOf(facet);
    return index >= 0 ? index : FACET_ORDER.length;
}

/**
 * Builds a narrative-ready model from already rendered investigation text.
 *
 * This class deliberately does not infer new facts. It only:
 * - preserves source/body text already resolved by presentation;
 * - orders confirmed observations for readable prose;
 * - exposes localization keys for glue/intro copy;
 * - retains highlight tokens so UI can emphasize semantic evidence.
 */
export class InvestigationNarrativeComposer {
    compose(renderedReport, { sourceType = "UNKNOWN" } = {}) {
        const observations = Array.isArray(renderedReport?.observations)
            ? renderedReport.observations
                .filter(item => typeof item?.value === "string" && item.value.length > 0)
                .map((item, index) => ({ ...item, _index: index }))
                .sort((a, b) => {
                    const byFacet = facetRank(a.facet) - facetRank(b.facet);
                    return byFacet !== 0 ? byFacet : a._index - b._index;
                })
                .map(({ _index, ...item }) => item)
            : [];

        return {
            reportId: renderedReport?.reportId || null,
            observedAtVerse: Number.isInteger(renderedReport?.observedAtVerse)
                ? renderedReport.observedAtVerse
                : null,
            title: renderedReport?.title || "",
            fallbackBody: renderedReport?.body || "",
            sourceType,
            introKey: SOURCE_INTRO_KEYS[sourceType] || "INVESTIGATION_NARRATIVE_GENERIC_INTRO",
            observations,
            hasObservations: observations.length > 0,
            narrativeMode: observations.length > 0 ? "COMPOSED" : "FALLBACK"
        };
    }
}

export default InvestigationNarrativeComposer;
