import { BattleNarrativeProjector, BATTLE_PRESENTATION_MODES } from "./battle_narrative_projector.js";
import { BattlePresentationState } from "./battle_presentation_state.js";
import { TrialBattleAdvisorSemanticProvider } from "./trial_battle_advisor_semantic_provider.js";
import { createResolvedBattleDicePresentation } from "./resolved_battle_dice_presentation.js";

function cloneData(value) {
    if (value === undefined) return undefined;
    return JSON.parse(JSON.stringify(value));
}

/**
 * Presentation-only bridge for a Battle Resolution Snapshot.
 *
 * This class never mutates gameplay state, never rolls RNG, never decides
 * Opportunity/Fortune/Decisive semantics, and never writes back to Trial.
 * It only projects an already-created immutable snapshot into B-owned read
 * models that runtime/UI may consume.
 */
export class BattlePresentationRuntimeBridge {
    constructor({
        narrativeProjector = new BattleNarrativeProjector(),
        advisorSemanticProvider = new TrialBattleAdvisorSemanticProvider()
    } = {}) {
        this.narrativeProjector = narrativeProjector;
        this.advisorSemanticProvider = advisorSemanticProvider;
    }

    project(snapshot, {
        mode = BATTLE_PRESENTATION_MODES.FULL,
        savedPresentationState = null
    } = {}) {
        if (!snapshot || typeof snapshot !== "object") {
            return Object.freeze({
                available: false,
                battleId: null,
                routeId: null,
                mode,
                narrative: null,
                presentationState: null,
                dicePresentation: null
            });
        }

        const before = JSON.stringify(snapshot);
        const state = new BattlePresentationState({ presentationMode: mode });
        state.restoreFromSnapshot(snapshot, savedPresentationState || {});
        if (!savedPresentationState?.presentationMode) state.setMode(mode);

        const narrative = this.narrativeProjector.project(snapshot, {
            mode: state.presentationMode
        });
        const dicePresentation = createResolvedBattleDicePresentation(snapshot);

        if (JSON.stringify(snapshot) !== before) {
            throw new Error("BATTLE_PRESENTATION_BRIDGE_MUTATED_SNAPSHOT");
        }

        return Object.freeze({
            available: true,
            battleId: snapshot.battleId ?? snapshot.id ?? null,
            routeId: snapshot.routeId ?? null,
            mode: state.presentationMode,
            narrative,
            presentationState: state.serialize(),
            dicePresentation
        });
    }

    projectAdvisorScene(snapshot, {
        sceneId,
        narrativeEvent = null,
        savedPresentationState = null,
        replay = false,
        dedupeKey = null
    } = {}) {
        if (!snapshot || typeof snapshot !== "object" || !sceneId) {
            return Object.freeze({
                available: false,
                shouldEmit: false,
                semantic: null,
                presentationState: savedPresentationState ? cloneData(savedPresentationState) : null
            });
        }

        const state = new BattlePresentationState();
        state.restoreFromSnapshot(snapshot, savedPresentationState || {});
        if (replay) state.startReplay({ replayAdvisor: true });

        const key = dedupeKey ?? (snapshot.battleId ?? snapshot.id ?? "");
        if (state.hasAdvisorScenePlayed(sceneId, key, { replay: state.replaying })) {
            return Object.freeze({
                available: true,
                shouldEmit: false,
                semantic: null,
                presentationState: state.serialize()
            });
        }

        const semantic = this.advisorSemanticProvider.projectOptional({
            sceneId,
            snapshot,
            narrativeEvent
        });
        if (!semantic) {
            return Object.freeze({
                available: false,
                shouldEmit: false,
                semantic: null,
                presentationState: state.serialize()
            });
        }

        state.markAdvisorScenePlayed(sceneId, key, { replay: state.replaying });
        return Object.freeze({
            available: true,
            shouldEmit: true,
            semantic,
            presentationState: state.serialize()
        });
    }
}

export default BattlePresentationRuntimeBridge;
