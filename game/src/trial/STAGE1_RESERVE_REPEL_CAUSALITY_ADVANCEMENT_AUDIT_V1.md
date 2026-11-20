# Stage1 Reserve / Repel Causality & Advancement Audit v1

## 0. Scope and evidence boundary

- Base: `d9483050c024affbd22c4d41996361abb3a6d871` (`origin/AoT261110` at task start)
- Scope: current Stage1 Trial reserve, normal outcome, route traversal, HQ arrival and causality contracts
- Production mutation: **none**
- Diagnostic entry: `scratch/diagnose_stage1_reserve_repel_causality_advancement_v1.mjs`
- Focused regression: `scratch/test_stage1_reserve_repel_causality_advancement_v1.mjs`
- Cases A-F: **development fixed-input fixtures** using the production resolvers. They are not production playthrough measurements.
- Existing `PRIMARY_SOURCE`, combat multipliers, terrain thresholds, REPEL policy, Opportunity/Fortune and damage rules remain unchanged.

## 1. Current force pipeline

| Concept | SSOT and unit | Next consumer | Snapshot / presentation |
|---|---|---|---|
| `totalSuppression` | `EnemyForceDeploymentResolver`; strategic route suppression | split into deployed and reserve | Battlefield Context `strategicSuppression` |
| `deployedSuppression` | deployment resolver; strategic unit | `InterceptionPowerResolver.resolveSuppression` converts by 1:5 | Battlefield Context keeps the pre-conversion deployment value |
| `reserveSuppression` | deployment resolver; strategic unit | converted by 1:5 before `createBattleContext` | Context/Fact/Cause uses pre-conversion value from deployment metadata; CombatResult uses converted combat value |
| `enemy.value` / `enemySuppression` | `TrialCombatResolver` after terrain modifiers; combat unit | normal-outcome comparison | Normal Outcome `enemyFinalPower` |
| `damageToSuppression` | `min(human.value, enemy.value)`; combat unit | remaining deployed calculation | Normal Outcome and read projector |
| `remainingSuppression` | terrain-adjusted deployed combat power minus damage | total-force calculation | Normal Outcome |
| `remainingForceSuppression` | remaining deployed plus converted reserve; combat unit | Enemy Advance | Normal Outcome and Battle result projector |
| traversal remaining force | `TrialEnemyAdvanceService` | HQ arrival aggregation | route progress; forced to zero for REPEL |
| HQ arrival suppression | sum of traversal results that reached route end | aggregate HQ damage | HQ damage result |

The dual-unit representation is deterministic but easy to misread. In Case B, the snapshot suppression block is strategic `20 / 9 / 11`, while Normal Outcome `remainingForceSuppression` is combat-scale `55`. No conversion metadata is attached to those individual snapshot fields.

The active Trial is not serialized as a mid-battle resume point. `TrialRestoreBoundaryService` redirects a restore request to the Trial-start Verse. Determinism therefore means replaying the fixed Trial input from that boundary, not hydrating a saved `TrialState` halfway through a battle.

## 2. Case A-F results

All suppression values below are combat-scale unless a column explicitly says strategic. Floating-point noise is rounded for the table.

| Case | Profile / terrain | Strategic total | Deployed / reserve | Terrain-adjusted enemy | Human | Outcome | Remaining deployed / total | Traversal | Stop / end | HQ arrival |
|---|---|---:|---:|---:|---:|---|---:|---:|---|---:|
| A | Large/Heavy, Open | 20 | 100 / 0 | 100 | 105 | REPEL | 0 / 0 | 0 | true / false | 0 |
| B | Large/Heavy, Forest | 20 | 45 / 55 | 42.5 | 45 | REPEL | 0 / 55 | 0 | true / false | 0 |
| C | Large/Heavy, Deep Forest | 20 | 25 / 75 | 25 | 31.75 | REPEL | 0 / 75 | 0 | true / false | 0 |
| D | Large/Heavy, Forest | 20 | 45 / 55 | 42.5 | 20 | BREAKTHROUGH | 22.5 / 77.5 | 77.5 | false / true | 77.5 |
| E1 | Large/Heavy, Forest | 20 | 45 / 55 | 42.5 | 42.5 | EXACT | 0 / 55 | 55 | false / true | 55 |
| E2 | Medium/Standard, Open | 20 | 100 / 0 | 100 | 100 | EXACT | 0 / 0 | 0 | false / true | 0 |
| F | B + D, two routes | 40 total | route-local | route-local | route-local | REPEL + BREAKTHROUGH | independent | 0 + 77.5 | stopped + reached | 77.5 |

### Relevant Facts / Causes

- A: `LOCAL_SUPERIORITY`, `HUMAN_PRESSURE_ADVANTAGE`; no reserve.
- B/C: `ENEMY_DEPLOYMENT_CONSTRAINED`, `ENEMY_RESERVE_PRESENT`; causes `DEPLOYMENT_CONSTRAINED`, `MOVEMENT_CONSTRAINED`, `ENEMY_RESERVE_HELD_BACK`, `LOCAL_SUPERIORITY`, `HUMAN_PRESSURE_ADVANTAGE`; consequence `SUPPORT_DELAYED`.
- D/E1: reserve/deployment/movement facts and causes remain, but local-superiority causes are absent.
- E2: no reserve/deployment cause.
- F: stopped REPEL contributes no arrival; the independent BREAKTHROUGH route contributes 77.5.

## 3. Central finding

Case B and C reproduce the requested state:

> Local battle is `REPEL`; CombatResult preserves reserve and remaining total force; traversal is `STOPPED`; traversal suppression and HQ arrival are zero.

