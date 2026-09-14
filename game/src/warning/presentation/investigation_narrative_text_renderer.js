import { INVESTIGATION_LOCALIZATION } from "./investigation_localization_fragment.js";

function resolve(dictionary, key) {
    if (!key) return "";
    return Object.prototype.hasOwnProperty.call(dictionary, key) ? dictionary[key] : "";
}

export class InvestigationNarrativeTextRenderer {
    constructor({ locale = "ja", dictionaries = INVESTIGATION_LOCALIZATION } = {}) {
        this.locale = locale;
        this.dictionaries = dictionaries;
    }

    render(narrativeModel) {
        const dictionary = this.dictionaries?.[this.locale] || this.dictionaries?.ja || {};
        if (!narrativeModel?.hasObservations) {
            return {
                reportId: narrativeModel?.reportId || null,
                observedAtVerse: Number.isInteger(narrativeModel?.observedAtVerse)
                    ? narrativeModel.observedAtVerse
                    : null,
                title: narrativeModel?.title || "",
                text: narrativeModel?.fallbackBody || "",
                highlights: []
            };
        }

        const intro = resolve(dictionary, narrativeModel?.introKey) || narrativeModel?.fallbackBody || "";
        const sentences = [];
        const highlights = [];

        for (const observation of narrativeModel.observations || []) {
            const sentence = resolve(dictionary, observation?.narrativeKey) || observation?.value || "";
            if (sentence) sentences.push(sentence);
            if (observation?.highlightToken) highlights.push(observation.highlightToken);
        }

        return {
            reportId: narrativeModel?.reportId || null,
            observedAtVerse: Number.isInteger(narrativeModel?.observedAtVerse)
                ? narrativeModel.observedAtVerse
                : null,
            title: narrativeModel?.title || "",
            text: [intro, ...sentences].filter(Boolean).join(" "),
            highlights
        };
    }
}

export default InvestigationNarrativeTextRenderer;
