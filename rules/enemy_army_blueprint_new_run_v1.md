# Enemy Army Blueprint New Run Bootstrap v1

Task: `enemy-army-blueprint-new-run-v1`

Target/base: `AoT261029` / `23f39d57a57df0c6308e255770073ea96522c7ad`

## Decision and completion boundary

IMPLEMENTED: Engine constructor/factory composition hook, opt-in Stage1 generation from an explicit policy, exactly-once construction guard, initial Verse1 snapshot inclusion, reuse of existing Lifecycle/Blueprint/RNG, restore non-generation and regression tests.

POLICY NOT CONFIGURED / NOT ENABLED BY DEFAULT: no production generation policy has been approved. This task chooses user instruction section3-2 option2. No provisional probabilities or species/equipment ratios are invented, and the existing test fixture stays test-only. A fresh Run with no explicit policy retains an empty Blueprint ledger. Therefore unconditional generation for ordinary production Runs is an unmet completion condition, intentionally deferred until a separately approved production policy is supplied.

Generation is automatic when a caller supplies `enemyArmyBlueprintPolicy` to GameEngine.createGame/new GameEngine. The option uses the existing generator policy contract; this task does not change its shape or derivation. `enemyArmyBlueprintGenerator` is an optional dependency override for focused tests/integration; the default is the existing generateEnemyArmyBlueprint function, not a new RNG or generator class.

## Existing initialization / restore investigation

- GameEngine.createGame is a thin constructor wrapper; callers also use new GameEngine directly. The hook belongs in the constructor so both paths are covered.
- RunSeed is selected before GameState and both independent CheckSystem/GameplayRandom streams. When dependencies.state is supplied, it is reused; otherwise a new GameState is constructed with Stage1/5x5 defaults and existing world/schedule randomness.
- Existing domain/world initialization and subsystem creation retain their order. TurnLifecycleService creates TrialThreatStateService, then TrueEnemyStateService, explicitly applies initial Threat for newly owned Truth, then EnemyTruthReadModel and HistorySnapshotService. Investigation projects from that existing read model.
- GameEngine then links state.runSeed and existing services and generates initial Offering. Previously, the next operation was the initial Verse1 captureRestorePoint. The new bootstrap runs between initial Offering and that existing capture. It does not reorder Threat, Truth, Offering or History service construction.
- state_serializer/hydrate_game_state already persist the optional Blueprint envelope from PR#469. No modifications are made to them. HistorySnapshotService captures that serialized field automatically; HistoryRestoreService hydrates existing GameState identity, restores runtime/RunSeed/RNG directly, and rolls back failures. No fact replay or generation hook is added there.
- Existing EnemyArmyStructureResolver still derives live force structure from suppression; TrialThreatStateService commits Threat updates at Verse boundaries. TrialScenarioFactory prefers truth.armyStructure, not Blueprint. TrueEnemyStateService/read model and scenario construction are unchanged. Trial1 remains suppression20/one force.

## Bootstrap API and ownership

`bootstrapEnemyArmyBlueprintNewRun({ gameState, runSeed, isNewRun=false, policy=null, generator=generateEnemyArmyBlueprint })` returns `{status, lifecycleService}`.

The Engine passes `isNewRun: !dependencies.state`. Neither Verse1 nor ledger absence is used as evidence of a new Run. An injected state at Verse1 is Restore, even if it lacks Blueprint data and a policy is provided. For a separately hydrated GameState, the first bootstrap is RESTORE_ONLY. Hydrating a state after its new-Run constructor is also supported: the already-consumed session guard cannot be rearmed by missing data or another common initialization call.

Status values:

- GENERATED: explicit policy on a fresh Stage1 generated and registered once.
- EXISTING_BLUEPRINT: a valid Stage1 Blueprint already existed; reuse without policy/generator invocation. Explicit changed registration still fails in Lifecycle Service.
- RESTORE_ONLY: state injection / explicit non-new mode; no generation or backfill.
- STAGE_NOT_SUPPORTED: fresh Stage other than1; no Stage2/3 generation.
- POLICY_NOT_CONFIGURED: no explicit policy; production generation disabled.
- ALREADY_INITIALIZED: same GameState construction session was already handled; no new generator call, including after legacy/empty hydrate.

A module-private WeakMap holds only the construction-session guard and Lifecycle reference, not a second army map. Persisted truth remains the existing GameState-owned ledger. The Engine exposes enemyArmyBlueprintBootstrap and enemyArmyBlueprintLifecycleService; both refer to the same service. Snapshot consumers must read the service rather than cache an earlier ledger.

Every repeated call validates the current ledger. Corruption is never repaired by drawing a new army. Failed generator/registration attempts leave no partially registered Blueprint, record the failure for that session and rethrow on retry instead of drawing again. The built-in generator is pure and Lifecycle validates before its single commit. No asynchronous generation or retry loop is introduced.

The default `isNewRun=false` makes an unclassified direct bootstrap safe. A caller must explicitly declare a fresh state; arbitrary callers deliberately lying about a previously untracked state are outside the contract. Engine-owned restore paths never declare it new.

## Determinism and persistence

The existing versioned FNV-1a seed tuple and common RandomSource are unchanged. No added salt, live stream draw, time or UI dependency exists. Initial Offering/world/GE snapshot data, both RNG states and live TrueEnemyState are deep-compared against a same-seed Run without Blueprint generation.

Initial captureRestorePoint includes the registered Blueprint. Later JSON and History save/restore use only the existing model validation and saved data. Missing/empty old save data remains unregistered, regardless of matching RunSeed/policy. Invalid saved Blueprint fails rather than generating a replacement. Session guards are not saved; a reconstructed Engine receives its restored state explicitly, which selects RESTORE_ONLY. Existing broad Run save/load architecture is not replaced or extended.

## Tests and scope

New tests registered as supplemental and executed by Full Inspection Layer6 / GitHub CI:

- scratch/test_enemy_army_blueprint_bootstrap_unit.mjs: generation count, identity/determinism, policy gating, existing data, restore suppression, unsupported Stage and atomic failure.
- scratch/test_enemy_army_blueprint_new_run_integration.mjs: direct/factory constructor, initial snapshot, same-seed world/Offering/GE/RNG/Truth equality, occupied/legacy/empty restore, separately hydrated state, corrupt data and Verse progression.
- scratch/test_enemy_army_blueprint_new_run_first_run.mjs: unchanged canonical24-check FirstRun completion with automatic test-policy initialization, JSON hydration and History restore before play; real Verse7 GE/Verse8 Investigation/Verse15 Trial1/Stage2 progression with generator call count1 and unchanged saved army.

Existing Foundation, Persistence and default FirstRun tests are retained unchanged. Test-only fixtures are imported only by test code. No production default policy module is added because option2 deliberately leaves generation disabled without caller policy.

Out of scope: Stage transition generation, Stage2/3 schema or policy, suppression/deployment, force count changes, commanders/tactics/terrain causality, Blueprint-derived observations, Advisor/UI and replacement/synchronization of live Enemy Truth. No automatic merge is authorized for this task.
