import { I18n } from "../../i18n.js";

const PRESENTATION_COPY = Object.freeze({
    ja: Object.freeze({
        INVESTIGATION_GROUP_ENEMY: "敵の特徴",
        INVESTIGATION_GROUP_APPROACH: "接近・移動",
        INVESTIGATION_GROUP_ENVIRONMENT: "周辺環境",
        INVESTIGATION_GROUP_OTHER: "その他の観測",
        INVESTIGATION_STATUS_NEW: "新たに判明",
        INVESTIGATION_STATUS_RECONFIRMED: "確認が取れた",
        INVESTIGATION_STATUS_OBSERVED: "今回の観測",
        INVESTIGATION_SUMMARY_NEW: "今回の調査で、新しい手掛かりを得た。",
        INVESTIGATION_SUMMARY_RECONFIRMED: "以前の観測と一致する証拠が得られ、情報の裏付けが進んだ。",
        INVESTIGATION_SUMMARY_MIXED: "新しい手掛かりに加え、以前の観測とも一致する証拠を得た。",
        INVESTIGATION_SUMMARY_OBSERVED: "今回の調査で、確認できた痕跡を記録した。",
        INVESTIGATION_SUMMARY_EMPTY: "有効な観測内容は記録されていない。",
        INVESTIGATION_VOLUME_LIMITED: "わずかな痕跡しか拾えなかった。",
        INVESTIGATION_VOLUME_ONE_CLUE: "手掛かりを一つ掴んだ。",
        INVESTIGATION_VOLUME_MULTIPLE: "複数の特徴が見えてきた。",
        INVESTIGATION_VOLUME_CRITICAL: "複数の兆候が一本につながった。",
        INVESTIGATION_VOLUME_UNROLLED: "観測できた範囲を記録した。",
        INVESTIGATION_REPORT_USE_FOR_TRIAL_PREP: "得られた情報は、次の試練に向けた備えを考える材料になる。",
        INVESTIGATION_OBSERVATION_UNMAPPED: "未整理の観測記録"
    }),
    en: Object.freeze({
        INVESTIGATION_GROUP_ENEMY: "Enemy traits",
        INVESTIGATION_GROUP_APPROACH: "Approach and movement",
        INVESTIGATION_GROUP_ENVIRONMENT: "Surrounding environment",
        INVESTIGATION_GROUP_OTHER: "Other observations",
        INVESTIGATION_STATUS_NEW: "New finding",
        INVESTIGATION_STATUS_RECONFIRMED: "Confirmed again",
        INVESTIGATION_STATUS_OBSERVED: "Observed this time",
        INVESTIGATION_SUMMARY_NEW: "This investigation produced new evidence.",
        INVESTIGATION_SUMMARY_RECONFIRMED: "The evidence matches earlier observations and strengthens the existing picture.",
        INVESTIGATION_SUMMARY_MIXED: "The investigation produced new evidence while also confirming earlier observations.",
        INVESTIGATION_SUMMARY_OBSERVED: "The traces confirmed by this investigation were recorded.",
        INVESTIGATION_SUMMARY_EMPTY: "No usable observation was recorded.",
        INVESTIGATION_VOLUME_LIMITED: "Only faint traces could be recovered.",
        INVESTIGATION_VOLUME_ONE_CLUE: "One useful clue was secured.",
        INVESTIGATION_VOLUME_MULTIPLE: "Several characteristics are starting to emerge.",
        INVESTIGATION_VOLUME_CRITICAL: "Several signs connected into a coherent picture.",
        INVESTIGATION_VOLUME_UNROLLED: "The observable evidence was recorded.",
        INVESTIGATION_REPORT_USE_FOR_TRIAL_PREP: "Use the confirmed evidence to inform preparations for the next Trial.",
        INVESTIGATION_OBSERVATION_UNMAPPED: "Unclassified observation"
    })
});

function dictionaryFor(locale) {
    const base = I18n?.getDictionary?.(locale) || {};
    const extension = PRESENTATION_COPY[locale] || PRESENTATION_COPY.ja;
    return Object.freeze({ ...base, ...extension });
}

export const INVESTIGATION_LOCALIZATION = Object.freeze({
    ja: dictionaryFor("ja"),
    en: dictionaryFor("en")
});

export default INVESTIGATION_LOCALIZATION;
