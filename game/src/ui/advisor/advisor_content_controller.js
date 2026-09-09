import { resolveAdvisorStatus } from './advisor_status_resolver.js';
import { getAdvisorRecords } from './advisor_record_adapter.js';

export const ADVISOR_SECTIONS = Object.freeze({ REPORT: "report", RECORD: "record", HELP: "help" });
export const ADVISOR_REPORT_DEPTHS = Object.freeze(["shallow", "medium", "deep"]);

export class AdvisorContentController {
    constructor({ i18n, stateProvider = () => ({}), trialStatusProvider = () => ({}) } = {}) {
        this.i18n = i18n;
        this.stateProvider = stateProvider;
        this.trialStatusProvider = trialStatusProvider;
        this.reportDepth = "shallow";
        this.onDepthChange = null;
    }

    setDepth(depth) {
        if (!ADVISOR_REPORT_DEPTHS.includes(depth)) return false;
        this.reportDepth = depth;
        this.onDepthChange?.(depth);
        return true;
    }

    render(host, section) {
        if (!host) return;
        host.replaceChildren();
        if (section === ADVISOR_SECTIONS.REPORT) return this.renderReport(host);
        if (section === ADVISOR_SECTIONS.RECORD) return this.renderRecords(host);
        if (section === ADVISOR_SECTIONS.HELP) return this.renderHelp(host);
    }

    renderReport(host) {
        host.appendChild(this.createTitle("UI_ADVISOR_REPORT_TITLE"));
        const depthBar = document.createElement("div");
        depthBar.className = "advisor-report-depths";
        depthBar.setAttribute("role", "group");
        depthBar.setAttribute("aria-label", this.i18n.t("UI_ADVISOR_REPORT_DEPTH_LABEL"));
        ADVISOR_REPORT_DEPTHS.forEach(depth => {
            const button = document.createElement("button");
            button.type = "button";
            button.className = "advisor-depth-button";
            button.dataset.depth = depth;
            button.textContent = this.i18n.t(`UI_ADVISOR_DEPTH_${depth.toUpperCase()}`);
            button.classList.toggle("is-active", depth === this.reportDepth);
            button.onclick = () => this.setDepth(depth);
            depthBar.appendChild(button);
        });
        host.appendChild(depthBar);
        const resolved = resolveAdvisorStatus(this.stateProvider?.() || {}, this.trialStatusProvider?.() || {});
        const items = [...resolved.urgency, ...resolved.status, ...resolved.outlook];
        if (!items.length) return this.appendText(host, "UI_ADVISOR_REPORT_PLACEHOLDER", {}, "advisor-content-note");
        const limit = this.reportDepth === "shallow" ? 1 : (this.reportDepth === "medium" ? 3 : 5);
        items.slice(0, limit).forEach(item => this.appendText(host, item.key, item.params, "advisor-status-row"));
    }

    renderRecords(host) {
        host.appendChild(this.createTitle("UI_ADVISOR_RECORD_TITLE"));
        const records = getAdvisorRecords(this.stateProvider?.() || {});
        if (!records.length) return this.appendText(host, "UI_ADVISOR_RECORD_EMPTY", {}, "advisor-content-note");
        records.forEach(record => this.appendText(host, "UI_ADVISOR_RECORD_ROW", { turn: record.turn, message: record.message }, "advisor-record-row"));
    }

    renderHelp(host) {
        host.appendChild(this.createTitle("UI_ADVISOR_HELP_TITLE"));
        this.appendText(host, "UI_ADVISOR_HELP_PLACEHOLDER", {}, "advisor-content-note");
    }

    createTitle(key) {
        const title = document.createElement("h3");
        title.className = "advisor-content-title";
        title.textContent = this.i18n.t(key);
        return title;
    }

    appendText(parent, key, params = {}, className = "advisor-record-row") {
        const row = document.createElement("div");
        row.className = className;
        row.textContent = this.i18n.t(key, params);
        parent.appendChild(row);
        return row;
    }
}
