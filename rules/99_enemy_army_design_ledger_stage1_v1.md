# Enemy army design ledger — Stage1 incremental implementation (2026-10-29)

This document separates **user-directed design decisions**, **provisional ideas**, and **current production behavior**. It does not supersede runtime rules or authorize unfinished gameplay changes.

## User-directed design decisions (not necessarily implemented)
- Enemy army identity (species composition, equipment, command traits, force setup) is determined before investigation can reveal it. Investigation reveals preexisting observable facts; hidden parameters remain effective but hidden.
- Each force may have a randomly generated species/equipment mix. Larger species shares should generally be more likely to be observed; repeated observation of the same group is permitted.
- Stage1 has **at most three** participation slots: A (primary), B and C. A receives priority, then B, then C. At low total suppression, detachments disappear from participation starting with C; their *identities* are not deleted.
- At theoretical maximum board development, all Stage1 forces participate at full intended scale.
- Force/route count and actual enemy suppression are not identical concepts. Stage progression should expand maximum forces; Stage2/3 numerical ceilings remain provisional.
- E2/GL0 is called **荒野 / Wasteland**. Internal `E2_DESERT_HILL` ID remains unchanged for compatibility.

## Pending design decisions — do not hardcode
- Stage1 board-to-suppression formula, minimum/maximum theoretical values (e.g. `30+4T` was an illustrative proposal, **not approved**).
- A/B/C distribution percentages, random deviation, minimum viable force suppression, rounding and redistribution details.
- Species-specific causal rules for desert/wasteland and mixed-species detachments.
- Definitions and scope of ordinary local leader, army commander, command species; particular tactics and command-loss effects.
- Link between observation geography and concrete invasion route.
- Stage2/3 enemy rebuilding and retention specifics.

## Verified existing implementation (AoT261015 before this task)
- `stage1_trial_threat_policy_v1.js`: Trial1 base suppression **20**, development coefficients **0**.
- `EnemyArmyStructureResolver`: default `suppressionPerForce=35`, `maxForces=5`, main weight `2`; commanders/force profiles are derived at resolution. This is **not** the new proposed pre-generated roster model.
- `EnemyTruthObservableResolver` produces coarse traits from existing force profiles, without numeric suppression or command internals.
- `KnownEnemyState` receives explicitly recorded reports and tags. An observable trait in Truth is **not automatically a player-known report**.

## Safe next implementation steps
1. Keep the FirstRun production suppression/force configuration and Trial launcher unchanged.
2. Guard Truth-vs-Known boundaries with focused regression checks, including repeated observations.
3. Introduce an opt-in immutable army-blueprint generator in isolation **only after** its stable identity and random generation contract are specified.
4. Connect blueprint and board-derived suppression behind explicit policies, then run focused Stage1 and full FirstRun completion suites before integration.

**Scope of this task:** documentation and contract-level focused test only; no Trial gameplay, UI, generation policy, or state migration.
