import { I18n } from '../../i18n.js';
import { DEFAULT_ADVISOR_PROFILE } from './advisor_profiles.js';
import { AdvisorDialogueSystem } from './advisor_dialogue_system.js';
import { AdvisorEventBridge } from './advisor_event_bridge.js';
import { AdvisorContentController, ADVISOR_SECTIONS } from './advisor_content_controller.js';

export const ADVISOR_VIEW_STATES = Object.freeze({ COLLAPSED: "collapsed", EXPANDED: "expanded" });
export const ADVISOR_EXPANDED_REASONS = Object.freeze({ CLICK: "click", HOVER: "hover" });
export const ADVISOR_UI_TIMING = Object.freeze({ HOVER_OPEN_MS: 160, HOVER_CLOSE_MS: 400 });

const NAV_ACTIONS = Object.freeze([
    { action: ADVISOR_SECTIONS.REPORT, icon: "▤" },
    { action: ADVISOR_SECTIONS.RECORD, icon: "◫" },
    { action: ADVISOR_SECTIONS.HELP, icon: "?" },
    { action: "settings", icon: "⚙" }
]);

export class AdvisorDockComponent {
    constructor({ stateProvider, trialStatusProvider = () => ({}), settingsModal = null, gameFactHub = null, profile = DEFAULT_ADVISOR_PROFILE, i18n = I18n, setTimer = setTimeout, clearTimer = clearTimeout } = {}) {
        this.stateProvider = stateProvider;
        this.trialStatusProvider = trialStatusProvider;
        this.settingsModal = settingsModal;
        this.profile = profile;
        this.i18n = i18n;
        this.setTimer = setTimer;
        this.clearTimer = clearTimer;
        this.viewState = ADVISOR_VIEW_STATES.COLLAPSED;
        this.expandedReason = null;
        this.activeSection = null;
        this.root = null;
        this.hoverOpenTimer = null;
        this.hoverCloseTimer = null;
        this.contentController = new AdvisorContentController({ i18n, stateProvider, trialStatusProvider });
        this.contentController.onDepthChange = () => this.renderContent();
        this.dialogueSystem = new AdvisorDialogueSystem({ profile, translate: (key, params) => this.i18n.t(key, params) });
        this.eventBridge = new AdvisorEventBridge(this.dialogueSystem, gameFactHub, { profile, enabledProvider: () => this.isEnabled() });
        this.unsubscribeDialogue = this.dialogueSystem.subscribe(item => this.renderPopup(item));
        this.handleKeydown = event => {
            if (event.key === "Escape" && this.isModalOpen()) this.closeModal();
        };
    }

    mount(container) {
        if (!container || this.root) return;
        this.root = document.createElement("aside");
        this.root.className = "advisor-dock is-collapsed";
        this.root.setAttribute("aria-label", this.i18n.t("UI_ADVISOR_TITLE"));
        const interactive = this.createElement("div", "advisor-interactive-region");
        const sidePanel = this.createContentHost("advisor-content-panel advisor-content-panel--side");
        sidePanel.hidden = true;
        const shell = this.createElement("div", "advisor-shell");
        const hoverTrigger = this.createElement("div", "advisor-hover-trigger");
        hoverTrigger.setAttribute("aria-hidden", "true");

        const portraitButton = document.createElement("button");
        portraitButton.type = "button";
        portraitButton.className = "advisor-portrait-button";
        portraitButton.onclick = () => this.handlePortraitClick();
        const portraitViewport = this.createElement("div", "advisor-portrait-viewport");
        const portrait = this.createElement(this.profile.portrait ? "img" : "div", "advisor-portrait");
        portrait.setAttribute("aria-hidden", "true");
        if (this.profile.portrait) portrait.src = this.profile.portrait;
        portraitViewport.appendChild(portrait);
        portraitViewport.appendChild(this.createElement("div", "advisor-profile-name"));
        const popup = this.createElement("div", "advisor-popup-comment");
        popup.setAttribute("aria-live", "polite");
        portraitViewport.appendChild(popup);
        portraitButton.appendChild(portraitViewport);

        const collapseButton = document.createElement("button");
        collapseButton.type = "button";
        collapseButton.className = "advisor-collapse-button";
        collapseButton.textContent = "‹";
        collapseButton.onclick = () => this.collapse();
        const navigation = this.createElement("nav", "advisor-navigation");
        NAV_ACTIONS.forEach(({ action, icon }) => navigation.appendChild(this.createNavButton(action, icon)));

        shell.appendChild(portraitButton);
        shell.appendChild(collapseButton);
        shell.appendChild(navigation);
        interactive.appendChild(sidePanel);
        interactive.appendChild(shell);
        interactive.appendChild(hoverTrigger);
        this.root.appendChild(interactive);
        this.root.appendChild(this.createModalHost());
        container.appendChild(this.root);

        interactive.addEventListener("mouseenter", () => this.cancelHoverCollapse());
        interactive.addEventListener("mouseleave", () => this.scheduleHoverCollapse());
        hoverTrigger.addEventListener("mouseenter", () => this.scheduleHoverExpand());
        document.addEventListener("keydown", this.handleKeydown);
        this.render();
    }

