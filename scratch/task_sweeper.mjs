import { execFileSync, spawnSync } from 'child_process';
import fs from 'fs';
import path from 'path';
import process from 'process';
import readline from 'readline/promises';
import { fileURLToPath } from 'url';
import { expectedTaskBranchPattern, isCanonicalTaskBranch } from './task_branch_contract.mjs';

const TASK_PREFIX = 'aot-task/';

function git(args, { cwd, allowFailure = false } = {}) {
    try {
        return execFileSync('git', args, {
            cwd,
            encoding: 'utf8',
            windowsHide: true,
            stdio: ['ignore', 'pipe', 'pipe'],
        }).trim();
    } catch (error) {
        if (allowFailure) return '';
        const stderr = error?.stderr?.toString?.().trim();
        throw new Error(`git ${args.join(' ')} failed${stderr ? `: ${stderr}` : ''}`);
    }
}

function refExists(ref, cwd) {
    const result = spawnSync('git', ['show-ref', '--verify', '--quiet', ref], {
        cwd,
        windowsHide: true,
        stdio: 'ignore',
    });
    return result.status === 0;
}

function countCommits(range, cwd) {
    const output = git(['rev-list', '--count', range], { cwd });
    return Number.parseInt(output, 10) || 0;
}

function refsHaveIdenticalTrees(leftRef, rightRef, cwd) {
    if (!leftRef || !rightRef) return false;
    const result = spawnSync('git', ['diff', '--quiet', leftRef, rightRef, '--'], {
        cwd,
        windowsHide: true,
        stdio: 'ignore',
    });
    return result.status === 0;
}

function hasOnlyPatchEquivalentCommits(targetRef, comparisonRef, cwd) {
    if (!targetRef || !comparisonRef) return false;
    const output = git(['cherry', targetRef, comparisonRef], { cwd, allowFailure: true });
    if (!output) return false;
    const lines = output.split(/\r?\n/).filter(Boolean);
    return lines.length > 0 && lines.every((line) => line.startsWith('- '));
}

function parseArgs(argv) {
    const result = { target: '', interactive: false, execute: false, confirm: '' };
    for (let i = 0; i < argv.length; i += 1) {
        const arg = argv[i];
        if (arg === '--target') result.target = argv[++i] ?? '';
        else if (arg === '--interactive') result.interactive = true;
        else if (arg === '--execute') result.execute = true;
        else if (arg === '--confirm') result.confirm = argv[++i] ?? '';
        else if (arg === '--help' || arg === '-h') result.help = true;
        else throw new Error(`Unknown argument: ${arg}`);
    }
    return result;
}

function readConfig(key, cwd) {
    return git(['config', '--get', key], { cwd, allowFailure: true });
}

function readSupersededTaskManifestFile(manifestPath) {
    const parsed = JSON.parse(fs.readFileSync(manifestPath, 'utf8'));
    if (parsed?.schemaVersion !== 1 || !Array.isArray(parsed.entries)) {
        throw new Error(`Invalid ${path.relative(process.cwd(), manifestPath) || manifestPath}`);
    }
    return parsed;
}

function loadSupersededTaskManifest(cwd, target) {
    const manifestPaths = [
        path.join(cwd, 'scratch', 'task_sweeper_superseded.json'),
        target ? path.join(cwd, 'scratch', `task_sweeper_superseded_${target}.json`) : '',
    ].filter(Boolean);

    const entries = [];
    const seenBranches = new Set();
    for (const manifestPath of manifestPaths) {
        if (!fs.existsSync(manifestPath)) continue;
        const parsed = readSupersededTaskManifestFile(manifestPath);
        if (parsed.target && target && parsed.target !== target) continue;
        for (const entry of parsed.entries) {
            if (!entry?.branch) continue;
            if (seenBranches.has(entry.branch)) {
                throw new Error(`Duplicate audited superseded TASK entry: ${entry.branch}`);
            }
            seenBranches.add(entry.branch);
            entries.push(entry);
        }
    }

    return { schemaVersion: 1, target: target || '', entries };
}

