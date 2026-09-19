import { ADVISOR_DIALOGUE_CHANNELS } from "../../data/advisor_dialogue_responsibility.js";
import { resolveAdvisorPostTrialScene } from "./advisor_post_trial_scene_adapter.js";

function firstReactionLine(reaction) {
    const lines = Array.isArray(reaction?.lines) ? reaction.lines : [];
    return lines.find(line => typeof line === "string" && line.trim()) || null;
}

/**
 * Presentation-only bridge for Post-Trial Advisor scenes.
 *
 * Post-Trial owns occurrence/order/payload. This presenter only chooses the
 * already-declared Advisor responsibility lane and character presentation.
 * Missing character data means intentional silence.
 */
export class AdvisorPostTrialScenePresenter {
    constructor({ dialogueSystem, profile, enabledProvider = () => true } = {}) {
        if (!dialogueSystem) throw new TypeError("ADVISOR_POST_TRIAL_DIALOGUE_SYSTEM_REQUIRED");
        this.dialogueSystem = dialogueSystem;
        this.profile = profile || dialogueSystem.profile || null;
        this.enabledProvider = enabledProvider;
    }

    present(scene = {}) {
        const resolved = resolveAdvisorPostTrialScene(scene);
        if (!resolved) return { success: false, reason: "ADVISOR_POST_TRIAL_SCENE_UNSUPPORTED" };
        if (!this.enabledProvider()) {
            return {
                success: true,
                spoken: false,
                reason: "ADVISOR_DISABLED",
                scene: resolved.advisorScene,
                channel: resolved.channel
            };
        }

        if (resolved.channel === ADVISOR_DIALOGUE_CHANNELS.DUTY) {
            const spoken = Boolean(this.dialogueSystem.emitDutyScene?.(
                resolved.advisorScene,
                resolved.payload || {}
            ));
            return {
                success: true,
                spoken,
                reason: spoken ? null : "ADVISOR_DUTY_SILENT",
                scene: resolved.advisorScene,
                channel: resolved.channel
            };
        }

        if (resolved.channel === ADVISOR_DIALOGUE_CHANNELS.REACTION) {
            const reaction = this.profile?.reactions?.[resolved.advisorScene] || null;
            const line = firstReactionLine(reaction);
            if (!line) {
                return {
                    success: true,
                    spoken: false,
                    reason: "ADVISOR_REACTION_SILENT",
                    scene: resolved.advisorScene,
                    channel: resolved.channel
                };
            }

            const spoken = Boolean(this.dialogueSystem.emitPresentation?.({
                scene: resolved.advisorScene,
                line,
                expression: reaction.expression || "NORMAL",
                priority: reaction.priority,
                durationMs: reaction.durationMs,
                payload: resolved.payload || {}
            }));
            return {
                success: true,
                spoken,
                reason: spoken ? null : "ADVISOR_REACTION_NOT_PRESENTED",
                scene: resolved.advisorScene,
                channel: resolved.channel
            };
        }

        return {
            success: true,
            spoken: false,
            reason: "ADVISOR_POST_TRIAL_CHANNEL_SILENT",
            scene: resolved.advisorScene,
            channel: resolved.channel
        };
    }
}

export default AdvisorPostTrialScenePresenter;
