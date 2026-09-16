import assert from "node:assert/strict";
import { ConditionEvaluator } from "../../core/condition_evaluator.js";

function evaluate(type, state, value = undefined) {
    const condition = value === undefined ? { type } : { type, value };
    return ConditionEvaluator.evaluate(condition, { state });
}

{
    const state = { turn: 10, nextTrialTurn: 15 };
    assert.equal(evaluate("TRIAL_DISTANCE_ABOVE", state, 4), true);
    assert.equal(evaluate("TRIAL_DISTANCE_ABOVE", state, 5), false);
    assert.equal(evaluate("TRIAL_NOTICE", state), true);
    assert.equal(evaluate("TRIAL_WITHIN", state, 5), true);
    assert.equal(evaluate("TRIAL_WITHIN", state, 4), false);
}

{
    const state = {
        turn: 1,
        nextTrialTurn: 50,
        getTrialNotice: () => ({ active: true, remaining: 49 })
    };
    assert.equal(evaluate("TRIAL_NOTICE", state), true);
    assert.equal(evaluate("TRIAL_WITHIN", state, 5), false);
}

{
    const state = { turn: 1 };
    assert.equal(evaluate("TRIAL_DISTANCE_ABOVE", state, 18), true);
    assert.equal(evaluate("TRIAL_DISTANCE_ABOVE", state, 19), false);
    assert.equal(evaluate("TRIAL_WITHIN", state, 19), true);
}

console.log("diagnose_condition_evaluator_trial_timing_compat: OK");
