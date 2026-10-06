# AoT261002 superseded TASK cleanup audit

Audited target: `554a58cbe2973770e6c1661e86261c281a82e155`.

This manifest records reviewed replacements; it does not merge stale branches or delete refs. Each entry pins the exact source head. Sweeper must independently verify replacement PRs are merged into AoT261002 and their merge commits remain target ancestors. A changed source head or an open PR reference still blocks cleanup.

## Retained protection

- Initial audit excluded #421 and #422. The 2026-10-06 follow-up below records their closed, superseded state after #453 certification.
- Future changes or open PR references invalidate automatic cleanup eligibility.

## Replacement evidence

- `aot-task/AoT261002/cards/farm-storage-v1` at `7eaf0e1c00739c830595f21d5f2e65c3a3d618c2`: Farm production/storage scope is present in #429. Current resource_storage_policy and test_farm_storage_v1 match the old head exactly; later Mining/Altar generic special-block extensions are retained.
- `aot-task/AoT261002/cards/mining-post-v1` at `f9fd8a645d28edd1725912a190fcdaef89f7e2db`: The stale Mining Site implementation was reconciled in #440 and hardened in #442. Stage1 UC master expectations, discovered-source identity and current placement consumers replace the old definitions. Do not restore the stale Stage2/R assertions.
- `aot-task/AoT261002/first-run/completion-persistence-boundary-v1` at `55382eb1b0892dfcfada25fd65054eba315a6477`: #419 explicitly includes Stage2-only completion persistence. Three-way replay of this exact source head changes no target content.
- `aot-task/AoT261002/first-run/full-inspection-baseline-repair-v3` at `17ef19d3fa6cc099e940204334d4a3e4bce8e58d`: #419 explicitly includes #418 repairs. Three-way replay differs only in test_registry.json; current supplemental entries already exist once. #438 updates the later production-path FirstRun certification.
- `aot-task/AoT261002/integration/full-inspection-hygiene-v2` at `c3166f3ed90da7e0c05823fe0895d4ba0759ed22`: Three-way replay differs only in registry entries already present. Current Stage1 completion is supplemental, not the obsolete quarantine proposed by this head; #419 reinstated active certification.
- `aot-task/AoT261002/integration/test-registry-repair-v1` at `115a58c3656aae4d2dac32ecd6e38b9ed0ac71f0`: Remaining replay delta is obsolete quarantine/duplicate registry entries and a second duplicate Verse9 scope assertion. Current test already asserts Verse9 no forced minimum and passes through the production path after #438.
- `aot-task/AoT261002/first-run/verse7-global-event-visual-polish-v1` at `f0c63d93e97bbef214b0a4599b582611e97455bf`: #443 transferred the exact visual-polish scope and added the completion watchdog; current SVG is identical to this source head. Later callback/timer cleanup is retained.
- `aot-task/AoT261002/investigation/runtime-presentation-connection-v1` at `7ce5501099bc27c4a3c28fcb4212b25d529b3a2e`: #431 incorporates this runtime presentation connection. Later UIController changes are retained; the source regression differs only by asserting the current investigationCardPresentationRuntime.execute boundary.
- `aot-task/AoT261002/trial/battle-presentation-runtime-consumption-v1` at `5234bbde65cd53bc3df450e8cf8db7efff3aa780`: #439 reconciled the immutable snapshot result explanation, localization and Player Tray consumption with canonical layout and total handling. Stale UI/source files must not replace later Trial fixes.
- `aot-task/AoT261002/trial/fortune-check-result-adapter-v1` at `d0b6aae40d7fe5a66513b1209f70ec5f713b2479`: #441 reconciled the Shared CheckResult adapter and lifecycle input while preserving legacy Fortune/RNG semantics; strict finite-fact validation supersedes old coercion.
- `aot-task/AoT261002/trial/trial-controller-responsibility-refactor-v1` at `b85a25e1b9c4351047a3fe05fa80240a04dd17d5`: #447 migrated the coordinator extraction and pending guard/end cleanup onto the current battle methods, preserving #445 origin context/action provenance. The 12-case characterization file is identical to this source.
- `aot-task/AoT261002/trial/engagement-origin-selection-ui-v1` at `fd824d2144de0dbd3ae9f85c7015c171ef86e172`: #450 preserves the selector, UIController API and 32-case connected regression from #448, moving new geometry into UILayoutConfig. UIController and connected test match; component differs only by applying the central layout styles.

## Registry review

Old baseline/hygiene replay changes only registry content. The registry-repair replay additionally inserts a second Verse9 scope assertion already present in the current completion test. The current registry has one active supplemental entry for Investigation presentation and one for FirstRun Stage1 completion. Reintroducing the old quarantined completion entry would retire working certification.

## Validation

Replacement PR snapshots were read through authenticated GitHub access; every listed merge commit was verified as an ancestor of the audited target. Existing Sweeper tests and clean-worktree Full Inspection are required before publishing. Real browser rendering is outside this metadata-only change.

## Defense diagnostic follow-up (2026-10-06)

Audited target: `5de00ce213cf5b4bc9e9789f77b78a71bbdfcacd`. PR #453 was merged at this commit; PR Full Inspection run 37480738513, target Full Inspection run 37481347907 and Pages run 37481348111 all succeeded. The merged tree matches tested tree `94ba66c2359c055461a11116e2625e1e376d0227`.

- `trial-defense-allocation-diagnose-ci-v1` at `12895356eba1c99a5583c572ecd8b6db2504f473`: The direct production-path Full Inspection gate is already present; #453 retains it and expands certification to four control input modes. #421 was closed as redundant.
- `trial-defense-allocation-dom-diagnose-v1` at `6ea7f8c980805a8f9eccc09f2f71f693bbca4941`: The control DOM fixture and direct/slider/increase/MAX gates were reconciled in #453. Current post-selection hover regression, combat-defense slider maximum and value conversion are retained. #422 was closed after successful PR and target certification.

This is cleanup evidence, not certification of real-browser layout or pointer hit testing. Existing exact-head, merged replacement ancestry and open-PR reference protections remain unchanged. No production or Sweeper logic changes.
