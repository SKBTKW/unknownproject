import { GAME_FACT_TYPES } from '../../core/game_fact.js';
import { ADVISOR_EVENTS } from './advisor_dialogue_database.js';
import { AdvisorRuntimeState } from './advisor_runtime_state.js';
import { createAdvisorPeaceSnapshot, resolveAdvisorPeaceStates } from './advisor_peace_state_resolver.js';
import { AdvisorReactionEvaluator } from './advisor_reaction_evaluator.js';
import {
    resolveAdvisorGlobalEventChoiceReaction
} from './advisor_global_event_choice_reaction_resolver.js';
import {
    ADVISOR_GLOBAL_EVENT_CHOICE_TIMINGS
} from './advisor_global_event_choice_reactions.js';
import { ADVISOR_NEUTRAL_PERSONALITY } from './advisor_global_event_neutral_reactions.js';

export class AdvisorEventBridge {
    constructor(dialogueSystem, gameFactHub = null, { profile = null, enabledProvider = () => true, rng = Math.random, neutralNarrationSink = null } = {}) {
        this.dialogueSystem = dialogueSystem;
        this.profile = profile;
        this.enabledProvider = enabledProvider;
        this.neutralNarrationSink = typeof neutralNarrationSink === "function" ? neutralNarrationSink : null;
        this.runtime = new AdvisorRuntimeState();
        this.evaluator = new AdvisorReactionEvaluator({ rng });
        this.previous = null;
        this.globalEventManager = null;
        this.unsubscribeGlobalEvent = null;
        this.unsubscribeFact = gameFactHub?.subscribe?.(fact => {
            if (fact.type === GAME_FACT_TYPES.TRIAL_PLAN_CONFIRMED) {
                if (this.enabledProvider()) this.dialogueSystem.emit(ADVISOR_EVENTS.TRIAL_PLAN_CONFIRMED, fact.payload);
                return;
            }
            if (fact.type === GAME_FACT_TYPES.GLOBAL_EVENT_CHOICE_PRESENTED) {
                this.handleGlobalEventChoiceFact(ADVISOR_GLOBAL_EVENT_CHOICE_TIMINGS.PRESENTED, fact.payload);
                return;
            }
            if (fact.type === GAME_FACT_TYPES.GLOBAL_EVENT_CHOICE_RESOLVED) {
                this.handleGlobalEventChoiceFact(ADVISOR_GLOBAL_EVENT_CHOICE_TIMINGS.RESOLVED, fact.payload);
            }
        }) || null;
    }

    handleGlobalEventChoiceFact(timing, payload = {}) {
        const advisorEnabled = Boolean(this.enabledProvider());
        const personality = advisorEnabled
            ? this.profile?.personality
            : ADVISOR_NEUTRAL_PERSONALITY;
        const reaction = resolveAdvisorGlobalEventChoiceReaction({
            eventId: payload.eventId,
            personality,
            timing,
            choiceId: payload.choiceId || null,
            publicContext: payload.publicContext || {},
            publicOutcomeTags: payload.publicOutcomeTags || []
        });
        if (!reaction) return false;
        if (!advisorEnabled && this.neutralNarrationSink) {
            return this.neutralNarrationSink(reaction) !== false;
        }
        return this.dialogueSystem.emitResolved(reaction);
    }

    ensureGlobalEventSubscription(manager) {
        if (manager === this.globalEventManager) return;
        this.unsubscribeGlobalEvent?.();
        this.unsubscribeGlobalEvent = null;
        this.globalEventManager = manager || null;
        if (!this.globalEventManager?.subscribe) return;
        this.unsubscribeGlobalEvent = this.globalEventManager.subscribe(notification => {
            if (!notification || notification.timing !== "START") return;
            if (!this.enabledProvider()) return;
            if (String(notification.importance || "MAJOR").toUpperCase() !== "MAJOR") return;
            const turn = Number(notification.turn || 1);
            this.emitImmediate(this.evaluator.evaluateGlobalEvent(notification, this.runtime, turn), turn);
        });
    }

    observeSnapshot(snapshot) {
        if (!snapshot) return;
        const enabled = Boolean(this.enabledProvider());
        const current = {
            turn: snapshot.turn,
            trialActive: Boolean(snapshot.trialActive),
            state: snapshot.state || {},
            zoneCount: Number(snapshot.zoneCount || 0),
            linkCount: Number(snapshot.linkCount || 0)
        };
        this.ensureGlobalEventSubscription(current.state?.globalEventManager || null);
        const peaceActive = !current.trialActive;
        if (!this.previous) {
            if (enabled && peaceActive && this.dialogueSystem.emit(ADVISOR_EVENTS.GAME_START, current)) this.runtime.recordSpeech("game_start", current.turn);
        } else {
            if (enabled && peaceActive) {
                this.observeMilestones(current);
                if (current.turn !== this.previous.turn) this.evaluateTurn(current);
            }
            if (enabled && current.trialActive && !this.previous.trialActive) this.dialogueSystem.emit(ADVISOR_EVENTS.TRIAL_START, current);
            if (enabled && !current.trialActive && this.previous.trialActive) this.dialogueSystem.emit(ADVISOR_EVENTS.TRIAL_END, current);
        }
        this.previous = current;
    }

    evaluateTurn(current) {
        const states = this.withRecoveryStates(resolveAdvisorPeaceStates(createAdvisorPeaceSnapshot(current.state)));
        const result = this.evaluator.evaluateTurn({ states, runtime: this.runtime, profile: this.profile, turn: current.turn, peaceActive: true });
        if (result && this.dialogueSystem.emitTopic(result, { turn: current.turn })) this.runtime.recordSpeech(result.topic, current.turn);
    }

    withRecoveryStates(states) {
        const next = [...states];
        const currentTopics = new Set(states.map(state => state.topic));
        [["ember", "EMBER_RECOVERED"], ["survival", "FOOD_RECOVERED"], ["logistics", "FOOD_RECOVERED"]].forEach(([topic, id]) => {
            const previous = this.runtime.previousResolvedStates.get(topic);
            if (!currentTopics.has(topic) && previous && /(WARNING|CRITICAL)/.test(previous)) next.push({ id, topic, severity: 1 });
        });
        return next;
    }

    observeMilestones(current) {
        if (current.zoneCount > this.previous.zoneCount) this.emitImmediate(this.evaluator.evaluateMilestone("ZONE_COMPLETED", this.runtime), current.turn);
        if (current.linkCount > this.previous.linkCount) this.emitImmediate(this.evaluator.evaluateMilestone("LINK_COMPLETED", this.runtime), current.turn);
    }

    observeMilitaryAction(actionType, turn) {
        if (!this.enabledProvider()) return false;
        return this.emitImmediate(this.evaluator.evaluateMilitaryAction(actionType, this.runtime), turn);
    }

    emitImmediate(result, turn) {
        if (!result || (!result.mandatory && this.profile?.policy?.[result.topic] < 3)) return false;
        const emitted = this.dialogueSystem.emitTopic(result, { turn });
        if (emitted) this.runtime.recordSpeech(result.topic, turn);
        return emitted;
    }

    destroy() {
        this.unsubscribeGlobalEvent?.();
        this.unsubscribeGlobalEvent = null;
        this.globalEventManager = null;
        if (this.unsubscribeFact) this.unsubscribeFact();
        this.unsubscribeFact = null;
    }
}
