# TrialController Phase 1 responsibility audit

Task: `aot-task/AoT261002/trial/trial-controller-responsibility-refactor-v1`
Owner: R. Target: AoT261002. Base: e2a76d1a.

## Scope and responsibility map

Only Phase 1. No Planning, Deployment, Traversal, Damage, Completion, Fact-emitter redesign or SessionContext extraction. Domain, Narrative and Fortune-owned files are excluded.

| Responsibility | Current public methods | Phase 1 disposition |
| --- | --- | --- |
| Session | `constructor()`, `startScenario()`, `endScenario()` | Unchanged. |
| Planning | `createRouteInterceptionInput()`, `validateRouteInterception()`, `getPlanningRoutes()`, `getRouteDecision()`, `getPlannedDefenseTotal()`, `getRemainingDefense()`, `getUndecidedRoutes()`, `setRouteInterceptPlan()`, `setRouteSkipped()`, `clearRouteDecision()`, `validatePlanningDraft()`, `buildInterceptionPlanSnapshot()`, `confirmInterceptionPlan()`, `validateConfirmedInterceptionPlan()` | Unchanged. |
| Deployment | `previewPlanningDraftDeployment()`, `previewInterceptionPlanDeployment()`, `getDeploymentHistory()`, `activateInterceptionPlan()` | Unchanged. |
| Battle | `startNextBattle()`, `resolveCurrentBattle()`, `createBattleContext()`, `previewInterception()`, `resolveBattle()` | Delegate sequence start, combat/snapshot orchestration; retain context/preview/legacy battle entry. |
| Fortune | `declineCurrentBattleOpportunity()`, `commitCurrentBattleOpportunity()`, `resolveCurrentBattleFortune()`, `finalizeCurrentBattleFortune()` | Delegate lifecycle ordering. |
| Traversal | `advanceAfterCurrentBattle()`, `transitionAfterCurrentBattle()` | Unchanged. |
| Damage | `resolveRouteEndDamage()` | Unchanged. |
| Completion | `canCompleteTrial()`, `completeTrial()` | Unchanged. |
| Query | `getRoute()`, `getRoutePosition()`, `getCurrentBattle()`, `isCurrentBattleResolved()`, `getCurrentBattleResult()`, `getBattleResults()`, `getBattleResolutionSnapshot()`, `getCurrentBattleResolutionSnapshot()`, `getCurrentBattleOpportunityFortuneRuntime()`, `getCurrentTraversalResult()`, `getRouteProgress()`, `isCurrentTraversalApplied()`, `isCurrentBattleSequenceAdvanced()`, `getCurrentDamageResult()`, `getDamageResult()`, `isDamageApplied()`, `isTrialCompleted()`, `getTrialResult()` | Delegate snapshot/runtime queries only; other queries remain. |

Fact projection is cross-cutting: PLAN_CONFIRMED, PLAN_ACTIVATED, BATTLE_STARTED, BATTLE_RESOLVED, TRAVERSAL_RESOLVED, BATTLE_SEQUENCE_ADVANCED, HQ_DAMAGE_RESOLVED, COMPLETED. Only battle started/resolved emission moves with its original call site and payload. It remains orchestration-adjacent until Phase 4.

## Reuse and boundary

- TrialPlanningDraftService / TrialDeploymentService / TrialDefenseReservation: unchanged authoritative planning/payment/reservation.
- TrialCombatResolver: unchanged combat calculation.
- BattleResolutionSnapshotFactory: unchanged causality/snapshot schema and immutable creation.
- BattleOpportunityFortuneRuntimeBridge: unchanged pending/completion ordering and sequence result projection.
- BattleOpportunityFortuneLifecycleService: unchanged eligibility, Ember commit, RNG checkpoint/2D6, decisive policy, snapshot evolution.
- TrialBattleSequenceService: unchanged queue transitions and completion guard.
- TrialEnemyAdvanceService / TrialHqDamageResolver / TrialCompletionService: untouched.

TrialBattleCoordinator owns snapshot collection and pending runtime, reads live session/service references through narrow ports, and calls existing route/context builders. The controller keeps writable enumerable compatibility properties for both runtime values; injected services remain live rather than copied. No new domain authority, RNG/payment implementation, or presentation logic.

## Characterization and limitations

Controller-public-API tests use real combat, snapshot, sequence, bridge and lifecycle with explicit test-only Fortune policies. Cover absent bridge, unavailable opportunity, pending, decline, commit/resolve/finalize guards, immutable snapshots, exact-once completion/facts/payment/RNG, failure propagation, next-battle transition and restoring runtime references through existing writable properties. Run before and after extraction and compare deterministic observable transcripts.

Existing risks intentionally preserved (not silently repaired in a responsibility-only refactor):
- Repeated resolveCurrentBattle while pending reconstructs/reopens runtime. A duplicate commit guard applies to the current snapshot, not to a discarded pending snapshot. A full anti-reentry guarantee requires a separate behavior-changing fix.
- endScenario clears snapshots/state but does not clear pending Fortune runtime; startScenario clears it.
- BATTLE_RESOLVED fact uses original combat prediction even when finalCombatResult exists.
- Active Fortune runtime has no canonical durable serializer/restore API here. TrialRestoreBoundaryService maps history restoration to trial start. Reference reattachment tests do not certify durable mid-Fortune save/load.

Requests: no A/B schema or presentation changes required for extraction. Fortune/R follow-up must agree anti-reentry/session cleanup and durable restore policy; do not change them implicitly in Phase 1.

## Phase 1 completion report

Changed files:
- game/src/trial/flow/trial_controller_base.js: delegates nine public battle/Fortune/snapshot methods; keeps original session resets and writable runtime properties.
- game/src/trial/flow/trial_battle_coordinator.js: owns snapshot/runtime references, combat-to-snapshot-to-Opportunity orchestration, sequence start/completion and original battle fact emission.
- scratch/test_trial_battle_coordinator_characterization.mjs: public contract characterization.
- scratch/run_full_inspection.mjs and scratch/test_registry.json: register that contract.
- this audit: responsibility map, evidence and remaining issues.

Controller: 1,042 -> 863 lines (179 fewer); Coordinator: 268 lines. No other owner runtime/domain/presentation files changed. Public signatures and return shapes are unchanged. The extracted method bodies are byte-identical to the base block; only their receiver's live service/session ports differ.

Validation on clean TASK at f0a35019:
- Characterization before/after: 6/6 PASS on each; deterministic JSON transcript byte-identical (state, responses, facts and counters).
- Existing Phase 2.8C Battle Resolution: 30/30 PASS.
- Existing Battle Opportunity/Fortune Runtime Bridge, Lifecycle, Battle Causality Domain and Causality/Resolution Domain focused diagnostics: PASS.
- Full Inspection: all six layers PASS, 84.16 seconds, exit 0.
- Full Inspection Stage1 E2E: 129 PASS / 0 FAIL; UI lifecycle: 188 PASS / 0 FAIL; main domain suite: 328/328 PASS.
- git diff --check: PASS. Real browser visuals: not tested; Node/DOM lifecycle coverage only.
- AoT261002 fetched again after implementation: still e2a76d1a376a00ab2c465fbac7f88604f5015aa4; no target drift at that fetch.

No requests to A or B are needed for this extraction. Fortune/R requests remain the anti-reentry, end-session cleanup and durable runtime restoration questions documented above. Phase 1 extraction is stable under the checked paths, but this is not certification of the pre-existing missing invariants. Phase 2 is not started; resolve or explicitly scope those follow-ups before proceeding. No push or integration performed.