function gitIsAncestor(ancestor, descendant, cwd) {
    if (!ancestor || !descendant) return false;
    const result = spawnSync('git', ['merge-base', '--is-ancestor', ancestor, descendant], {
        cwd,
        windowsHide: true,
        stdio: 'ignore',
    });
    return result.status === 0;
}

function resolveTarget(explicitTarget, cwd) {
    if (explicitTarget) return explicitTarget;
    const authorized = readConfig('aot.authorizedBranch', cwd);
    if (authorized) return authorized;
    const current = git(['branch', '--show-current'], { cwd, allowFailure: true });
    if (/^AoT\d{6}$/.test(current)) return current;
    throw new Error('Target branch is ambiguous. Use --target AoTYYMMDD or configure aot.authorizedBranch.');
}

export function parseGitHubRepo(remoteUrl) {
    const ssh = remoteUrl.match(/^git@github\.com:([^/]+)\/(.+?)(?:\.git)?$/);
    if (ssh) return { owner: ssh[1], repo: ssh[2] };
    const https = remoteUrl.match(/^https:\/\/github\.com\/([^/]+)\/(.+?)(?:\.git)?$/);
    if (https) return { owner: https[1], repo: https[2] };
    return null;
}

function parseWorktrees(raw) {
    const entries = [];
    let current = null;
    for (const line of `${raw}\n`.split(/\r?\n/)) {
        if (line.startsWith('worktree ')) {
            if (current) entries.push(current);
            current = { path: line.slice('worktree '.length), branch: '', locked: false, prunable: false };
        } else if (!line && current) {
            entries.push(current);
            current = null;
        } else if (current && line.startsWith('branch refs/heads/')) {
            current.branch = line.slice('branch refs/heads/'.length);
        } else if (current && line.startsWith('locked')) {
            current.locked = true;
        } else if (current && line.startsWith('prunable')) {
            current.prunable = true;
        }
    }
    return entries;
}

export function collectOpenPullRequestReferences(branch, pulls = [], repositoryFullName = '') {
    if (!branch || !Array.isArray(pulls)) return [];
    const references = [];
    const expectedRepo = repositoryFullName.toLowerCase();
    const matchesRepository = (fullName) => !expectedRepo
        || (typeof fullName === 'string' && fullName.toLowerCase() === expectedRepo);

    for (const pr of pulls) {
        if (!pr || !Number.isInteger(pr.number)) continue;
        const baseMatches = pr.base?.ref === branch && matchesRepository(pr.base?.repo?.full_name);
        const headMatches = pr.head?.ref === branch && matchesRepository(pr.head?.repo?.full_name);

        if (headMatches) references.push({ number: pr.number, role: 'head' });
        if (baseMatches) references.push({ number: pr.number, role: 'base' });
    }

    return references;
}

let cachedGitHubCliToken;

function loadGitHubCliToken() {
    if (cachedGitHubCliToken !== undefined) return cachedGitHubCliToken;
    try {
        cachedGitHubCliToken = execFileSync('gh', ['auth', 'token', '--hostname', 'github.com'], {
            encoding: 'utf8',
            windowsHide: true,
            stdio: ['ignore', 'pipe', 'ignore'],
        }).trim();
    } catch {
        cachedGitHubCliToken = '';
    }
    return cachedGitHubCliToken;
}

export function resolveGitHubToken(env = process.env) {
    const envToken = env.GITHUB_TOKEN || env.GH_TOKEN;
    if (typeof envToken === 'string' && envToken.trim()) return envToken.trim();
    return loadGitHubCliToken();
}

function githubHeaders() {
    const headers = {
        Accept: 'application/vnd.github+json',
        'User-Agent': 'AoT-Task-Sweeper',
        'X-GitHub-Api-Version': '2022-11-28',
    };
    const token = resolveGitHubToken();
    if (token) headers.Authorization = `Bearer ${token}`;
    return headers;
}

async function githubFailureReason(response, prefix) {
    const details = [`${prefix} (${response.status})`];
    const remaining = response.headers.get('x-ratelimit-remaining');
    const reset = response.headers.get('x-ratelimit-reset');
    if (remaining !== null) details.push(`rate_remaining=${remaining}`);
    if (reset !== null) details.push(`rate_reset=${reset}`);
    try {
        const body = await response.json();
        if (body && typeof body.message === 'string' && body.message.trim()) {
            details.push(body.message.trim());
        }
    } catch {
        // Status + rate-limit headers are enough when GitHub returns no JSON body.
    }
    return details.join(' | ');
}

