import assert from "node:assert/strict";
import { resolvePostTrialAdvisorReaction } from "../../ui/advisor/advisor_post_trial_reaction_variant_resolver.js";

const reaction = {
    expression: "NORMAL",
    lines: ["default"],
    policyVariants: {
        defense: { lines: ["defense"], expression: "TENSE" },
        logistics: { lines: ["logistics"] },
        development: { lines: ["development"] }
    },
    semanticVariants: {
        FIRST_TRIAL_AFTERMATH_MEANING: {
            lines: ["first-default"],
            policyVariants: {
                defense: { lines: ["first-defense"] },
                development: { lines: ["first-development"] }
            }
        }
    }
};

let resolved = resolvePostTrialAdvisorReaction({
    reaction,
    profile: {
        policy: {
            defense: 4,
            logistics: 3,
            development: 2
        }
    },
    payload: {}
});
assert.equal(resolved.line, "defense");
assert.equal(resolved.policyLens, "defense");
assert.equal(resolved.expression, "TENSE");

resolved = resolvePostTrialAdvisorReaction({
    reaction,
    profile: {
        policy: {
            defense: 2,
            logistics: 4,
            development: 3
        }
    },
    payload: {}
});
assert.equal(resolved.line, "logistics");
assert.equal(resolved.policyLens, "logistics");

resolved = resolvePostTrialAdvisorReaction({
    reaction,
    profile: {
        policy: {
            defense: 2,
            development: 4
        }
    },
    payload: {
        semanticSceneId: "FIRST_TRIAL_AFTERMATH_MEANING"
    }
});
assert.equal(resolved.line, "first-development");
assert.equal(resolved.policyLens, "development");
assert.equal(resolved.semanticSceneId, "FIRST_TRIAL_AFTERMATH_MEANING");

resolved = resolvePostTrialAdvisorReaction({
    reaction: {
        lines: ["fallback-only"]
    },
    profile: { policy: { defense: 4 } },
    payload: {}
});
assert.equal(resolved.line, "fallback-only");
assert.equal(resolved.policyLens, null);

assert.equal(resolvePostTrialAdvisorReaction({
    reaction: {},
    profile: {},
    payload: {}
}), null);

console.log("diagnose_post_trial_advisor_policy_variants: OK");
