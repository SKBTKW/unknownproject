import assert from 'assert/strict';
import fs from 'node:fs';
import {
    classifyCleanupRevalidation,
    classifyTaskCandidate,
    collectOpenPullRequestReferences,
    parseGitHubRepo,
    resolveGitHubToken,
} from './task_sweeper.mjs';
import { extractTargets, isCleanConfirmation } from './task_sweeper_launcher.mjs';
import { expectedTaskBranchPattern, isCanonicalTaskBranch } from './task_branch_contract.mjs';

const base = {
    target: 'AoT260917',
    canonicalName: true,
    currentWorktree: false,
    lockedWorktree: false,
    dirtyWorktree: false,
    localRemoteMismatch: false,
    unpushedCommits: 0,
    uniqueCommits: 0,
    contentEquivalent: false,
    patchEquivalent: false,
    remoteExists: true,
    openPrLookupVerified: true,
    openPrReferences: [],
    openPrReason: '',
    mergedPrVerified: false,
    mergedPrNumber: undefined,
    prReason: '',
    supersededVerified: false,
    supersededPrNumber: undefined,
    supersededReason: '',
};

const tests = [
    ['empty task is safe', { ...base }, 'SAFE'],
    ['verified squash-merged task is safe', { ...base, uniqueCommits: 3, mergedPrVerified: true, mergedPrNumber: 42 }, 'SAFE'],
    ['verified merged local-only task is safe after remote cleanup', { ...base, remoteExists: false, uniqueCommits: 3, mergedPrVerified: true, mergedPrNumber: 42 }, 'SAFE'],
    ['non-canonical task name blocks', { ...base, canonicalName: false }, 'BLOCKED'],
    ['dirty worktree blocks', { ...base, dirtyWorktree: true }, 'BLOCKED'],
    ['current task worktree blocks', { ...base, currentWorktree: true }, 'BLOCKED'],
    ['locked worktree blocks', { ...base, lockedWorktree: true }, 'BLOCKED'],
    ['local/remote mismatch blocks', { ...base, localRemoteMismatch: true }, 'BLOCKED'],
    ['unpushed commits block', { ...base, unpushedCommits: 1 }, 'BLOCKED'],
    ['local-only unique commits block', { ...base, remoteExists: false, uniqueCommits: 1 }, 'BLOCKED'],
    ['unverified unique remote commits block', { ...base, uniqueCommits: 1, prReason: 'No merged PR' }, 'BLOCKED'],
    ['content-equivalent unique remote commits are safe', {
        ...base,
        uniqueCommits: 4,
        contentEquivalent: true,
        prReason: 'No merged PR',
    }, 'SAFE'],
    ['content-equivalent TASK still blocks while referenced by an open PR', {
        ...base,
        uniqueCommits: 4,
        contentEquivalent: true,
        openPrReferences: [{ number: 80, role: 'head' }],
    }, 'BLOCKED'],
    ['patch-equivalent unique commits are safe after target advances', {
        ...base,
        uniqueCommits: 4,
        patchEquivalent: true,
        prReason: 'No merged PR',
    }, 'SAFE'],
    ['patch-equivalent TASK still blocks while referenced by an open PR', {
        ...base,
        uniqueCommits: 4,
        patchEquivalent: true,
        openPrReferences: [{ number: 81, role: 'head' }],
    }, 'BLOCKED'],
    ['zero-unique TASK used as open PR head blocks', {
        ...base,
        openPrReferences: [{ number: 77, role: 'head' }],
    }, 'BLOCKED'],
    ['zero-unique TASK used as open PR base blocks', {
        ...base,
        openPrReferences: [{ number: 78, role: 'base' }],
    }, 'BLOCKED'],
    ['verified merged TASK still blocks while reused as open PR base', {
        ...base,
        uniqueCommits: 3,
        mergedPrVerified: true,
        mergedPrNumber: 42,
        openPrReferences: [{ number: 79, role: 'base' }],
    }, 'BLOCKED'],
    ['audited superseded TASK is safe only after replacement proof', {
        ...base,
        uniqueCommits: 3,
        supersededVerified: true,
        supersededPrNumber: 181,
    }, 'SAFE'],
    ['superseded manifest mismatch remains blocked', {
        ...base,
        uniqueCommits: 3,
        supersededVerified: false,
        supersededReason: 'audited superseded proof head mismatch',
    }, 'BLOCKED'],
    ['remote TASK blocks when open PR lookup is unavailable', {
        ...base,
        openPrLookupVerified: false,
        openPrReason: 'GitHub open PR lookup failed (503)',
    }, 'BLOCKED'],
];

