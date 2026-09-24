# Stage1 E2E / Integration Re-audit Status

Target: `AoT260922`  
Audit branch: `aot-task/AoT260922/integration/stage1-e2e-reaudit-r2`

## Purpose

This file records the current Stage1 completion gate from the integration-auditor perspective.

The auditor does not define Gameplay balance values and does not modify Trial/Investigation/Offering production behavior. Resolved owner work is verified at the integration boundary; unresolved items are returned to their owners.

## Resolved Stage1 blockers

### #200 — canonical browser FirstRun activation source

Status: **RESOLVED / CLOSED**

Merged owner work: PR #203 `feat(first-run): persist browser activation state`.

Current `scratch/test_stage1_e2e.mjs` verifies that the production browser bootstrap supplies an explicit FirstRun activation source before the Verse7 → Verse15 FirstRun path is certified.

Stage1 completion blocker: **NO**

### #201 — production Enemy Truth observable profile

Status: **RESOLVED / CLOSED**

Merged owner work: PR #206 `feat(trial): project observable enemy traits from Truth`.

Current Stage1 E2E verifies the production chain:

`TrueEnemyState -> observable -> Investigation -> KnownEnemyState -> WATCH`

at Verse8 using the real Investigation execution path.

Stage1 completion blocker: **NO**

### #202 — canonical Trial1 threat / non-zero enemy force

Status: **RESOLVED / CLOSED**

Merged owner work: PR #222 `feat(trial): add canonical Stage1 Trial1 threat policy`.

Production Stage1 Trial1 now supplies positive canonical StrategicSuppression and remains in the intended introductory one-force / one-route band.

Current Stage1 E2E asserts positive Trial1 suppression, non-zero route/force truth, legal ingress, and real TrialLaunchCoordinator start.

Stage1 completion blocker: **NO**

## Remaining HIGH

### #208 — Trial Deployment Economy production composition / final balance certification

Status: **OPEN / HIGH**

Owner: Trial Deployment Economy + Stage1 balance composition.

Important target distinction:

- Later `AoT260924` work demonstrates a green runtime integration path after additional merged work.
- This audit target is `AoT260922`.
- Results from `AoT260924` must not be counted as proof that `AoT260922` satisfies the same production composition contract.

On `AoT260922`, the existing Stage1 E2E currently verifies canonical Defense write-through after Trial1 plan activation, but it does not yet prove all intended Deployment Economy behavior:

- production `TrialDeploymentService` attachment
- real preview resolution
- positive Food / Material deployment sink
- exact preview == commit payment
- Food write-through exactly once
- Material write-through exactly once
- no duplicate charging across activation / battle / settlement

Do not select or invent a cost profile in this audit branch.

Stage1 completion blocker under the stated gate `unresolved HIGH = 0`: **YES**

## Downstream canonical path coverage already present

The current Stage1 E2E test reaches, without a mock Trial scenario:

`Verse1`
→ normal LAND Offering / placement
→ Verse7 traces / OMEN
→ Investigation unlock
→ Verse8 Investigation
→ KnownEnemyState / WATCH
→ TENSE / IMMINENT
→ Verse15 Trial1 due
→ positive Enemy Truth
→ legal ingress
→ Trial launch
→ interception planning
→ defense allocation
→ plan confirm / activation
→ battle
→ enemy traversal
→ route-end / HQ damage when applicable
→ Trial completion
→ settlement
→ Post-Trial interlude
→ Stage prelude
→ Stage2
→ 7x7 expansion
→ Trial session release
→ normal Verse progression / Offering restoration

## Current auditor verdict

- unresolved BLOCKER: **0**
- unresolved HIGH: **1** (#208)
- canonical downstream E2E test path: **implemented**
- latest `AoT260922` execution on this re-audit branch: **NOT YET VERIFIED BY A RUN**
- final Stage1 certification: **NOT READY**

The next D-owner action is to extend the audit-only E2E assertions for the #208 boundary, without modifying production Gameplay or choosing balance values, then run the Stage1 E2E / Full Inspection on the latest target.
