# Stage1 Trial Gameplay Foundation / Standard Board & Causality Audit v1

Status: diagnostic audit. Production balance and runtime behavior are unchanged.

## 1. Scope and method

This audit traces the current Stage1 path from the standard board to Trial damage and compares two explicitly injected prototype policies. The prototypes live only in `scratch/diagnose_stage1_trial_gameplay_foundation.mjs`; both declare `status: PROTOTYPE` and `appliesToProduction: false`.

The standard-board sample executes the real FirstRun economy through Verse 15 with three policies (`expansion`, `concentration`, `balanced`) for eight seeds (20260920-20260927), then launches the real production Trial. It does not install packages or modify production state.

## 2. Standard-board simulation report

| Strategy | Blocks | Cells | Food | Material | Defense | Ember | Legal intercept cells |
| --- | ---: | ---: | ---: | ---: | ---: | ---: | ---: |
| expansion | 13.00 (13-13) | 14.75 (14-17) | 190.75 (166-200) | 200.00 (200-200) | 20.88 (16-28) | 8.00 (7-9) | 2.63 (1-4) |
| concentration | 3.00 (3-3) | 3.38 (3-4) | 126.63 (0-209) | 78.00 (16-217) | 8.63 (5-11) | 6.00 (6-6) | 1.50 (0-2) |
| balanced | 9.50 (8-12) | 10.88 (8-16) | 200.50 (96-260) | 147.75 (34-267) | 16.88 (10-27) | 8.50 (6-11) | 2.13 (1-3) |

Values are mean followed by observed min-max. All 24 samples produced strategic suppression 20 and one route under the production policy. One concentration sample (seed 20260924) had zero legal interception cells despite Trial launch. This is not proof of an unwinnable run because skip/arrival resolution remains legal, but it is a playability risk requiring a route/interception-specific follow-up.

## 3. Threat and participant-policy comparison

### Production policy

- `stage1-trial-threat-policy-v1`: base suppression 20; development coefficients are all zero.
- `EnemyArmyStructureResolver`: one force per 35 suppression, up to five forces; suppression 20 therefore creates one participant and one route.
- Development is captured, but currently has no effect on Trial1 suppression.

### Diagnostic policies

| Policy | Injected formula | Injected 1/2/3 bands | expansion | concentration | balanced |
| --- | --- | --- | --- | --- | --- |
| prototype-block-pressure-v1 | 20 + 2 × blocks | 0-34 / 35-69 / 70+ | 46 / 2 | 26 / 1 | 36-44 / 2 |
| prototype-territory-pressure-v1 | 20 + cells + 4 × zones + 2 × links | 0-29 / 30-49 / 50+ | 34-39 / 2 | 23-24 / 1 | 28-36 / 1-2 |

The second policy exposes a discontinuity: balanced boards around 29/30 suppression switch between one and two participants after a single point. The resolver reports distance to the nearest band boundary so later balance studies can identify such cliffs. These coefficients and boundaries are examples for comparison only, not recommendations.

Source-force identity A/B/C is conserved by the existing consolidation foundation for injected participant counts 1-3. That foundation is not connected to production Trial routing. Production still emits generic `FORCE_1...` identities from the legacy structure resolver.

## 4. Causality connection matrix

