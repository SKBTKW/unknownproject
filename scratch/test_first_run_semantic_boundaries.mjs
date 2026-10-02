import assert from "node:assert/strict";

import {
    FirstRunService,
    FIRST_RUN_INVESTIGATION_GUARANTEE_VERSE
} from "../game/src/tutorial/first_run_service.js";
import { OFFERING_GENERATION_REASONS } from "../game/src/systems/deck_manager.js";
import { UIController } from "../game/src/ui/ui_controller.js";
import { FIRST_RUN_TRIAL_TUTORIAL_EVENTS } from "../game/src/tutorial/first_run_trial_tutorial_service.js";

function requirementIds(service, reason, state) {
    return service.getMinimumRequirements({ reason, state }).map(row => row.id);
}

{
    const service = new FirstRunService({ enabled: true });
    const hits = [];
    const reasons = [
        OFFERING_GENERATION_REASONS.VERSE_START,
        OFFERING_GENERATION_REASONS.MULLIGAN,
        OFFERING_GENERATION_REASONS.INITIAL
    ];

    for (let verse = 1; verse <= 15; verse += 1) {
        const state = {
            turn: verse,
            investigationUnlocked: verse >= FIRST_RUN_INVESTIGATION_GUARANTEE_VERSE
        };
        for (const reason of reasons) {
            const ids = requirementIds(service, reason, state);
            if (ids.includes("FIRST_RUN_INVESTIGATION")) hits.push({ verse, reason });
        }
    }

    assert.deepEqual(
        hits,
        [{
            verse: FIRST_RUN_INVESTIGATION_GUARANTEE_VERSE,
            reason: OFFERING_GENERATION_REASONS.VERSE_START
        }],
        "one-shot FirstRun Offering guarantees must be scoped to one explicit lifecycle boundary"
    );
}

{
    let completionWrites = 0;
    const fakeUi = {
        firstRunTrialTutorialService: {
            record() {
                return { active: false, completed: true, currentStep: "COMPLETED" };
            }
        },
        engine: {
            state: { stage: { id: 1, size: 5 } },
            firstRunState: { active: true },
            firstRunActivationStore: {
                markCompleted() {
                    completionWrites += 1;
                    return { success: true, completed: true };
                }
            }
        },
        trialController: {
            state: { trialIndex: 1 }
        },
        trialActionTrayComponent: {
            render() {}
        }
    };

    const tutorial = UIController.prototype.recordFirstRunTrialTutorialEvent.call(
        fakeUi,
        FIRST_RUN_TRIAL_TUTORIAL_EVENTS.CAUSALITY_OBSERVED
    );

    assert.equal(tutorial.completed, true, "Trial tutorial completion is allowed before Stage2");
    assert.equal(
        completionWrites,
        0,
        "sub-flow completion must never directly persist whole-FirstRun completion while Stage1 is active"
    );
}

console.log("✅ FirstRun semantic boundaries PASS");
