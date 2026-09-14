import { I18n } from '../i18n.js';
import { GlobalEventChoiceSystem } from '../systems/global_event_choice_system.js';
import { GlobalEventChoiceComponent } from './global_event_choice_component.js';
import { choiceText } from './global_event_choice_i18n.js';

export class GlobalEventChoiceRuntimeIntegration {
    constructor(uiController) {
        this.ui = uiController;
        this.engine = uiController?.engine || null;
        this.manager = this.engine?.globalEventManager || null;
        this.active = null;
        this.system = new GlobalEventChoiceSystem({ factHub: uiController?.trialController?.gameFactHub || null });
        this.component = typeof document !== 'undefined'
            ? new GlobalEventChoiceComponent({ i18n: I18n, onChoose: choiceId => this.resolve(choiceId) })
            : null;
        this.component?.mount(document.body);

        const bridge = uiController?.advisorDockComponent?.eventBridge;
        if (bridge) {
            bridge.choiceReactionSink = reaction => this.component?.setAdvisorReaction(reaction) ?? false;
            bridge.neutralNarrationSink = reaction => this.component?.setNeutralReaction(reaction) ?? false;
        }

        this.unsubscribe = this.manager?.subscribe?.(notification => {
            if (notification?.timing !== 'START' || !notification.choiceEventId || !notification.publicContext) return;
            this.present(notification.choiceEventId, notification.publicContext, notification.eventId);
        }) || null;
    }

    present(eventId, publicContext, sourceEventId = null) {
        if (!this.component || !eventId || !publicContext) return null;
        const presentation = this.system.createPresentation(eventId, publicContext);
        this.active = { eventId, publicContext, sourceEventId };
        this.component.show(presentation);
        return presentation;
    }

    resolve(choiceId) {
        if (!this.active) return null;
        const { eventId, publicContext, sourceEventId } = this.active;
        const resolution = this.system.resolveChoice(eventId, choiceId, publicContext);
        if (sourceEventId) this.manager?.markChoiceResolved?.(sourceEventId, resolution);
        const turn = Number(this.ui?.state?.turn || 1);
        this.engine?.chronicleSystem?.record?.({
            turn,
            type: 'GLOBAL_EVENT_CHOICE',
            id: `${eventId}_${turn}_${choiceId}`,
            nameKey: 'EVENT_DEMIHUMAN_SCOUTS_NAME',
            importance: 'MAJOR',
            meta: {
                eventId,
                choiceId,
                publicOutcomeTags: [...(resolution.publicOutcomeTags || [])],
                publicContext: JSON.parse(JSON.stringify(publicContext))
            }
        });
        this.ui?.state?.addLog?.(`🌍 ${choiceText(I18n, `RESULT_${choiceId}`)}`);
        this.active = null;
        this.component.showResolution(resolution);
        return resolution;
    }

    resumePending() {
        if (this.active || !this.component?.root?.hidden) return null;
        const pending = this.manager?.getPendingChoice?.();
        if (!pending) return null;
        return this.present(pending.eventId, pending.publicContext, pending.sourceEventId);
    }

    destroy() {
        this.unsubscribe?.();
        this.unsubscribe = null;
    }
}

export default GlobalEventChoiceRuntimeIntegration;
