# Enemy Army Blueprint Persistence v1

Task: `enemy-army-blueprint-persistence-v1`

Owner: Enemy Army Blueprint Lifecycle / Persistence Foundation

Target/base: `AoT261029` / `69f58995d2dc95c7fa367c4b243330dcfd4340e6`

## Scope and inspected boundaries

IMPLEMENTED: explicit Stage-keyed registration, detached reads, immutable held snapshots, versioned save envelope, JSON/History restoration, missing legacy field handling and validation before mutation.

NOT CONNECTED: GameEngine/createGame, new Run, Stage transition, Trial scenario, Investigation/GE, Advisor/UI, participation, suppression allocation, commanders or new generation policy. No generator import exists in the service or persistence path. Existing TrueEnemyState remains the live Trial authority.

Investigation of the existing implementation confirmed:

- Foundation PR #468 provides the validation authority, immutable EnemyArmyBlueprint and deterministic opt-in generator. No existing Blueprint lifecycle/persistence service or field was found. Other snapshot freeze helpers are module-private, not shared APIs.
- `EnemyArmyStructureResolver` derives existing force count, scale and profile from suppression; `TrueEnemyStateService` updates its separate current army on Threat transitions and exposes copies through `EnemyTruthReadModel`. This task does not change either contract.
- GameEngine initializes RunSeed, GameState, TurnLifecycle/Truth and History before initial Verse1 capture. GameState defaults to Stage1; TrialStageProgressionService applies Stage2 expansion only after settlement/presentation cleanup. Neither is a registration or generation trigger here.
- `state_serializer.js`/`hydrate_game_state.js` wrap the base world serialization contract. Base hydration rejects unknown fields and prepares world values before applying them. Therefore the wrapper owns the new optional field and removes it before calling the base.
- HistorySnapshotService captures serialized GameState for both committed snapshots and Verse restore points. HistoryRestoreService uses the same serializer/hydrator for restoration and rollback checkpoints. Reusing these existing paths preserves Blueprint data without adding a second service snapshot under runtime or modifying History services.
- The lifecycle envelope has its own schemaVersion=1. Existing Blueprint schemaVersion=1, History schemaVersion=1 and the existing save layout remain unchanged; an absent optional field identifies a legacy save, not a new Run or generation request.

## Service and ownership

`new EnemyArmyBlueprintLifecycleService({ gameState })` is opt-in. Omit gameState for an isolated plain data container. Empty construction does not change GameState. Existing state is validated, copied and frozen on explicit construction. No Engine attachment is introduced.

The single source is `gameState.enemyArmyBlueprintState`. The service is the registration writer and hydration is the authoritative save-replacement writer. There is no second cached map or mutable generated-stage set; a service already bound to GameState immediately sees restored data. Consumers must use the service API rather than replace the GameState field themselves.

APIs:

- `registerBlueprint(stageId, blueprintOrSnapshot)`: validate using EnemyArmyBlueprint.fromSnapshot, check destination Stage, then atomically commit a frozen copy. Returns `{registered: true, blueprint}` on first registration; same-content repeat returns `{registered: false, blueprint}`. A changed existing Stage throws `BLUEPRINT_LIFECYCLE_STAGE_ALREADY_REGISTERED`.
- `getBlueprint(stageId)`: detached immutable EnemyArmyBlueprint or null. Invalid Stage ID throws. Retrieving an unregistered Stage never generates it.
- `getSnapshot()`: deep detached envelope copy.
- `restoreSnapshot(snapshot)`: validate every entry before one authoritative replacement; returns a detached envelope. This explicit historical save replacement can replace the current timeline, unlike registration. It does not merge current/future data into old saves.

Object property insertion order is ignored for same-content registration; ordered Blueprint arrays remain significant. The envelope rejects duplicate stages, unsupported schema, missing/extra envelope fields and non-array data. Blueprint schema, army/force identities and composition validation remain in the existing model. Array.from visits sparse army lists; the Blueprint model's force iteration is likewise hardened to visit holes rather than silently skip validation.

Only Stages allowed by the existing Blueprint model can be registered: currently Stage1. The Stage-keyed envelope supports later validated model versions, but this task neither relaxes the Stage1 constraint nor fabricates Stage2/3 data to test multiple entries. Multi-Stage production support remains unimplemented. Mixed RunSeeds are rejected if future model support permits multiple stages.

## Save shape and backwards compatibility

An occupied save adds only:

```json
{
  "enemyArmyBlueprintState": {
    "schemaVersion": 1,
    "blueprints": ["<complete EnemyArmyBlueprint snapshot>"]
  }
}
```

The quoted placeholder represents the full nested object, not an actual string in saved data. Each entry already contains its RunSeed, Stage ID, army/force identities, generation policy identity/version and composition. The envelope does not duplicate those fields.

When empty or absent, the serializer omits the field so existing unregistered save output stays unchanged. Serialization validates and copies, consumes no RNG, and does not modify the held army or regenerate it.

Hydration checks field presence explicitly: absent is legacy-compatible; present null/undefined/malformed is an error. It validates and freezes the entire Blueprint envelope before calling base hydration. A bad Blueprint therefore cannot change even unrelated world values. If base hydration fails, the prepared Blueprint is not installed. Successful legacy hydration deletes any future held envelope, leaving an unregistered state and preserving existing Trial behavior. Successful occupied hydration replaces the held snapshot directly without generation or policy lookup. The input save is never rewritten.

HistoryRestoreService's existing rollback checkpoint includes this field via serializeGameState. A later failure (for example the CheckSystem setter after hydration) restores the previous army through the existing rollback hydration. Fault-injection tests cover this path. No new service runtime restore hooks or seed-based rerolls are added.

Errors follow existing contracts: synchronous validation throws, History restore rolls back and rethrows. Unknown versions are explicitly rejected; no silent repair/migration or weakened validation is introduced.

## Validation routes

All four new test files are registered as `supplemental` in scratch/test_registry.json. Full Inspection runs that suite in Layer6, including in GitHub CI; supplemental is not a manual-only or quarantined classification.

- `test_enemy_army_blueprint_lifecycle_unit.mjs`: registration, same/different content, Stage consistency, model errors, detached ownership, envelope validation, repeated restore and unsupported Stage2/3.
- `test_enemy_army_blueprint_persistence_integration.mjs`: real serializer/hydrator JSON roundtrip, missing legacy field, repeated hydrate, malformed input preflight, base failure, both History capture routes, restore, late failure rollback and corrupt history input.
- `test_enemy_army_blueprint_persistence_regression.mjs`: fail-on-RNG spies for registration/save/hydration/History restore, stable existing Truth, suppression20/one force, no new Run/Verse generation.
- `test_enemy_army_blueprint_first_run_regression.mjs`: unchanged canonical 24-check FirstRun certification reused with test-only registration. Confirms Investigation -> Trial1 -> Stage2 and identical retained Stage1 Blueprint, no Stage2 generation. The original certification is not edited or weakened.

The canonical unregistered FirstRun completion and full pipeline remain required. Real-browser rendering is not claimed for this data-only task.
