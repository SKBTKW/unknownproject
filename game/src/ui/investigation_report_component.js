import { UILayoutConfig } from "./layout_config.js";
import { I18n } from "../i18n.js";

function appendText(parent, tagName, className, text) {
    if (!text) return null;
    const node = document.createElement(tagName);
    node.className = className;
    node.textContent = text;
    parent.appendChild(node);
    return node;
}

export class InvestigationReportComponent {
    constructor({ i18n = I18n } = {}) {
        this.i18n = i18n;
        this.overlay = null;
        this.previousFocus = null;
        this.keydownHandler = event => {
            if (event?.key === "Escape" && this.overlay && this.overlay.hidden === false) {
                event.preventDefault?.();
                this.hide();
            }
        };
    }

    ensureStyles() {
        if (typeof document === "undefined" || document.getElementById("investigation-report-styles")) return;
        const style = document.createElement("style");
        style.id = "investigation-report-styles";
        style.textContent = UILayoutConfig.investigationReportStyles;
        document.head.appendChild(style);
    }

    ensureMounted() {
        if (typeof document === "undefined") return false;
        this.ensureStyles();
        if (this.overlay?.isConnected) return true;

        const overlay = document.createElement("div");
        overlay.className = "investigation-report-overlay";
        overlay.hidden = true;
        overlay.setAttribute("role", "dialog");
        overlay.setAttribute("aria-modal", "true");

        const panel = document.createElement("section");
        panel.className = "investigation-report-panel";
        overlay.appendChild(panel);
        document.body.appendChild(overlay);
        document.addEventListener("keydown", this.keydownHandler);

        this.overlay = overlay;
        return true;
    }

    show(presentation) {
        if (!presentation?.available || !this.ensureMounted()) return false;
        const report = presentation.report || {};
        const narrative = presentation.narrative || {};
        const panel = this.overlay.firstElementChild;
        panel.replaceChildren();

        const reportLabel = this.i18n?.t?.("UI_INVESTIGATION_REPORT_KICKER");
        appendText(panel, "div", "investigation-report-kicker",
            Number.isInteger(report.observedAtVerse) ? `Verse ${report.observedAtVerse} / ${reportLabel}` : reportLabel);
        appendText(panel, "h2", "investigation-report-title", report.title || reportLabel);

        if (report.roll?.total) {
            const diceLabel = this.i18n?.t?.("UI_INVESTIGATION_DICE_LABEL") || "2D6";
            appendText(panel, "div", "investigation-report-roll",
                `${diceLabel}: ${report.roll.dice.join(" + ")} = ${report.roll.total}`);
        }
        appendText(panel, "p", "investigation-report-volume", report.observationVolume);
        appendText(panel, "p", "investigation-report-summary", report.summary);

        for (const section of report.sections || []) {
            const group = document.createElement("section");
            group.className = "investigation-report-group";
            appendText(group, "h3", "investigation-report-group-title", section.label);
            for (const observation of section.observations || []) {
                const row = document.createElement("div");
                row.className = "investigation-report-observation";
                appendText(row, "span", "investigation-report-observation-status", observation.statusLabel);
                appendText(row, "span", "investigation-report-observation-value", observation.value);
                group.appendChild(row);
            }
            panel.appendChild(group);
        }

        appendText(panel, "p", "investigation-report-preparation", report.preparationHint);
        if (!report.hasObservations && narrative.text) {
            appendText(panel, "p", "investigation-report-narrative", narrative.text);
        }

        const actions = document.createElement("div");
        actions.className = "investigation-report-actions";
        const close = document.createElement("button");
        close.type = "button";
        close.className = "investigation-report-close";
        close.textContent = this.i18n?.t?.("UI_CONFIRM");
        close.addEventListener("click", () => this.hide(), { once: true });
        actions.appendChild(close);
        panel.appendChild(actions);

        this.previousFocus = typeof document !== "undefined" ? document.activeElement : null;
        this.overlay.hidden = false;
        close.focus?.();
        return true;
    }

    showFailure(failure) {
        if (!failure || !this.ensureMounted()) return false;
        const panel = this.overlay.firstElementChild;
        panel.replaceChildren();

        appendText(
            panel,
            "div",
            "investigation-report-kicker",
            this.i18n?.t?.("UI_INVESTIGATION_REPORT_KICKER")
        );
        appendText(
            panel,
            "h2",
            "investigation-report-title",
            failure.title || (this.i18n?.t?.("UI_INVESTIGATION_FAILURE_TITLE"))
        );
        appendText(
            panel,
            "p",
            "investigation-report-failure",
            failure.message || (this.i18n?.t?.("UI_INVESTIGATION_FAILURE_GENERIC"))
        );

        const actions = document.createElement("div");
        actions.className = "investigation-report-actions";
        const close = document.createElement("button");
        close.type = "button";
        close.className = "investigation-report-close";
        close.textContent = this.i18n?.t?.("UI_CONFIRM");
        close.addEventListener("click", () => this.hide(), { once: true });
        actions.appendChild(close);
        panel.appendChild(actions);

        this.previousFocus = typeof document !== "undefined" ? document.activeElement : null;
        this.overlay.hidden = false;
        close.focus?.();
        return true;
    }

    hide() {
        if (!this.overlay) return false;
        this.overlay.hidden = true;
        const focusTarget = this.previousFocus;
        this.previousFocus = null;
        if (focusTarget && typeof focusTarget.focus === "function" && focusTarget.isConnected !== false) {
            focusTarget.focus();
        }
        return true;
    }

    destroy() {
        if (typeof document !== "undefined") {
            document.removeEventListener("keydown", this.keydownHandler);
        }
        this.overlay?.remove?.();
        this.overlay = null;
        this.previousFocus = null;
    }
}

export default InvestigationReportComponent;
