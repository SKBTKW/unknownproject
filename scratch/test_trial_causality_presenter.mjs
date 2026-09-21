import assert from "assert/strict";
import { TrialCausalityPresenter } from "../game/src/trial/presentation/trial_causality_presenter.js";
import { MODIFIER_TARGETS } from "../game/src/trial/domain/trial_types.js";

const presenter = new TrialCausalityPresenter();

{
    const projected = presenter.project({
        appliedModifiers: [
            {
                source: "FOREST_DEPLOYMENT",
                target: MODIFIER_TARGETS.ENEMY_SUPPRESSION,
                before: 12,
                after: 8
            },
            {
                source: "HIGH_GROUND",
                target: MODIFIER_TARGETS.HUMAN_INTERCEPTION,
                before: 7,
                after: 9
            }
        ],
        prediction: { outcome: "REPEL" }
    });

    assert.equal(projected.available, true);
    assert.equal(projected.modifiers.length, 2);
    assert.equal(projected.modifiers[0].favorable, true);
    assert.equal(projected.modifiers[1].favorable, true);
    assert.equal(projected.outcome, "REPEL");
}

{
    const projected = presenter.project({
        appliedModifiers: [],
        prediction: { outcome: "EXACT" }
    });
    assert.equal(projected.available, true);
    assert.deepEqual(projected.modifiers, []);
    assert.equal(projected.outcome, "EXACT");
}

{
    const projected = presenter.project(null);
    assert.equal(projected.available, false);
    assert.deepEqual(projected.modifiers, []);
}

console.log("✅ Trial causality presenter exposes only resolved canonical facts PASS");