let passed = 0;
for (const [label, state, expected] of tests) {
    const actual = classifyTaskCandidate(state).status;
    assert.equal(actual, expected, label);
    passed += 1;
}

assert.deepEqual(parseGitHubRepo('git@github.com:SKBTKW/unknownproject.git'), { owner: 'SKBTKW', repo: 'unknownproject' });
assert.deepEqual(parseGitHubRepo('https://github.com/SKBTKW/unknownproject.git'), { owner: 'SKBTKW', repo: 'unknownproject' });
assert.equal(parseGitHubRepo('https://example.com/SKBTKW/unknownproject.git'), null);

assert.equal(
    resolveGitHubToken({ GITHUB_TOKEN: 'token-from-github', GH_TOKEN: 'token-from-gh' }),
    'token-from-github',
    'explicit GitHub environment token must remain the first authentication source',
);
assert.equal(
    resolveGitHubToken({ GH_TOKEN: 'token-from-gh' }),
    'token-from-gh',
    'GH_TOKEN must authenticate direct REST checks when GITHUB_TOKEN is absent',
);

const openPulls = [
    {
        number: 101,
        head: { ref: 'aot-task/AoT260917/tooling/task-sweeper', repo: { full_name: 'SKBTKW/unknownproject' } },
        base: { ref: 'AoT260917', repo: { full_name: 'SKBTKW/unknownproject' } },
    },
    {
        number: 102,
        head: { ref: 'feature/from-fork', repo: { full_name: 'someone/fork' } },
        base: { ref: 'aot-task/AoT260917/tooling/task-sweeper', repo: { full_name: 'SKBTKW/unknownproject' } },
    },
    {
        number: 103,
        head: { ref: 'aot-task/AoT260917/tooling/task-sweeper', repo: { full_name: 'someone/fork' } },
        base: { ref: 'AoT260917', repo: { full_name: 'SKBTKW/unknownproject' } },
    },
];
assert.deepEqual(
    collectOpenPullRequestReferences(
        'aot-task/AoT260917/tooling/task-sweeper',
        openPulls,
        'SKBTKW/unknownproject',
    ),
    [
        { number: 101, role: 'head' },
        { number: 102, role: 'base' },
    ],
    'same-repository open PR head/base references must protect the TASK without matching fork heads',
);
assert.deepEqual(
    collectOpenPullRequestReferences(
        'aot-task/AoT260917/tooling/task-sweeper',
        openPulls,
        'skbtkw/UNKNOWNPROJECT',
    ),
    [
        { number: 101, role: 'head' },
        { number: 102, role: 'base' },
    ],
    'GitHub repository identity comparison must be case-insensitive',
);

assert.equal(isCanonicalTaskBranch('aot-task/AoT260917/tooling/task-sweeper', 'AoT260917'), true);
assert.equal(isCanonicalTaskBranch('aot-task/AoT260917/trial/route-fix', 'AoT260917'), true);
assert.equal(isCanonicalTaskBranch('TASK/trial-260917', 'AoT260917'), false);
assert.equal(isCanonicalTaskBranch('aot-task/AoT260917/tooling/foo/bar', 'AoT260917'), false);
assert.equal(isCanonicalTaskBranch('aot-task/AoT260916/tooling/task-sweeper', 'AoT260917'), false);
assert.equal(isCanonicalTaskBranch('aot-task/AoT260917/Tooling/task-sweeper', 'AoT260917'), false);
assert.equal(expectedTaskBranchPattern('AoT260917'), 'aot-task/AoT260917/<domain>/<task-id>');

assert.deepEqual(
    extractTargets([
        'aot-task/AoT260916/tutorial/first-run',
        'origin/aot-task/AoT260917/tooling/task-sweeper',
        'origin/aot-task/AoT260916/layout/trial-responsive-clearance',
        'origin/main',
    ]),
    ['AoT260917', 'AoT260916'],
);

for (const value of ['CLEAN', 'clean', 'Clean', 'cLeAn', ' CLEAN ']) {
    assert.equal(isCleanConfirmation(value), true, `${value} should authorize cleanup`);
}
for (const value of ['', 'delete', 'yes', 'clean now']) {
    assert.equal(isCleanConfirmation(value), false, `${value} should not authorize cleanup`);
}

