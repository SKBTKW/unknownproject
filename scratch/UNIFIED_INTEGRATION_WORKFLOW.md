# AoT Unified Integration Workflow

This is the top-level operator for integration work.

It composes the existing safety tools rather than replacing their contracts:

1. Orphan / Noncanonical Branch Inspector
2. Integration Guard (inside Safe Integration Runner)
3. Safe Integration Runner
4. PR Full Inspection verification
5. one merge only
6. target push Full Inspection verification
7. fresh-clone post-merge Guard rerun
8. repeat from repository-wide audit

## Double-click use

Run:

`AoT_Integration_Workflow.cmd`

The launcher offers:

- plan/audit only
- safe integrate-all loop
- exit

The integrate-all option requires typing `INTEGRATE` before any merge is attempted.

## Fail-closed rules

The workflow stops immediately when:

- the repository-wide inspector finds an unreviewed `REVIEW_REQUIRED` branch
- a previously reviewed stale branch no longer matches its pinned HEAD SHA
- local and remote heads disagree
- Integration Guard reports BLOCKED / RECONCILE_REQUIRED / REVIEW_REQUIRED
- a candidate has no exact open PR
- PR Full Inspection is not SUCCESS
- PR or target SHA moves after planning
- merge preview is not CLEAN
- post-merge Full Inspection fails or times out
- post-merge Guard cannot verify the resulting target

The workflow never resolves conflicts, rebases, force-pushes, or deletes branches.

## Reviewed stale history

Unique history is not made non-blocking merely because a branch is old.

A stale/noncanonical branch may pass the repository-wide audit only after an explicit review entry is added to
`.aot-integration-workflow.json`. Each entry is pinned to the exact reviewed 40-character HEAD SHA and records a
disposition/reason.

If that branch moves later, the observed HEAD no longer matches the acknowledgement and the workflow blocks again.
This prevents integration progress from silently redefining an unexplained branch as harmless.

The current AoT260919 entries were reviewed as tooling-only history. The Orphan Inspector implementation is retained
in AoT260920, the Unified Integration Workflow was ported, and the earlier blanket non-blocking treatment of
`REVIEW_REQUIRED` history is replaced by this pinned fail-closed contract.

## Archive exclusions

`.aot-integration-workflow.json` also contains explicit repository-wide audit exclusions.

An excluded branch is still printed as `IGNORED/ARCHIVE` when it has findings; it is not silently hidden.

Current project exclusions preserve the explicitly archived:

- `AGtest260915`
- `Legacy260911`

Archive exclusion is stronger than stale-history review and should remain limited to branches intentionally designated
as archival. Changing this file changes only the top-level orphan-audit gate. It does not weaken Guard or Safe
Integration Runner.

## CLI

Plan only:

```powershell
node scratch/unified_integration_workflow.mjs --target AoT260920 --plan
```

Integrate until complete or safely blocked:

```powershell
node scratch/unified_integration_workflow.mjs --target AoT260920 --execute-all --confirm INTEGRATE
```

Target can also be resolved from `git config aot.authorizedBranch`, the current `AoTYYMMDD` branch, or a current canonical TASK branch.
