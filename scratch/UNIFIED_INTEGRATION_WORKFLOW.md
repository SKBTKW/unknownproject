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

- the repository-wide inspector finds an unignored `REVIEW_REQUIRED` branch
- local and remote heads disagree
- Integration Guard reports BLOCKED / RECONCILE_REQUIRED / REVIEW_REQUIRED
- a candidate has no exact open PR
- PR Full Inspection is not SUCCESS
- PR or target SHA moves after planning
- merge preview is not CLEAN
- post-merge Full Inspection fails or times out
- post-merge Guard cannot verify the resulting target

The workflow never resolves conflicts, rebases, force-pushes, or deletes branches.

## Archive exclusions

`.aot-integration-workflow.json` contains explicit repository-wide audit exclusions.

An excluded branch is still printed as `IGNORED/ARCHIVE` when it has findings; it is not silently hidden.

Current project exclusions preserve the explicitly archived:

- `AGtest260915`
- `Legacy260911`

Changing this file changes only the top-level orphan-audit gate. It does not weaken Guard or Safe Integration Runner.

## CLI

Plan only:

```powershell
node scratch/unified_integration_workflow.mjs --target AoT260919 --plan
```

Integrate until complete or safely blocked:

```powershell
node scratch/unified_integration_workflow.mjs --target AoT260919 --execute-all --confirm INTEGRATE
```

Target can also be resolved from `git config aot.authorizedBranch`, the current `AoTYYMMDD` branch, or a current canonical TASK branch.