The decisions are made at separate boundaries:

1. `TrialCombatResolver` compares only terrain-adjusted local powers. Any positive human margin is `REPEL`.
2. The same resolver preserves unengaged reserve in `remainingForceSuppression`.
3. `BattleResolutionSnapshotFactory` records reserve as available/held back and records `SUPPORT_DELAYED`.
4. `TrialEnemyAdvanceService` treats `REPEL` alone as a complete route stop and replaces traversal remaining force with zero.
5. `TrialHqArrivalAggregationService` excludes stopped routes, so HQ arrival is zero.

No Cause, Consequence, Battle State or Decisive Event explains that the reserve withdrew, lost command, became unable to advance, or was destroyed. The Battle State simultaneously says:

- `reserveAvailability = AVAILABLE`
- `supportDelay = DELAYED`
- `withdrawal = NONE`
- `collapse = STABLE`

`ENEMY_RESERVE_HELD_BACK` means that reserve exists and did not join the local engagement. It does not guarantee inability to move after battle or whole-army withdrawal. `SUPPORT_DELAYED` is a recorded battle consequence; it does not modify combat or traversal. No Fortune is implicitly generated to justify the stop.

`REPEL` therefore has a narrow meaning in Combat (local positive margin) and a wider meaning in Enemy Advance (entire route invasion stops). It is not used as evidence that the whole enemy army is destroyed: the CombatResult and immutable snapshot retain the reserve.

## 4. Issue classification

### P0 — causality contract contradiction, not a runtime crash

The route-stop state cannot be derived from the recorded Battle State. `AVAILABLE` reserve, `withdrawal=NONE` and `collapse=STABLE` coexist with whole-route STOPPED and zero traversal force. The runtime is deterministic, but the causal model does not explain the gameplay transition. This is a specification/semantic contradiction; this audit does not label the existing gameplay policy itself as an implementation bug.

### P1 — outcome discontinuity affects tactical value

A small positive local margin stops 55-75 reserve power in B/C, while EXACT lets that reserve reach HQ in E1. This makes forest/deep-forest interception highly valuable under current policy, but the value comes from the binary REPEL route rule rather than an explicit retreat/reorganization cause. Changing it would materially alter Stage1 balance.

### P2 — unit and presentation ambiguity

Battlefield Context displays deployment values in strategic units and remaining force in combat units under similarly named suppression fields. Narrative/presentation can expose reserve state and normal outcome, but no canonical player-facing projection states the reserve's post-REPEL disposition.

## 5. Options A-C

| Option | World/player rationale | Tactical/investigation value | Cost and determinism | Causality / future fit |
|---|---|---|---|---|
| A. REPEL withdraws whole force | Plausible only if REPEL is explicitly defined as loss of local initiative causing route withdrawal/reorganization | Preserves current strong value of choosing constraining terrain and learning enemy profile | Lowest Stage1 gameplay risk; deterministic and save-compatible | Needs an explicit advancement decision/reason and withdrawal/reserve disposition in the causal/read model |
| B. Reserve always continues | Preserves force conservation literally, but implies reserves can pass a defeated/blocked vanguard without delay | Can sharply reduce the value of forest interception and make information less useful | Small code diff but large balance/regression surface | Simple rule, poor fit for situations where local defeat should block a route |
| C. Branch by causality | Best long-term narrative and tactical expressiveness | Can reward terrain, intelligence, command and route choices distinctly | Highest cost; required command/control, retreat route and reserve-readiness inputs do not currently exist | Strongest Stage2+ extension path once those inputs have approved SSOTs |

### Recommendation

For the smallest Stage1 change, retain gameplay behavior A but harden its contract in a separate production TASK:

1. Introduce a pure advancement-decision projection that maps final battle outcome to `STOP / CONTINUE` with an explicit policy ID and reason.
2. Record post-battle reserve disposition (`WITHDRAWN_WITH_FORCE`, not destroyed) and route withdrawal state when REPEL stops the route.
3. Keep combat numbers, HQ damage and current REPEL threshold unchanged.
4. Add a unit label/provenance field to distinguish strategic deployment values from converted combat values.

This is a clarification of current gameplay behavior, but it still changes causal/read-model contracts and presentation semantics. It requires design approval. Option C should remain a later design TASK after its missing inputs are specified; Option B should not be adopted without a new balance audit.

## 6. Save/restore and regression evidence

- Trial restore request from Verse 16 while a Verse 15 boundary is active resolves to Verse 15.
- Replaying every fixed fixture from that boundary produces identical output.
- No claim is made that mid-battle `TrialState` is serialized/restored; current policy avoids that path.
- The immutable Battle Resolution Snapshot remains frozen in all cases.
- Full Inspection and FirstRun/Stage1 regressions are recorded in the Git handoff after the clean task commit.

## 7. Next TASK proposal

### Design approval required

- Decide whether Stage1 REPEL canonically means whole-route withdrawal/reorganization.
- Approve the post-REPEL reserve disposition vocabulary.
- Decide whether EXACT reaching route end with zero arrival is a valid traversal-state convention.
- Decide whether strategic/combat suppression names need schema changes or only explicit unit metadata.

### Can preserve existing gameplay numbers

- Add a pure, deterministic advancement decision result with policy/reason provenance.
- Project current REPEL stop into Battle/route state as withdrawal without destroying CombatResult reserve.
- Add focused tests for the B/C discontinuity, multiple-route isolation and restore-boundary replay.
- Update player-facing explanation to use the approved state without exposing hidden force details.

No production change from this proposal is included in this audit TASK.
