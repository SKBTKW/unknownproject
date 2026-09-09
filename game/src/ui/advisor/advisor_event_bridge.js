import { GAME_FACT_TYPES } from '../../core/game_fact.js';
import { ADVISOR_EVENTS } from './advisor_dialogue_database.js';
import { AdvisorRuntimeState } from './advisor_runtime_state.js';
import { createAdvisorPeaceSnapshot, resolveAdvisorPeaceStates } from './advisor_peace_state_resolver.js';
import { AdvisorReactionEvaluator } from './advisor_reaction_evaluator.js';

export class AdvisorEventBridge {
    constructor(dialogueSystem, gameFactHub = null, { profile = null, enabledProvider = () => true, rng = Math.random } = {}) {
        this.dialogueSystem = dialogueSystem;
        this.profile = profile;
        this.enabledProvider = enabledProvider;
        this.runtime = new AdvisorRuntimeState();
        this.evaluator = new AdvisorReactionEvaluator({ rng });
        this.previous = null;
        this.unsubscribeFact = gameFactHub?.subscribe?.(fact => {
            if (fact.type === GAME_FACT_TYPES.TRIAL_PLAN_CONFIRMED) {
                this.dialogueSystem.emit(ADVISOR_EVENTS.TRIAL_PLAN_CONFIRMED, fact.payload);
            }
        }) || null;
    }

    observeSnapshot(snapshot) {
        if (!snapshot) return;
        const enabled = Boolean(this.enabledProvider());
        const current = {
            turn: snapshot.turn,
            trialActive: Boolean(snapshot.trialActive),
            trialRemaining: snapshot.trialRemaining,
            warningDuration: Number(snapshot.warningDuration ?? 5),
            state: snapshot.state || {},
            zoneCount: Number(snapshot.zoneCount || 0),
            linkCount: Number(snapshot.linkCount || 0),
            activeGlobalEvents: snapshot.activeGlobalEvents || []
        };
        const peaceActive = !current.trialActive && (current.trialRemaining < 0 || current.trialRemaining > current.warningDuration);
        if (!this.previous) {
            if (enabled && peaceActive && this.dialogueSystem.emit(ADVISOR_EVENTS.GAME_START, current)) this.runtime.recordSpeech("game_start", current.turn);
        } else {
            if (enabled && peaceActive) {
                this.observeMilestones(current);
                this.observeGlobalEvents(current);
                if (current.turn !== this.previous.turn) this.evaluateTurn(current);
            }
            if (enabled && current.trialActive && !this.previous.trialActive) this.dialogueSystem.emit(ADVISOR_EVENTS.TRIAL_START, current);
            if (enabled && !current.trialActive && this.previous.trialActive) this.dialogueSystem.emit(ADVISOR_EVENTS.TRIAL_END, current);
            if (enabled && current.trialRemaining >= 0 && current.trialRemaining <= 1 && current.trialRemaining !== this.previous.trialRemaining) {
                this.dialogueSystem.emit(ADVISOR_EVENTS.TRIAL_WARNING, current);
            }
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

    observeGlobalEvents(current) {
        const previousIds = new Set(this.previous.activeGlobalEvents.map(event => event.id));
        current.activeGlobalEvents.filter(event => !previousIds.has(event.id)).forEach(event => this.emitImmediate(this.evaluator.evaluateGlobalEvent(event, this.runtime, current.turn), current.turn));
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
        if (this.unsubscribeFact) this.unsubscribeFact();
        this.unsubscribeFact = null;
    }
}