const GITHUB_FETCH_MAX_ATTEMPTS = 3;
const GITHUB_FETCH_RETRY_BASE_MS = 350;

function sleep(ms) {
    return new Promise((resolve) => setTimeout(resolve, ms));
}

function shouldRetryGitHubStatus(status) {
    return status === 408 || status === 429 || status >= 500;
}

async function fetchGitHubJson(url, { headers, label }) {
    let lastReason = '';
    for (let attempt = 1; attempt <= GITHUB_FETCH_MAX_ATTEMPTS; attempt += 1) {
        try {
            const response = await fetch(url, { headers });
            if (response.ok) {
                const body = await response.json();
                return { ok: true, body, response };
            }

            lastReason = await githubFailureReason(response, label);
            if (!shouldRetryGitHubStatus(response.status) || attempt === GITHUB_FETCH_MAX_ATTEMPTS) {
                return { ok: false, reason: lastReason };
            }
        } catch (error) {
            lastReason = `${label}: ${error.message}`;
            if (attempt === GITHUB_FETCH_MAX_ATTEMPTS) {
                return { ok: false, reason: lastReason };
            }
        }

        await sleep(GITHUB_FETCH_RETRY_BASE_MS * attempt);
    }

    return { ok: false, reason: lastReason || `${label}: exhausted retries` };
}

async function verifyAuditedSupersession({
    branch,
    remoteSha,
    target,
    targetRef,
    githubRepo,
    supersededManifest,
    cwd,
}) {
    if (!remoteSha || !githubRepo || !supersededManifest) {
        return { verified: false, reason: '' };
    }
    if (supersededManifest.target && supersededManifest.target !== target) {
        return { verified: false, reason: '' };
    }

    const entry = supersededManifest.entries.find((item) => item?.branch === branch);
    if (!entry) return { verified: false, reason: '' };
    if (entry.expectedHeadSha !== remoteSha) {
        return {
            verified: false,
            reason: `audited superseded proof head mismatch: expected ${entry.expectedHeadSha}, found ${remoteSha}`,
        };
    }
    const replacementPrs = Array.isArray(entry.replacementPrs)
        ? entry.replacementPrs
        : [entry.replacementPr];
    if (replacementPrs.length === 0 || replacementPrs.some((number) => !Number.isInteger(number))) {
        return { verified: false, reason: 'audited superseded proof is missing replacement PR number(s)' };
    }

    const headers = githubHeaders();
    for (const replacementPr of replacementPrs) {
        const request = await fetchGitHubJson(
            `https://api.github.com/repos/${githubRepo.owner}/${githubRepo.repo}/pulls/${replacementPr}`,
            { headers, label: 'GitHub replacement PR lookup failed' }
        );
        if (!request.ok) return { verified: false, reason: request.reason };

        const pr = request.body;
        if (!pr?.merged_at) {
            return { verified: false, reason: `replacement PR #${replacementPr} is not merged` };
        }
        if (pr.base?.ref !== target) {
            return { verified: false, reason: `replacement PR #${replacementPr} does not target ${target}` };
        }
        if (!pr.merge_commit_sha || !gitIsAncestor(pr.merge_commit_sha, targetRef, cwd)) {
            return {
                verified: false,
                reason: `replacement PR #${replacementPr} merge commit is not contained in ${targetRef}`,
            };
        }
    }

    return {
        verified: true,
        replacementPr: replacementPrs.length === 1 ? replacementPrs[0] : undefined,
        replacementPrs,
        note: entry.note || '',
    };
}

