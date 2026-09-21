function cloneData(value) {
    if (value === undefined) return undefined;
    return JSON.parse(JSON.stringify(value));
}

export const FIRST_RUN_TRIAL_TUTORIAL_STEPS = Object.freeze({
    INACTIVE: "INACTIVE",
    ROUTE_INTRO: "ROUTE_INTRO",
    INTERCEPTION_INTRO: "INTERCEPTION_INTRO",
    TERRAIN_COMPARE: "TERRAIN_COMPARE",
    INTERCEPTION_SELECTED: "INTERCEPTION_SELECTED",
    DEFENSE_ALLOCATION: "DEFENSE_ALLOCATION",
    FINAL_REVIEW: "FINAL_REVIEW",
    BATTLE: "BATTLE",
    RESULT_CAUSALITY: "RESULT_CAUSALITY",
    COMPLETED: "COMPLETED"
});

function createTrialTutorialState(candidate = null) {
    const source = candidate && typeof candidate === "object" ? candidate : {};
    return {
        active: source.active === true,
        trialIndex: Number.isInteger(source.trialIndex) ? source.trialIndex : null,
        currentStep: Object.values(FIRST_RUN_TRIAL_TUTORIAL_STEPS).includes(source.currentStep)
            ? source.currentStep
            : FIRST_RUN_TRIAL_TUTORIAL_STEPS.INACTIVE,
        routeIntroduced: source.routeIntroduced === true,
        interceptionIntroduced: source.interceptionIntroduced === true,
        terrainIntroduced: source.terrainIntroduced === true,
        interceptionSelected: source.interceptionSelected === true,
        defenseIntroduced: source.defenseIntroduced === true,
        defenseAllocated: source.defenseAllocated === true,
        reviewIntroduced: source.reviewIntroduced === true,
        resultObserved: source.resultObserved === true,
        causalityObserved: source.causalityObserved === true,
        completed: source.completed === true
    };
}

/**
 * Service-owned runtime state for FirstRun / tutorial orchestration.
 *
 * This is engine-owned runtime state, not GameState domain state.
 */
export class FirstRunState {
    constructor({
        active = false,
        occurredScenes = [],
        basicLoopComplete = false,
        trialTutorial = null
    } = {}) {
        this.active = active === true;
        this.occurredScenes = new Set(Array.isArray(occurredScenes) ? occurredScenes : []);
        this.basicLoopComplete = basicLoopComplete === true;
        this.trialTutorial = createTrialTutorialState(trialTutorial);
    }

    recordScene(sceneId) {
        if (typeof sceneId === "string" && sceneId.trim()) {
            this.occurredScenes.add(sceneId.trim());
        }
    }

    hasSceneOccurred(sceneId) {
        return this.occurredScenes.has(sceneId);
    }

    setBasicLoopComplete(value = true) {
        this.basicLoopComplete = value === true;
    }

    getTrialTutorialState() {
        return cloneData(this.trialTutorial);
    }

    setTrialTutorialState(candidate) {
        this.trialTutorial = createTrialTutorialState(candidate);
        return this.getTrialTutorialState();
    }

    getRestoreState() {
        return {
            active: this.active,
            occurredScenes: Array.from(this.occurredScenes),
            basicLoopComplete: this.basicLoopComplete,
            trialTutorial: this.getTrialTutorialState()
        };
    }

    restoreState(snapshot) {
        if (!snapshot || typeof snapshot !== "object") {
            return this.getRestoreState();
        }
        if (typeof snapshot.active === "boolean") this.active = snapshot.active;
        if (Array.isArray(snapshot.occurredScenes)) {
            this.occurredScenes = new Set(snapshot.occurredScenes);
        }
        if (typeof snapshot.basicLoopComplete === "boolean") {
            this.basicLoopComplete = snapshot.basicLoopComplete;
        }
        if (snapshot.trialTutorial && typeof snapshot.trialTutorial === "object") {
            this.trialTutorial = createTrialTutorialState(snapshot.trialTutorial);
        }
        return this.getRestoreState();
    }
}

export default FirstRunState;
