# Stage1 Threat / Enemy Participation Production Integration v1

Status: implemented behind an explicit opt-in policy. Existing production defaults remain unchanged.

## 1. Runtime path

The opt-in path is:

`GameState board` → `CivilizationDevelopmentSnapshotService` → `TrialThreatResolver`
→ `Stage1ParticipationPolicyResolver` → `EnemyForceConsolidationResolver`
→ suppression allocation → legal common ingress selection → existing route generation
→ existing Trial planning, battle, aggregate HQ damage and settlement.

`TrialScenarioFactory` selects this path only when `attachTrialLaunchSubsystem` receives an
enabled `enemyParticipationPolicy`, or an adapter is injected directly. With neither input,
the legacy `EnemyArmyStructureResolver` path is unchanged.

## 2. Policy boundary

The participation policy must explicitly provide:

- `id`, `version`, `stageId: 1`, and `trialIndex: 1`
- three exhaustive 1/2/3-participant suppression bands
- A/B/C suppression weights
- an ingress direction priority
- `sourceDisposition: "CONSOLIDATE_ALL_SOURCES"`
- `runtimeProfileSource: "PRIMARY_SOURCE"`

No participation thresholds, A/B/C allocation weights, or merged-ingress weights are enabled
as production defaults. Diagnostic coefficients remain test-only. The existing Trial1 threat
policy still resolves base suppression 20 with zero development coefficients; it now exposes
an explicit policy ID and version without changing its numeric behavior.

## 3. Source identity and ingress

The current consolidation foundation always assigns all source forces A/B/C exactly once.
Consequently, `DROP_NON_PARTICIPANTS` is rejected. This makes the unresolved design conflict
explicit: nonparticipation and consolidation are different rules, and this integration does
not silently reinterpret one as the other.

Each participant snapshot retains:

- participant and primary source IDs
- every constituent source-force ID and immutable Blueprint composition
- activity-direction diagnostics from the consolidation snapshot
- allocated strategic suppression
- selected ingress direction, ingress ID, and cell

Merged participants use only the intersection of ingress directions supported by all their
sources. The old 70/15/15 single-source weights are not applied to merged participants. An
externally supplied direction priority selects among common legal directions. The existing
`EnemyInvasionEntryResolver` is not reused for this step because its v1 contract requires a
one-to-one source-force/participant mapping and cannot represent consolidation.

## 4. Persistence and information boundaries

The immutable Stage1 participation snapshot is stored in GameState and serialized. Restore
reuses that exact result instead of recalculating participation, allocation, or ingress. A
different suppression value or policy identity for the same Stage/Trial fails closed.

Old saves without the new field hydrate normally. Invalid or duplicate snapshots are rejected.
Consolidation and participation state are committed only after every allocation and ingress
has resolved, avoiding partial commits from failed previews.

The adapter reads Blueprint truth and direction truth but never reads or rewrites
`KnownEnemyState`. It preserves source IDs for the existing investigation-provenance projection;
it does not promote Blueprint composition into player-known information.

## 5. Verification evidence

The focused integration test uses explicitly test-only inputs:

- board development: 9 normal placement groups
- threat formula: `2 + 2 × blocks`, producing suppression 20
- participation bands: 0–9 / 10–29 / 30+
- source allocation weights: A/B/C = 3/2/1

This fixture produces two participants and two routes, conserves total suppression 20, keeps A
as MAIN, and preserves all A/B/C identities. It then executes the real `TrialController` through
planning, two interceptions, two battles, traversal, aggregate HQ damage, and completion. The
observed aggregate is source power 70, Ember damage 14, and Ember 15 → 1; damage is applied once.

The same test verifies deterministic repeat build, save/restore, old-save compatibility,
KnownEnemyState immutability, missing-foundation failure, no-ingress failure without partial
state, policy/snapshot conflict failure, and the legacy one-route path when opt-in is absent.

## 6. Standard-board policy comparison

The PR #493 strategy harness is reused for eight seeds (`20260920`–`20260927`) and three
strategies. Expansion and balanced are the 16 standard samples; concentration is retained as
an eight-sample diagnostic and is not used as the principal balance criterion. Every candidate
is marked `PROTOTYPE` and `appliesToProduction: false`.

The standard samples cover 8–13 placed blocks, 8–17 occupied cells, 0–1 completed zones,
0 links, food 96–260, material 34–267, defense 10–28, and Ember 6–11.

