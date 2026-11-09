# Enemy Army Blueprint foundation v1

Task: `enemy-army-blueprint-foundation-v1`  
Owner: Enemy Army Blueprint / Pre-generated Enemy Truth Foundation  
Target: `AoT261029`  
Inspected base: `4457aecc93a0024ea0024d772870a060cebf9f9f`

## Status and boundaries

IMPLEMENTED: opt-in Stage1 data model, deterministic generation with explicit caller policy, detached reads, JSON snapshot restoration, unit and integration contracts.

SCHEDULED: Stage-start ownership/persistence wiring, blueprint-to-existing-Truth adapter, suppression allocation and participation. No production imports of the generator or model are added. The Blueprint is an immutable value, not a second live Truth service. Future Stage ownership must retain the created value/snapshot instead of regenerating it during observation or Trial allocation.

ON_HOLD: production species ratios, equipment probabilities, combination constraints, command roles/capabilities and future stages. Test fixture weights/shares are synthetic and authorize no gameplay balance.

The existing design ledger `99_enemy_army_design_ledger_stage1_v1.md` describes an earlier documentation-only task. Its closing scope is historical, not the scope of this implementation. Its reported default army settings and Trial1 policy agree with inspected code.

## Existing implementation investigation

- `TurnLifecycleService` creates `TrialThreatStateService`, which captures initial development and resolves initial Threat. It then creates `TrueEnemyStateService` and explicitly applies that initial Threat once. Thus production army structure already exists before an investigation, but is not a fixed Stage-start roster.
- `TrialThreatStateService` marks itself dirty on `CIVILIZATION_DEVELOPMENT_CHANGED`; a `VERSE_COMMITTED` while dirty recalculates Threat and emits `TRIAL_THREAT_UPDATED`. `TrueEnemyStateService` subscribes to that event. The injected standard `createEnemyStateTransitionResolver` resolves army structure again, then observable facets. Without a transition resolver, the Truth service retains its current army.
- `EnemyArmyStructureResolver` derives force count, IDs (`FORCE_1` etc.), suppression allocation, commander and quality from suppression and Trial index on each resolution. Defaults are suppressionPerForce=35, maxForces=5, mainForceWeight=2. Default profile is MEDIUM with STANDARD equipment. This is not a pre-generated A/B/C identity model and is deliberately unchanged.
- Truth resides in `TrueEnemyStateService.current` (commander, forces, armyStructure, observable, revision), not in KnownEnemyState. `EnemyTruthReadModel` returns detached snapshots. `TrialScenarioFactory` prefers the stored `truth.armyStructure`; it resolves a structure only as fallback when no structure exists. Trial launch also composes route/ingress selection and allocation; none is connected to Blueprint here.
- `EnemyTruthObservableResolver` projects coarse categorical body/equipment traits from force profiles, preserving explicit other observable facets. It does not reveal exact suppression or commander data. `InvestigationResolver` selects from this already-redacted profile; `recordInvestigationReport` copies explicitly reported observations into `KnownEnemyState.reports` and `observedTags`. Observation does not generate army composition or mutate Truth.
- `EnemyForceTerrainInteractionResolver` maps body size, active equipment and terrain to semantic interactions; `EnemyForceDeploymentResolver` computes deployed/reserve suppression from those interactions. `EnemyTacticResolver` determines eligibility from those profiles, terrain and existing commander level. These are downstream battlefield responsibilities and are not reused to invent Blueprint balance or command rules.
- `stage1_trial_threat_policy_v1.js` supplies Trial1 base suppression 20 and all development coefficients 0. With the default structure resolver this yields one force/route. FirstRun ingress and tutorial launch paths remain unchanged.
- `GameEngine` normalizes RunSeed to uint32 and creates separate CheckSystem and GameplayRandomService streams. Both reuse Mulberry32 `RandomSource`. No named stream/fork derivation utility was found. Blueprint requires an already-normalized uint32; it never creates a RunSeed or consumes either engine stream.
- `HistorySnapshotService` stores serialized GameState, both RNG states and runtime `trueEnemyState`/Threat state/RunSeed. `HistoryRestoreService` restores these service snapshots and RNG states. `TrueEnemyStateService.getRestoreState()` contains current Truth and lastThreat. `state_serializer.js` separately persists KnownEnemyState reports/tags. Blueprint JSON roundtrip is standalone only; no existing save schema, history lifecycle or migration is modified.

