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
| `GameState` construction | legacy production state | Creates randomized Trial 1/2 schedule and `nextTrialTurn` | Keep until replacement timing authority exists |
| `GameState.getTrialNotice()` | legacy compatibility/rule helper | Returns direct remaining-turn notice | Keep while card predicates still consume it |
| `TurnLifecycleService` stage expansion | production gameplay, legacy-coupled | Stage 1 -> 2 at `trialSchedule.trial1`; Stage 2 -> 3 at `trialSchedule.trial2`; updates `nextTrialTurn` | Isolated behind `core/legacy_trial_schedule_compat.js` |
| `ConditionEvaluator.TRIAL_DISTANCE_ABOVE` | production rule predicate | Reads `nextTrialTurn - turn` | Do not extend; migrate to modern semantic condition later |
| `ConditionEvaluator.TRIAL_NOTICE` | production rule predicate | Calls `getTrialNotice()` and falls back to `nextTrialTurn - turn <= 5` | Do not remove while cards use `reqTrialNotice` |
| `ConditionEvaluator.TRIAL_WITHIN` | production rule predicate | Reads exact `nextTrialTurn - turn <= N` | Do not remove while cards use `reqTrialWithin` |
| `state_serializer_base.js` | save/history compatibility | Serializes `trialSchedule` and `nextTrialTurn` | Keep until restore schema migration |
| `hydrate_game_state_base.js` | restore compatibility | Hydrates `trialSchedule` and `nextTrialTurn` | Keep until restore schema migration |
| `TopHeaderComponent` | presentation legacy residue | Countdown badge exists but is forced hidden | Safe presentation residue; not timing authority |
| Warning / Investigation subsystem | modern production subsystem | No confirmed dependency on old schedule/countdown in inspected integration path | Keep independent |

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

These cards make the old countdown model gameplay-relevant even though the visible countdown badge is disabled.

`CMD_VIGILANCE` also has `reqTrialOrLowDefense`; its exact resolver path should be treated as part of the same follow-up card-condition audit before the old timing state is removed.

## What can be removed now?

Nothing in the schedule state itself is proven removable yet.

What *has* been safely changed:

1. Production-facing Trial UI now exposes `startTrialSession(...)` / `stopTrialSession()`.
2. Preview-named start/stop methods remain deprecated compatibility aliases.
3. Development Trial preview calls the production-facing session API.
4. Verse lifecycle no longer contains inline Trial-schedule stage-expansion rules; that legacy coupling is isolated in `core/legacy_trial_schedule_compat.js`.
5. A diagnostic covers the preserved Stage 1 -> 2 and Stage 2 -> 3 compatibility behavior.

## Required replacement contracts before deletion

### A. Trial timing authority

One authoritative runtime service must own when the next Trial actually occurs. First-run Trial 1 can be fixed at Verse 15 while later-run schedule policy can remain configurable, but callers must not infer timing independently.

### B. Board-stage progression authority

Board expansion must no longer happen merely because an old scheduled Verse number was reached. The replacement should state explicitly whether expansion occurs after Trial settlement, at another progression milestone, or by a separate progression rule.

Until that design is implemented, `legacy_trial_schedule_compat.js` preserves current behavior.

### C. Card semantic conditions

Old exact-distance predicates need semantic replacements compatible with Warning / Investigation, for example concepts such as:

- omen discovered
- threat/watch phase reached
- invasion confirmed
- warning severity/state

Do not mechanically map `<= 3`, `<= 6`, or `<= 10` to a new Warning state without card-by-card design review; those values currently encode different intended availability windows.

### D. Save/restore schema migration

Serializer and hydrator must migrate together. Old restore points containing `trialSchedule` / `nextTrialTurn` need an explicit compatibility policy before those fields disappear from the schema.

## Safe next sequence

1. Finish audit of compound card conditions such as `reqTrialOrLowDefense` and any DeckManager-specific direct schedule reads.
2. Define the modern Trial timing/progression read model; do not wire UI countdown to it.
3. Move board expansion from legacy schedule threshold to the chosen progression event.
4. Replace card-data timing predicates with semantic Warning/Trial predicates.
5. Migrate serializer/hydrator schema and compatibility.
6. Remove `getTrialNotice()`, `nextTrialTurn`, and finally `trialSchedule` only when no production consumer remains.
