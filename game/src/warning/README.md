# Warning and Investigation boundary

This package stores player-facing knowledge about the next Trial, not authoritative Trial data.

Rules:
- Trial Scenario owns authoritative enemy data.
- `TrialTimingAuthorityService` owns the exact internal Trial clock.
- Warning / Advisor / UI must not expose exact remaining Verse counts merely because the timing authority knows them.
- Warning and Investigation only read narrow semantic projections needed for player-facing knowledge.
- This package does not change enemy composition, ingress, routes, schedule, combat, or Trial resolution.
- Investigation reports are snapshots tied to the Verse when they were observed. Older reports are not rewritten when the underlying threat changes.
- Warning-state and presentation rules are intentionally separate from the exact internal clock.

Timing flow:

```text
TrialTimingAuthorityService (exact internal Verse)
    -> Warning semantic state / omen / atmosphere
    -> Advisor + UI presentation
```

The middle layer may know concepts such as `OMEN`, `WATCH`, `TENSE`, or `IMMINENT`, but presentation must not reverse those concepts back into an exact countdown.

Investigation data flow:

```text
Trial data -> ObservableEnemyProfile -> InvestigationReport -> KnownEnemyState
```


## Investigation history boundary

Successful investigations emit `GAME_FACT_TYPES.INVESTIGATION_RECORDED`.
`ChronicleSystem` stores a MINOR history index entry
(`CHRONICLE_INVESTIGATION_RECORDED`) containing only:

- verse
- trialIndex
- reportId
- sourceType
- cardId

Observation snapshots remain owned by `KnownEnemyState.reports`.
Chronicle does not copy ObservableEnemyProfile, route, ingress, force, suppression,
or observation contents, so Run history cannot become a second enemy-truth store.
