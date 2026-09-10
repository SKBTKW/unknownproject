import { I18n } from '../../i18n.js';
import { DEFAULT_ADVISOR_PROFILE } from './advisor_profiles.js?v=20260909_advisor2';
import { AdvisorDialogueSystem } from './advisor_dialogue_system.js';
import { AdvisorEventBridge } from './advisor_event_bridge.js';
import { AdvisorContentController, ADVISOR_SECTIONS, ADVISOR_REPORT_DEPTHS } from './advisor_content_controller.js';

export const ADVISOR_VIEW_STATES = Object.freeze({ COLLAPSED: "collapsed", EXPANDED: "expanded" });
export const ADVISOR_EXPANDED_REASONS = Object.freeze({ CLICK: "click", HOVER: "hover" });
export const ADVISOR_UI_TIMING = Object.freeze({ HOVER_OPEN_MS: 0, HOVER_CLOSE_MS: 400 });

const defaultSetTimer = (callback, delay) => setTimeout(callback, delay);
const defaultClearTimer = timerId => clearTimeout(timerId);

const NAV_ACTIONS = Object.freeze([
    { action: ADVISOR_SECTIONS.REPORT, icon: "✦" },
    { action: ADVISOR_SECTIONS.RECORD, icon: "▤" },
    { action: ADVISOR_SECTIONS.HELP, icon: "?" },
    { action: "settings", icon: "⚙" }
]);

function isImageElement(el) {
    if (!el) return false;
    if (typeof HTMLImageElement !== "undefined" && el instanceof HTMLImageElement) return true;
    return String(el.tagName || "").toUpperCase() === "IMG";
}

export class AdvisorDockComponent {
    constructor({ stateProvider, trialStatusProvider = () => ({}), settingsModal = null, gameFactHub = null, profile = DEFAULT_ADVISOR_PROFILE, i18n = I18n, setTimer = defaultSetTimer, clearTimer = defaultClearTimer } = {}) {
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
        this.reportBubbleOpen = false;
        this.reportDepthMenuOpen = false;
        this.root = null;
        this.hoverOpenTimer = null;
        this.hoverCloseTimer = null;
        this.contentController = new AdvisorContentController({ i18n, stateProvider, trialStatusProvider });
        this.contentController.onDepthChange = () => {
            this.renderReportBubble();
            this.renderContent();
        };
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
        const hasPortrait = Boolean(this.profile.portrait || this.profile.portraitExpanded || this.profile.portraitCollapsed);
        const portrait = this.createElement(hasPortrait ? "img" : "div", "advisor-portrait");
        portrait.setAttribute("aria-hidden", "true");
        if (isImageElement(portrait)) {
            portrait.alt = "";
            portrait.decoding = "async";
            portrait.draggable = false;
        }
        portraitViewport.appendChild(portrait);
        portraitViewport.appendChild(this.createElement("div", "advisor-profile-name"));
        const popup = this.createElement("div", "advisor-popup-comment");
        popup.setAttribute("aria-live", "polite");
        portraitViewport.appendChild(popup);
        portraitButton.appendChild(portraitViewport);

        const reportBubble = this.createReportBubble();

        const collapseButton = document.createElement("button");
        collapseButton.type = "button";
        collapseButton.className = "advisor-collapse-button";
        collapseButton.textContent = "‹";
        collapseButton.onclick = () => this.collapse();

        const navigation = this.createElement("nav", "advisor-navigation advisor-nav--horizontal");
        NAV_ACTIONS.forEach(({ action, icon }) => navigation.appendChild(this.createNavItem(action, icon)));

        shell.appendChild(portraitButton);
        shell.appendChild(reportBubble);
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
        button.dataset.section = action;
        const iconNode = this.createElement("span", "advisor-nav-icon");
        iconNode.textContent = icon;
        iconNode.setAttribute("aria-hidden", "true");
        const labelNode = this.createElement("span", "advisor-nav-label");
        button.appendChild(iconNode);
        button.appendChild(labelNode);
        button.onclick = () => this.handleAction(action);
        return button;
    }

    createNavItem(action, icon) {
        const item = this.createElement("div", "advisor-nav-item");
        item.appendChild(this.createNavButton(action, icon));
        if (action !== ADVISOR_SECTIONS.REPORT) return item;

        const toggle = document.createElement("button");
        toggle.type = "button";
        toggle.className = "advisor-depth-menu-toggle";
        toggle.textContent = "⋯";
        toggle.onclick = event => {
            event.stopPropagation();
            this.reportDepthMenuOpen = !this.reportDepthMenuOpen;
            this.renderDepthMenu();
        };
        item.appendChild(toggle);

        const menu = this.createElement("div", "advisor-depth-menu");
        menu.hidden = true;
        menu.setAttribute("role", "group");
        ADVISOR_REPORT_DEPTHS.forEach(depth => {
            const button = document.createElement("button");
            button.type = "button";
            button.className = "advisor-depth-menu-option";
            button.dataset.depth = depth;
            button.onclick = event => {
                event.stopPropagation();
                this.contentController.setDepth(depth);
                this.reportDepthMenuOpen = false;
                this.renderDepthMenu();
            };
            menu.appendChild(button);
        });
        item.appendChild(menu);
        return item;
    }

