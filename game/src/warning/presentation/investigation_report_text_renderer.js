import { INVESTIGATION_LOCALIZATION } from "./investigation_localization_fragment.js";

function resolve(dictionary, key) {
    if (!key) return "";
    return Object.prototype.hasOwnProperty.call(dictionary, key) ? dictionary[key] : key;
}

export class InvestigationReportTextRenderer {
    constructor({ locale = "ja", dictionaries = INVESTIGATION_LOCALIZATION } = {}) {
        this.locale = locale;
        this.dictionaries = dictionaries;
    }

    render(viewModel) {
        const dictionary = this.dictionaries?.[this.locale] || this.dictionaries?.ja || {};
        const observations = Array.isArray(viewModel?.observations)
            ? viewModel.observations.map(item => ({
                facet: item?.facet || "UNKNOWN",
                tag: item?.tag || null,
                label: resolve(dictionary, item?.labelKey),
                value: resolve(dictionary, item?.valueKey),
                highlightToken: item?.highlightToken || null
            }))
            : [];

        return {
            reportId: viewModel?.reportId || null,
            observedAtVerse: Number.isInteger(viewModel?.observedAtVerse) ? viewModel.observedAtVerse : null,
            sourceType: viewModel?.sourceType || "UNKNOWN",
            title: resolve(dictionary, viewModel?.sourceTitleKey),
            body: resolve(dictionary, viewModel?.sourceBodyKey),
            observations,
            hasObservations: observations.length > 0
        };
    }
}

export default InvestigationReportTextRenderer;