## Data contract

`EnemyArmyBlueprint` owns a recursively frozen private copy; its public instance is frozen. `getSnapshot()` and `getForce(slot)` return deep detached copies. `EnemyArmyBlueprint.fromSnapshot(snapshot)` validates and copies saved truth without random generation. Unsupported schema versions, stage IDs, malformed composition, reordered/duplicate force identities and unknown fields fail explicitly. Future schema versions require an explicit migration; v1 does not silently reinterpret them.

Snapshot fields:

```text
schemaVersion: 1
runSeed: uint32
stageId: 1
armyId: ENEMY_ARMY_V1_<runSeed>_STAGE_1
generationPolicy: { id, version }
forces: [
  { id: <armyId>_A, slot: A, composition: {
      speciesComposition: [{ type: LARGE|MEDIUM|SMALL, share: positive fraction }],
      equipmentComposition: [{ type: LIGHT|STANDARD|HEAVY, share: positive fraction }]
  } },
  ... B, C
]
```

Each composition list has distinct categories with positive shares summing to 1 (floating tolerance 1e-12). These are representation constraints, not production ratios. Species and equipment are separate marginal compositions; this schema asserts no species/equipment correlation, individual headcounts, force suppression or participation. A is the primary potential identity and B/C are secondary; three stored identities do not mean three participants. Identity is stable across policy changes for the same run/stage, while policy provenance is recorded separately.

Equipment vocabulary reuses exported `ACTIVE_EQUIPMENT_TYPES`. Species vocabulary is explicit Blueprint data; it is not a terrain category or a new body/terrain compatibility classifier. No commander, route, tactic or battle-result fields exist.

## Generation contract and usage

```js
const blueprint = generateEnemyArmyBlueprint({ runSeed, stageId: 1, policy });
const saved = JSON.stringify(blueprint.getSnapshot());
const restored = EnemyArmyBlueprint.fromSnapshot(JSON.parse(saved));
```

Policy is required; shape: `{ id: lowercase-kebab-case, version: positive integer, slots: { A: candidates, B: candidates, C: candidates } }`. Every slot has a nonempty ordered array of `{ weight: positive finite number, composition }`. Every candidate is validated even if it is not selected. Weight totals must remain finite. There is no default policy or hidden combination constraint. Fixed output can be supplied using one candidate per slot; mixed populations are explicit composition data. Any changed candidate data/order should receive a new policy version; callers retain the policy asset if future regeneration is required. Restore needs only the saved Blueprint, not the policy asset.

For each slot, FNV-1a hashes the ASCII JSON tuple `['enemy-army-blueprint-v1', runSeed, stageId, policy.id, policy.version, slot]` to uint32. A fresh common `RandomSource` seeded with that value makes exactly one draw for weighted candidate selection. Policy/slot ordering is explicit; object property insertion order does not affect generation. Other-slot draws, engine calls, investigation count, time and UI state cannot consume this local series. This is deterministic PRNG isolation, not cryptographic uniqueness; derived seed collisions are possible in 32 bits.

Golden test: seed 42, Stage1, test-only v1 gives stream seeds A=1390786755, B=715033562, C=2109847745 and rolls approximately .7593084881, .4215567079, .3017490061. Synthetic fixture first species: SMALL, MEDIUM, LARGE.

## Verification responsibilities

- `test_enemy_army_blueprint_unit.mjs`: deterministic replay/golden sequence, varied seeds, stable identities, vocabulary, invalid input/policy/restore, detached ownership, JSON roundtrip, per-slot isolation.
- `test_enemy_army_blueprint_integration.mjs`: actual InvestigationResolver/known report recording on a **test-only** redacted projection, repeated observation leaves Blueprint unchanged; real FirstRun GameEngine keeps existing Truth and both RNG states. No production disclosure adapter is introduced.
- Both are registered as supplemental, which Full Inspection runs. Existing Stage1 policy and FirstRun completion regressions remain unchanged and provide the live one-force launch and Stage2 progression checks.
- Browser rendering is outside these data-only changes; no real-browser verification is claimed.
