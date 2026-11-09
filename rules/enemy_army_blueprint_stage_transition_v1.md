# Enemy Army Blueprint Stage Transition Adapter v1

Task: `enemy-army-blueprint-stage-transition-v1`

Target/base: `AoT261029` / `170c1a3b38d78d60cfe4cfde3ec27bf31aca5d93`

## Status and boundaries

IMPLEMENTED: small Stage fact adapter, explicit applied-vs-reconciled fact provenance, opt-in Stage policy map, Lifecycle-owned registration idempotency, safe unsupported-stage no-op, explicit validation failures and regression coverage.

NOT IMPLEMENTED: production Stage2/3 Blueprint generation. The existing model remains Stage1-only. There is no actual forward Stage transition into a supported Blueprint Stage yet. The registration branch is exercised with a synthetic supported-Stage1 notification in unit tests, not by pretending the live game can transition back into Stage1. A future model/policy task must precede production Stage2/3 generation.

No production defaults, species ratios, equipment weights, force participation, suppression allocation, commanders, tactics, terrain causality, disclosure or UI behavior are added. Existing Trial Enemy Truth is neither replaced nor synchronized with Blueprint.

## Existing timing investigation

1. TrialStageProgressionService subscribes to TRIAL_RESULT_SETTLED and records a pending transition. This authorizes/reserves progression; the grid and Stage remain unchanged. Repeated settled Trial indexes are tracked by the existing service.
2. Presentation cleanup calls PostTrialProgressionService.completeAfterPresentationCleanup (via trial_result_ui_controller). Required reward/unlock steps and any presentation Stage gate still govern when automatic progression may execute.
3. PostTrialProgressionService._advanceAutomaticSteps calls TrialStageProgressionService.applyPending. The latter expands GridEngine to7x7/9x9, assigns state.stage, updates the legacy next-Trial mirror, adds the existing log and clears pending. The adapter does none of this.
4. After successful application, PostTrial marks its Stage step APPLIED and emits the existing POST_TRIAL_STAGE_ADVANCED fact. Reconciled restored steps can emit the same fact without an actual grid/Stage application.
5. This task adds an additive appliedNow boolean to that fact: true only at the successful applyPending call site; false on reconciliation/default emission. Old facts without the flag are conservatively treated as replay. TrialStageProgressionService itself is unchanged; there is no second Stage progression authority or polling.
6. Adapter subscribes in trial_runtime_bootstrap after Stage service creation but before PostTrial and later observers. It is attached once and reused on repeated runtime composition. The GameEngine-owned Lifecycle service is reused, with a state-backed fallback for existing minimal harnesses. Restore activity is read dynamically from HistoryRestoreService.isRestoring, and RunSeed from engine.runSeed.
7. Existing History snapshots are captured at Verse commit and after the next Verse initializes, before pending Trial launch. No History capture was found inside the Stage apply -> fact -> synchronous adapter gap; GridEngine and Stage apply do not capture History. The next capture sees the completed synchronous notification. A test counts captures and verifies a later observer sees the adapter result. External subscribers that capture on this fact must be attached after this adapter; arbitrary preexisting external listeners are not made transactional by this task.
8. Restore hydrates GameState and runtime snapshots directly without replaying facts. PostTrial can later reconcile a restored Stage step and emit a non-live fact. Both isRestoring and appliedNow=false prevent generation. Restored existing Blueprint remains authority; missing legacy data is not backfilled on reconciliation.

## Adapter API

`new EnemyArmyBlueprintStageAdapter({ gameState, gameFactHub, lifecycleService, policiesByStage={}, generator, runSeedProvider, isRestoring })`

- `handleFact(fact)`: handles POST_TRIAL_STAGE_ADVANCED only. Requires appliedNow=true, result.success, matching result/payload/current Stage ID and non-restoring mode. It reads Lifecycle registration first; an existing army is reused without generation. Missing policy is a successful POLICY_NOT_CONFIGURED no-op. A valid policy for an unsupported model Stage returns MODEL_STAGE_UNSUPPORTED without invoking the generator. A supported Stage with policy uses the existing deterministic generator and Lifecycle registration.
- `getLastResult()`: detached diagnostic result, with no world mutation. The Stage does not depend on this result.
- `dispose()`: idempotently unsubscribes.

Policy maps are explicit injection through `attachTrialRuntimeSubsystems(engine, {blueprintStageOptions:{policiesByStage}})`. They are copied, have canonical positive numeric Stage keys and are fully validated before subscription using the existing generator policy validator, including entries for currently unsupported Stages. No fixture is imported by runtime code.

The existing model now exports its unchanged Stage support list `[1]`. Its validator, generator, New Run bootstrap and this adapter reuse that single list. The existing generation policy validator is exported and reused rather than reimplemented. No new Stage support or random sequence is introduced.

Construction/configuration validation throws synchronously. Direct handleFact failures throw and Lifecycle validates before its single commit. The subscribed listener catches a handler failure and exposes `{success:false,status:'ERROR',message}` via getLastResult instead of throwing through GameFactHub's synchronous Stage listeners. No failure is reported as successful registration and no army is partially committed; callers enabling future supported-stage policies must inspect this explicit result. Default Stage2/3 paths cannot invoke generation.

Idempotency primarily follows the persistent Lifecycle ledger, not an adapter-local processed flag. Reattaching the adapter or restoring an existing army cannot reroll it. Attempts to explicitly register a different army still fail in Lifecycle. Reconciled notifications are ignored even when old saves contain no army.

## Snapshot and future limits

Serializer/hydrator/History services and Blueprint schema versions are unchanged. Existing saves retain their optional enemyArmyBlueprintState contract. Stage1 snapshots are not rewritten; JSON and History restoration preserve the same composition. Actual Grid expansion consumes existing gameplay RNG, so tests compare adapter-on/off runs at the same seed rather than incorrectly requiring the whole Stage transition to consume zero RNG.

The adapter does not authenticate externally fabricated facts: callers must preserve appliedNow=false on replay/reconciliation, as the existing PostTrial producer now does. Before enabling future Stage2/3 generation, durable provenance for any new external replay mechanism and save listeners preceding the adapter must be audited; this task does not enable an unsupported Stage to work around those boundaries.

## Tests

New scratch tests are registered as supplemental and run by Full Inspection Layer6 / CI:

- test_enemy_army_blueprint_stage_adapter_unit.mjs: reservations/unapplied facts, supported-port registration, duplicate state reuse/conflict, no-policy/unsupported Stage2/3, Restore/replay, invalid policies and errors/dispose.
- test_enemy_army_blueprint_stage_integration.mjs: real Grid and PostTrial Stage2/3, attach-once, live vs reconcile facts, identical RNG/Truth/Trial scenarios with adapter on/off, before/after snapshots, legacy/occupied JSON and History restore, synchronous observer/capture order.
- test_enemy_army_blueprint_stage_first_run.mjs: unchanged canonical24-check FirstRun path with Stage1 Blueprint, actual applied notification once, Stage2 expansion with no generation, immutable Stage1 snapshot and post-Stage JSON restore/replay.

Existing tests are retained unchanged. Browser rendering is not claimed for this data/integration task.
