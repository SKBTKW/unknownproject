# Trial subsystem boundary

This directory contains the runtime Trial subsystem. The purpose of this note is to make the current ownership boundaries explicit before further cleanup. It does not change gameplay behavior.

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

The intended production boundary is:

```text
GameState + EnemyTruth + Trial index
    -> TrialScenarioFactory
    -> Trial scenario
    -> TrialController.startScenario(...)
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

`trial_timing_authority_service.js` is the replacement boundary for the exact internal Trial clock. It knows scheduled Verse values and the current Trial index, but it is **not** a Warning/Advisor/UI presentation API.

`trial_timing_policy.js` owns schedule generation policy. The current target policy is:

- first-run Trial 1: Verse 15 exactly;
- later-run Trial 1: Verse 12..18;
- Trial 2: Verse 27..33;
- Trial 3: Verse 50.

The timing authority/policy are foundation only until the normal Verse runtime is explicitly migrated to them.

UI must not reproduce these calculations or expose exact remaining Verse counts from the timing authority.

### `flow/`

Owns orchestration and Trial lifecycle boundaries.

- `trial_controller.js` is the main runtime facade used by presentation code.
- `trial_session_boundary_service.js` owns begin / abort / release boundaries around a Trial session.
- Result settlement is required before a normal Trial exit.

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

The development preview harness now calls the same production-facing session API rather than owning an alternate start/stop path.

The current split is therefore:

```text
production caller
    -> startTrialSession(...)
    -> TrialController

dev harness
    -> startTrialSession(...)
    -> TrialController
```

Do not add gameplay rules to the deprecated preview-named aliases.

## Known legacy surfaces outside this directory

`game/src/v2_unity_ready_main.js` still contains the older Trial schedule/countdown model:

- `trialSchedule`
- `nextTrialTurn`
- `warningDuration`
- `getTrialNotice()` returning direct remaining-turn information

These remain live compatibility state while migration is incomplete. They are not the intended long-term authority and must not be extended with new Trial behavior.

### Confirmed live legacy dependency

The legacy schedule is **not dead yet**.

Board stage expansion currently depends on `trialSchedule.trial1` / `trialSchedule.trial2`. At the matching Verse boundary the normal turn lifecycle expands Stage 1 -> 2 (7x7) and Stage 2 -> 3 (9x9), and updates `nextTrialTurn`.

That behavior has been moved behind:

`game/src/core/legacy_trial_schedule_compat.js`

The same compatibility boundary now owns reusable legacy timing predicates used during migration. `ConditionEvaluator` consumes that boundary; `DeckManager` still has direct legacy timing checks and remains the main unresolved duplicate consumer.

This is an isolation boundary only. It intentionally preserves old behavior until board-stage progression, card eligibility, and save/restore migrate to explicit modern contracts.

The remaining legacy data must not be deleted until all references are audited. The cleanup order is:

1. find every read/write reference;
2. classify each reference as production, compatibility, test, or dead;
3. connect `TrialTimingAuthorityService` as the production timing source;
4. migrate stage progression and card predicates;
5. migrate save/restore;
6. remove legacy schedule/countdown data only after reference count reaches zero.

## Timing vs Warning invariant

The exact clock and player-facing warning state are intentionally different layers:

```text
TrialTimingAuthorityService
    exact internal Verse / due state
            ↓
Warning semantic state
    OMEN / WATCH / TENSE / IMMINENT
            ↓
Advisor / atmosphere / UI
```

Warning/Advisor/UI must never infer or display exact remaining Verse counts merely because the internal timing authority can calculate them.

## Invariants to preserve during cleanup

- Trial combat rules stay independent from Warning / Investigation presentation knowledge.
- Actual enemy state and player-known enemy state remain separate.
- Exact Trial timing remains internal simulation data, not player-facing knowledge.
- A route receives at most one deliberate interception in the current rules.
- INTERCEPT and SKIP remain explicit route decisions.
- Defense allocation is committed when the confirmed plan is activated, not while drafting.
- Breakthrough survivors continue to HQ under the current route semantics.
- HQ arrivals are aggregated before Ember damage conversion.
- Trial completion requires resolved battles/traversal and HQ damage resolution.
- Result settlement precedes normal Trial exit.
- Trial presentation cleanup must restore the normal board/layout context without mutating underlying normal-game board state.

## Cleanup sequence

Do cleanup in small, rollback-safe steps:

1. **Reference audit** — legacy schedule/countdown and preview-named production entry points. **Done for confirmed runtime surfaces.**
2. **Production start boundary** — expose a correctly named Trial session start API without removing compatibility callers. **Done.**
3. **Dev harness convergence** — route development preview through the production start boundary. **Done.**
4. **Legacy schedule isolation** — move confirmed old consumers behind an explicit compatibility boundary. **In progress; stage expansion and generic ConditionEvaluator predicates isolated, DeckManager remains.**
5. **Timing authority foundation** — define exact internal timing service and first-run policy without exposing countdown UI. **Done, not yet connected to GameEngine.**
6. **Production timing migration** — connect Verse runtime, Trial settlement, card eligibility, and save/restore to the timing authority.
7. **Legacy removal** — remove `getTrialNotice()`, `nextTrialTurn`, and `trialSchedule` only when no production consumer remains.

No gameplay rebalance, Trial combat-rule redesign, or player-facing Warning behavior change belongs in these cleanup commits.