async function loadOpenPullRequestSnapshot({ owner, repo }) {
    const pulls = [];
    const perPage = 100;
    const maxPages = 100;
    const headers = githubHeaders();

    try {
        for (let page = 1; page <= maxPages; page += 1) {
            const params = new URLSearchParams({
                state: 'open',
                per_page: String(perPage),
                page: String(page),
            });
            const request = await fetchGitHubJson(
                `https://api.github.com/repos/${owner}/${repo}/pulls?${params}`,
                { headers, label: 'GitHub open PR lookup failed' }
            );
            if (!request.ok) {
                return { verified: false, pulls: [], reason: request.reason };
            }
            const pagePulls = request.body;
            if (!Array.isArray(pagePulls)) {
                return { verified: false, pulls: [], reason: 'GitHub open PR lookup returned a non-array response' };
            }
            pulls.push(...pagePulls);
            if (pagePulls.length < perPage) {
                return { verified: true, pulls, reason: '' };
            }
        }
        return { verified: false, pulls: [], reason: 'GitHub open PR lookup exceeded pagination safety limit' };
    } catch (error) {
        return { verified: false, pulls: [], reason: `GitHub open PR lookup failed: ${error.message}` };
    }
}

function formatOpenPullRequestReferences(references = []) {
    return references
        .map((reference) => `#${reference.number} (${reference.role})`)
        .join(', ');
}

