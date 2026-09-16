#!/usr/bin/env python3
"""GIT001 contract tests for DIRECT, ISOLATED, and TASK work modes."""
from pathlib import Path

from pre_write_linter import inspect_git_branch_policy, validate_git_branch_tracking


def check(condition, description):
    assert condition, description
    print("  PASS: " + description)


BASE = "1" * 40
TARGET = "AoT260916"
TASK = "aot-task/AoT260916/tooling/task-branch-workflow"
TEMP = "aot-tmp/AoT260916/layout-check"


check(not validate_git_branch_tracking(TARGET, f"origin/{TARGET}", TARGET),
      "DIRECT accepts the authorized same-name origin branch")
check(validate_git_branch_tracking(TARGET, f"origin/{TARGET}", "")[0].rule_id == "GIT001",
      "missing target authorization is rejected")
check(validate_git_branch_tracking("", "", TARGET)[0].rule_id == "GIT001",
      "detached HEAD is rejected")
check("not the authorized DIRECT" in validate_git_branch_tracking(
      "other", "origin/other", TARGET)[0].message,
      "DIRECT rejects another branch")
check("must track" in validate_git_branch_tracking(TARGET, "", TARGET)[0].message,
      "DIRECT rejects a missing upstream")
check("must track" in validate_git_branch_tracking(
      TARGET, "fork/AoT260916", TARGET)[0].message,
      "DIRECT rejects a different remote")
check("stale" in validate_git_branch_tracking(
      TARGET, f"origin/{TARGET}", TARGET, authorized_base_commit=BASE)[0].message,
      "DIRECT rejects stale work-mode metadata")


isolated_defaults = dict(
    branch=TEMP, upstream="", authorized_branch=TARGET, mode="ISOLATED",
    authorized_work_branch=TEMP, authorized_base_commit=BASE,
    target_head=BASE, work_descends_from_base=True,
    target_descends_from_base=True, is_linked_worktree=True,
)
check(not validate_git_branch_tracking(**isolated_defaults),
      "ISOLATED accepts a local authorized linked-worktree branch")
check("aot-tmp" in validate_git_branch_tracking(**{
      **isolated_defaults, "authorized_work_branch": "temporary/layout-check"})[0].message,
      "ISOLATED rejects an invalid namespace")
check("not authorized ISOLATED" in validate_git_branch_tracking(**{
      **isolated_defaults, "branch": f"{TEMP}-other"})[0].message,
      "ISOLATED rejects switching branches")
check("valid recorded base" in validate_git_branch_tracking(**{
      **isolated_defaults, "authorized_base_commit": ""})[0].message,
      "ISOLATED rejects a missing base commit")
check("must not track" in validate_git_branch_tracking(**{
      **isolated_defaults, "upstream": f"origin/{TEMP}"})[0].message,
      "ISOLATED rejects every upstream")
check("separate linked worktree" in validate_git_branch_tracking(**{
      **isolated_defaults, "is_linked_worktree": False})[0].message,
      "ISOLATED rejects work in the target worktree")
check("Target branch moved" in validate_git_branch_tracking(**{
      **isolated_defaults, "target_head": "2" * 40})[0].message,
      "ISOLATED rejects a moved local target")
check("not a descendant" in validate_git_branch_tracking(**{
      **isolated_defaults, "work_descends_from_base": False})[0].message,
      "ISOLATED rejects unrelated history")


task_defaults = dict(
    branch=TASK, upstream="", authorized_branch=TARGET, mode="TASK",
    authorized_task_branch=TASK, authorized_base_commit=BASE,
    target_head=BASE, work_descends_from_base=True,
    target_descends_from_base=True, is_linked_worktree=True,
)
check(not validate_git_branch_tracking(**task_defaults),
      "TASK accepts an authorized pre-push branch without upstream")
check(not validate_git_branch_tracking(**{
      **task_defaults, "upstream": f"origin/{TASK}"}),
      "TASK accepts only its same-name origin upstream after push")
check("<domain>/<task-id>" in validate_git_branch_tracking(**{
      **task_defaults,
      "branch": "aot-task/AoT260916/no-domain",
      "authorized_task_branch": "aot-task/AoT260916/no-domain"})[0].message,
      "TASK requires domain and task-id path segments")
check("<domain>/<task-id>" in validate_git_branch_tracking(**{
      **task_defaults,
      "branch": "aot-task/AoT260916/tooling/foo/bar",
      "authorized_task_branch": "aot-task/AoT260916/tooling/foo/bar"})[0].message,
      "TASK rejects extra path segments after task-id")
check("<domain>/<task-id>" in validate_git_branch_tracking(**{
      **task_defaults,
      "branch": "aot-task/AoT260916/Tooling/task-name",
      "authorized_task_branch": "aot-task/AoT260916/Tooling/task-name"})[0].message,
      "TASK requires lowercase kebab-case domain and task-id")
check("not authorized TASK" in validate_git_branch_tracking(**{
      **task_defaults, "branch": f"{TASK}-other"})[0].message,
      "TASK rejects switching branches")
check("not 'origin" in validate_git_branch_tracking(**{
      **task_defaults, "upstream": f"origin/{TARGET}"})[0].message,
      "TASK rejects tracking the target branch")
check("not in origin" in validate_git_branch_tracking(**{
      **task_defaults, "target_descends_from_base": False})[0].message,
      "TASK rejects a rewritten target that lost its recorded base")
check("same-name remote upstream" in validate_git_branch_tracking(**{
      **task_defaults, "integration_ready": True, "target_is_ancestor": True})[0].message,
      "integration readiness requires the pushed task branch")
check("latest origin" in validate_git_branch_tracking(**{
      **task_defaults, "upstream": f"origin/{TASK}",
      "integration_ready": True, "target_is_ancestor": False})[0].message,
      "integration readiness rejects a stale task branch")
check("uncommitted or untracked" in validate_git_branch_tracking(**{
      **task_defaults, "upstream": f"origin/{TASK}",
      "integration_ready": True, "target_is_ancestor": True,
      "worktree_clean": False})[0].message,
      "integration readiness rejects a dirty candidate")
check(not validate_git_branch_tracking(**{
      **task_defaults, "upstream": f"origin/{TASK}",
      "integration_ready": True, "target_is_ancestor": True,
      "worktree_clean": True}),
      "integration readiness accepts a current clean pushed task")


violations, branch, upstream, authorized, mode = inspect_git_branch_policy(Path.cwd())
check(not violations,
      f"live repository branch is authorized ({mode}: {branch}; upstream={upstream or '(none)'}; target={authorized})")

print("GIT001 branch authorization: 28/28 PASS")
