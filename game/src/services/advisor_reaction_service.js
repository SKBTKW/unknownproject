import { AdvisorCueResolver } from "./advisor_cue_resolver.js";

function defaultPickLine(lines) {
    return Array.isArray(lines) && lines.length > 0 ? lines[0] : null;
}

function defaultReactionPriority(scene) {
    if (scene === "GAME_OVER" || scene === "RUN_CLEAR" || scene === "THIRD_TRIAL_VICTORY") return 100;
    if (scene?.startsWith?.("TRIAL_")) return 90;
    if (scene === "CIVILIANS_LOST" || scene === "FOOD_CRITICAL") return 90;
    return 70;
}

// Character Reaction only. Required Advisor Duty / warnings are intentionally outside this service.
export class AdvisorReactionService {
    constructor({
        gameFactHub,
        character,
        cueResolver = new AdvisorCueResolver(),
        pickLine = defaultPickLine
    } = {}) {
        if (!gameFactHub || typeof gameFactHub.subscribe !== "function") {
            throw new TypeError("ADVISOR_GAME_FACT_HUB_REQUIRED");
        }
        if (!character || typeof character !== "object") {
            throw new TypeError("ADVISOR_CHARACTER_REQUIRED");
        }

        this.gameFactHub = gameFactHub;
        this.character = character;
        this.cueResolver = cueResolver;
        this.pickLine = pickLine;
        this.listeners = new Set();
        this.unsubscribeFactHub = gameFactHub.subscribe(fact => this.handleFact(fact));
    }

    handleFact(fact) {
        const cue = this.cueResolver.resolve(fact);
        if (!cue) return null;

        const reaction = this.character.reactions?.[cue.type];
        if (!reaction) return null;

        const line = this.pickLine(reaction.lines || []);
        if (!line) return null;

        const presentation = Object.freeze({
            characterId: this.character.id,
            scene: cue.type,
            expression: reaction.expression || "NORMAL",
            line,
            priority: Number.isFinite(reaction.priority) ? reaction.priority : defaultReactionPriority(cue.type),
            payload: cue.payload || {}
        });

        this.listeners.forEach(listener => listener(presentation));
        return presentation;
    }

    subscribe(listener) {
        if (typeof listener !== "function") throw new TypeError("ADVISOR_REACTION_LISTENER_REQUIRED");
        this.listeners.add(listener);
        return () => this.listeners.delete(listener);
    }

    dispose() {
        this.unsubscribeFactHub?.();
        this.unsubscribeFactHub = null;
        this.listeners.clear();
    }
}

export default AdvisorReactionService;