const previousCleanupState = {
    localSha: 'local-a',
    remoteSha: 'remote-a',
};
const stableCleanupState = {
    status: 'SAFE',
    reason: 'still safe',
    localSha: 'local-a',
    remoteSha: 'remote-a',
    blockers: [],
};
assert.equal(
    classifyCleanupRevalidation(previousCleanupState, stableCleanupState).status,
    'SAFE',
    'stable SAFE candidate should remain cleanable',
);
assert.equal(
    classifyCleanupRevalidation(previousCleanupState, {
        ...stableCleanupState,
        localSha: 'local-b',
    }).status,
    'BLOCKED',
    'local head movement after dry run must block cleanup',
);
assert.equal(
    classifyCleanupRevalidation({ localSha: 'local-a', remoteSha: '' }, {
        ...stableCleanupState,
        localSha: 'local-a',
        remoteSha: 'remote-new',
    }).status,
    'BLOCKED',
    'a remote branch appearing after dry run must block cleanup',
);
assert.equal(
    classifyCleanupRevalidation(previousCleanupState, null).status,
    'SKIP',
    'already-absent TASK branches should be idempotently skipped',
);
assert.equal(
    classifyCleanupRevalidation(previousCleanupState, {
        ...stableCleanupState,
        remoteSha: '',
    }).status,
    'SAFE',
    'remote disappearance after dry run is safe when the remaining candidate re-inspects SAFE',
);

const sweeperSource = fs.readFileSync(new URL('./task_sweeper.mjs', import.meta.url), 'utf8');
assert.equal(
    sweeperSource.includes("git(['branch', '-D', item.branch]"),
    true,
    'local deletion must use force-delete only after Sweeper revalidation',
);
assert.equal(
    sweeperSource.includes("git(['branch', '-d', item.branch]"),
    false,
    'cleanup must not delegate safety to git branch -d after Sweeper already revalidated the target',
);
assert.equal(
    sweeperSource.includes('Revalidating SAFE TASK branches immediately before cleanup'),
    true,
    'cleanup must refresh and revalidate immediately before mutation',
);
assert.equal(
    (sweeperSource.match(/await loadOpenPullRequestSnapshot\(githubRepo\)/g) || []).length >= 3,
    true,
    'open PR references must be refreshed during dry-run, cleanup revalidation, and immediately before each destructive mutation',
);
assert.equal(
    sweeperSource.includes('Rechecking open PR references immediately before mutating'),
    true,
    'destructive cleanup must close the open-PR race window with a final per-TASK reference check',
);
assert.equal(
    sweeperSource.includes('const headers = githubHeaders();'),
    true,
    'open and merged PR lookups must share the same authenticated GitHub headers',
);
assert.equal(
    sweeperSource.includes("execFileSync('gh', ['auth', 'token', '--hostname', 'github.com']"),
    true,
    'local Sweeper must fall back to the authenticated GitHub CLI token instead of silently using anonymous REST',
);
assert.equal(
    sweeperSource.includes('let cachedGitHubCliToken;'),
    true,
    'GitHub CLI token lookup must be cached instead of spawning gh once per API request',
);
assert.equal(
    sweeperSource.includes("response.headers.get('x-ratelimit-remaining')"),
    true,
    'GitHub 403 diagnostics must expose rate-limit context without exposing credentials',
);
assert.equal(
    sweeperSource.includes('const GITHUB_FETCH_MAX_ATTEMPTS = 3;'),
    true,
    'transient GitHub REST failures must have a bounded retry budget',
);
assert.equal(
    sweeperSource.includes('shouldRetryGitHubStatus(response.status)'),
    true,
    'retry policy must remain limited to transient HTTP failures',
);
assert.equal(
    sweeperSource.includes("status === 408 || status === 429 || status >= 500"),
    true,
    'authentication and authorization failures must remain fail-closed instead of being blindly retried',
);
assert.equal(
    sweeperSource.includes('await sleep(GITHUB_FETCH_RETRY_BASE_MS * attempt);'),
    true,
    'retry attempts must use a small backoff rather than hot-looping the GitHub API',
);
assert.equal(
    sweeperSource.includes("task_sweeper_superseded.json"),
    true,
    'superseded cleanup must use an explicit audited manifest rather than branch-name heuristics',
);
assert.equal(
    sweeperSource.includes("task_sweeper_superseded_${target}.json"),
    true,
    'Sweeper must support a target-scoped audited superseded manifest without mixing target histories',
);
assert.equal(
    sweeperSource.includes('loadSupersededTaskManifest(cwd, target)'),
    true,
    'target resolution must select the matching audited superseded ledger',
);
assert.equal(
    sweeperSource.includes('entry.expectedHeadSha !== remoteSha'),
    true,
    'superseded proof must be pinned to the exact current remote TASK head',
);
assert.equal(
    sweeperSource.includes('gitIsAncestor(pr.merge_commit_sha, targetRef, cwd)'),
    true,
    'replacement PR merge commit must already be contained in the integration target',
);
assert.equal(
    sweeperSource.includes('!state.mergedPrVerified && !state.supersededVerified && !state.contentEquivalent && !state.patchEquivalent'),
    true,
    'unique commits may bypass the normal merged-head proof only through audited supersession, exact tree equivalence, or patch equivalence',
);
assert.equal(
    sweeperSource.includes("spawnSync('git', ['diff', '--quiet', leftRef, rightRef, '--']"),
    true,
    'content-equivalent cleanup must compare complete endpoint trees and fail closed on git diff errors',
);
assert.equal(
    sweeperSource.includes("reason: 'TASK tree is content-equivalent to target'"),
    true,
    'content-equivalent TASK cleanup must be explicit in the dry-run report',
);
assert.equal(
    sweeperSource.includes("git(['cherry', targetRef, comparisonRef]"),
    true,
    'stale TASK absorption must use git cherry patch-equivalence instead of comparing against the moving target tree',
);
assert.equal(
    sweeperSource.includes("reason: 'all TASK commits are patch-equivalent to target'"),
    true,
    'patch-equivalent TASK cleanup must be explicit in the dry-run report',
);

