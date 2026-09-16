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

Owns Trial resolution rules after a scenario exists.

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

UI must not reproduce these calculations.

### `flow/`

Owns orchestration and Trial lifecycle boundaries.

- `trial_controller.js` is the main runtime facade used by presentation code.
- `trial_session_boundary_service.js` owns begin / abort / release boundaries around a Trial session.
- Result settlement is required before a normal Trial exit.

### `presentation/`

Owns presentation-only Trial state and read models.

Draft hover state, selected cells, preview values, display mode, and UI-facing lifecycle projection belong here. Presentation state must not become the authoritative source for combat or scenario truth.

### `dev/`

Development-only harnesses and diagnostics.

`DevelopmentTrialPreviewHarness` and `diagnose_*.mjs` files are not production scenario authority. They may exercise production Trial services, but production game flow must not depend on dev-only scenario fixtures or diagnostics.

## Current production-facing UI boundary

`UIController` currently owns a `TrialController`, `TrialPresentationState`, and `DevelopmentTrialPreviewHarness`.

The method currently named `startTrialInterceptionPreview(...)` starts the real Trial controller/session presentation path even though its name still reflects the earlier preview phase. Treat this as a compatibility surface pending a dedicated production start API. Do not add new gameplay rules to this method.

The desired eventual split is:

```text
production trigger
    -> production Trial session start API
    -> TrialController

dev harness
    -> same production Trial session start API
```

The dev harness should become a caller of the production boundary, not an alternate Trial implementation.

## Known legacy surfaces outside this directory

`game/src/v2_unity_ready_main.js` still contains the older Trial schedule/countdown model:

- `trialSchedule`
- `nextTrialTurn`
- `warningDuration`
- `getTrialNotice()` returning direct remaining-turn information

These are legacy scheduling/presentation surfaces and are not the authority for the newer Warning / Investigation design. Do not extend them with new Trial behavior.

They must not be deleted until all references are audited. The cleanup order is:

1. find every read/write reference;
2. classify each reference as production, compatibility, test, or dead;
3. introduce the replacement production trigger contract;
4. migrate callers;
5. remove legacy schedule/countdown data only after reference count reaches zero.

## Invariants to preserve during cleanup

- Trial combat rules stay independent from Warning / Investigation presentation knowledge.
- Actual enemy state and player-known enemy state remain separate.
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

1. **Reference audit** — legacy schedule/countdown and preview-named production entry points.
2. **Production start boundary** — add a correctly named Trial session start API without removing compatibility callers.
3. **Dev harness convergence** — route development preview through the production start boundary.
4. **Legacy schedule isolation** — stop production code from consuming direct countdown state.
5. **Legacy removal** — only after tests/diagnostics prove no required references remain.

No gameplay rebalance, Trial rule redesign, or Warning/Investigation behavior change belongs in these cleanup commits.
