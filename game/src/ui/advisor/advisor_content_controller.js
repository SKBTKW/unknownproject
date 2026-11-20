import { resolveAdvisorStatus } from './advisor_status_resolver.js';
import { resolveAdvisorAdvice } from './advisor_advice_resolver.js';
import { getAdvisorRecords } from './advisor_record_adapter.js';
import { projectAdvisorReportTopics } from './advisor_topic_report_projector.js';

export const ADVISOR_SECTIONS = Object.freeze({ REPORT: "report", RECORD: "record", HELP: "help" });
export const ADVISOR_REPORT_DEPTHS = Object.freeze(["shallow", "medium", "deep"]);

export class AdvisorContentController {
    constructor({ i18n, stateProvider = () => ({}), trialStatusProvider = () => ({}) } = {}) {
        this.i18n = i18n;
        this.stateProvider = stateProvider;
        this.trialStatusProvider = trialStatusProvider;
        this.reportDepth = "medium";
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

    getReportLines() {
        const state = this.stateProvider?.() || {};
        const trialStatus = this.trialStatusProvider?.() || {};
        const resolved = resolveAdvisorStatus(state, trialStatus);
        const items = [...resolved.urgency, ...resolved.status, ...resolved.outlook];
        const limit = this.reportDepth === "shallow" ? 1 : (this.reportDepth === "medium" ? 3 : 5);
        const lines = items.slice(0, limit).map(item => this.i18n.t(item.key, item.params || {}));

        if (this.reportDepth === "deep") {
            const advice = resolveAdvisorAdvice(state, trialStatus);
            if (advice?.suggestionKey) lines.push(this.i18n.t(advice.suggestionKey));
        }
        if (!lines.length) lines.push(this.i18n.t("UI_ADVISOR_REPORT_PLACEHOLDER"));
        return lines;
    }

    getReportText() {
        return this.getReportLines().join("\n");
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
        this.renderTopicReport(host);
    }

    // A view of known facts, never a secondary enemy-truth store.
    // Native details/summary keeps the topic list keyboard-accessible.
    renderTopicReport(host) {
        const topics = projectAdvisorReportTopics(this.stateProvider?.() || {});
        for (const topic of topics) {
            const details = document.createElement("details");
            details.className = "advisor-report-topic";
            const heading = document.createElement("summary");
            heading.className = "advisor-report-topic-title";
            heading.textContent = this.i18n.t(topic.labelKey);
            details.appendChild(heading);
            if (topic.id === "STATUS") {
                for (const line of this.getReportLines()) {
                    const row = document.createElement("p");
                    row.className = "advisor-status-row";
                    row.textContent = line;
                    details.appendChild(row);
                }
            } else if (topic.entries.length === 0) {
                this.appendText(details, "UI_ADVISOR_TOPIC_NO_EVIDENCE", {}, "advisor-content-note");
            } else {
                for (const entry of topic.entries) {
                    const row = document.createElement("div");
                    row.className = "advisor-topic-observation";
                    const verse = document.createElement("span");
                    verse.className = "advisor-topic-verse";
                    verse.textContent = Number.isInteger(entry.verse) ? `Verse ${entry.verse}` : "";
                    row.appendChild(verse);
                    const fact = document.createElement("strong");
                    fact.className = "advisor-topic-known-fact";
                    fact.textContent = this.i18n.t(entry.valueKey);
                    row.appendChild(fact);
                    const status = document.createElement("span");
                    status.className = "advisor-topic-evidence-status";
                    status.textContent = this.i18n.t(entry.statusKey);
                    row.appendChild(status);
                    details.appendChild(row);
                }
            }
            host.appendChild(details);
        }
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
