import assert from "assert/strict";
import {
    FirstRunState,
    FIRST_RUN_TRIAL_TUTORIAL_STEPS
} from "../game/src/tutorial/first_run_state.js";
import {
    FirstRunTrialTutorialService,
    FIRST_RUN_TRIAL_TUTORIAL_EVENTS
} from "../game/src/tutorial/first_run_trial_tutorial_service.js";

{
    const firstRunState = new FirstRunState({ active: true });
    const service = new FirstRunTrialTutorialService();

    let state = service.begin({ firstRunState, trialIndex: 1 });
    assert.equal(state.active, true);
    assert.equal(state.currentStep, FIRST_RUN_TRIAL_TUTORIAL_STEPS.ROUTE_INTRO);

    let policy = service.getPresentationPolicy({ firstRunState });
    assert.equal(policy.highlightRoute, true);
    assert.equal(policy.allowInterceptionSelection, false);
    assert.equal(policy.allowDefenseInput, false);
    assert.equal(policy.allowTrialConfirm, false);
    assert.equal(policy.allowSkipRoute, false, "FirstRun tutorial must require one interception experience");

    state = service.record({
        firstRunState,
        trialIndex: 1,
        event: FIRST_RUN_TRIAL_TUTORIAL_EVENTS.ROUTE_ACKNOWLEDGED
    });
    assert.equal(state.routeIntroduced, true);
    assert.equal(state.currentStep, FIRST_RUN_TRIAL_TUTORIAL_STEPS.INTERCEPTION_INTRO);

    policy = service.getPresentationPolicy({ firstRunState });
    assert.equal(policy.allowInterceptionSelection, true);
    assert.equal(policy.allowDefenseInput, false);

    state = service.record({
        firstRunState,
        trialIndex: 1,
        event: FIRST_RUN_TRIAL_TUTORIAL_EVENTS.INTERCEPTION_HOVERED
    });
    assert.equal(state.terrainIntroduced, true);
    assert.equal(state.currentStep, FIRST_RUN_TRIAL_TUTORIAL_STEPS.TERRAIN_COMPARE);

    state = service.record({
        firstRunState,
        trialIndex: 1,
        event: FIRST_RUN_TRIAL_TUTORIAL_EVENTS.INTERCEPTION_SELECTED
    });
    assert.equal(state.interceptionSelected, true);
    assert.equal(state.defenseIntroduced, true);
    assert.equal(state.currentStep, FIRST_RUN_TRIAL_TUTORIAL_STEPS.DEFENSE_ALLOCATION);

    policy = service.getPresentationPolicy({ firstRunState });
    assert.equal(policy.allowDefenseInput, true);
    assert.equal(policy.allowTrialConfirm, false);
    assert.equal(policy.qualitativePreviewOnly, true);

    state = service.record({
        firstRunState,
        trialIndex: 1,
        event: FIRST_RUN_TRIAL_TUTORIAL_EVENTS.DEFENSE_CHANGED
    });
    assert.equal(state.defenseAllocated, true);
    assert.equal(state.currentStep, FIRST_RUN_TRIAL_TUTORIAL_STEPS.FINAL_REVIEW);

    policy = service.getPresentationPolicy({ firstRunState });
    assert.equal(policy.allowTrialConfirm, true);

    service.record({
        firstRunState,
        trialIndex: 1,
        event: FIRST_RUN_TRIAL_TUTORIAL_EVENTS.BATTLE_STARTED
    });
    service.record({
        firstRunState,
        trialIndex: 1,
        event: FIRST_RUN_TRIAL_TUTORIAL_EVENTS.RESULT_OBSERVED
    });
    state = service.record({
        firstRunState,
        trialIndex: 1,
        event: FIRST_RUN_TRIAL_TUTORIAL_EVENTS.CAUSALITY_OBSERVED
    });

    assert.equal(state.resultObserved, true);
    assert.equal(state.causalityObserved, true);
    assert.equal(state.completed, true);
    assert.equal(state.active, false);
    assert.equal(state.currentStep, FIRST_RUN_TRIAL_TUTORIAL_STEPS.COMPLETED);

    policy = service.getPresentationPolicy({ firstRunState });
    assert.equal(policy.tutorialActive, false);
    assert.equal(policy.allowInterceptionSelection, true);
    assert.equal(policy.allowDefenseInput, true);
    assert.equal(policy.allowTrialConfirm, true);
    assert.equal(policy.allowSkipRoute, true, "completed tutorial must converge to normal Trial controls");
}

