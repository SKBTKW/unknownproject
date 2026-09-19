# AoT Integration Guard

Integration Guard is a **read-only integration inspection tool** for `aot-task/<AoT target>/...` branches.

Its job is to answer:

- Which TASK branches are already integrated?
- Which TASKs are ready, stale, review-sensitive, or blocked?
- Which TASKs overlap with each other?
- What is a safe provisional integration order?
- Which TASKs should be re-inspected after the target changes?
- What should the operator do next?

It does **not** perform the integration itself.

## Current contract

Current dashboard label: **V1.12**

Analysis schema: **v9**

The V1.13 documentation release does not change runtime behavior or analysis data.

## Safety boundary

Integration Guard is intentionally fail-closed.

It may:

- fetch and observe refs
- inspect ancestry and mergeability
- classify target/TASK overlap
- classify peer TASK overlap
- create a verified external `git bundle` backup
- persist `integration-analysis.json`
- print provisional guidance, ordering, clusters, and reinspection focus

It must not:

- merge
- rebase
- reset
- push
- delete branches
- resolve conflicts
- rewrite history
- mutate game/rules implementation
- silently continue when remote refs change during analysis

If the worktree is dirty, a Git operation is already in progress, local/remote TASK refs disagree, the target is ambiguous, backup verification fails, or the remote snapshot changes during the run, the Guard stops.

## Basic usage

From the repository root:

```bash
node scratch/integration_guard.mjs --target AoTYYMMDD
```

Example:

```bash
node scratch/integration_guard.mjs --target AoT260917
```

To select an explicit external backup location:

```bash
node scratch/integration_guard.mjs --target AoT260917 --backup-root <outside-repo-path>
```

The backup root must be outside the repository.

For detailed evidence:

```bash
node scratch/integration_guard.mjs --target AoT260917 --verbose
```

`-v` is equivalent to `--verbose`.

## Default dashboard

The default dashboard is intentionally concise.

It shows:

1. target SHA and verified backup location
2. status counts
3. provisional global integration order
4. integration groups / cluster strategies
5. cluster-local order
6. next-run focus
7. Executive Summary

Detailed peer-overlap evidence and per-TASK inspection facts are hidden by default.

Use `--verbose` when you need to inspect why a TASK was classified or why two TASKs overlap.

## Status meanings

### `MERGED`

The TASK HEAD is already contained in target history.

Current V1 proof is strict commit ancestry. Squash/cherry-pick equivalence is not assumed.

Action: `NONE`

### `READY`

The TASK contains the latest target, merge preview is clean, and no review-grade overlap requires escalation.

Action: `INTEGRATE_ONE_AT_A_TIME`

This is still a human integration decision, not an automatic merge instruction.

### `REVIEW_REQUIRED`

The TASK is structurally mergeable, but target or peer overlap requires human review.

Action: `REVIEW_OVERLAP`

### `RECONCILE_REQUIRED`

The target has advanced beyond the TASK's known base.

Action: `RECONCILE_TARGET`

The TASK should be reconciled against the latest target before choosing an integration order.

### `BLOCKED`

The Guard cannot safely prove the TASK relationship or mergeability.

Examples include:

- local/remote TASK mismatch
- missing remote TASK
- no merge base
- merge conflict
- unknown relationship

Action: `STOP_AND_INSPECT`

## Overlap graph and clusters

The peer-overlap graph represents **review relationships**, not semantic dependencies.

An edge means two TASKs touch related surfaces strongly enough to matter for review.

It does **not** mean:

- A depends on B
- A must be merged before B
- the edge has a direction

Review-grade connected components become `REVIEW_CLUSTER` groups.

TASKs with no review-grade cluster relation are shown as `INDEPENDENT`.

## Provisional ordering

The global order is advisory.

Current priority is:

1. status bucket
2. fewer review-grade peer overlaps
3. deterministic branch-name fallback

Within a cluster, local ordering uses:

1. status bucket
2. fewer review-grade direct overlaps
3. fewer changed files
4. deterministic branch-name fallback

Every ordering entry is explicitly `provisional: true`.

Status and per-TASK guidance remain authoritative over ordering.

## Cluster strategy

For `INDEPENDENT` groups, the TASK's existing action is preserved.

For `REVIEW_CLUSTER` groups:

- if any member is `BLOCKED` → stop and inspect
- otherwise if any member is `RECONCILE_REQUIRED` → reconcile stale TASKs first
- otherwise → review the cluster as a set, then choose one-at-a-time integration order

## After integrating one TASK

Once a TASK is integrated, the target SHA changes.

That makes the previous Guard snapshot stale.

Integration Guard predicts:

- direct review-grade peers
- remaining TASKs in the same review cluster

as the **primary reinspection set**.

Other active TASKs become the **secondary reinspection set**.

This prioritization does **not** exempt anything from the next full Guard run.

The safety contract is:

> After every target-history change, run Integration Guard again across all active TASKs.

## Executive Summary

The dashboard ends with a short operator summary.

Priority is:

1. `BLOCKED`
2. `RECONCILE_REQUIRED`
3. `REVIEW_REQUIRED`
4. `READY`

When available, it also identifies:

- the current next candidate
- the candidate's recommended action
- the primary reinspection focus after the target changes
- the requirement to run the full Guard again

## Backup contract

Before analysis, the Guard creates an external verified bundle backup.

The backup session contains artifacts such as:

- the Git bundle
- manifest
- SHA-256 checksum
- `integration-analysis.json`

The bundle is verified for restore before the analysis is trusted.

Remote refs are checked again after backup and after analysis. If they changed, the run is invalid and must be restarted from preflight.

## Session locking

Only one Integration Guard session should run against the repository at a time.

A live lock blocks a second run.

A valid stale lock is archived rather than silently discarded.

Unreadable or malformed locks stop execution for manual inspection.

## Recommended operator workflow

1. Ensure all worktrees are clean.
2. Ensure no merge/rebase/cherry-pick/revert is in progress.
3. Run Integration Guard against the current `AoTYYMMDD` target.
4. Read the Executive Summary first.
5. If blocked, stop and inspect.
6. If reconciliation is required, reconcile affected TASKs before integration.
7. If review is required, inspect the relevant cluster/overlap evidence with `--verbose`.
8. Integrate at most one TASK at a time.
9. After the target changes, run the full Guard again.
10. Repeat until no active TASK requires integration action.

## What Integration Guard is not

Integration Guard is not:

- an auto-merger
- a conflict resolver
- a semantic dependency solver
- proof that a provisional order is globally optimal
- permission to skip Full Inspection
- permission to skip reinspection after target changes

Its role is to make integration state observable, reproducible, and safer for a human operator.

## Validation

Integration Guard contract tests are included in AoT Full Inspection through:

`scratch/test_integration_guard.mjs`

Changes to Guard behavior should preserve the fail-closed safety boundary and must pass Full Inspection before being merged into the AoT target.
