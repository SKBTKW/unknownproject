# Trial subsystem boundary

This directory contains the runtime Trial subsystem. This note records current ownership boundaries and migration status; it must not be used to smuggle balance rules into presentation code.

## Runtime ownership

### `domain/`

Owns Trial state and pure planning/domain contracts.

- `trial_state.js` is the Trial runtime state container.
- `trial_types.js` owns Trial enums, reasons, outcomes, modifier contracts, and current default Trial rules.
- `trial_planning_draft_service.js` owns route planning draft validation and INTERCEPT / SKIP decisions.

Code outside Trial may read these contracts, but should not duplicate their rules.

### `scenario/`

Owns conversion from normal-game truth/state into a Trial scenario.

- `trial_scenario_factory.js` is the production scenario assembly boundary.
- Enemy truth is authoritative for actual enemy composition and suppression when supplied.
- Warning / investigation presentation knowledge is not authoritative input for enemy truth.
- Ingress selection and route generation belong here, not in UI.
- Ingress count and route movement-cost policy remain explicit injected production dependencies. No dev fixture or arbitrary fallback may be used to make production launch appear ready.

The intended production boundary is:

```text
GameState + EnemyTruth + Trial index
    -> TrialScenarioFactory
    -> Trial scenario
    -> startTrialSession(...)
```

### `systems/`

Owns Trial resolution rules and internal Trial simulation services.

Examples:

- interception power
- terrain effects
- combat resolution
- battle sequencing
- enemy traversal
- skipped-route traversal
- HQ arrival aggregation
- HQ damage
- completion and settlement prerequisites
- exact internal Trial timing
- semantic due request creation
- settlement-authorized Stage progression

`trial_timing_authority_service.js` owns the exact internal Trial clock. It knows scheduled Verse values and the current Trial index, but it is **not** a Warning/Advisor/UI presentation API.

`trial_timing_policy.js` owns schedule generation policy. The current target policy is:

- first-run Trial 1: Verse 15 exactly;
- later-run Trial 1: Verse 12..18;
- Trial 2: Verse 27..33;
- Trial 3: Verse 50.

`trial_due_state_service.js` converts exact timing into an exactly-once semantic pending request containing only `trialIndex`. It never opens UI and never exposes remaining Verse counts.

`trial_stage_progression_service.js` owns Trial settlement -> Stage progression. Settlement only authorizes a transition; physical board expansion is deferred until Trial presentation/session cleanup has completed. Therefore Trial 1 is fought on Stage 1 / 5x5, then Stage 2 / 7x7 is created after successful settlement and exit. Trial 2 follows the same contract for Stage 2 -> Stage 3 / 9x9.

UI must not reproduce timing calculations or expose exact remaining Verse counts from the timing authority.

### `flow/`

Owns orchestration and Trial lifecycle boundaries.

- `trial_controller.js` is the main runtime facade used by presentation code.
- `trial_session_boundary_service.js` owns begin / abort / release boundaries around a Trial session.
- Result settlement is required before a normal Trial exit.

### `integration/`

Owns runtime composition boundaries.

- `trial_timing_bootstrap.js` attaches the exact timing authority and settlement fact bridge.
- `trial_runtime_bootstrap.js` composes the shared GameFactHub, timing, semantic Warning timing, due request state, and Stage progression without duplicating Investigation bootstrap.
- `trial_launch_coordinator.js` consumes a due request, validates authoritative EnemyTruth/scenario readiness, starts the Trial session, and acknowledges the request only after a successful start.
- `trial_launch_bootstrap.js` is idempotent and fail-closed. It does not invent ingress-count or movement-cost policy.

The production browser does **not** attach Trial launch merely to make the pipeline look complete. Launch composition remains intentionally unattached until the production ingress-count and route-cost policies are supplied. Missing policy is a readiness failure, not permission to use dev fixtures.

### `presentation/`

Owns presentation-only Trial state and read models.

Draft hover state, selected cells, preview values, display mode, and UI-facing lifecycle projection belong here. Presentation state must not become the authoritative source for combat, scenario truth, or exact Trial timing.

### `dev/`

Development-only harnesses and diagnostics.

`DevelopmentTrialPreviewHarness` and `diagnose_*.mjs` files are not production scenario authority. They may exercise production Trial services, but production game flow must not depend on dev-only scenario fixtures or diagnostics.

## Current production-facing UI boundary

The production-facing UI subclasses expose:

- `startTrialSession(...)`
- `stopTrialSession()`

The older `startTrialInterceptionPreview(...)` / `stopTrialInterceptionPreview()` names remain as deprecated compatibility aliases while the base UI implementation and older callers are migrated.

The development preview harness calls the same production-facing session API rather than owning an alternate start/stop path.

```text
production caller
    -> startTrialSession(...)
    -> TrialController

dev harness
    -> startTrialSession(...)
    -> TrialController
```

