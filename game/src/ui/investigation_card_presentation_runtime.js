import { I18n } from "../i18n.js";
import { InvestigationResultPresentationBridge } from "../warning/presentation/investigation_result_presentation_bridge.js";

/**
 * UI-side execution/presentation boundary for Investigation cards.
 * The canonical engine API performs gameplay; this runtime only routes its
 * returned result into presentation.
 */
export class InvestigationCardPresentationRuntime {
    constructor({
        bridge = null,
        component = null,
        localeProvider = () => I18n?.getLanguage?.() || "ja"
    } = {}) {
        this.bridge = bridge;
        this.component = component;
        this.localeProvider = localeProvider;
    }

    presentFailure(reason) {
        const normalizedReason = typeof reason === "string" && reason.length > 0
            ? reason
            : "UNKNOWN";
        const key = `UI_INVESTIGATION_FAILURE_${normalizedReason}`;
        const fallbackKey = "UI_INVESTIGATION_FAILURE_GENERIC";
        const message = I18n?.has?.(key)
            ? I18n.t(key)
            : (I18n?.t?.(fallbackKey) || "調査を実行できませんでした。");
        const presentation = Object.freeze({
            reason: normalizedReason,
            title: I18n?.t?.("UI_INVESTIGATION_FAILURE_TITLE") || "調査中止",
            message
        });
        this.component?.showFailure?.(presentation);
        return presentation;
    }

    execute(engine, card, source) {
        if (!engine || typeof engine.executeInvestigationCard !== "function") {
            const result = { success: false, reason: "INVESTIGATION_EXECUTION_UNAVAILABLE" };
            return { ...result, failurePresentation: this.presentFailure(result.reason) };
        }

        const result = engine.executeInvestigationCard(card, source);
        if (!result?.success) {
            return { ...result, failurePresentation: this.presentFailure(result?.reason) };
        }

        const bridge = this.bridge || new InvestigationResultPresentationBridge({
            locale: this.localeProvider()
        });
        const presentation = bridge.project(result);
        if (presentation?.available) this.component?.show?.(presentation);
        return { ...result, presentation };
    }
}

export default InvestigationCardPresentationRuntime;
