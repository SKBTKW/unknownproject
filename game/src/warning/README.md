# Warning and Investigation boundary

This package stores player-facing knowledge about the next Trial, not authoritative Trial data.

Rules:
- Trial Scenario owns authoritative enemy data.
- Warning and Investigation only read a narrow projection of that data.
- This package does not change enemy composition, ingress, routes, schedule, combat, or Trial resolution.
- Investigation reports are snapshots tied to the Verse when they were observed. Older reports are not rewritten when the underlying threat changes.
- Warning-state and presentation rules are intentionally outside this foundation.

Data flow:
Trial data -> ObservableEnemyProfile -> InvestigationReport -> KnownEnemyState
