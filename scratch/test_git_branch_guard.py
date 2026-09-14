#!/usr/bin/env python3
"""GIT001 must reject autonomous local branches before inspection can pass."""
from pathlib import Path

from pre_write_linter import inspect_git_branch_policy, validate_git_branch_tracking


def check(condition, description):
    assert condition, description
    print("  PASS: " + description)


check(
    not validate_git_branch_tracking(
        "AGtest260915", "origin/AGtest260915", "AGtest260915"
    ),
    "authorized same-name origin tracking branch is accepted",
)

missing_authorization = validate_git_branch_tracking("AGtest260915", "origin/AGtest260915", "")
check(
    len(missing_authorization) == 1 and "No user-authorized" in missing_authorization[0].message,
    "missing local user authorization is rejected",
)

detached = validate_git_branch_tracking("", "", "AGtest260915")
check(len(detached) == 1 and detached[0].rule_id == "GIT001", "detached HEAD is rejected")

wrong_branch = validate_git_branch_tracking(
    "codex/autonomous", "origin/codex/autonomous", "AGtest260915"
)
check(
    len(wrong_branch) == 1 and "not the user-authorized" in wrong_branch[0].message,
    "different existing remote branch is rejected",
)

untracked = validate_git_branch_tracking("AGtest260915", "", "AGtest260915")
check(
    len(untracked) == 1 and "no upstream" in untracked[0].message,
    "new untracked local branch is rejected",
)

renamed = validate_git_branch_tracking("AGtest260915", "origin/approved-name", "AGtest260915")
check(
    len(renamed) == 1 and "origin/approved-name" in renamed[0].message,
    "branch tracking a differently named remote branch is rejected",
)

wrong_remote = validate_git_branch_tracking(
    "AGtest260915", "fork/AGtest260915", "AGtest260915"
)
check(
    len(wrong_remote) == 1 and "origin/AGtest260915" in wrong_remote[0].message,
    "same-name branch on a non-origin remote is rejected",
)

violations, branch, upstream, authorized = inspect_git_branch_policy(Path.cwd())
check(
    not violations,
    f"live repository branch is authorized ({branch} -> {upstream}; authorized={authorized})",
)

print("GIT001 branch authorization: 8/8 PASS")
