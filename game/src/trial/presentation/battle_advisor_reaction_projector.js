import {
    ADVISOR_DIALOGUE_CHANNELS,
    getAdvisorSceneResponsibility
} from "../../data/advisor_dialogue_responsibility.js";

function defaultPickLine(lines) {
    return Array.isArray(lines) && lines.length > 0 ? lines[0] : null;
}

function defaultPriority(sceneId) {
    return typeof sceneId === "string" && sceneId.startsWith("TRIAL_") ? 90 : 70;
}

/**
 * Projects an already-sanitized Battle Advisor semantic payload into a
 * character reaction presentation. No GameFact emission or gameplay lookup.
 */
export class BattleAdvisorReactionProjector {
    constructor({ pickLine = defaultPickLine } = {}) {
        this.pickLine = pickLine;
    }

    project({ semantic, character } = {}) {
        const sceneId = semantic?.sceneId;
        if (typeof sceneId !== "string" || !sceneId) return null;
        if (!character || typeof character !== "object") return null;

        const responsibility = getAdvisorSceneResponsibility(sceneId);
        if (responsibility?.channel !== ADVISOR_DIALOGUE_CHANNELS.REACTION) return null;

        const reaction = character.reactions?.[sceneId];
        if (!reaction || typeof reaction !== "object") return null;

        const line = this.pickLine(reaction.lines || []);
        if (typeof line !== "string" || !line.trim()) return null;

        return Object.freeze({
            characterId: character.id ?? null,
            scene: sceneId,
            expression: reaction.expression || "NORMAL",
            line: line.trim(),
            priority: Number.isFinite(Number(reaction.priority))
                ? Number(reaction.priority)
                : defaultPriority(sceneId),
            payload: semantic
        });
    }
}

export default BattleAdvisorReactionProjector;
