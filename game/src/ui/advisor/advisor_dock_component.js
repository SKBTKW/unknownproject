import { I18n } from '../../i18n.js';
import { DEFAULT_ADVISOR_PROFILE } from './advisor_profiles.js';
import { AdvisorDialogueSystem } from './advisor_dialogue_system.js';
import { AdvisorEventBridge } from './advisor_event_bridge.js';
import { resolveAdvisorStatus } from './advisor_status_resolver.js';
import { resolveAdvisorAdvice } from './advisor_advice_resolver.js';
import { getAdvisorRecords } from './advisor_record_adapter.js';

export class AdvisorDockComponent {
    constructor({ stateProvider, trialStatusProvider = () => ({}), settingsModal = null, gameFactHub = null, profile = DEFAULT_ADVISOR_PROFILE, i18n = I18n } = {}) {
        this.stateProvider = stateProvider;
        this.trialStatusProvider = trialStatusProvider;
        this.settingsModal = settingsModal;
        this.profile = profile;
        this.i18n = i18n;
        this.activePanel = null;
        this.root = null;
        this.dialogueSystem = new AdvisorDialogueSystem({ profile, translate: (key, params) => this.i18n.t(key, params) });
        this.eventBridge = new AdvisorEventBridge(this.dialogueSystem, gameFactHub);
        this.unsubscribeDialogue = this.dialogueSystem.subscribe(item => this.renderPopup(item));
    }

    mount(container) {
        if (!container || this.root) return;
        this.root = document.createElement("aside");
        this.root.className = "advisor-dock";
        this.root.setAttribute("aria-label", this.i18n.t("UI_ADVISOR_TITLE"));
        const header = this.createElement("header", "advisor-header");
        header.appendChild(this.createElement("strong", "advisor-turn"));
        header.appendChild(this.createElement("span", "advisor-trial-announcement"));
        const portraitViewport = this.createElement("div", "advisor-portrait-viewport");
        const portrait = this.createElement(this.profile.portrait ? "img" : "div", "advisor-portrait");
        portrait.setAttribute("aria-hidden", "true");
        if (this.profile.portrait) portrait.src = this.profile.portrait;
        portraitViewport.appendChild(portrait);
        portraitViewport.appendChild(this.createElement("div", "advisor-profile-name"));
        const popup = this.createElement("div", "advisor-popup-comment");
        popup.setAttribute("aria-live", "polite");
        portraitViewport.appendChild(popup);
        const detail = this.createElement("section", "advisor-detail-panel");
        detail.hidden = true;
        const actions = this.createElement("footer", "advisor-footer-actions");
        this.root.appendChild(header);
        this.root.appendChild(portraitViewport);
        this.root.appendChild(detail);
        this.root.appendChild(actions);
        ["status", "log", "advice", "settings"].forEach(action => {
            const button = document.createElement("button");
            button.type = "button";
            button.className = "advisor-action-btn";
            button.dataset.action = action;
            button.onclick = () => this.handleAction(action);
            actions.appendChild(button);
        });
        container.appendChild(this.root);
        this.render();
    }

    createElement(tag, className) {
        const element = document.createElement(tag);
        element.className = className;
        return element;
    }

    handleAction(action) {
        if (action === "settings") {
            this.settingsModal?.open?.();
            return;
        }
        this.activePanel = this.activePanel === action ? null : action;
        this.render();
    }

    render() {
        if (!this.root) return;
        const state = this.stateProvider?.() || {};
        const trialStatus = this.trialStatusProvider?.() || {};
        const turn = Number(state.turn || 1);
        const maxTurns = Number(state.maxTurns || 50);
        const remaining = Number(state.nextTrialTurn || 0) - turn;
        this.root.querySelector(".advisor-turn").textContent = this.i18n.t("UI_ADVISOR_TURN", { turn, max: maxTurns });
        const announcement = this.root.querySelector(".advisor-trial-announcement");
        announcement.textContent = trialStatus.active
            ? this.i18n.t("UI_ADVISOR_TRIAL_ACTIVE")
            : (remaining >= 0 && remaining <= (state.trialSchedule?.warningDuration ?? 5)
                ? this.i18n.t("UI_ADVISOR_TRIAL_IN", { turns: remaining }) : "");
        this.root.querySelector(".advisor-profile-name").textContent = this.i18n.t(this.profile.displayNameKey);
        const portrait = this.root.querySelector(".advisor-portrait");
        portrait.textContent = this.profile.portrait ? "" : this.i18n.t("UI_ADVISOR_PORTRAIT_PENDING");

        this.root.querySelectorAll(".advisor-action-btn").forEach(button => {
            const action = button.dataset.action;
            button.textContent = this.i18n.t(`UI_ADVISOR_ACTION_${action.toUpperCase()}`);
            button.classList.toggle("is-active", action === this.activePanel);
        });
        this.renderDetail(state, trialStatus);
        this.eventBridge.observeSnapshot({ turn, trialActive: trialStatus.active, trialRemaining: remaining });
    }

    renderDetail(state, trialStatus) {
        const panel = this.root.querySelector(".advisor-detail-panel");
        panel.hidden = !this.activePanel;
        while (panel.firstChild) panel.removeChild(panel.firstChild);
        if (!this.activePanel) return;
        if (this.activePanel === "log") {
            const records = getAdvisorRecords(state);
            if (!records.length) return this.appendText(panel, "UI_ADVISOR_RECORD_EMPTY");
            records.forEach(record => this.appendText(panel, "UI_ADVISOR_RECORD_ROW", { turn: record.turn, message: record.message }));
            return;
        }
        if (this.activePanel === "advice") {
            const advice = resolveAdvisorAdvice(state, trialStatus);
            advice.factKeys.forEach(key => this.appendText(panel, key, {}, "advisor-detail-fact"));
            this.appendText(panel, advice.suggestionKey, {}, `advisor-advice advisor-severity-${advice.severity}`);
            return;
        }
        const resolved = resolveAdvisorStatus(state, trialStatus);
        [...resolved.urgency, ...resolved.status, ...resolved.outlook].forEach(item => this.appendText(panel, item.key, item.params, "advisor-status-row"));
    }

    appendText(parent, key, params = {}, className = "advisor-record-row") {
        const row = document.createElement("div");
        row.className = className;
        row.textContent = this.i18n.t(key, params);
        parent.appendChild(row);
    }

    renderPopup(item) {
        if (!this.root) return;
        const popup = this.root.querySelector(".advisor-popup-comment");
        popup.textContent = item?.text || "";
        popup.classList.toggle("is-visible", Boolean(item));
    }

    destroy() {
        this.unsubscribeDialogue?.();
        this.eventBridge.destroy();
        this.dialogueSystem.destroy();
        this.root?.remove();
        this.root = null;
    }
}