const supersededManifest = JSON.parse(
    fs.readFileSync(new URL('./task_sweeper_superseded.json', import.meta.url), 'utf8')
);
assert.equal(supersededManifest.schemaVersion, 1);
assert.equal(supersededManifest.target, 'AoT260922');
assert.equal(new Set(supersededManifest.entries.map(entry => entry.branch)).size, supersededManifest.entries.length);
for (const entry of supersededManifest.entries) {
    assert.match(entry.branch, /^aot-task\/AoT260922\/[a-z0-9-]+\/[a-z0-9-]+$/);
    assert.match(entry.expectedHeadSha, /^[0-9a-f]{40}$/);
    const replacementPrs = Array.isArray(entry.replacementPrs)
        ? entry.replacementPrs
        : [entry.replacementPr];
    assert.ok(replacementPrs.length > 0);
    assert.equal(replacementPrs.every(Number.isInteger), true);
}

const targetScopedSupersededManifest = JSON.parse(
    fs.readFileSync(new URL('./task_sweeper_superseded_AoT260924.json', import.meta.url), 'utf8')
);
assert.equal(targetScopedSupersededManifest.schemaVersion, 1);
assert.equal(targetScopedSupersededManifest.target, 'AoT260924');
assert.equal(
    new Set(targetScopedSupersededManifest.entries.map(entry => entry.branch)).size,
    targetScopedSupersededManifest.entries.length,
);
for (const entry of targetScopedSupersededManifest.entries) {
    assert.match(entry.branch, /^aot-task\/AoT260924\/[a-z0-9-]+\/[a-z0-9-]+$/);
    assert.match(entry.expectedHeadSha, /^[0-9a-f]{40}$/);
    const replacementPrs = Array.isArray(entry.replacementPrs)
        ? entry.replacementPrs
        : [entry.replacementPr];
    assert.ok(replacementPrs.length > 0);
    assert.equal(replacementPrs.every(Number.isInteger), true);
}
assert.equal(
    sweeperSource.includes('const replacementPrs = Array.isArray(entry.replacementPrs)'),
    true,
    'audited supersession must support a branch whose work was split across multiple replacement PRs',
);
assert.equal(
    sweeperSource.includes('function githubHeaders() {\n    const headers = githubHeaders();'),
    false,
    'GitHub header helper must not recurse into itself',
);

console.log(`✅ AoT Task Sweeper safety contract: ${passed}/21 classifications PASS + content/patch-equivalence + open PR head/base protection + cleanup revalidation + naming/launcher contract PASS`);