| Prototype | Strategic suppression | Participant distribution (1/2/3) | Basic Ember damage | Informed Ember damage |
| --- | ---: | ---: | ---: | ---: |
| Current numeric baseline `20` | 20 | 16 / 0 / 0 | 0–20 | 0–20 |
| `20 + 2 × blocks` | 36–46 | 0 / 16 / 0 | 1–27 | 0–27 |
| `20 + cells + 4 × zones + 2 × links` | 28–39 | 2 / 14 / 0 | 0–21 | 0–21 |

The block prototype makes every standard sample a two-route Trial and can exceed the current
starting Ember even after basic interception. The territory prototype spans both one and two
participants and therefore exposes the participant cliff, but it also remains severe. Neither
candidate is ready to become the production default from this evidence alone.

For each sample the diagnostic records blocks, cells, zones, links, resources, total
suppression, participant/source IDs, per-participant suppression, ingress direction/cell,
legal intercept count, allocated defense, operations, attenuation, remaining combat power,
strategic-equivalent residual, and Ember damage. Unplanned, basic first-legal, and globally
terrain/profile-informed interception are executed through the real Trial Controller. The
informed mode is an upper-bound diagnostic using scenario truth; it is not evidence that the
live player knows undiscovered composition.

### 6.1 Participant boundary at 29 → 30

The same balanced board is evaluated at suppression 29 and 30 for all eight seeds. The only
policy change is one participant versus two participants.

| Metric | Suppression 29 / one participant | Suppression 30 / two participants |
| --- | ---: | ---: |
| Legal intercept cells | 0–3 | 4–6 |
| Basic interception operations | 0–1 | 2 |
| Allocated defense | 0–27 | 10–27 |
| Basic strategic-equivalent residual | 0–29 | 0–19.5 |
| Basic Ember damage | 0–29 | 0–20 |

The boundary always doubles the required route decisions when both routes are interceptable,
but does not uniformly increase damage. In paired basic results, Ember damage changed by
`0, +1, +1, +2, 0, 0, -14, 0`; the extra route sometimes creates more legal interception
opportunities and can reduce damage. The cliff is therefore primarily an operation/defense
distribution discontinuity, not a monotonic hidden difficulty multiplier. Thresholds must not
be adjusted to conceal this mixed result.

### 6.2 Recommendation status

The territory-pressure prototype is the better next research candidate because it distinguishes
the observed standard boards and exercises both one- and two-participant paths. This is not an
adoption recommendation: its coefficients, 30/50 bands, 3/2/1 source weights, and direction
priority remain unapproved. Production should retain the current default until a reviewed
candidate meets a chosen survivability envelope.

## 7. Structured assessment

### ① Concerns and risks

1. Final development coefficients, participant thresholds, and allocation weights remain
   unapproved; enabling arbitrary values can create sharp route-count difficulty cliffs.
2. The consolidation foundation retains all A/B/C sources. A future design that truly removes
   B or C from participation needs a separate reviewed source-disposition policy.
3. `PRIMARY_SOURCE` is an explicit temporary runtime-profile projection. The full constituent
   composition remains preserved, but merged combat semantics still need a reviewed rule.
4. The known concentration sample at seed 20260924 with zero legal interception cells remains
   outside this task and is not concealed by the new adapter.

### ② Responses and alternatives

1. Keep opt-in disabled until balance values are approved after seeded standard-board studies.
2. Add a new source-disposition policy and snapshot schema version if true nonparticipation is
   selected; do not overload consolidation.
3. Replace `PRIMARY_SOURCE` with a reviewed merged-profile resolver in a later policy version.
4. Diagnose the zero-interception sample independently, preserving the existing known issue.

### ③ Overall judgment

The A/B/C foundation is now executable through the real Trial and damage pipeline under an
explicit, restorable policy boundary. The implementation is suitable for diagnostics and
policy review, while legacy production balance and launch behavior remain the default.

## 8. Completion status

Technical connection: complete behind explicit opt-in. A configured policy runs Board → Threat
→ A/B/C consolidation → ingress/routes → planning → all battles → aggregate Ember damage.

Gameplay adoption preparation: comparison package complete for user review, but production
adoption remains pending approval of coefficients, thresholds, allocation, source disposition,
merged-profile semantics, and ingress selection. The new path is therefore not enabled by
default.

Real-browser rendering was not tested. Headless domain, UI lifecycle, persistence, focused
Trial, supplemental, Stage1 E2E, and Full Inspection checks are reported separately.
