import { I18n } from "../i18n.js";
import GlobalEventPublicPresentationReadModel from "../presentation/global_event/global_event_public_presentation_read_model.js";
import GlobalEventPublicPresentationBridge from "../presentation/global_event/global_event_public_presentation_bridge.js";
import { GlobalEventPresentationComponent } from "./global_event_presentation_component.js";
import { GlobalEventPresentationRuntimeState } from "./global_event_presentation_runtime_state.js";
import { GlobalEventChoiceRuntimeIntegration } from "./global_event_choice_runtime_integration.js";
import { ADVISOR_SCENES } from "../data/advisor_scene_catalog.js";
import { ADVISOR_EVENTS } from "./advisor/advisor_dialogue_database.js";

function presentationKey(presentation) {
    if (!presentation?.eventId) return null;
    return `${presentation.eventId}:${Number.isInteger(presentation.turn) ? presentation.turn : "NA"}`;
}

export class GlobalEventPresentationRuntimeIntegration {
    constructor(uiController, {
        readModel = new GlobalEventPublicPresentationReadModel(),
        component = null
    } = {}) {
        this.ui = uiController || null;
        this.engine = uiController?.engine || null;
        this.manager = this.engine?.globalEventManager || null;
        this.readModel = readModel;
        this.state = new GlobalEventPresentationRuntimeState();
        this.unsubscribeAdvisorDialogue = null;
        this.activeAdvisorSpeechEvent = null;
        this.component = component || (typeof document !== "undefined"
            ? new GlobalEventPresentationComponent({
                i18n: I18n,
                onAction: actionId => this.handleAction(actionId)
            })
            : null);
        this.component?.mount?.(typeof document !== "undefined" ? document.body : null);
        this.bridge = new GlobalEventPublicPresentationBridge({
            readModel: this.readModel,
            sink: presentation => this.present(presentation)
        });
        this.attachResult = this.manager ? this.bridge.attach({ globalEventManager: this.manager }) : {
            success: false,
            reason: "GLOBAL_EVENT_LIFECYCLE_REQUIRED"
        };
    }

    present(presentation) {
        if (!presentation || presentation.presentationMode !== "NOTICE" || presentation.actionKind !== "CONFIRM") return null;
        const key = presentationKey(presentation);
        if (!key) return null;
        if (this.state.activePresentationKey === key) return null;
        if (this.state.lastDismissedPresentationKey === key) return null;

        const view = Object.freeze({
            ...presentation,
            actions: Object.freeze([Object.freeze({
                id: "CONFIRM",
                labelKey: "UI_CONFIRM",
                primary: true
            })])
        });
        this.state.open(key);
        this.component?.show?.(view);
        this.component?.setInteractionLocked?.(true);
        this.activateAdvisorForPresentation(view);
        return view;
    }

    activateAdvisorForPresentation(presentation) {
        if (presentation?.eventId !== "EVENT_DEMIHUMAN_TRACES") {
            this.releaseInteractionLock();
            return false;
        }

        const dock = this.ui?.advisorDockComponent || null;
        if (!dock?.isEnabled?.()) {
            this.releaseInteractionLock();
            return false;
        }

        const firstRunState = this.engine?.firstRunState || null;
        const firstRun = firstRunState?.active === true;
        const backgroundSceneKey = "GLOBAL_EVENT_DEMIHUMAN_TRACES_ADVISOR_BACKGROUND";
        const firstPresentation = firstRun && firstRunState?.hasSceneOccurred?.(backgroundSceneKey) !== true;
        if (firstPresentation) firstRunState?.recordScene?.(backgroundSceneKey);

        const expectedEvent = firstPresentation
            ? ADVISOR_EVENTS.GLOBAL_EVENT_PRESENTED_FIRST_RUN
            : ADVISOR_EVENTS.GLOBAL_EVENT_PRESENTED_BRIEF;

        this.unsubscribeAdvisorDialogue?.();
        this.unsubscribeAdvisorDialogue = null;
        this.activeAdvisorSpeechEvent = expectedEvent;
        let speechStarted = false;
        this.unsubscribeAdvisorDialogue = dock.dialogueSystem?.subscribe?.(item => {
            if (item?.event === expectedEvent) {
                speechStarted = true;
                return;
            }
            if (speechStarted && item === null) this.releaseInteractionLock();
        }) || null;

        this.state.setAdvisorActive(true);
        dock.expand?.("click");

        const emitted = dock.consumeSemanticScene?.({
            sceneId: ADVISOR_SCENES.GLOBAL_EVENT_PRESENTED,
            verse: Number.isInteger(presentation.turn) ? presentation.turn : Number(this.ui?.state?.turn || 1),
            context: Object.freeze({
                eventId: presentation.eventId,
                category: presentation.category || null,
                presentationKind: presentation.presentationKind || null,
                publicKnowledge: presentation.publicKnowledge || null,
                firstRun,
                firstPresentation
            })
        }) === true;

        if (!emitted) this.releaseInteractionLock();
        return emitted;
    }

    releaseInteractionLock() {
        this.unsubscribeAdvisorDialogue?.();
        this.unsubscribeAdvisorDialogue = null;
        this.activeAdvisorSpeechEvent = null;
        this.state.setAdvisorActive(false);
        this.state.setInteractionLocked(false);
        this.component?.setInteractionLocked?.(false);
        return true;
    }

    handleAction(actionId) {
        if (actionId !== "CONFIRM" || !this.state.isOpen() || this.state.isInteractionLocked()) return false;
        this.state.beginResolution();
        this.component?.hide?.();
        this.state.close();
        return true;
    }

    isInteractionLocked() {
        return this.state.isInteractionLocked();
    }

    setAdvisorActive(active) {
        return this.state.setAdvisorActive(active);
    }

    reconcileActive() {
        if (this.state.isOpen()) return null;
        const activeEvents = this.manager?.state?.activeGlobalEvents;
        if (!Array.isArray(activeEvents)) return null;
        for (const activeEvent of activeEvents) {
            if (activeEvent?.runtimeState?.choice?.status === "PENDING") continue;
            const projection = this.readModel.projectActive(activeEvent, {
                turn: Number.isInteger(this.manager?.state?.turn) ? this.manager.state.turn : null
            });
            if (!projection) continue;
            const result = this.present(projection);
            if (result) return result;
        }
        return null;
    }

    destroy() {
        this.bridge?.detach?.();
        this.unsubscribeAdvisorDialogue?.();
        this.unsubscribeAdvisorDialogue = null;
        this.component?.destroy?.();
        this.state.close();
    }
}

export function attachGlobalEventPresentation(uiController) {
    if (!uiController?.engine?.globalEventManager) {
        return { success: false, reason: "GLOBAL_EVENT_MANAGER_REQUIRED" };
    }

    const notice = new GlobalEventPresentationRuntimeIntegration(uiController);
    const choice = new GlobalEventChoiceRuntimeIntegration(uiController);
    notice.reconcileActive();
    choice.reconcilePending();

    uiController.globalEventPresentationRuntime = notice;
    uiController.globalEventChoiceRuntime = choice;

    return {
        success: notice.attachResult?.success !== false,
        notice,
        choice,
        destroy() {
            notice.destroy();
            choice.destroy();
        }
    };
}

export default GlobalEventPresentationRuntimeIntegration;
