# Integration merge-preview contract v1

Task: `aot-task/AoT261029/tooling/integration-merge-preview-contract-v1`  
Target/base: `AoT261029` / `87db1d3e4b6740d59805f0953f3449295416c317`

## Incident and contract

PR #473 exposed a mismatch between Integration Guard and Safe Integration Runner. `previewMerge()` first checks whether target is an ancestor of TASK. For ordinary health inspection, an included target requires no reconciliation, so the helper returns `NOT_REQUIRED` without executing `merge-tree`. Guard could classify that TASK as READY. Runner correctly requires an actual `CLEAN` preview before it can build a Merge Decision Proof, and rejected that READY candidate.

`NOT_REQUIRED` means an ancestry-based shortcut was taken. It is neither a failed merge nor measured clean-merge evidence. GitHub's `CLEAN` merge state and successful Full Inspection do not replace the project's local preview requirement.

## Resolution

The shared helper accepts `{ requireMergeTree: true }` as its fourth argument. Integration Guard always uses this mode. Even for a contained target it executes the existing `git merge-tree --write-tree` preview and records the resulting tree SHA and CLEAN/CONFLICT/UNKNOWN status.

Default callers, including ordinary TASK health, retain the inexpensive NOT_REQUIRED shortcut. Runner, Merge Decision Proof, CI requirements, exact PR identity checks, integration ordering, peer-overlap review and human merge authorization are unchanged. No NOT_REQUIRED-to-CLEAN relabeling or manual evidence rewriting is introduced.

Git errors remain UNKNOWN and block integration. Divergent clean histories still require reconciliation under existing Guard rules; a successful preview alone does not make an outdated TASK READY. Content conflicts remain CONFLICT. Preview does not move refs or modify index/worktree; it may write unreachable Git objects, as before.

## Regression scope

The existing registered `scratch/test_task_merge_preview.mjs` now covers:

- Default contained-target health preview remains NOT_REQUIRED.
- Required contained-target preview returns measured CLEAN and the committed TASK tree, even with staged, unstaged and untracked user changes.
- HEAD, index and worktree status remain unchanged.
- Actual Git preview output flows through Guard classification into Runner proof without status rewriting.
- Missing successful CI or a mismatched PR head still blocks proof.
- Invalid Git execution remains UNKNOWN in required mode.
- Existing divergent clean, same-line, modify/delete and rename/rename cases remain in place.

The proof test uses a synthetic PR/CI fixture; it does not claim a real GitHub check ran. No new test file or registry entry is needed. Related Guard, Runner, health, progress-guide tests and Full Inspection must pass before push.

## PR #473 re-evaluation

Run the repaired tooling in read-only plan mode:

```powershell
node scratch/safe_integration_runner.mjs --target AoT261029 --repo SKBTKW/unknownproject --plan
```

This refreshes remote evidence and writes the existing backup/audit artifacts but does not authorize merging. Record the exact target/TASK/PR heads and CI result with the plan. A proof produced before target advances must be refreshed after this tooling TASK is integrated; PR #473 may then need its own normal reconciliation and revalidation. Do not reuse a stale proof.

This tooling change contains no Gameplay or enemy-policy changes. PR #473 remains separate and unmerged. The approved next experiment direction is standard-species core plus non-fixed force differences; probabilities, equipment ratios and production adoption remain undecided.
