# Battle Causality Execution Foundation v1

Status: IMPLEMENTED as a development-only validation foundation. It is not
connected to production battle outcome, Opportunity, Fortune, AI, or UI.

## Reused SSOT

This foundation extends the existing `DEV_TACTICAL_CAUSALITY_V1` envelope. It
does not add a second tactic engine. Action semantics remain in
`dev/tactical_causality_action.js`, state-to-token projection remains in
`dev/tactical_causality_state.js`, and eligibility continues to use
`TacticRequirementEvaluator`.

`domain/battle_causality_execution.js` supplies only execution invariants shared
by those development contracts:

- HUMAN and ENEMY state is actor-scoped; every transition also records a force
  ID so a later unit-scoped adapter can replace the default force scope.
- every applied state delta has a transition ID, event ID, state key,
  before/after value, action, cause, consequence, fact/event evidence, and a
  deterministic global order;
- external adjudication evidence receives deterministic fact IDs instead of
  becoming an untraceable boolean;
- action/fact/cause/event references must already exist in the immutable base
  snapshot or earlier execution history; missing and forward references fail
  closed;
- action IDs cannot collide with base-snapshot or earlier execution IDs;
- unchanged values emit no transition, a finite input schedule cannot recurse,
  and an optional `maxActions` limit produces `MAX_ACTIONS_REACHED` explicitly.

The frozen envelope now also exposes `transitionHistory` as a flat replay audit.
Restore still replays the original input and compares the entire envelope, so a
modified transition, source reference, ordering value, or final state is rejected.

## Boundary

Eligibility, execution, action success, consequence application, and normal
battle outcome remain separate. This change does not assign success probability,
modify damage or victory, consume gameplay RNG, select commander decisions, or
publish new production tactic rules. The existing caller-declared validation
requirements remain validation assumptions only.

## Focused validation

`node scratch/test_trial_bidirectional_tactical_causality.mjs` covers the existing
bidirectional chains plus actor isolation, grounded transition history, invalid
references, base-action ID collisions, deterministic external fact provenance,
explicit action limits, replay, duplicate suppression, and zero RNG consumption.
