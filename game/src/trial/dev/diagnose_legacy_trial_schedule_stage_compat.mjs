import assert from "node:assert/strict";
import {
    applyLegacyTrialScheduleStageProgression,
    getLegacyTrialDistance,
    isLegacyTrialNoticeActive,
    isLegacyTrialWithin
} from "../../core/legacy_trial_schedule_compat.js";

function createEngine({ turn, stageId }) {
    const expandedSizes = [];
    const logs = [];
    return {
        state: {
            turn,
            stage: { id: stageId, name: `Stage ${stageId}`, size: stageId === 1 ? 5 : 7 },
            trialSchedule: { trial1: 15, trial2: 30, trial3: 50, warningDuration: 5 },
            nextTrialTurn: 15,
            addLog: message => logs.push(message)
        },
        gridEngine: {
            expandGrid: size => expandedSizes.push(size)
        },
        expandedSizes,
        logs
    };
}

{
    const state = { turn: 10, nextTrialTurn: 15 };
    assert.equal(getLegacyTrialDistance(state), 5);
    assert.equal(isLegacyTrialWithin(state, 5), true);
    assert.equal(isLegacyTrialWithin(state, 4), false);
    assert.equal(isLegacyTrialNoticeActive(state, { fallbackThreshold: 5 }), true);
    assert.equal(isLegacyTrialNoticeActive(state), false);
}

{
    const state = {
        turn: 1,
        nextTrialTurn: 50,
        getTrialNotice: () => ({ active: true, remaining: 49 })
    };
    assert.equal(isLegacyTrialNoticeActive(state), true);
    assert.equal(isLegacyTrialNoticeActive(state, { fallbackThreshold: 5 }), true);
}

{
    const engine = createEngine({ turn: 14, stageId: 1 });
    const result = applyLegacyTrialScheduleStageProgression(engine);
    assert.deepEqual(result, { changed: false, stageId: 1 });
    assert.equal(engine.state.stage.id, 1);
    assert.deepEqual(engine.expandedSizes, []);
}

{
    const engine = createEngine({ turn: 15, stageId: 1 });
    const result = applyLegacyTrialScheduleStageProgression(engine);
    assert.deepEqual(result, { changed: true, stageId: 2 });
    assert.equal(engine.state.stage.id, 2);
    assert.equal(engine.state.nextTrialTurn, 30);
    assert.deepEqual(engine.expandedSizes, [7]);
}

{
    const engine = createEngine({ turn: 30, stageId: 2 });
    const result = applyLegacyTrialScheduleStageProgression(engine);
    assert.deepEqual(result, { changed: true, stageId: 3 });
    assert.equal(engine.state.stage.id, 3);
    assert.equal(engine.state.nextTrialTurn, 50);
    assert.deepEqual(engine.expandedSizes, [9]);
}

console.log("diagnose_legacy_trial_schedule_stage_compat: OK");
