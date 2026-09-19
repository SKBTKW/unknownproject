# AoT Safe Integration Runner

Safe Integration Runner is the mutation layer that sits **above** Integration Guard.

Its purpose is not to merge everything automatically. Its purpose is to make one integration step recoverable, observable, and fail-closed.

## Safety contract

A run may merge **at most one PR**.

It never:

- deletes a branch
- rebases
- resets
- force-pushes
- resolves conflicts
- continues through BLOCKED / RECONCILE_REQUIRED / REVIEW_REQUIRED state

Before merge it requires:

- explicit target in merge mode
- clean Integration Guard preflight
- verified external bundle backup
- no BLOCKED TASK
- no RECONCILE_REQUIRED TASK
- no REVIEW_REQUIRED TASK
- READY candidate
- CLEAN merge preview
- exactly one open PR for candidate -> target
- non-draft PR
- PR head branch and SHA exactly match Guard analysis
- PR base exactly matches target
- GitHub merge state CLEAN
- AoT Full Inspection SUCCESS
- target and TASK remote SHAs unchanged since planning

After merge it requires:

- target SHA actually changed
- TASK remote SHA did not change
- TASK HEAD is contained in the new target history
- target push AoT Full Inspection SUCCESS
- a complete Integration Guard rerun from a fresh clone

If any post-merge verification fails, the tool stops and preserves the audit file. It does not attempt rollback automatically.

## Plan mode

Default:

```powershell
AoT_Safe_Integration_Runner.cmd --target AoT260919
```

or:

```powershell
node scratch\safe_integration_runner.mjs --target AoT260919 --plan
```

Plan mode performs Guard analysis and PR verification, writes an operation plan and audit record, but does **not** merge.

## Merge-next mode

```powershell
AoT_Safe_Integration_Runner.cmd --target AoT260919 --merge-next
```

`--target` is mandatory in merge mode.

The tool may merge only the next verified READY PR and then stops after post-merge validation.

## Recovery artifacts

The Integration Guard backup session is created before any merge attempt and contains the verified bundle and analysis.

Safe Integration Runner adds:

- `integration-operation-plan.json`
- `integration-operation-audit.json`

The audit records target SHA before/after, TASK SHA, PR number, whether execution was attempted, post-merge Full Inspection state, post-merge Guard rerun state, and any blocking error.

## Why there is no batch-all mode yet

The safe unit is:

> inspect -> backup -> merge one -> inspect target -> Full Inspection -> rerun Guard

A future batch command may repeat this unit, but it must never reuse a stale list of READY branches. Each target change invalidates the previous Guard snapshot.
