## Task identity

- Target branch: `<target>`
- Task branch: `aot-task/<target>/<domain>/<task-id>`
- Recorded base commit:
- Task owner:
- Queue state: `READY`

## Scope

- Objective:
- Changed files:
- Shared files touched:
- Explicitly out of scope:

## Verification

- [ ] `python scratch/pre_write_linter.py` passed
- [ ] Focused tests passed (list results below)
- [ ] Full Inspection Layer 1-6 passed in a clean task worktree
- [ ] `git fetch origin <target>` was run immediately before readiness review
- [ ] `python scratch/pre_write_linter.py --integration-ready` passed
- [ ] No unrelated uncommitted or untracked files were present

Focused test results:

```text
<test>: <passed>/<total> PASS
```

Full Inspection result:

```text
Layer 1: PASS
Layer 2: PASS
Layer 3: PASS
Layer 4: PASS
Layer 5: PASS
Layer 6: PASS
Exit code: 0
```

## Manual verification

- Real browser verification: `VERIFIED / NOT VERIFIED / NOT APPLICABLE`
- Viewports or devices checked:
- Known limitations or unverified behavior:

## Integration review

- [ ] Diff matches the declared task scope
- [ ] Latest `origin/<target>` is contained in the task branch
- [ ] Shared-file integration order was confirmed
- [ ] No force push, rebase, destructive reset, or hidden conflict resolution was used
- [ ] Squash commit message is ready
- [ ] Target-branch push has separate explicit approval
