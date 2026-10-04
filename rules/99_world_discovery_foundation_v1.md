# Surroundings Exploration: inactive connection foundation

Status: IMPLEMENTED foundation / NOT CONNECTED gameplay.

This task adds data contracts and persistence only. It adds no card, result
catalogue, random selection, payment, check invocation, actual Offering unlock,
terrain generation or category availability change. Existing FirstRun behavior
and the temporary three Investigation cards remain unchanged. Their unpublished
localization task is on hold; they are not the intended final card portfolio.

## Responsibilities

- `createObservableWorldProfile`: allowlisted observations explicitly supplied
  by a future world-owned source. It neither reads Enemy Truth nor generates
  world contents. Eligibility must be resolved upstream before observations
  are supplied. No final category list is hardcoded.
- `createWorldInvestigationReport`: immutable observation snapshot, category,
  Verse and source type. BASIC requires at least one discovery and forbids a
  check. FOLLOW_UP references one BASIC report and may have zero new information.
  An existing Shared CheckResult is copied opaquely; this is not a dice resolver.
- `DiscoveryLedger`: immutable reports in `state.discoveryLedger`, separate from
  KnownEnemyState. Report IDs are idempotent; conflicting reuse is rejected.
  New/reconfirmed status is derived from earlier snapshots. A BASIC report may
  have only one FOLLOW_UP, restricted to its category. Actual payment/check
  atomicity and same-category candidate selection remain future runtime work.
- `projectWorldDiscoveryReport`: localized-key data, new/reconfirmed status and
  potential future Offering unlock keys. These keys declare intended effects;
  they do not assert that any Offering has already been activated.
- `DISCOVERY_RECORDED { discoveryId }`: common ConditionEvaluator requirement.
  Missing ledger or discovery fails closed. Card ID branching is unnecessary.
  No production card definition uses this requirement in this task.
- serializer/hydrate: canonical Run persistence; old saves restore an empty
  ledger. Reports are reconstructed/frozen, not re-rolled. History Restore uses
  the same serializers. No second save system is introduced.
- `isExplorationCategoryAvailable`: future opt-in policy contract. NormalRun is
  available; FirstRun requires its existing unlock. Missing Run classification
  fails closed. Current availability/execution paths do not call this function.

## Future connection order

A world-owned observable source and data-authored eligible result definitions
must precede category sampling through GameplayRandom. Then connect only the
Surroundings Exploration card. Footprints/camp remains/scout sightings are
THREAT observation sources, not intended independent cards. Enemy observations
continue through ObservableEnemyProfile/KnownEnemyState; world history must not
be inserted into that enemy contract.

Only after a basic result is shown may a configured, affordable investment invoke
Shared CheckSystem once. No check for category selection, no new RNG stream,
no free reroll after Restore. Whether an investment occurred, its cost/payment,
shared check and immutable follow-up must eventually be persisted atomically.
The foundation alone does not guarantee this future runtime transaction.

The future Offering bridge must report actual activation separately from the
potential unlock keys, with a truthful player-facing explanation. No activation
ledger or acknowledgement behavior is fabricated while actual targets remain
undecided.

Unresolved: investment cost/Stage multipliers, category/result catalogues,
Critical rewards, immediate placement/Ember expansion, final natural-heritage
and oasis effects, continuing-exploration GE and card weight. No balance values
or placeholder product discoveries are authored here.