    createElement(tag, className) {
        const element = document.createElement(tag);
        element.className = className;
        return element;
    }

    createNavButton(action, icon) {
        const button = document.createElement("button");
        button.type = "button";
        button.className = "advisor-nav-button";
        button.dataset.action = action;
        const iconNode = this.createElement("span", "advisor-nav-icon");
        iconNode.textContent = icon;
        iconNode.setAttribute("aria-hidden", "true");
        const labelNode = this.createElement("span", "advisor-nav-label");
        button.appendChild(iconNode);
        button.appendChild(labelNode);
        button.onclick = () => this.handleAction(action);
        return button;
    }

    createContentHost(className) {
        const host = this.createElement("section", className);
        host.setAttribute("aria-live", "polite");
        return host;
    }

    createModalHost() {
        const overlay = this.createElement("div", "advisor-modal-overlay");
        overlay.hidden = true;
        overlay.onclick = event => { if (event.target === overlay) this.closeModal(); };
        const modal = this.createElement("section", "advisor-modal");
        modal.setAttribute("role", "dialog");
        modal.setAttribute("aria-modal", "true");
        const close = document.createElement("button");
        close.type = "button";
        close.className = "advisor-modal-close";
        close.textContent = "×";
        close.onclick = () => this.closeModal();
        const content = this.createContentHost("advisor-content-panel advisor-content-panel--modal");
        modal.appendChild(close);
        modal.appendChild(content);
        overlay.appendChild(modal);
        return overlay;
    }

    handlePortraitClick() {
        if (this.viewState === ADVISOR_VIEW_STATES.COLLAPSED) return this.expand(ADVISOR_EXPANDED_REASONS.CLICK);
        if (this.expandedReason === ADVISOR_EXPANDED_REASONS.HOVER) return this.expand(ADVISOR_EXPANDED_REASONS.CLICK);
    }

    handleAction(action) {
        if (action === "settings") return this.settingsModal?.open?.();
        if (this.viewState === ADVISOR_VIEW_STATES.COLLAPSED) {
            this.activeSection = action;
            return this.openModal();
        }
        this.activeSection = this.activeSection === action ? null : action;
        this.renderContent();
        this.renderStateClasses();
    }

    expand(reason = ADVISOR_EXPANDED_REASONS.CLICK) {
        this.cancelHoverTimers();
        this.viewState = ADVISOR_VIEW_STATES.EXPANDED;
        this.expandedReason = reason;
        this.closeModal();
        this.render();
    }

    collapse() {
        this.cancelHoverTimers();
        this.viewState = ADVISOR_VIEW_STATES.COLLAPSED;
        this.expandedReason = null;
        this.activeSection = null;
        this.closeModal();
        this.render();
    }

    scheduleHoverExpand() {
        if (!this.isHoverExpandEnabled() || this.viewState !== ADVISOR_VIEW_STATES.COLLAPSED) return;
        this.cancelTimer("hoverOpenTimer");
        this.hoverOpenTimer = this.setTimer(() => {
            this.hoverOpenTimer = null;
            this.expand(ADVISOR_EXPANDED_REASONS.HOVER);
        }, ADVISOR_UI_TIMING.HOVER_OPEN_MS);
    }

    scheduleHoverCollapse() {
        if (this.expandedReason !== ADVISOR_EXPANDED_REASONS.HOVER) return;
        this.cancelTimer("hoverCloseTimer");
        this.hoverCloseTimer = this.setTimer(() => {
            this.hoverCloseTimer = null;
            this.collapse();
        }, ADVISOR_UI_TIMING.HOVER_CLOSE_MS);
    }

    cancelHoverCollapse() { this.cancelTimer("hoverCloseTimer"); }
    cancelHoverTimers() { this.cancelTimer("hoverOpenTimer"); this.cancelTimer("hoverCloseTimer"); }
    cancelTimer(key) { if (this[key] !== null) this.clearTimer(this[key]); this[key] = null; }
    isEnabled() { return this.settingsModal?.settings?.get?.("advisorEnabled") !== false; }
    isHoverExpandEnabled() { return this.settingsModal?.settings?.get?.("advisorHoverExpand") === true; }
    isModalOpen() { return this.root?.querySelector(".advisor-modal-overlay")?.hidden === false; }

