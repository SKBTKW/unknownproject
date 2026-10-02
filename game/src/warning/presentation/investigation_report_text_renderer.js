import { INVESTIGATION_LOCALIZATION } from "./investigation_localization_fragment.js";

function resolve(dictionary, key, fallback = "") {
    if (!key) return fallback;
    return Object.prototype.hasOwnProperty.call(dictionary, key) ? dictionary[key] : fallback;
}

function groupObservations(observations) {
    const sections = [];
    const byGroup = new Map();
    for (const observation of observations) {
        const group = observation.group || "OTHER";
        if (!byGroup.has(group)) {
            const section = {
                group,
                label: observation.groupLabel,
                observations: []
            };
            byGroup.set(group, section);
            sections.push(section);
        }
        byGroup.get(group).observations.push(observation);
    }
    return sections;
}

export class InvestigationReportTextRenderer {
    constructor({ locale = "ja", dictionaries = INVESTIGATION_LOCALIZATION } = {}) {
        this.locale = locale;
        this.dictionaries = dictionaries;
    }

    render(viewModel) {
        const dictionary = this.dictionaries?.[this.locale] || this.dictionaries?.ja || {};
        const unmappedValue = resolve(dictionary, "INVESTIGATION_OBSERVATION_UNMAPPED", "");
        const observations = Array.isArray(viewModel?.observations)
            ? viewModel.observations.map(item => ({
                facet: item?.facet || "UNKNOWN",
                group: item?.group || "OTHER",
                groupLabel: resolve(dictionary, item?.groupLabelKey, ""),
                tag: item?.tag || null,
                status: item?.status || "OBSERVED",
                statusLabel: resolve(dictionary, item?.statusKey, ""),
                label: resolve(dictionary, item?.labelKey, ""),
                value: resolve(dictionary, item?.valueKey, unmappedValue),
                highlightToken: item?.highlightToken || null
            }))
            : [];

        const roll = Number.isInteger(viewModel?.roll?.total)
            ? {
                total: viewModel.roll.total,
                dice: Array.isArray(viewModel.roll.dice) ? [...viewModel.roll.dice] : []
            }
            : null;

        return {
            reportId: viewModel?.reportId || null,
            observedAtVerse: Number.isInteger(viewModel?.observedAtVerse) ? viewModel.observedAtVerse : null,
            sourceType: viewModel?.sourceType || "UNKNOWN",
            title: resolve(dictionary, viewModel?.sourceTitleKey, resolve(dictionary, "INVESTIGATION_SOURCE_UNKNOWN_TITLE", "")),
            body: resolve(dictionary, viewModel?.sourceBodyKey, resolve(dictionary, "INVESTIGATION_SOURCE_UNKNOWN_BODY", "")),
            summary: resolve(dictionary, viewModel?.summaryKey, ""),
            observationVolume: resolve(dictionary, viewModel?.observationVolumeKey, ""),
            observationVolumeBand: viewModel?.observationVolumeBand || "UNROLLED",
            preparationHint: resolve(dictionary, viewModel?.preparationHintKey, ""),
            roll,
            observations,
            sections: groupObservations(observations),
            hasObservations: observations.length > 0
        };
    }
}

export default InvestigationReportTextRenderer;
