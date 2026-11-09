# Force Relationship Foundation v1

Status: IMPLEMENTED as a development-only Domain foundation. It is not connected
to production Trial progression, Enemy Army generation, combat resolution, AI,
Opportunity, Fortune, UI, or narration.

## Identity and state

Every Force has a unique `forceId`, an explicit `HUMAN` or `ENEMY` owner, an
independent Force State, and separately validated Spatial Evidence. Multiple
Forces may belong to one Actor. Force updates use
`applyForceScopedBattleTransition` in the existing Battle Causality Execution
Foundation and cannot mutate another Force.

The optional actor-scoped compatibility view requires an explicit Force choice
for each Actor. It never aggregates or guesses among multiple same-Actor Forces,
so the existing actor-scoped contract remains unchanged.

## Directed relationships

`SUPPORT`, `COORDINATION`, and `SEPARATION` are directed relations with distinct
`CONFIRMED`, `DENIED`, and `UNRESOLVED` states. SUPPORT and COORDINATION require
same-Actor Forces; cross-Actor spatial separation remains representable without
mislabeling it as allied support. Reverse-direction relations never change
implicitly.

`ISOLATION` is an aggregate evaluation, not a binary alias for one SUPPORT
relation. It becomes CONFIRMED only when the support-candidate scope is declared
complete and every known candidate-to-target SUPPORT relation is DENIED. Any
unknown scope or unresolved relation remains UNRESOLVED; confirmed alternative
support makes isolation DENIED.

## Spatial evidence

Position, relative position, distance, route, reachability, terrain constraints,
and travel time each carry their own evidence status. A resolved value requires
a Fact reference. An UNRESOLVED field cannot carry a guessed value. Spatial
Evidence is descriptive only and never derives SUPPORT or ISOLATION by itself.

## Execution and replay

The finite development harness reuses the existing causal reference index,
external Fact creation, Action/Cause/Consequence/Event registration, and new
Force/Relation delta primitives in `battle_causality_execution.js`. Each applied
delta records before/after, direction, evidence, and global order. Unknown or
future references, duplicate Action/Event IDs, ungrounded updates, and unchanged
values fail closed or emit no redundant transition. Restore replays explicit
inputs and rejects altered history.

The foundation consumes no gameplay RNG and does not resolve actions, damage,
Normal Outcome, Opportunity, or Fortune.
