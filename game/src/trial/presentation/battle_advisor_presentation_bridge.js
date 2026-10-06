import { BattlePresentationRuntimeBridge } from "./battle_presentation_runtime_bridge.js";

/**
 * Fail-open delivery boundary for battle Advisor presentation.
 *
 * Input authority is the canonical Battle Resolution Snapshot. The injected
 * emitter receives only the already-sanitized semantic projection produced by
 * BattlePresentationRuntimeBridge / TrialBattleAdvisorSemanticProvider.
 */
export class BattleAdvisorPresentationBridge {
    constructor({
        runtimeBridge = new BattlePresentationRuntimeBridge(),
        enabledProvider = () => true,
        emitSemantic = () => false
    } = {}) {
        this.runtimeBridge = runtimeBridge;
        this.enabledProvider = enabledProvider;
        this.emitSemantic = emitSemantic;
    }

    present(snapshot, {
        sceneId,
        narrativeEvent = null,
        savedPresentationState = null,
        replay = false,
        dedupeKey = null
    } = {}) {
        let projected;
        try {
            projected = this.runtimeBridge.projectAdvisorScene(snapshot, {
                sceneId,
                narrativeEvent,
                savedPresentationState,
                replay,
                dedupeKey
            });
        } catch {
            return Object.freeze({
                available: false,
                shouldEmit: false,
                emitted: false,
                reason: "ADVISOR_PROJECTION_FAILED",
                semantic: null,
                presentationState: savedPresentationState || null
            });
        }

        if (!projected?.available || !projected.shouldEmit || !projected.semantic) {
            return Object.freeze({
                available: projected?.available === true,
                shouldEmit: false,
                emitted: false,
                reason: projected?.available === true ? "ALREADY_PRESENTED" : "ADVISOR_SEMANTIC_UNAVAILABLE",
                semantic: projected?.semantic ?? null,
                presentationState: projected?.presentationState ?? savedPresentationState ?? null
            });
        }

        let enabled = false;
        try {
            enabled = Boolean(this.enabledProvider());
        } catch {
            enabled = false;
        }
        if (!enabled) {
            return Object.freeze({
                available: true,
                shouldEmit: false,
                emitted: false,
                reason: "ADVISOR_DISABLED",
                semantic: projected.semantic,
                presentationState: projected.presentationState
            });
        }

        try {
            const emitted = this.emitSemantic(projected.semantic) !== false;
            return Object.freeze({
                available: true,
                shouldEmit: true,
                emitted,
                reason: emitted ? null : "ADVISOR_PRESENTATION_REJECTED",
                semantic: projected.semantic,
                presentationState: projected.presentationState
            });
        } catch {
            return Object.freeze({
                available: true,
                shouldEmit: true,
                emitted: false,
                reason: "ADVISOR_PRESENTATION_FAILED",
                semantic: projected.semantic,
                presentationState: projected.presentationState
            });
        }
    }
}

export default BattleAdvisorPresentationBridge;