function listTaskBranches(target, cwd) {
    const prefix = `${TASK_PREFIX}${target}/`;
    const localRaw = git(['for-each-ref', '--format=%(refname:short)', `refs/heads/${prefix}`], { cwd, allowFailure: true });
    const remoteRaw = git(['for-each-ref', '--format=%(refname:short)', `refs/remotes/origin/${prefix}`], { cwd, allowFailure: true });
    const locals = new Set(localRaw ? localRaw.split(/\r?\n/).filter(Boolean) : []);
    const remotes = new Set(
        remoteRaw
            ? remoteRaw.split(/\r?\n/).filter(Boolean).map((name) => name.replace(/^origin\//, ''))
            : [],
    );
    return [...new Set([...locals, ...remotes])].sort().map((branch) => ({
        branch,
        localExists: locals.has(branch),
        remoteExists: remotes.has(branch),
        canonicalName: isCanonicalTaskBranch(branch, target),
    }));
}

async function findMergedPullRequest({ owner, repo, branch, target, headSha }) {
    const params = new URLSearchParams({
        state: 'closed',
        head: `${owner}:${branch}`,
        base: target,
        per_page: '100',
    });
    const headers = githubHeaders();

    try {
        const request = await fetchGitHubJson(
            `https://api.github.com/repos/${owner}/${repo}/pulls?${params}`,
            { headers, label: 'GitHub PR lookup failed' }
        );
        if (!request.ok) {
            return { verified: false, reason: request.reason };
        }
        const pulls = request.body;
        const merged = pulls.find((pr) => pr.merged_at && pr.head?.sha === headSha);
        if (!merged) return { verified: false, reason: 'No merged PR matches the current remote TASK head' };
        return { verified: true, number: merged.number, mergedAt: merged.merged_at };
    } catch (error) {
        return { verified: false, reason: `GitHub PR lookup failed: ${error.message}` };
    }
}

export function classifyTaskCandidate(state) {
    const blockers = [];
    if (state.canonicalName === false) blockers.push(`branch name is not canonical; expected ${expectedTaskBranchPattern(state.target || 'AoTYYMMDD')}`);
    if (state.currentWorktree) blockers.push('currently executing from this TASK worktree');
    if (state.lockedWorktree) blockers.push('worktree is locked');
    if (state.dirtyWorktree) blockers.push('worktree has uncommitted or untracked files');
    if (state.localRemoteMismatch) blockers.push('local and remote TASK heads do not match');
    if (state.unpushedCommits > 0) blockers.push(`${state.unpushedCommits} local commit(s) are not pushed`);
    if (state.remoteExists && state.openPrLookupVerified === false) {
        blockers.push(state.openPrReason || 'open PR references could not be verified');
    }
    if (Array.isArray(state.openPrReferences) && state.openPrReferences.length > 0) {
        blockers.push(`open PR reference protects this TASK: ${formatOpenPullRequestReferences(state.openPrReferences)}`);
    }
    if (state.uniqueCommits > 0 && !state.mergedPrVerified && !state.supersededVerified && !state.contentEquivalent && !state.patchEquivalent) {
        const fallbackReason = state.remoteExists
            ? 'unique commits exist and merged PR could not be verified'
            : 'local-only TASK has unique commits and merged PR could not be verified';
        blockers.push(state.supersededReason || state.prReason || fallbackReason);
    }

    if (blockers.length > 0) return { status: 'BLOCKED', blockers };
    if (state.uniqueCommits === 0) {
        return { status: 'SAFE', reason: 'no unique commits against target' };
    }
    if (state.contentEquivalent) {
        return { status: 'SAFE', reason: 'TASK tree is content-equivalent to target' };
    }
    if (state.patchEquivalent) {
        return { status: 'SAFE', reason: 'all TASK commits are patch-equivalent to target' };
    }
    if (state.mergedPrVerified) {
        return { status: 'SAFE', reason: `merged PR #${state.mergedPrNumber} verified at current remote head` };
    }
    return {
        status: 'SAFE',
        reason: Array.isArray(state.supersededPrNumbers) && state.supersededPrNumbers.length > 1
            ? `audited superseded TASK; replacement PRs ${state.supersededPrNumbers.map((number) => `#${number}`).join(' + ')} are merged into target`
            : `audited superseded TASK; replacement PR #${state.supersededPrNumber} is merged into target`,
    };
}

function isWorktreeDirty(worktreePath) {
    const output = git(['status', '--porcelain', '--untracked-files=all'], { cwd: worktreePath });
    return Boolean(output);
}

async function inspectCandidate(candidate, context) {
    const { cwd, target, targetRef, worktreeByBranch, githubRepo, openPrSnapshot, supersededManifest } = context;
    const localRef = candidate.localExists ? candidate.branch : '';
    const remoteRef = candidate.remoteExists ? `origin/${candidate.branch}` : '';
    const localSha = localRef ? git(['rev-parse', localRef], { cwd }) : '';
    const remoteSha = remoteRef ? git(['rev-parse', remoteRef], { cwd }) : '';
    const comparisonRef = remoteRef || localRef;
    const uniqueCommits = comparisonRef ? countCommits(`${targetRef}..${comparisonRef}`, cwd) : 0;
    const contentEquivalent = Boolean(
        comparisonRef && refsHaveIdenticalTrees(targetRef, comparisonRef, cwd),
    );
    const patchEquivalent = Boolean(
        uniqueCommits > 0 && comparisonRef && hasOnlyPatchEquivalentCommits(targetRef, comparisonRef, cwd),
    );
    const unpushedCommits = localRef && remoteRef ? countCommits(`${remoteRef}..${localRef}`, cwd) : 0;
    const worktree = worktreeByBranch.get(candidate.branch) ?? null;
    const currentRoot = fs.realpathSync(cwd);
    const worktreeReal = worktree?.path && fs.existsSync(worktree.path) ? fs.realpathSync(worktree.path) : '';
    const currentWorktree = Boolean(worktreeReal && worktreeReal === currentRoot);
    const dirtyWorktree = Boolean(worktree?.path && fs.existsSync(worktree.path) && isWorktreeDirty(worktree.path));
    const localRemoteMismatch = Boolean(localSha && remoteSha && localSha !== remoteSha);

    const repositoryFullName = githubRepo ? `${githubRepo.owner}/${githubRepo.repo}` : '';
    const openPrReferences = openPrSnapshot?.verified
        ? collectOpenPullRequestReferences(candidate.branch, openPrSnapshot.pulls, repositoryFullName)
        : [];
    const openPrLookupVerified = !candidate.remoteExists || openPrSnapshot?.verified === true;
    const openPrReason = openPrLookupVerified
        ? ''
        : (openPrSnapshot?.reason || 'origin is not a supported github.com repository');

    let mergedPr = { verified: false, reason: '' };
    let superseded = { verified: false, reason: '' };
    if (uniqueCommits > 0) {
        const prHeadSha = remoteSha || localSha;
        if (!githubRepo) {
            mergedPr = { verified: false, reason: 'origin is not a supported github.com repository' };
        } else if (!prHeadSha) {
            mergedPr = { verified: false, reason: 'TASK head SHA is unavailable for merged PR verification' };
        } else {
            mergedPr = await findMergedPullRequest({
                ...githubRepo,
                branch: candidate.branch,
                target,
                headSha: prHeadSha,
            });
            if (!mergedPr.verified) {
                superseded = await verifyAuditedSupersession({
                    branch: candidate.branch,
                    remoteSha,
                    target,
                    targetRef,
                    githubRepo,
                    supersededManifest,
                    cwd,
                });
            }
        }
    }

    const classification = classifyTaskCandidate({
        target,
        canonicalName: candidate.canonicalName,
        currentWorktree,
        lockedWorktree: Boolean(worktree?.locked),
        dirtyWorktree,
        localRemoteMismatch,
        unpushedCommits,
        uniqueCommits,
        contentEquivalent,
        patchEquivalent,
        remoteExists: candidate.remoteExists,
        openPrLookupVerified,
        openPrReferences,
        openPrReason,
        mergedPrVerified: mergedPr.verified,
        mergedPrNumber: mergedPr.number,
        prReason: mergedPr.reason,
        supersededVerified: superseded.verified,
        supersededPrNumber: superseded.replacementPr,
        supersededPrNumbers: superseded.replacementPrs,
        supersededReason: superseded.reason,
    });

    return {
        ...candidate,
        localSha,
        remoteSha,
        uniqueCommits,
        contentEquivalent,
        patchEquivalent,
        unpushedCommits,
        worktree,
        currentWorktree,
        dirtyWorktree,
        openPrLookupVerified,
        openPrReferences,
        openPrReason,
        mergedPr,
        superseded,
        ...classification,
    };
}

function printReport(target, inspected) {
    console.log('\n============================================================');
    console.log('🧹 AoT Task Sweeper — DRY RUN');
    console.log(`Target: ${target}`);
    console.log('============================================================\n');

    if (inspected.length === 0) {
        console.log('TASK branches: none');
        return;
    }

    for (const item of inspected) {
        const icon = item.status === 'SAFE' ? '✅' : '⛔';
        console.log(`${icon} [${item.status}] ${item.branch}`);
        console.log(`   local=${item.localExists ? 'yes' : 'no'} remote=${item.remoteExists ? 'yes' : 'no'} unique=${item.uniqueCommits}`);
        if (item.worktree?.path) console.log(`   worktree=${item.worktree.path}`);
        if (item.status === 'SAFE') console.log(`   reason: ${item.reason}`);
        else item.blockers.forEach((reason) => console.log(`   blocked: ${reason}`));
        console.log('');
    }

    const safe = inspected.filter((item) => item.status === 'SAFE').length;
    const blocked = inspected.length - safe;
    console.log(`Summary: SAFE=${safe} BLOCKED=${blocked}`);
}

function deleteRemoteBranch(branch, cwd) {
    const result = spawnSync('git', ['push', 'origin', '--delete', branch], {
        cwd,
        windowsHide: true,
        encoding: 'utf8',
        stdio: ['ignore', 'pipe', 'pipe'],
    });
    if (result.status === 0) return { deleted: true, alreadyAbsent: false };

    // A branch can disappear after cleanup revalidation but before mutation
    // (for example, another cleanup process deletes it first). Refresh the
    // remote-tracking namespace and treat that specific race as idempotent.
    git(['fetch', 'origin', '--prune'], { cwd, allowFailure: true });
    if (!refExists(`refs/remotes/origin/${branch}`, cwd)) {
        console.log('   - remote TASK branch already absent');
        return { deleted: false, alreadyAbsent: true };
    }

    const stderr = result.stderr?.toString?.().trim();
    throw new Error(`git push origin --delete ${branch} failed${stderr ? `: ${stderr}` : ''}`);
}

function removeWorktree(worktreePath, cwd) {
    git(['worktree', 'remove', worktreePath], { cwd });
}

function deleteLocalBranch(item, cwd) {
    git(['branch', '-D', item.branch], { cwd });
}

export function classifyCleanupRevalidation(previous, current) {
    if (!current) return { status: 'SKIP', reason: 'TASK branch is already absent' };

    const blockers = [];
    if (current.status !== 'SAFE') {
        blockers.push(...(current.blockers || ['candidate is no longer SAFE']));
    }
    if (!previous.localSha && current.localSha) {
        blockers.push('local TASK branch appeared after dry run');
    } else if (previous.localSha && current.localSha && previous.localSha !== current.localSha) {
        blockers.push('local TASK head changed after dry run');
    }
    if (!previous.remoteSha && current.remoteSha) {
        blockers.push('remote TASK branch appeared after dry run');
    } else if (previous.remoteSha && current.remoteSha && previous.remoteSha !== current.remoteSha) {
        blockers.push('remote TASK head changed after dry run');
    }

    if (blockers.length > 0) return { status: 'BLOCKED', blockers };
    return { status: 'SAFE', reason: current.reason || 'candidate remains SAFE after refresh' };
}

async function revalidateCleanupItems(items, context) {
    const { cwd, target, targetRef, githubRepo, supersededManifest } = context;
    console.log('\n🔎 Revalidating SAFE TASK branches immediately before cleanup...');
    git(['fetch', 'origin', '--prune'], { cwd });

    const worktrees = parseWorktrees(git(['worktree', 'list', '--porcelain'], { cwd }));
    const worktreeByBranch = new Map(worktrees.filter((entry) => entry.branch).map((entry) => [entry.branch, entry]));
    const freshCandidates = new Map(listTaskBranches(target, cwd).map((candidate) => [candidate.branch, candidate]));
    const openPrSnapshot = githubRepo
        ? await loadOpenPullRequestSnapshot(githubRepo)
        : { verified: false, pulls: [], reason: 'origin is not a supported github.com repository' };
    const result = [];

    for (const previous of items) {
        const candidate = freshCandidates.get(previous.branch) ?? null;
        if (!candidate) {
            const revalidation = classifyCleanupRevalidation(previous, null);
            console.log(`   - ${previous.branch}: SKIP (${revalidation.reason})`);
            result.push({ previous, current: null, revalidation });
            continue;
        }

        const current = await inspectCandidate(candidate, {
            cwd,
            target,
            targetRef,
            worktreeByBranch,
            githubRepo,
            openPrSnapshot,
            supersededManifest,
        });
        const revalidation = classifyCleanupRevalidation(previous, current);
        if (revalidation.status === 'BLOCKED') {
            const details = revalidation.blockers.join('; ');
            throw new Error(`Cleanup revalidation failed for ${previous.branch}: ${details}`);
        }
        console.log(`   - ${previous.branch}: SAFE (${revalidation.reason})`);
        result.push({ previous, current, revalidation });
    }

    return result;
}

async function executeCleanup(items, context) {
    const { cwd, githubRepo } = context;
    const revalidated = await revalidateCleanupItems(items, context);

    for (const entry of revalidated) {
        const item = entry.current;
        if (!item || entry.revalidation.status === 'SKIP') continue;

        if (item.remoteExists) {
            console.log(`\n🔒 Rechecking open PR references immediately before mutating ${item.branch}...`);
            if (!githubRepo) {
                throw new Error(`Cleanup blocked for ${item.branch}: origin is not a supported github.com repository`);
            }
            const openPrSnapshot = await loadOpenPullRequestSnapshot(githubRepo);
            if (!openPrSnapshot.verified) {
                throw new Error(`Cleanup blocked for ${item.branch}: ${openPrSnapshot.reason || 'open PR references could not be verified'}`);
            }
            const repositoryFullName = `${githubRepo.owner}/${githubRepo.repo}`;
            const references = collectOpenPullRequestReferences(item.branch, openPrSnapshot.pulls, repositoryFullName);
            if (references.length > 0) {
                throw new Error(`Cleanup blocked for ${item.branch}: open PR reference protects this TASK: ${formatOpenPullRequestReferences(references)}`);
            }
        }

        console.log(`\n🧹 Cleaning ${item.branch}`);
        if (item.worktree?.path) {
            console.log('   - remove worktree');
            removeWorktree(item.worktree.path, cwd);
        }
        if (item.localExists) {
            console.log('   - delete local TASK branch (revalidated SAFE)');
            deleteLocalBranch(item, cwd);
        }
        if (item.remoteExists) {
            console.log('   - delete remote TASK branch');
            deleteRemoteBranch(item.branch, cwd);
        }
    }
    console.log('\n   - prune remote-tracking refs');
    git(['fetch', 'origin', '--prune'], { cwd });
}

async function requestInteractiveConfirmation(items) {
    const remoteCount = items.filter((item) => item.remoteExists).length;
    const worktreeCount = items.filter((item) => item.worktree?.path).length;
    const localCount = items.filter((item) => item.localExists).length;
    console.log('\n⚠️  CLEAN will permanently remove only the SAFE entries above.');
    console.log(`    remote branches=${remoteCount}, worktrees=${worktreeCount}, local branches=${localCount}`);
    console.log('    Remote deletion runs: git push origin --delete <branch>');
    const rl = readline.createInterface({ input: process.stdin, output: process.stdout });
    try {
        return (await rl.question('Type CLEAN to authorize deletion, or press Enter to cancel: ')).trim();
    } finally {
        rl.close();
    }
}

function printHelp() {
    console.log(`AoT Task Sweeper\n\nUsage:\n  node scratch/task_sweeper.mjs [--target AoTYYMMDD] [--interactive]\n  node scratch/task_sweeper.mjs --target AoTYYMMDD --execute --confirm CLEAN\n\nDefault is dry-run only. Deletion requires an explicit CLEAN confirmation.`);
}

async function main() {
    const args = parseArgs(process.argv.slice(2));
    if (args.help) {
        printHelp();
        return;
    }

    const cwd = git(['rev-parse', '--show-toplevel'], { cwd: process.cwd() });
    const target = resolveTarget(args.target, cwd);
    if (!/^AoT\d{6}$/.test(target)) throw new Error(`Refusing non-AoT integration target: ${target}`);

    console.log(`Refreshing origin refs for ${target}...`);
    git(['fetch', 'origin', '--prune'], { cwd });
    const targetRef = `origin/${target}`;
    if (!refExists(`refs/remotes/${targetRef}`, cwd)) throw new Error(`Missing ${targetRef}`);

    const originUrl = git(['remote', 'get-url', 'origin'], { cwd });
    const githubRepo = parseGitHubRepo(originUrl);
    const supersededManifest = loadSupersededTaskManifest(cwd, target);
    const openPrSnapshot = githubRepo
        ? await loadOpenPullRequestSnapshot(githubRepo)
        : { verified: false, pulls: [], reason: 'origin is not a supported github.com repository' };
    const worktrees = parseWorktrees(git(['worktree', 'list', '--porcelain'], { cwd }));
    const worktreeByBranch = new Map(worktrees.filter((entry) => entry.branch).map((entry) => [entry.branch, entry]));
    const candidates = listTaskBranches(target, cwd);
    const inspected = [];
    for (const candidate of candidates) {
        inspected.push(await inspectCandidate(candidate, {
            cwd,
            target,
            targetRef,
            worktreeByBranch,
            githubRepo,
            openPrSnapshot,
            supersededManifest,
        }));
    }

    printReport(target, inspected);
    const safeItems = inspected.filter((item) => item.status === 'SAFE');
    if (safeItems.length === 0) return;

    let confirmation = args.confirm;
    if (args.interactive) confirmation = await requestInteractiveConfirmation(safeItems);
    if (!args.execute && !args.interactive) {
        console.log('\nDry run only. Re-run with --interactive to clean SAFE entries.');
        return;
    }
    if (confirmation !== 'CLEAN') {
        console.log('\nCancelled. Nothing was deleted.');
        return;
    }

    await executeCleanup(safeItems, {
        cwd,
        target,
        targetRef,
        githubRepo,
        supersededManifest,
    });
    console.log('\n✅ SAFE TASK cleanup completed.');
}

const isMain = process.argv[1] && path.resolve(process.argv[1]) === path.resolve(fileURLToPath(import.meta.url));
if (isMain) {
    main().catch((error) => {
        console.error(`\n❌ AoT Task Sweeper aborted: ${error.message}`);
        process.exit(1);
    });
}