| Input / stage | Production effect today | Evidence boundary | Status |
| --- | --- | --- | --- |
| Standard board occupancy | Captured as blocks, cells, zones, links | `CivilizationDevelopmentSnapshotService` | connected |
| Development → suppression | Coefficients are all zero for Trial1 | `stage1_trial_threat_policy_v1.js` | connected, inert |
| Suppression → force/route count | ceil(suppression / 35) | `EnemyArmyStructureResolver` | connected |
| A/B/C source identity → participants | Resolver and immutable snapshots exist | `EnemyForceConsolidationResolver` | foundation only |
| Participants → ingress | Production consumes generic army structure, not A/B/C consolidation | scenario pipeline | not connected |
| Terrain/elevation/growth → route and combat | Route eligibility and combat modifiers are resolved | `TrialTerrainEffectResolver`, `TrialCombatResolver` | connected |
| Enemy body/equipment → deployed/reserve suppression | Terrain interaction constrains deployable suppression | `TrialController.createRouteInterceptionInput` | connected |
| Selected enemy tactic → combat result | Selection is stored in battle context but not applied by `TrialCombatResolver` | `EnemyTacticResolver`, `TrialCombatResolver` | selected, numerically inert |
| Facility on intercept cell | Board identity is visible, but no generic facility combat modifier is inferred | terrain resolver boundary | only explicit terrain/trait rules |
| Weather/time/visibility | Accepted as future context; no current combat modifier | `BattlefieldContextResolver` | context only |
| Interception defense → suppression reduction | Human power reduces deployed enemy power | `TrialCombatResolver` | connected |
| Reserve suppression | Added back to post-battle remaining suppression | `TrialCombatResolver` | connected |
| Remaining suppression reaching HQ → Ember | power converted with ceil(sourcePower / 5) | `TrialHqDamageResolver`, aggregate service | connected |
| Normal Outcome causes | Facts, actions, modifiers and result are snapshotted | `BattleResolutionSnapshotFactory` | connected after resolution |
| Opportunity/Fortune | Optional runtime can revise final combat result before commit | battle coordinator/runtime bridge | connected when bridge supplied |
| Force relationships | Development causal model exists | `force_relationship_causal_integration_model.js` | development only |

## 5. Advisor information-source audit

The in-battle advisor semantic provider reads the immutable `BattleResolutionSnapshot`; it does not reconstruct hidden causes in presentation. The snapshot is built from the actual battle context, combat result, normalized human action, resolved facts, causes, consequences, and Normal Outcome.

The post-Trial advisor may receive sanitized `KnownEnemyState`. Its provider explicitly excludes `TrueEnemyState`, hidden routes, schedule internals, and RNG. Force-relationship advice remains a development model and does not alter the live advisor or Trial.

## 6. Structured assessment

### ① Concerns and risks

1. Production difficulty is board-independent at Trial1: expansion and concentration both face suppression 20 and one route despite large differences in defense and resources.
2. A development-weighted policy can create hard participant-count cliffs. A one-point change can add a route and multiply planning burden.
3. A/B/C identity, direction consolidation, investigation provenance, and force relationships are implemented as foundations but do not yet form one production chain.
4. One of 24 standard-board samples had no legal interception cell.
5. Selected tactics and future environment inputs can appear in causal context without changing the numeric battle outcome; presentation must not imply stronger causality than exists.

### ② Responses and alternatives

1. Keep all candidate coefficients and participant bands externally injected until a wider seeded study establishes difficulty and survivability envelopes.
2. Evaluate suppression and participant count separately. Prefer explicit hysteresis, wider bands, or a route-capacity rule if boundary cliffs prove undesirable.
3. Reconcile A/B/C consolidation with ingress in a dedicated TASK before any production switch, preserving source IDs through routes, observations, battle snapshots, and investigation provenance.
4. Add a focused reproduction for seed 20260924 concentration and distinguish intentional no-intercept routes from geometry/eligibility defects.
5. Add causal-status metadata to advisor-facing semantics before surfacing tactics, weather, time, visibility, or relationships as explanations.

### ③ Overall judgment

The current production chain is coherent from generic route creation through interception, residual suppression, and Ember damage. It is not yet a complete Stage1 gameplay model driven by standard-board development and A/B/C enemy identity. The safe next step is evidence collection and route-eligibility diagnosis, not promotion of either prototype balance policy.

## 7. Next implementation plan

1. Reproduce and classify the zero-interception concentration sample with route cells, terrain eligibility, available defense, and selection reasons.
2. Run larger seeded distributions for each candidate policy, reporting suppression, participant count, route count, defense coverage, skip frequency, and Ember loss.
3. Define a reviewed contract for `participatingForce source IDs → route force ID → battle snapshot → investigation provenance`.
4. Only after approval, implement that contract behind an opt-in policy and rerun Full Inspection plus browser playtest.

## 8. Reproduction

```text
node scratch/test_stage1_trial_gameplay_foundation_audit_v1.mjs
node scratch/diagnose_stage1_trial_gameplay_foundation.mjs 20260920 20260921 20260922 20260923 20260924 20260925 20260926 20260927
node scratch/run_full_inspection.mjs
```
