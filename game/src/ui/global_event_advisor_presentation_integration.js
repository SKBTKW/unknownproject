import { ADVISOR_SCENES } from "../data/advisor_scene_catalog.js";
import { ADVISOR_EVENTS } from "./advisor/advisor_dialogue_database.js";

const DEMIHUMAN_TRACES_EVENT_ID = "EVENT_DEMIHUMAN_TRACES";
const FIRST_RUN_BACKGROUND_SCENE_KEY = "GLOBAL_EVENT_DEMIHUMAN_TRACES_ADVISOR_BACKGROUND";

export class GlobalEventAdvisorPresentationIntegration {
    constructor(uiController) {
        this.ui = uiController || null;
        this.engine = uiController?.engine || null;
        this.unsubscribeAdvisorDialogue = null;
        this.activeAdvisorSpeechEvent = null;
        this.runtime = null;
    }

    onPresented(presentation, runtime, { source = "LIFECYCLE" } = {}) {
        if (presentation?.eventId !== DEMIHUMAN_TRACES_EVENT_ID) return false;

        const dock = this.ui?.advisorDockComponent || null;
        if (!dock?.isEnabled?.()) return false;
        if (typeof dock.dialogueSystem?.subscribe !== "function") return false;
        if (typeof dock.consumeSemanticScene !== "function") return false;

        const firstRunState = this.engine?.firstRunState || null;
        const firstRun = firstRunState?.active === true;
        const firstPresentation = firstRun
            && firstRunState?.hasSceneOccurred?.(FIRST_RUN_BACKGROUND_SCENE_KEY) !== true;

        // Restore may reconstruct the GE shell, but must not replay an Advisor line
        // that was already presented and recorded before the snapshot.
        if (source === "RESTORE" && !firstPresentation) return false;

        const expectedEvent = firstPresentation
            ? ADVISOR_EVENTS.GLOBAL_EVENT_PRESENTED_FIRST_RUN
            : ADVISOR_EVENTS.GLOBAL_EVENT_PRESENTED_BRIEF;

        this.detachDialogueSubscription();
        this.activeAdvisorSpeechEvent = expectedEvent;
        let speechStarted = false;
        let occurrenceRecorded = false;
        const unsubscribe = dock.dialogueSystem.subscribe(item => {
            if (item?.event === expectedEvent) {
                speechStarted = true;
                if (firstPresentation && !occurrenceRecorded) {
                    firstRunState?.recordScene?.(FIRST_RUN_BACKGROUND_SCENE_KEY);
                    occurrenceRecorded = true;
                }
                return;
            }
            if (speechStarted && item === null) this.releaseRuntimeLock();
        });
        if (typeof unsubscribe !== "function") {
            this.activeAdvisorSpeechEvent = null;
            return false;
        }
        this.unsubscribeAdvisorDialogue = unsubscribe;
        this.runtime = runtime || null;

        try {
            runtime?.setAdvisorActive?.(true);
            dock.expand?.("click");

            const emitted = dock.consumeSemanticScene({
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

            if (!emitted) {
                this.releaseRuntimeLock();
                return false;
            }
            return true;
        } catch {
            this.releaseRuntimeLock();
            return false;
        }
    }

    releaseRuntimeLock() {
        this.detachDialogueSubscription();
        this.activeAdvisorSpeechEvent = null;
        this.runtime?.releaseInteractionLock?.();
        this.runtime = null;
        return true;
    }

    detachDialogueSubscription() {
        this.unsubscribeAdvisorDialogue?.();
        this.unsubscribeAdvisorDialogue = null;
    }

    destroy(runtime = null) {
        this.detachDialogueSubscription();
        this.activeAdvisorSpeechEvent = null;
        if (runtime && this.runtime === runtime) this.runtime = null;
    }
}

export default GlobalEventAdvisorPresentationIntegration;
