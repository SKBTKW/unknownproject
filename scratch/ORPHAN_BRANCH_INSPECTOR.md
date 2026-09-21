# AoT Orphan / Noncanonical Branch Inspector

Read-only repository-wide branch audit for branches that the target-scoped Task Sweeper intentionally does not own.

## Why it exists

Task Sweeper only owns canonical branches under:

`aot-task/<current-target>/<domain>/<task-id>`

That safety boundary is intentional. This inspector covers the blind spot outside it:

- stale `aot-task/AoTYYMMDD/...` namespaces from older targets
- noncanonical `TASK/...`, `tmp/...`, `noop-...` and similar branches
- branches with unique commits against the current integration target
- duplicate branch heads
- local/remote head mismatches

## Safety contract

This tool is read-only.

It may run `git fetch origin --prune` to refresh remote-tracking refs. It never:

- creates branches
- merges or rebases
- resets HEAD
- pushes commits
- deletes local branches
- deletes remote branches
- declares a unique-history branch safe merely because its files look similar

Any branch with `ahead > 0` is `REVIEW_REQUIRED`. Semantic absorption must be confirmed separately.

## Usage

```powershell
node scratch/orphan_branch_inspector.mjs --target AoT260919
node scratch/orphan_branch_inspector.mjs --target AoT260919 --json
```

Use `--no-fetch` only when refs were already refreshed and network access is intentionally unavailable.

## Statuses

- `PROTECTED` — target or protected core branch
- `CURRENT_TASK` — canonical current-target TASK; Task Sweeper owns it
- `TARGET_CONTAINED` — no unique commits against target
- `DUPLICATE_HEAD` — target-contained and shares a head SHA with another branch
- `LOCAL_REMOTE_MISMATCH` — local and remote heads differ; stop and inspect
- `REVIEW_REQUIRED` — unique commits exist; never auto-delete
