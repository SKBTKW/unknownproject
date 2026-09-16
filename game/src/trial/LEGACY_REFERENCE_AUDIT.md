# Legacy Trial schedule reference audit

Branch baseline: `AoT260916`

This audit records confirmed consumers of the pre-Warning Trial schedule model before removal. It is intentionally descriptive: no entry in this document is permission to change gameplay behavior without a replacement contract.

## Legacy state under audit

Defined on `GameState` in `game/src/v2_unity_ready_main.js`:

- `trialSchedule.trial1`
- `trialSchedule.trial2`
- `trialSchedule.trial3`
- `trialSchedule.warningDuration`
- `nextTrialTurn`
- `getTrialNotice()`

The old model exposes exact Trial distance. The modern Warning / Investigation model must not use that exact distance as player-facing knowledge.

## Confirmed references

| Surface | Classification | Confirmed dependency | Current action |
| --- | --- | --- | --- |
| `GameState` construction | legacy production state | Creates randomized Trial 1/2 schedule and `nextTrialTurn` | Replacement schedule policy now exists but is not wired yet |
| `GameState.getTrialNotice()` | legacy compatibility/rule helper | Returns direct remaining-turn notice | Keep while DeckManager still consumes it |
| `TurnLifecycleService` stage expansion | production gameplay, legacy-coupled | Stage 1 -> 2 at Trial 1 scheduled Verse; Stage 2 -> 3 at Trial 2 scheduled Verse; updates `nextTrialTurn` | Isolated behind `core/legacy_trial_schedule_compat.js` |
| `ConditionEvaluator.TRIAL_DISTANCE_ABOVE` | production rule predicate | Exact Trial distance | Migrated to `LegacyTrialTimingReadModel` compatibility boundary |
| `ConditionEvaluator.TRIAL_NOTICE` | production rule predicate | Legacy notice active or distance <= 5 | Migrated to `LegacyTrialTimingReadModel` compatibility boundary |
| `ConditionEvaluator.TRIAL_WITHIN` | production rule predicate | Exact distance <= N | Migrated to `LegacyTrialTimingReadModel` compatibility boundary |
| `DeckManager.isCardEligible()` | production gameplay, duplicate timing authority | Reimplements `reqTrialNotice`, `reqTrialWithin`, and `reqTrialOrLowDefense` directly from `getTrialNotice()` / `nextTrialTurn` | Main remaining direct timing consumer; compat gate exists but is not wired yet |
| `state_serializer_base.js` | save/history compatibility | Serializes `trialSchedule` and `nextTrialTurn` | Keep until restore schema migration |
| `hydrate_game_state_base.js` | restore compatibility | Hydrates `trialSchedule` and `nextTrialTurn` | Keep until restore schema migration |
| `TopHeaderComponent` | presentation legacy residue | Countdown badge exists but is forced hidden | Safe presentation residue; not timing authority |
| Warning / Investigation subsystem | modern production subsystem | No confirmed dependency on old schedule/countdown in inspected integration path | Keep independent |

## Replacement timing foundation now present

### Exact internal timing authority

`game/src/trial/systems/trial_timing_authority_service.js`

`TrialTimingAuthorityService` owns:

- scheduled Verse by Trial index;
- current Trial index;
- exact distance-to-due calculation for simulation use;
- due/not-due checks;
- Trial-index advancement after settlement;
- restore state.

It is explicitly **not** a Warning/Advisor/UI read model. Exact remaining Verse counts must stay internal.

### Schedule generation policy

`game/src/trial/systems/trial_timing_policy.js`

Target schedule policy is now explicit and separately testable:

- first-run Trial 1: Verse 15 fixed;
- later-run Trial 1: Verse 12..18;
- Trial 2: Verse 27..33;
- Trial 3: Verse 50 fixed.

The policy currently requires gameplay RNG for randomized schedule entries and is not yet wired into `GameState` construction.

### Legacy compatibility read model

`game/src/core/legacy_trial_schedule_compat.js`

This boundary now owns:

- exact legacy Trial distance;
- legacy notice-active semantics;
- legacy `within N` semantics;
- `LegacyTrialTimingReadModel`;
- the reusable DeckManager-compatible card timing gate;
- legacy Stage progression compatibility.

This is migration infrastructure, not the long-term timing authority.

## Confirmed card-condition duplication

