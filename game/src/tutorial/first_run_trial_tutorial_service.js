import { FIRST_RUN_TRIAL_TUTORIAL_STEPS } from "./first_run_state.js";

export const FIRST_RUN_TRIAL_TUTORIAL_EVENTS = Object.freeze({
    TRIAL_STARTED: "TRIAL_STARTED",
    ROUTE_ACKNOWLEDGED: "ROUTE_ACKNOWLEDGED",
    INTERCEPTION_HOVERED: "INTERCEPTION_HOVERED",
    INTERCEPTION_SELECTED: "INTERCEPTION_SELECTED",
    DEFENSE_CHANGED: "DEFENSE_CHANGED",
    REVIEW_REACHED: "REVIEW_REACHED",
    BATTLE_STARTED: "BATTLE_STARTED",
    RESULT_OBSERVED: "RESULT_OBSERVED",
    CAUSALITY_OBSERVED: "CAUSALITY_OBSERVED"
});

function cloneData(value) {
    if (value === undefined) return undefined;
    return JSON.parse(JSON.stringify(value));
}

function createInactive() {
    return {
        active: false,
        trialIndex: null,
        currentStep: FIRST_RUN_TRIAL_TUTORIAL_STEPS.INACTIVE,
        routeIntroduced: false,
        interceptionIntroduced: false,
        terrainIntroduced: false,
        interceptionSelected: false,
        defenseIntroduced: false,
        defenseAllocated: false,
        reviewIntroduced: false,
        resultObserved: false,
        causalityObserved: false,
        completed: false
    };
}

function requireState(firstRunState) {
    if (!firstRunState || typeof firstRunState.getTrialTutorialState !== "function"
        || typeof firstRunState.setTrialTutorialState !== "function") {
        throw new TypeError("FIRST_RUN_TRIAL_TUTORIAL_STATE_REQUIRED");
    }
}

export class FirstRunTrialTutorialService {
    constructor({ firstTrialIndex = 1 } = {}) {
        this.firstTrialIndex = Number.isInteger(firstTrialIndex) && firstTrialIndex >= 1
            ? firstTrialIndex
            : 1;
    }

    shouldActivate({ firstRunState, trialIndex } = {}) {
        if (!firstRunState?.active) return false;
        if (Number(trialIndex) !== this.firstTrialIndex) return false;
        return firstRunState.getTrialTutorialState?.().completed !== true;
    }

    begin({ firstRunState, trialIndex } = {}) {
        requireState(firstRunState);
        if (!this.shouldActivate({ firstRunState, trialIndex })) {
            return firstRunState.getTrialTutorialState();
        }

        const current = firstRunState.getTrialTutorialState();
        if (current.active && current.trialIndex === this.firstTrialIndex) {
            return current;
        }

        return firstRunState.setTrialTutorialState({
            ...createInactive(),
            active: true,
            trialIndex: this.firstTrialIndex,
            currentStep: FIRST_RUN_TRIAL_TUTORIAL_STEPS.ROUTE_INTRO
        });
    }

    record({ firstRunState, trialIndex, event } = {}) {
        requireState(firstRunState);
        const current = firstRunState.getTrialTutorialState();

        if (!current.active || current.completed || Number(trialIndex) !== current.trialIndex) {
            return current;
        }

        const next = { ...current };