    openModal() {
        const overlay = this.root?.querySelector(".advisor-modal-overlay");
        if (!overlay) return;
        overlay.hidden = false;
        overlay.classList.add("is-open");
        this.renderContent();
    }

    closeModal() {
        const overlay = this.root?.querySelector(".advisor-modal-overlay");
        if (!overlay) return;
        overlay.hidden = true;
        overlay.classList.remove("is-open");
        if (this.viewState === ADVISOR_VIEW_STATES.COLLAPSED) this.activeSection = null;
    }

    observeMilitaryAction(actionType) {
        const state = this.stateProvider?.() || {};
        return this.eventBridge.observeMilitaryAction(actionType, Number(state.turn || 1));
    }

    render() {
        if (!this.root) return;
        const state = this.stateProvider?.() || {};
        const trialStatus = this.trialStatusProvider?.() || {};
        const turn = Number(state.turn || 1);
        const remaining = Number(state.nextTrialTurn || 0) - turn;
        this.root.hidden = !this.isEnabled();
        this.eventBridge.observeSnapshot({ turn, trialActive: trialStatus.active, trialRemaining: remaining, warningDuration: state.trialSchedule?.warningDuration ?? 5, state, zoneCount: Object.keys(state.mergedBlocks || {}).length, linkCount: state.mergeLinks instanceof Set ? state.mergeLinks.size : 0, activeGlobalEvents: state.activeGlobalEvents || [] });
        if (this.root.hidden) return;

        this.root.setAttribute("aria-label", this.i18n.t("UI_ADVISOR_TITLE"));
        const portraitButton = this.root.querySelector(".advisor-portrait-button");
        portraitButton.title = this.i18n.t("UI_ADVISOR_EXPAND");
        portraitButton.setAttribute("aria-label", this.i18n.t("UI_ADVISOR_EXPAND"));
        const collapseButton = this.root.querySelector(".advisor-collapse-button");
        collapseButton.title = this.i18n.t("UI_ADVISOR_COLLAPSE");
        collapseButton.setAttribute("aria-label", this.i18n.t("UI_ADVISOR_COLLAPSE"));
        const modalClose = this.root.querySelector(".advisor-modal-close");
        modalClose.title = this.i18n.t("UI_ADVISOR_MODAL_CLOSE");
        modalClose.setAttribute("aria-label", this.i18n.t("UI_ADVISOR_MODAL_CLOSE"));
        this.root.querySelector(".advisor-profile-name").textContent = this.i18n.t(this.profile.displayNameKey);
        const portrait = this.root.querySelector(".advisor-portrait");
        portrait.textContent = this.profile.portrait ? "" : this.i18n.t("UI_ADVISOR_PORTRAIT_PENDING");
        this.root.querySelectorAll(".advisor-nav-button").forEach(button => {
            const action = button.dataset.action;
            const label = this.i18n.t(`UI_ADVISOR_ACTION_${action.toUpperCase()}`);
            button.title = label;
            button.setAttribute("aria-label", label);
            button.querySelector(".advisor-nav-label").textContent = label;
            button.classList.toggle("is-active", action === this.activeSection);
        });
        this.renderStateClasses();
        this.renderContent();
    }

    renderStateClasses() {
        if (!this.root) return;
        const expanded = this.viewState === ADVISOR_VIEW_STATES.EXPANDED;
        this.root.classList.toggle("is-expanded", expanded);
        this.root.classList.toggle("is-collapsed", !expanded);
        this.root.dataset.expandedReason = this.expandedReason || "";
        this.root.querySelector(".advisor-content-panel--side").hidden = !(expanded && this.activeSection);
    }

    renderContent() {
        if (!this.root || !this.activeSection) return;
        const selector = this.viewState === ADVISOR_VIEW_STATES.EXPANDED ? ".advisor-content-panel--side" : ".advisor-content-panel--modal";
        this.contentController.render(this.root.querySelector(selector), this.activeSection);
    }

    renderPopup(item) {
        if (!this.root) return;
        const popup = this.root.querySelector(".advisor-popup-comment");
        popup.textContent = item?.text || "";
        popup.classList.toggle("is-visible", Boolean(item));
    }

    destroy() {
        this.cancelHoverTimers();
        document.removeEventListener("keydown", this.handleKeydown);
        this.unsubscribeDialogue?.();
        this.eventBridge.destroy();
        this.dialogueSystem.destroy();
        this.root?.remove();
        this.root = null;
    }
}
