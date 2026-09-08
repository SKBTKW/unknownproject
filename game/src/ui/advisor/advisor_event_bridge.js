import { GAME_FACT_TYPES } from '../../core/game_fact.js';
import { ADVISOR_EVENTS } from './advisor_dialogue_database.js';

export class AdvisorEventBridge {
    constructor(dialogueSystem, gameFactHub = null) {
        this.dialogueSystem = dialogueSystem;
        this.previous = null;
        this.unsubscribeFact = gameFactHub?.subscribe?.(fact => {
            if (fact.type === GAME_FACT_TYPES.TRIAL_PLAN_CONFIRMED) {
                this.dialogueSystem.emit(ADVISOR_EVENTS.TRIAL_PLAN_CONFIRMED, fact.payload);
            }
        }) || null;
    }

    observeSnapshot(snapshot) {
        if (!snapshot) return;
        const current = {
            turn: snapshot.turn,
            trialActive: Boolean(snapshot.trialActive),
            trialRemaining: snapshot.trialRemaining
        };
        if (!this.previous) {
            this.dialogueSystem.emit(ADVISOR_EVENTS.GAME_START, current);
        } else {
            if (current.turn !== this.previous.turn) this.dialogueSystem.emit(ADVISOR_EVENTS.TURN_START, current);
            if (current.trialActive && !this.previous.trialActive) this.dialogueSystem.emit(ADVISOR_EVENTS.TRIAL_START, current);
            if (!current.trialActive && this.previous.trialActive) this.dialogueSystem.emit(ADVISOR_EVENTS.TRIAL_END, current);
            if (current.trialRemaining >= 0 && current.trialRemaining <= 1 && current.trialRemaining !== this.previous.trialRemaining) {
                this.dialogueSystem.emit(ADVISOR_EVENTS.TRIAL_WARNING, current);
            }
        }
        this.previous = current;
    }

    destroy() {
        if (this.unsubscribeFact) this.unsubscribeFact();
        this.unsubscribeFact = null;
    }
}