    createReportBubble() {
        const bubble = this.createElement("section", "advisor-report-bubble");
        bubble.hidden = true;
        bubble.setAttribute("aria-live", "polite");
        const text = this.createElement("div", "advisor-report-bubble-text");
        bubble.appendChild(text);
        return bubble;
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
        return this.collapse();
    }

    handleAction(action) {
        if (action === ADVISOR_SECTIONS.REPORT) {
            this.closeModal();
            this.activeSection = this.reportBubbleOpen ? null : ADVISOR_SECTIONS.REPORT;
            this.reportBubbleOpen = !this.reportBubbleOpen;
            this.renderStateClasses();
            this.renderReportBubble();
            return;
        }
        this.reportBubbleOpen = false;
        this.reportDepthMenuOpen = false;
        this.renderReportBubble();
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
        this.reportBubbleOpen = false;
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
        if (this.viewState === ADVISOR_VIEW_STATES.COLLAPSED && !this.reportBubbleOpen) this.activeSection = null;
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
        const portraitActionLabel = this.viewState === ADVISOR_VIEW_STATES.EXPANDED
            ? this.i18n.t("UI_ADVISOR_COLLAPSE")
            : this.i18n.t("UI_ADVISOR_EXPAND");
        portraitButton.title = portraitActionLabel;
        portraitButton.setAttribute("aria-label", portraitActionLabel);
        const collapseButton = this.root.querySelector(".advisor-collapse-button");
        collapseButton.title = this.i18n.t("UI_ADVISOR_COLLAPSE");
        collapseButton.setAttribute("aria-label", this.i18n.t("UI_ADVISOR_COLLAPSE"));
        const modalClose = this.root.querySelector(".advisor-modal-close");
        modalClose.title = this.i18n.t("UI_ADVISOR_MODAL_CLOSE");
        modalClose.setAttribute("aria-label", this.i18n.t("UI_ADVISOR_MODAL_CLOSE"));
        this.root.querySelector(".advisor-profile-name").textContent = this.i18n.t(this.profile.displayNameKey);
        const portrait = this.root.querySelector(".advisor-portrait");
        if (!isImageElement(portrait)) portrait.textContent = this.i18n.t("UI_ADVISOR_PORTRAIT_PENDING");
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
        this.renderReportBubble();
        this.renderDepthMenu();
    }

    renderStateClasses() {
        if (!this.root) return;
        const expanded = this.viewState === ADVISOR_VIEW_STATES.EXPANDED;
        this.root.classList.toggle("is-expanded", expanded);
        this.root.classList.toggle("is-collapsed", !expanded);
        this.root.dataset.expandedReason = this.expandedReason || "";

        const navigation = this.root.querySelector(".advisor-navigation");
        navigation?.classList.toggle("advisor-nav--horizontal", !expanded);
        navigation?.classList.toggle("advisor-nav--vertical", expanded);

        const portrait = this.root.querySelector(".advisor-portrait");
        if (isImageElement(portrait)) {
            const nextSrc = expanded
                ? (this.profile.portraitExpanded || this.profile.portrait)
                : (this.profile.portraitCollapsed || this.profile.portrait);
            if (nextSrc && portrait.src !== nextSrc) portrait.src = nextSrc;
            portrait.dataset.portraitMode = expanded ? "expanded" : "collapsed";
        }

        const collapseButton = this.root.querySelector(".advisor-collapse-button");
        collapseButton?.setAttribute("aria-hidden", expanded ? "false" : "true");
        this.root.querySelector(".advisor-content-panel--side").hidden = !(expanded && this.activeSection && this.activeSection !== ADVISOR_SECTIONS.REPORT);
    }

    renderContent() {
        if (!this.root || !this.activeSection || this.activeSection === ADVISOR_SECTIONS.REPORT) return;
        const selector = this.viewState === ADVISOR_VIEW_STATES.EXPANDED ? ".advisor-content-panel--side" : ".advisor-content-panel--modal";
        this.contentController.render(this.root.querySelector(selector), this.activeSection);
    }

    renderReportBubble() {
        if (!this.root) return;
        const bubble = this.root.querySelector(".advisor-report-bubble");
        if (!bubble) return;
        bubble.hidden = !this.reportBubbleOpen;
        bubble.classList.toggle("is-visible", this.reportBubbleOpen);
        if (!this.reportBubbleOpen) return;
        const text = bubble.querySelector(".advisor-report-bubble-text");
        if (text) text.textContent = this.contentController.getReportText();
    }

    renderDepthMenu() {
        if (!this.root) return;
        const toggle = this.root.querySelector(".advisor-depth-menu-toggle");
        const menu = this.root.querySelector(".advisor-depth-menu");
        if (!toggle || !menu) return;
        const label = this.i18n.t("UI_ADVISOR_REPORT_DEPTH_LABEL");
        toggle.title = label;
        toggle.setAttribute("aria-label", label);
        toggle.setAttribute("aria-expanded", this.reportDepthMenuOpen ? "true" : "false");
        menu.hidden = !this.reportDepthMenuOpen;
        menu.setAttribute("aria-label", label);
        menu.querySelectorAll(".advisor-depth-menu-option").forEach(button => {
            const depth = button.dataset.depth;
            button.textContent = this.i18n.t(`UI_ADVISOR_DEPTH_${depth.toUpperCase()}`);
            button.classList.toggle("is-active", depth === this.contentController.reportDepth);
        });
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
