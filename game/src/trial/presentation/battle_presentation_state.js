import { BATTLE_PRESENTATION_MODES } from "./battle_narrative_projector.js";

function pendingOpportunity(opportunity) {
    if (!opportunity || typeof opportunity !== "object") return false;
    return opportunity.status === "OPPORTUNITY_PENDING"
        || opportunity.state === "OPPORTUNITY_PENDING"
        || opportunity.pending === true;
}

export class BattlePresentationState {
    constructor({ presentationMode = BATTLE_PRESENTATION_MODES.FULL } = {}) {
        this.presentationMode = presentationMode;
        this.currentNarrativeIndex = 0;
        this.skipped = false;
        this.replaying = false;
        this.opportunityPanelOpen = false;
        this.diceAnimationComplete = false;
        this.gameplayAdvisorScenesPlayed = new Set();
        this.replayAdvisorScenesPlayed = new Set();
    }

    setMode(mode) {
        if (!Object.values(BATTLE_PRESENTATION_MODES).includes(mode)) {
            throw new Error(`INVALID_BATTLE_PRESENTATION_MODE:${mode}`);
        }
        this.presentationMode = mode;
        return mode;
    }

    advanceNarrative() {
        this.currentNarrativeIndex += 1;
        return this.currentNarrativeIndex;
    }

    skipToResult() {
        this.skipped = true;
        this.opportunityPanelOpen = false;
        return this;
    }

    startReplay({ replayAdvisor = false } = {}) {
        this.currentNarrativeIndex = 0;
        this.skipped = false;
        this.replaying = true;
        this.opportunityPanelOpen = false;
        this.diceAnimationComplete = false;
        if (!replayAdvisor) this.replayAdvisorScenesPlayed.clear();
        return this;
    }

    endReplay() {
        this.replaying = false;
        return this;
    }

    openOpportunityPanel() {
        this.opportunityPanelOpen = true;
    }

    closeOpportunityPanel() {
        // Presentation close is deliberately not a Domain decline.
        this.opportunityPanelOpen = false;
    }

    markDiceAnimationComplete() {
        this.diceAnimationComplete = true;
    }

    markAdvisorScenePlayed(sceneId, dedupeKey = "", { replay = this.replaying } = {}) {
        const key = `${sceneId}:${dedupeKey}`;
        const set = replay ? this.replayAdvisorScenesPlayed : this.gameplayAdvisorScenesPlayed;
        if (set.has(key)) return false;
        set.add(key);
        return true;
    }

    hasAdvisorScenePlayed(sceneId, dedupeKey = "", { replay = this.replaying } = {}) {
        const key = `${sceneId}:${dedupeKey}`;
        return (replay ? this.replayAdvisorScenesPlayed : this.gameplayAdvisorScenesPlayed).has(key);
    }

    restoreFromSnapshot(snapshot, {
        resumeNarrativeIndex = 0,
        replaying = false,
        diceAnimationComplete = false
    } = {}) {
        this.currentNarrativeIndex = Math.max(0, Number(resumeNarrativeIndex) || 0);
        this.skipped = false;
        this.replaying = Boolean(replaying);
        this.opportunityPanelOpen = pendingOpportunity(snapshot?.opportunity);
        this.diceAnimationComplete = Boolean(diceAnimationComplete);
        return this;
    }
}

export default BattlePresentationState;
