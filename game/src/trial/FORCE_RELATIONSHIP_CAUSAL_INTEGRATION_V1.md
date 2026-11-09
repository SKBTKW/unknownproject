# Force Relationship Causal Integration v1

Status: `PROTOTYPE` / development-only

This slice connects the existing Battle Causality Execution, Force Relationship
Foundation and `TacticRequirementEvaluator`. It does not replace any of them and
has no production Trial import.

## Execution order

1. Validate externally resolved action evidence and its declared field scope.
2. Apply the result to exactly one actor-owned Force.
3. Re-evaluate only explicitly named directed relations.
4. Apply a relation transition only when all declared decision axes are grounded.
5. Re-evaluate isolation from the complete support-candidate scope.
6. Re-evaluate caller-declared development tactic requirements.
7. Freeze the snapshot and retain transition provenance for replay.

Action selection is not action resolution. Relation assessment is independent
from Force State mutation. Tactic eligibility does not select a tactic or resolve
success.

## Support evidence policy

Support decisions require explicit `routeReachability`, `supportCapability`, and
`timing` axes. Every decisive non-unknown axis references an existing Fact.
`distance` may be recorded as context but is never a decisive support axis.

- any required unknown axis: `UNRESOLVED`
- all required axes confirmed: `CONFIRMED`
- all required axes resolved and at least one denied: `DENIED`

One denied directed Support relation does not establish isolation. Isolation is
confirmed only when the support-candidate set is complete and every candidate's
directed Support relation is denied.

## Information boundary

The internal battlefield snapshot retains objective Force and Relation state.
The human known projection exposes only relation and isolation identifiers that
the caller explicitly declares known. Objective human eligibility may therefore
differ from known eligibility without leaking the missing relation to UI or
Advisor surfaces.

## Preserved boundaries

- no CombatResolver, Trial coordinator, production adapter, damage or victory edits
- no AI, automatic tactic selection, Opportunity, Fortune or gameplay RNG
- no pathfinding or invented coordinates
- deterministic finite input order, replay restore and tamper detection