Do not add gameplay rules to the deprecated preview-named aliases.

## Timing vs Warning invariant

The exact clock and player-facing warning state are intentionally different layers:

```text
TrialTimingAuthorityService
    exact internal Verse / due state
            |
            +-> TrialDueStateService
            |      semantic pending { trialIndex }
            |
            +-> WarningTimingBridge
                   TENSE / IMMINENT only
                         |
                         v
                 WarningStateService
             OMEN / WATCH / TENSE / IMMINENT
                         |
                         v
                 Advisor / atmosphere / UI
```

`WarningTimingBridge` may read exact distance because it is the explicit simulation-to-semantic boundary. The Warning read model, Advisor, and UI must never receive or reconstruct that exact countdown.

OMEN/WATCH remain owned by the existing Warning lifecycle bridges. Trial timing owns neither omen discovery nor investigation state.

## Stage progression invariant

Board Stage is no longer advanced merely because the scheduled Trial Verse has been reached.

```text
Trial fought on current Stage
    -> TRIAL_RESULT_SETTLED
    -> TrialStageProgressionService queues transition
    -> Trial session/presentation cleanup
    -> applyPending()
    -> GridEngine.expandGrid(...)
    -> next Stage
```

A failed/terminated run does not progress to the next Stage. Duplicate settlement facts do not schedule the same transition twice.

`nextTrialTurn` may still be mirrored after Stage progression for legacy card eligibility compatibility. That mirror is not the modern timing authority.

## Known legacy surfaces

`game/src/v2_unity_ready_main.js` still contains older Trial schedule/countdown state such as:

- `trialSchedule`
- `nextTrialTurn`
- `warningDuration`
- `getTrialNotice()`

These remain live compatibility state while card predicates and save/restore migration are incomplete. They are not the intended long-term authority and must not be extended with new Trial behavior.

`game/src/core/legacy_trial_schedule_compat.js` still owns legacy exact-timing predicates consumed by old card/condition paths. Stage progression has migrated away from that compatibility path; its old stage helper is retained only as a temporary compatibility surface until all external references are proven absent.

The remaining legacy cleanup order is:

1. migrate remaining card eligibility reads to an approved modern contract;
2. migrate save/restore ownership for exact Trial timing;
3. remove obsolete `getTrialNotice()`, `nextTrialTurn`, `trialSchedule`, and retired compatibility helpers only after reference count reaches zero.

Do not reinterpret old exact-timing card conditions as Warning states without an explicit gameplay decision.

## Invariants to preserve during cleanup

- Trial combat rules stay independent from Warning / Investigation presentation knowledge.
- Actual enemy state and player-known enemy state remain separate.
- Exact Trial timing remains internal simulation data, not player-facing knowledge.
- Warning timing bridge advances only semantic TENSE / IMMINENT state.
- A due Trial request contains only the Trial index and does not open UI during `VERSE_COMMITTED`.
- Production Trial launch remains fail-closed if authoritative truth or required scenario policies are unavailable.
- Unresolved Global Event choices may block Trial presentation; ordinary active timed Global Events do not automatically own presentation.
- A route receives at most one deliberate interception in the current rules.
- INTERCEPT and SKIP remain explicit route decisions.
- Defense allocation is committed when the confirmed plan is activated, not while drafting.
- Breakthrough survivors continue to HQ under the current route semantics.
- HQ arrivals are aggregated before Ember damage conversion.
- Trial completion requires resolved battles/traversal and HQ damage resolution.
- Result settlement precedes normal Trial exit.
- Trial presentation cleanup restores the normal board/layout context before pending Stage expansion is applied.
- Normal-game board state is preserved when the grid expands around the existing board.

## Migration status

1. **Reference audit** — legacy schedule/countdown and preview-named production entry points: done for confirmed runtime surfaces.
2. **Production session boundary** — `startTrialSession(...)` / `stopTrialSession()`: done.
3. **Dev harness convergence** — development preview uses production session entry: done.
4. **Exact timing authority** — connected to runtime and advanced by Trial settlement facts: done.
5. **Semantic Warning timing** — exact timing -> TENSE/IMMINENT bridge without countdown leakage: done.
6. **Due request boundary** — exact clock -> semantic pending Trial index: done.
7. **Stage progression migration** — scheduled-Verse expansion retired from TurnLifecycle; settlement/post-cleanup progression active: done.
8. **Production launch coordinator/bootstrap** — contract implemented and fail-closed; browser composition waits for approved ingress-count and route-cost production policies.
9. **Legacy card/save migration** — still pending.
10. **Legacy schedule/countdown removal** — blocked until remaining production references are migrated.

No gameplay rebalance, Trial combat-rule redesign, or direct player-facing countdown belongs in these migration commits.
