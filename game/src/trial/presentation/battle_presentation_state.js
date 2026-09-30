import { BATTLE_PRESENTATION_MODES } from "./battle_narrative_projector.js";

function pendingOpportunity(opportunity) {
    if (!opportunity || typeof opportunity !== "object") return false;
    if (opportunity.declined === true || opportunity.resolved === true) return false;
    return opportunity.available === true
        || opportunity.status === "OPPORTUNITY_PENDING"
        || opportunity.state === "OPPORTUNITY_PENDING"
        || opportunity.pending === true;
}

function arrayOfStrings(value) {
    return Array.isArray(value) ? value.filter(row => typeof row === "string") : [];
}

export class BattlePresentationState {
    constructor({ presentationMode = BATTLE_PRESENTATION_MODES.FULL } = {}) {
        this.presentationMode = presentationMode;
        this.battleId = null;
        this.routeId = null;
        this.currentNarrativeIndex = 0;
        this.presentationCursor = 0;
        this.skipped = false;
        this.fastForward = false;
        this.replaying = false;
        this.opportunityPanelOpen = false;
        this.acknowledgedOpportunity = false;
        this.diceAnimationComplete = false;
        this.completedPresentationPhases = new Set();
        this.emittedSemanticEvents = new Set();
        this.viewedFlavorEntries = new Set();
        this.gameplayAdvisorScenesPlayed = new Set();
        this.replayAdvisorScenesPlayed = new Set();
    }

    bindSnapshot(snapshot) {
        const battleId = snapshot?.battleId ?? snapshot?.id ?? null;
        const routeId = snapshot?.routeId ?? null;
        if (this.battleId !== null && battleId !== null && this.battleId !== battleId) {
            throw new Error("BATTLE_PRESENTATION_BATTLE_MISMATCH");
        }
        if (this.routeId !== null && routeId !== null && this.routeId !== routeId) {
            throw new Error("BATTLE_PRESENTATION_ROUTE_MISMATCH");
        }
        this.battleId = battleId;
        this.routeId = routeId;
        return this;
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
        this.presentationCursor = this.currentNarrativeIndex;
        return this.currentNarrativeIndex;
    }

    skipToResult() {
        this.skipped = true;
        this.fastForward = false;
        this.opportunityPanelOpen = false;
        return this;
    }

    setFastForward(enabled = true) {
        this.fastForward = Boolean(enabled);
        return this.fastForward;
    }

    startReplay({ replayAdvisor = false } = {}) {
        this.currentNarrativeIndex = 0;
        this.presentationCursor = 0;
        this.skipped = false;
        this.fastForward = false;
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
        this.opportunityPanelOpen = false;
    }

    acknowledgeOpportunity() {
        this.acknowledgedOpportunity = true;
        this.opportunityPanelOpen = false;
    }

    markDiceAnimationComplete() {
        this.diceAnimationComplete = true;
    }

    markPresentationPhaseComplete(phase) {
        if (typeof phase !== "string" || phase.length === 0) return false;
        const before = this.completedPresentationPhases.size;
        this.completedPresentationPhases.add(phase);
        return this.completedPresentationPhases.size > before;
    }

    markSemanticEventEmitted(eventKey) {
        if (typeof eventKey !== "string" || eventKey.length === 0) return false;
        if (this.emittedSemanticEvents.has(eventKey)) return false;
        this.emittedSemanticEvents.add(eventKey);
        return true;
    }

    markFlavorViewed(flavorId) {
        if (typeof flavorId !== "string" || flavorId.length === 0) return false;
        if (this.viewedFlavorEntries.has(flavorId)) return false;
        this.viewedFlavorEntries.add(flavorId);
        return true;
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

    serialize() {
        return Object.freeze({
            presentationMode: this.presentationMode,
            battleId: this.battleId,
            routeId: this.routeId,
            currentNarrativeIndex: this.currentNarrativeIndex,
            presentationCursor: this.presentationCursor,
            skipped: this.skipped,
            fastForward: this.fastForward,
            replaying: this.replaying,
            opportunityPanelOpen: this.opportunityPanelOpen,
            acknowledgedOpportunity: this.acknowledgedOpportunity,
            diceAnimationComplete: this.diceAnimationComplete,
            completedPresentationPhases: Object.freeze([...this.completedPresentationPhases]),
            emittedSemanticEvents: Object.freeze([...this.emittedSemanticEvents]),
            viewedFlavorEntries: Object.freeze([...this.viewedFlavorEntries]),
            gameplayAdvisorScenesPlayed: Object.freeze([...this.gameplayAdvisorScenesPlayed]),
            replayAdvisorScenesPlayed: Object.freeze([...this.replayAdvisorScenesPlayed])
        });
    }

    restoreFromSnapshot(snapshot, saved = {}) {
        this.bindSnapshot(snapshot);
        if (saved.presentationMode) this.setMode(saved.presentationMode);
        const cursor = saved.presentationCursor ?? saved.resumeNarrativeIndex ?? saved.currentNarrativeIndex ?? 0;
        this.currentNarrativeIndex = Math.max(0, Number(cursor) || 0);
        this.presentationCursor = this.currentNarrativeIndex;
        this.skipped = Boolean(saved.skipped);
        this.fastForward = Boolean(saved.fastForward);
        this.replaying = Boolean(saved.replaying);
        this.acknowledgedOpportunity = Boolean(saved.acknowledgedOpportunity);
        this.opportunityPanelOpen = this.acknowledgedOpportunity
            ? false
            : (saved.opportunityPanelOpen ?? pendingOpportunity(snapshot?.opportunity));
        this.diceAnimationComplete = Boolean(saved.diceAnimationComplete);
        this.completedPresentationPhases = new Set(arrayOfStrings(saved.completedPresentationPhases));
        this.emittedSemanticEvents = new Set(arrayOfStrings(saved.emittedSemanticEvents));
        this.viewedFlavorEntries = new Set(arrayOfStrings(saved.viewedFlavorEntries));
        this.gameplayAdvisorScenesPlayed = new Set(arrayOfStrings(saved.gameplayAdvisorScenesPlayed));
        this.replayAdvisorScenesPlayed = new Set(arrayOfStrings(saved.replayAdvisorScenesPlayed));
        return this;
    }
}

export default BattlePresentationState;
