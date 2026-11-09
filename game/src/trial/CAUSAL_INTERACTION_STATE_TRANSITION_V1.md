# Causal Interaction & State Transition v1

Status: IMPLEMENTED as a development-only adapter. It is not connected to
production Trial progression, combat resolution, Opportunity, Fortune, AI, UI,
or narration.

## Contract

`dev/causal_interaction_state_transition_v1.js` accepts a frozen Causal Rule
Slice result, actor-scoped initial Battle State, and caller-declared validation
tactics. It replays the Rule Slice input before trusting any evaluation. A Rule
ID or external evaluation object is therefore not evidence by itself.

Only the confirmed forest/large-force deployment rule can update Battle State.
The adapter sends that delta through `applyActorScopedBattleTransition`, records
the actor and force, state axis, before/after values, and Action, Cause,
Consequence, Fact, and Event provenance, then reevaluates all declared HUMAN and
ENEMY tactics through the existing `TacticRequirementEvaluator` path.

Confirmed frontal resistance and flank detection potential remain immutable,
referenceable Interaction Constraints. They do not become Battle State, action
failure, actual detection, response, damage, or victory. Their unresolved
prerequisites remain explicit for later resolvers.

## Existing SSOT reused

- `evaluateCausalRuleSliceV1` owns the three rule evaluations.
- `applyActorScopedBattleTransition` owns actor/force-scoped state mutation and
  grounded transition history.
- `tactical_causality_state.evaluateTactics` and
  `TacticRequirementEvaluator` own eligibility evaluation.
- `freezeBattleResolutionData` owns the immutable envelope.

The adapter adds no state reducer, rule engine, success probability, action
selection, recursive execution, or RNG. Restore replays the explicit input and
rejects modified derived records.

## Focused validation

`node scratch/test_trial_causal_interaction_state_transition_v1.mjs` covers the
forest deployment chain, both-side reevaluation, referenceable frontal and
detection constraints, fail-closed Rule Slice replay, actor isolation, complete
provenance, deterministic restore, duplicate-transition suppression, unchanged
outcome boundaries, and zero RNG consumption.