Trial-distance card eligibility still has two rule surfaces:

1. generic handlers in `ConditionEvaluator`, now routed through the compatibility read model;
2. direct field-specific checks in `DeckManager.isCardEligible()`.

`DeckManager` currently resolves:

- `reqTrialOrLowDefense`: `getTrialNotice().active || defense <= 30`;
- `reqTrialNotice`: `getTrialNotice().active || (nextTrialTurn - turn <= 5)`;
- `reqTrialWithin`: `(nextTrialTurn - turn) <= card.reqTrialWithin`.

`passesLegacyTrialCardTimingRequirements(card, state)` now preserves those exact semantics in one compatibility function. The remaining migration step is to route DeckManager through it without changing eligibility behavior.

## Confirmed active card-data dependencies

Current generated command-card data still uses old Trial-distance predicates.

### `reqTrialNotice`

- `CMD_MUD_OBSTACLE`
- `CMD_HIGH_GROUND_FORMATION`
- `CMD_CAVALRY_SCOUTS`
- `CMD_SCOUT_ENEMY`

### `reqTrialWithin`

- `CMD_SCORCHED_RETREAT`: 3
- `CMD_LOCAL_IRON_ARMAMENT`: 6
- `CMD_OMEN_DREAM`: 10

### `reqTrialOrLowDefense`

- `CMD_VIGILANCE`

These cards make the old countdown model gameplay-relevant even though the visible countdown badge is disabled.

## What can be removed now?

Nothing in the legacy schedule state itself is proven removable yet.

What *has* been safely changed:

1. Production-facing Trial UI exposes `startTrialSession(...)` / `stopTrialSession()`.
2. Preview-named start/stop methods remain deprecated compatibility aliases.
3. Development Trial preview calls the production-facing session API.
4. Verse lifecycle no longer contains inline Trial-schedule stage-expansion rules; that legacy coupling is isolated in `core/legacy_trial_schedule_compat.js`.
5. Generic `ConditionEvaluator` Trial-distance handlers no longer duplicate raw schedule arithmetic.
6. Compatibility diagnostics cover Stage progression, timing predicates, card timing gate semantics, internal timing authority lifecycle, restore, and first-run timing policy.
7. Exact timing and player-facing Warning responsibilities are documented as separate layers.

## Required replacement contracts before deletion

### A. Connect Trial timing authority

`TrialTimingAuthorityService` must become the production source of exact Trial timing. Connection must happen through GameEngine/runtime orchestration, not UI.

The service should advance its current Trial index from actual Trial settlement, not from Stage changes and not merely because a scheduled Verse was reached.

### B. Board-stage progression authority

Board expansion must no longer happen merely because an old scheduled Verse number was reached. The replacement should state explicitly whether expansion occurs after Trial settlement, at another progression milestone, or by a separate progression rule.

Until that design is implemented, `legacy_trial_schedule_compat.js` preserves current behavior.

### C. Card semantic conditions

First finish routing DeckManager through the compatibility gate. Then replace old exact-distance predicates with semantic conditions compatible with Warning / Investigation, for example concepts such as:

- omen discovered;
- threat/watch phase reached;
- invasion confirmed;
- warning severity/state.

Do not mechanically map `<= 3`, `<= 6`, or `<= 10` to a new Warning state without card-by-card design review; those values currently encode different intended availability windows.

### D. Save/restore schema migration

Serializer and hydrator must migrate together. New restore state should preserve `TrialTimingAuthorityService` state. Old restore points containing `trialSchedule` / `nextTrialTurn` need an explicit compatibility policy before those fields disappear from the schema.

## Safe next sequence

1. Route DeckManager Trial-timing eligibility through `passesLegacyTrialCardTimingRequirements(...)` with no behavior change.
2. Connect `TrialTimingAuthorityService` to GameEngine as internal exact timing state.
3. Persist/restore timing authority state alongside Threat and TrueEnemy state.
4. Trigger Trial production flow from timing authority due-state, not legacy `nextTrialTurn`.
5. Move board expansion to the chosen post-Trial/progression event.
6. Replace card-data timing predicates with semantic Warning/Trial predicates.
7. Migrate serializer/hydrator schema compatibility.
8. Remove `getTrialNotice()`, `nextTrialTurn`, and finally `trialSchedule` only when no production consumer remains.
