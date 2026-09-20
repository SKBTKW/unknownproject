# Integration Progress Guide

Integration Progress Guide is a read-only interpretation layer on top of Integration Guard.

It does not merge, reconcile, delete, reset, rebase, push, or resolve conflicts.

Its job is to answer one operational question:

> What must happen next so every active TASK can eventually become integrated or correctly recognized as already integrated?

## Progress classes

### INTEGRATE_NOW

The TASK is `READY`.

Next action:

- verify/open its PR
- require AoT Full Inspection success
- use Safe Integration Runner for at most one integration
- rerun the full Integration Guard after the target changes

### PREPARE_FOR_INTEGRATION

The TASK is one of:

- `REVIEW_REQUIRED`
- `RECONCILE_REQUIRED`
- `BLOCKED`

The guide does **not** repair it automatically.

Instead it explains the preparation path:

- review overlap when responsibility is ambiguous
- reconcile the current target into stale TASK state
- inspect ref/worktree/merge-preview blockers
- rerun focused tests / Full Inspection after changes
- rerun Integration Guard until the TASK becomes `READY` or `MERGED`

### NO_INTEGRATION_NEEDED

The TASK is `MERGED`.

Its HEAD is already contained in target history. Integration is unnecessary.

Branch cleanup remains a separate safety decision.

## Completion loop

The intended operating loop is:

1. Run Integration Guard.
2. Read Integration Progress Guide.
3. If a READY TASK exists, integrate at most one with Safe Integration Runner.
4. If no READY TASK exists, perform the listed preparation work on the highest-priority non-ready TASK.
5. After any target change, rerun the full Integration Guard.
6. Continue until every TASK is MERGED or deliberately closed/cleaned up through separate branch-management review.

Never reuse a READY list produced before the target changed.


## Preparation priority

When no TASK is READY, the guide now prefers a low-risk reconciliation candidate when all of the following are true:

- status is `RECONCILE_REQUIRED`
- target overlap risk is `NONE`
- merge preview is `CLEAN`
- local/remote TASK refs agree
- no review-grade peer overlap is observed

Among equally low-risk candidates, the TASK with fewer target-only commits (`behindCount`) is preferred, then fewer TASK-only commits (`aheadCount`).

This is only a preparation recommendation. It does not perform reconciliation automatically and does not weaken Integration Guard or Safe Integration Runner gates.