{
    const firstRunState = new FirstRunState({ active: true });
    const service = new FirstRunTrialTutorialService();

    assert.equal(
        service.begin({ firstRunState, trialIndex: 2 }).active,
        false,
        "Trial2 must never activate the FirstRun Trial tutorial"
    );

    service.begin({ firstRunState, trialIndex: 1 });
    const before = firstRunState.getTrialTutorialState();
    service.record({
        firstRunState,
        trialIndex: 1,
        event: FIRST_RUN_TRIAL_TUTORIAL_EVENTS.DEFENSE_CHANGED
    });
    assert.deepEqual(
        firstRunState.getTrialTutorialState(),
        before,
        "out-of-order tutorial events must not skip Trial decisions"
    );
}

{
    const disabledState = new FirstRunState({ active: false });
    const service = new FirstRunTrialTutorialService();
    const state = service.begin({ firstRunState: disabledState, trialIndex: 1 });
    assert.equal(state.active, false, "normal Run must not activate the FirstRun tutorial");
    const policy = service.getPresentationPolicy({ firstRunState: disabledState });
    assert.equal(policy.allowSkipRoute, true, "normal Run must retain normal SKIP behavior");
}

{
    const original = new FirstRunState({ active: true });
    const service = new FirstRunTrialTutorialService();
    service.begin({ firstRunState: original, trialIndex: 1 });
    service.record({
        firstRunState: original,
        trialIndex: 1,
        event: FIRST_RUN_TRIAL_TUTORIAL_EVENTS.ROUTE_ACKNOWLEDGED
    });
    service.record({
        firstRunState: original,
        trialIndex: 1,
        event: FIRST_RUN_TRIAL_TUTORIAL_EVENTS.INTERCEPTION_SELECTED
    });

    const snapshot = original.getRestoreState();
    const restored = new FirstRunState();
    restored.restoreState(snapshot);

    assert.deepEqual(
        restored.getRestoreState(),
        snapshot,
        "FirstRun Trial tutorial progress must round-trip through existing FirstRun restore state"
    );
    assert.equal(
        restored.getTrialTutorialState().currentStep,
        FIRST_RUN_TRIAL_TUTORIAL_STEPS.DEFENSE_ALLOCATION
    );
}

{
    const original = new FirstRunState({ active: true });
    const service = new FirstRunTrialTutorialService();
    service.begin({ firstRunState: original, trialIndex: 1 });
    service.record({
        firstRunState: original,
        trialIndex: 1,
        event: FIRST_RUN_TRIAL_TUTORIAL_EVENTS.ROUTE_ACKNOWLEDGED
    });
    service.record({
        firstRunState: original,
        trialIndex: 1,
        event: FIRST_RUN_TRIAL_TUTORIAL_EVENTS.INTERCEPTION_SELECTED
    });
    service.record({
        firstRunState: original,
        trialIndex: 1,
        event: FIRST_RUN_TRIAL_TUTORIAL_EVENTS.DEFENSE_CHANGED
    });
    service.record({
        firstRunState: original,
        trialIndex: 1,
        event: FIRST_RUN_TRIAL_TUTORIAL_EVENTS.BATTLE_STARTED
    });
    service.record({
        firstRunState: original,
        trialIndex: 1,
        event: FIRST_RUN_TRIAL_TUTORIAL_EVENTS.RESULT_OBSERVED
    });

    const snapshot = original.getRestoreState();
    const restored = new FirstRunState();
    restored.restoreState(snapshot);

    assert.equal(
        restored.getTrialTutorialState().currentStep,
        FIRST_RUN_TRIAL_TUTORIAL_STEPS.RESULT_CAUSALITY,
        "restore before causality acknowledgement must remain inside the tutorial"
    );
    assert.equal(restored.getTrialTutorialState().completed, false);
    const completed = service.record({
        firstRunState: restored,
        trialIndex: 1,
        event: FIRST_RUN_TRIAL_TUTORIAL_EVENTS.CAUSALITY_OBSERVED
    });
    assert.equal(completed.completed, true, "restored RESULT_CAUSALITY must complete only after acknowledgement");
    assert.equal(completed.currentStep, FIRST_RUN_TRIAL_TUTORIAL_STEPS.COMPLETED);
}

console.log("✅ FirstRun Trial tutorial state/presentation policy contract PASS");