        switch (event) {
            case FIRST_RUN_TRIAL_TUTORIAL_EVENTS.ROUTE_ACKNOWLEDGED:
                next.routeIntroduced = true;
                next.currentStep = FIRST_RUN_TRIAL_TUTORIAL_STEPS.INTERCEPTION_INTRO;
                break;

            case FIRST_RUN_TRIAL_TUTORIAL_EVENTS.INTERCEPTION_HOVERED:
                if (!next.routeIntroduced) return current;
                next.interceptionIntroduced = true;
                next.terrainIntroduced = true;
                next.currentStep = FIRST_RUN_TRIAL_TUTORIAL_STEPS.TERRAIN_COMPARE;
                break;

            case FIRST_RUN_TRIAL_TUTORIAL_EVENTS.INTERCEPTION_SELECTED:
                if (!next.routeIntroduced) return current;
                next.interceptionIntroduced = true;
                next.interceptionSelected = true;
                next.currentStep = FIRST_RUN_TRIAL_TUTORIAL_STEPS.DEFENSE_ALLOCATION;
                next.defenseIntroduced = true;
                break;

            case FIRST_RUN_TRIAL_TUTORIAL_EVENTS.DEFENSE_CHANGED:
                if (!next.interceptionSelected) return current;
                next.defenseIntroduced = true;
                next.defenseAllocated = true;
                next.currentStep = FIRST_RUN_TRIAL_TUTORIAL_STEPS.FINAL_REVIEW;
                break;

            case FIRST_RUN_TRIAL_TUTORIAL_EVENTS.REVIEW_REACHED:
                if (!next.defenseAllocated) return current;
                next.reviewIntroduced = true;
                next.currentStep = FIRST_RUN_TRIAL_TUTORIAL_STEPS.FINAL_REVIEW;
                break;

            case FIRST_RUN_TRIAL_TUTORIAL_EVENTS.BATTLE_STARTED:
                if (!next.interceptionSelected || !next.defenseAllocated) return current;
                next.currentStep = FIRST_RUN_TRIAL_TUTORIAL_STEPS.BATTLE;
                break;

            case FIRST_RUN_TRIAL_TUTORIAL_EVENTS.RESULT_OBSERVED:
                next.resultObserved = true;
                next.currentStep = FIRST_RUN_TRIAL_TUTORIAL_STEPS.RESULT_CAUSALITY;
                break;

            case FIRST_RUN_TRIAL_TUTORIAL_EVENTS.CAUSALITY_OBSERVED:
                if (!next.resultObserved) return current;
                next.causalityObserved = true;
                next.completed = Boolean(
                    next.routeIntroduced
                    && next.interceptionSelected
                    && next.defenseAllocated
                    && next.resultObserved
                    && next.causalityObserved
                );
                next.active = !next.completed;
                next.currentStep = next.completed
                    ? FIRST_RUN_TRIAL_TUTORIAL_STEPS.COMPLETED
                    : FIRST_RUN_TRIAL_TUTORIAL_STEPS.RESULT_CAUSALITY;
                break;

            default:
                return current;
        }

        return firstRunState.setTrialTutorialState(next);
    }

    getPresentationPolicy({ firstRunState } = {}) {
        requireState(firstRunState);
        const state = firstRunState.getTrialTutorialState();

        if (!state.active || state.completed) {
            return Object.freeze({
                tutorialActive: false,
                step: state.currentStep,
                highlightRoute: false,
                highlightIngress: false,
                highlightHQ: false,
                emphasizeInterceptionCandidates: false,
                qualitativePreviewOnly: false,
                allowInterceptionSelection: true,
                allowDefenseInput: true,
                allowTrialConfirm: true,
                allowSkipRoute: true
            });
        }

        const step = state.currentStep;
        const routeOnly = step === FIRST_RUN_TRIAL_TUTORIAL_STEPS.ROUTE_INTRO;
        const interceptionOpen = !routeOnly;
        const defenseOpen = [
            FIRST_RUN_TRIAL_TUTORIAL_STEPS.DEFENSE_ALLOCATION,
            FIRST_RUN_TRIAL_TUTORIAL_STEPS.FINAL_REVIEW,
            FIRST_RUN_TRIAL_TUTORIAL_STEPS.BATTLE,
            FIRST_RUN_TRIAL_TUTORIAL_STEPS.RESULT_CAUSALITY
        ].includes(step);
        const confirmOpen = [
            FIRST_RUN_TRIAL_TUTORIAL_STEPS.FINAL_REVIEW,
            FIRST_RUN_TRIAL_TUTORIAL_STEPS.BATTLE,
            FIRST_RUN_TRIAL_TUTORIAL_STEPS.RESULT_CAUSALITY
        ].includes(step);

        return Object.freeze({
            tutorialActive: true,
            step,
            highlightRoute: true,
            highlightIngress: true,
            highlightHQ: true,
            emphasizeInterceptionCandidates: interceptionOpen,
            qualitativePreviewOnly: true,
            allowInterceptionSelection: interceptionOpen,
            allowDefenseInput: defenseOpen,
            allowTrialConfirm: confirmOpen,
            allowSkipRoute: false
        });
    }

    getRestoreState({ firstRunState } = {}) {
        requireState(firstRunState);
        return cloneData(firstRunState.getTrialTutorialState());
    }
}

export default FirstRunTrialTutorialService;
