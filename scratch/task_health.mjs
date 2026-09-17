import { execFileSync } from 'child_process';
import path from 'path';
import process from 'process';
import { fileURLToPath } from 'url';

export const TASK_HEALTH = Object.freeze({
    HEALTHY: 'HEALTHY',
    TARGET_DRIFT: 'TARGET_DRIFT',
    TARGET_STATE_STALE: 'TARGET_STATE_STALE',
    OVERLAP_DETECTED: 'OVERLAP_DETECTED',
    RECONCILE_RECOMMENDED: 'RECONCILE_RECOMMENDED',
    BLOCKED: 'BLOCKED',
});

export const REMOTE_FRESHNESS = Object.freeze({
    FRESH: 'FRESH',
    UNKNOWN: 'UNKNOWN',
});

export const INTEGRATION_STATE = Object.freeze({
    WORKING: 'WORKING',
    READY: 'READY',
    WAITING_FOR_BASE_UPDATE: 'WAITING_FOR_BASE_UPDATE',
    CONFLICT: 'CONFLICT',
    TEST_FAILED: 'TEST_FAILED',
    APPROVED: 'APPROVED',
    MERGED: 'MERGED',
});

export const OVERLAP_RISK = Object.freeze({
    NONE: 'NONE',
    PATH_OVERLAP: 'PATH_OVERLAP',
    DOMAIN_OVERLAP: 'DOMAIN_OVERLAP',
    SHARED_SURFACE: 'SHARED_SURFACE',
    CONTRACT_OVERLAP: 'CONTRACT_OVERLAP',
});

const SHARED_SURFACE_PATHS = new Set([
    'AGENTS.md',
    'game/src/i18n.js',
    'game/src/ui/layout_config.js',
    'game/src/core/game_engine.js',
    'game/src/core/game_fact.js',
    'scratch/run_full_inspection.mjs',
    'scratch/test_all_modules.mjs',
]);

const CONTRACT_WORDS = new Set(['contract', 'service', 'bootstrap', 'event', 'fact']);

function unique(values) {
    return [...new Set(values.filter(Boolean))];
}

function isSharedSurface(filepath) {
    return SHARED_SURFACE_PATHS.has(filepath)
        || /^game\/src\/data\/[^/]+\.json$/.test(filepath);
}

function domainOf(filepath) {
    const source = filepath.match(/^game\/src\/([^/]+)\//);
    if (source) return `game/src/${source[1]}`;
    const game = filepath.match(/^game\/([^/]+)\//);
    if (game) return `game/${game[1]}`;
    const scratch = filepath.match(/^scratch\/([^/]+)/);
    return scratch ? `scratch/${scratch[1]}` : '';
}

function contractWords(filepath) {
    return filepath.toLowerCase().split(/[^a-z0-9]+/).filter((word) => CONTRACT_WORDS.has(word));
}

/**
 * Classify only the observed overlap. It intentionally does not infer semantic
 * dependencies from arbitrary source code; those remain a human reconciliation
 * decision at the integration gate.
 */
export function classifyOverlap(targetFiles = [], taskFiles = []) {
    const target = unique(targetFiles);
    const task = unique(taskFiles);
    const taskSet = new Set(task);
    const paths = target.filter((filepath) => taskSet.has(filepath));
    const taskDomains = new Set(task.map(domainOf).filter(Boolean));
    const domains = unique(target.map(domainOf).filter((domain) => taskDomains.has(domain)));
    const taskWords = new Set(task.flatMap(contractWords));
    const contracts = unique(target.flatMap(contractWords).filter((word) => taskWords.has(word)));
    const shared = target.filter(isSharedSurface);
    const findings = [
        [OVERLAP_RISK.CONTRACT_OVERLAP, contracts],
        [OVERLAP_RISK.SHARED_SURFACE, shared],
        [OVERLAP_RISK.PATH_OVERLAP, paths],
        [OVERLAP_RISK.DOMAIN_OVERLAP, domains],
    ].filter(([, evidence]) => evidence.length > 0);
    const [risk = OVERLAP_RISK.NONE] = findings[0] || [];
    return {
        risk,
        risks: findings.map(([kind]) => kind),
        evidence: unique(findings.flatMap(([, evidence]) => evidence)),
    };
}

export function buildTaskFileRanges({ mergeBase, targetRef, head = 'HEAD' }) {
    return Object.freeze({
        targetOnlyRange: `${mergeBase}..${targetRef}`,
        taskOwnedRange: `${mergeBase}..${head}`,
    });
}

export function assessTaskHealth({
    baseIsTargetAncestor = true,
    taskDescendsFromBase = true,
    remoteTaskIsAncestor = true,
    remoteFreshness = REMOTE_FRESHNESS.FRESH,
    targetHasAdvancedSinceRecordedBase = false,
    needsReconciliationNow = false,
    targetIsAncestor = true,
    integrationReady = false,
    overlap = { risk: OVERLAP_RISK.NONE, evidence: [] },
} = {}) {
    if (!baseIsTargetAncestor) {
        return {
            health: TASK_HEALTH.BLOCKED,
            integrationState: INTEGRATION_STATE.CONFLICT,
            risk: OVERLAP_RISK.NONE,
            action: 'STOP',
            reason: 'BASE_REWRITE: recorded base is not in current target history.',
        };
    }
    if (!taskDescendsFromBase) {
        return {
            health: TASK_HEALTH.BLOCKED,
            integrationState: INTEGRATION_STATE.CONFLICT,
            risk: OVERLAP_RISK.NONE,
            action: 'STOP',
            reason: 'UNKNOWN_BRANCH_RELATIONSHIP: TASK is not descended from its recorded base.',
        };
    }
    if (!remoteTaskIsAncestor) {
        return {
            health: TASK_HEALTH.BLOCKED,
            integrationState: INTEGRATION_STATE.CONFLICT,
            risk: OVERLAP_RISK.NONE,
            action: 'STOP',
            reason: 'REMOTE_TASK_DRIFT: same-name remote TASK has unrecognized commits.',
        };
    }

    if (remoteFreshness !== REMOTE_FRESHNESS.FRESH) {
        return {
            health: integrationReady ? TASK_HEALTH.BLOCKED : TASK_HEALTH.TARGET_STATE_STALE,
            integrationState: integrationReady ? INTEGRATION_STATE.WAITING_FOR_BASE_UPDATE : INTEGRATION_STATE.WORKING,
            risk: OVERLAP_RISK.NONE,
            action: integrationReady ? 'BLOCK' : 'CONTINUE_WITH_WARNING',
            reason: 'Remote refs could not be refreshed; observation may be stale.',
        };
    }

    const integrationState = integrationReady && !targetIsAncestor
        ? INTEGRATION_STATE.WAITING_FOR_BASE_UPDATE
        : (integrationReady ? INTEGRATION_STATE.READY : INTEGRATION_STATE.WORKING);
    if (!needsReconciliationNow) {
        return {
            health: TASK_HEALTH.HEALTHY,
            integrationState,
            risk: OVERLAP_RISK.NONE,
            action: integrationState === INTEGRATION_STATE.READY ? 'READY_FOR_INTEGRATION' : 'CONTINUE',
            reason: targetHasAdvancedSinceRecordedBase
                ? 'Target advanced since the recorded base, and the latest target is already contained.'
                : 'Recorded base matches the current target.',
        };
    }

    if (overlap.risk === OVERLAP_RISK.CONTRACT_OVERLAP) {
        return {
            health: TASK_HEALTH.RECONCILE_RECOMMENDED,
            integrationState,
            risk: overlap.risk,
            action: 'CONTINUE_WITH_RECONCILIATION_PLAN',
            reason: 'TARGET_DRIFT includes a possible contract overlap.',
        };
    }
    return {
        health: TASK_HEALTH.TARGET_DRIFT,
        integrationState,
        risk: overlap.risk,
        action: 'CONTINUE',
        reason: overlap.risk === OVERLAP_RISK.NONE
            ? 'TARGET_DRIFT has no observed file or domain overlap.'
            : `TARGET_DRIFT observed ${overlap.risk}.`,
    };
}

function git(args, cwd, allowFailure = false) {
    try {
        return execFileSync('git', args, { cwd, encoding: 'utf8', windowsHide: true }).trim();
    } catch (error) {
        if (allowFailure) return '';
        throw error;
    }
}

function gitSuccess(args, cwd) {
    try {
        execFileSync('git', args, { cwd, stdio: 'ignore', windowsHide: true });
        return true;
    } catch {
        return false;
    }
}

function refreshRemoteRefs(cwd, target, branch) {
    try {
        execFileSync('git', ['fetch', 'origin', target], { cwd, stdio: 'ignore', windowsHide: true });
        const remoteTask = execFileSync('git', ['ls-remote', '--heads', 'origin', branch], {
            cwd,
            encoding: 'utf8',
            windowsHide: true,
        }).trim();
        const remoteTaskExists = Boolean(remoteTask);
        if (remoteTaskExists) {
            execFileSync('git', ['fetch', 'origin', branch], { cwd, stdio: 'ignore', windowsHide: true });
        }
        return { freshness: REMOTE_FRESHNESS.FRESH, remoteTaskExists, reason: '' };
    } catch (error) {
        return {
            freshness: REMOTE_FRESHNESS.UNKNOWN,
            remoteTaskExists: null,
            reason: error?.message?.split(/\r?\n/)[0] || 'remote ref refresh failed',
        };
    }
}

function parseArgs(argv) {
    const options = { target: '', integrationReady: false };
    for (let index = 0; index < argv.length; index += 1) {
        const value = argv[index];
        if (value === '--target') options.target = argv[++index] || '';
        else if (value === '--integration-ready') options.integrationReady = true;
        else if (value === '--help' || value === '-h') options.help = true;
        else throw new Error(`Unknown argument: ${value}`);
    }
    return options;
}

function printHelp() {
    console.log('Usage: node scratch/task_health.mjs [--target AoTYYMMDD] [--integration-ready]');
}

function inspectCurrentTask(cwd, options) {
    const branch = git(['branch', '--show-current'], cwd);
    const target = options.target || git(['config', '--get', 'aot.authorizedBranch'], cwd);
    const base = git(['config', '--get', 'aot.authorizedBaseCommit'], cwd);
    if (!branch || !target || !base) throw new Error('TASK branch, authorized target, or recorded base is missing.');
    const targetRef = `origin/${target}`;
    const taskRef = `origin/${branch}`;
    const refresh = refreshRemoteRefs(cwd, target, branch);
    if (!gitSuccess(['rev-parse', '--verify', targetRef], cwd)) {
        throw new Error(`UNKNOWN_BRANCH_RELATIONSHIP: ${targetRef} is unavailable after refresh.`);
    }

    const baseIsTargetAncestor = gitSuccess(['merge-base', '--is-ancestor', base, targetRef], cwd);
    const taskDescendsFromBase = gitSuccess(['merge-base', '--is-ancestor', base, 'HEAD'], cwd);
    const remoteTaskExists = refresh.remoteTaskExists ?? gitSuccess(['rev-parse', '--verify', taskRef], cwd);
    const remoteTaskIsAncestor = !remoteTaskExists || gitSuccess(['merge-base', '--is-ancestor', taskRef, 'HEAD'], cwd);
    const targetHasAdvancedSinceRecordedBase = git(['rev-parse', targetRef], cwd) !== base;
    const targetIsAncestor = gitSuccess(['merge-base', '--is-ancestor', targetRef, 'HEAD'], cwd);
    const needsReconciliationNow = targetHasAdvancedSinceRecordedBase && !targetIsAncestor;
    const mergeBase = git(['merge-base', targetRef, 'HEAD'], cwd);
    const ranges = buildTaskFileRanges({ mergeBase, targetRef });
    const targetFiles = needsReconciliationNow
        ? git(['diff', '--name-only', ranges.targetOnlyRange], cwd).split(/\r?\n/).filter(Boolean)
        : [];
    const taskFiles = git(['diff', '--name-only', ranges.taskOwnedRange], cwd).split(/\r?\n/).filter(Boolean);
    const overlap = classifyOverlap(targetFiles, taskFiles);
    const assessment = assessTaskHealth({
        baseIsTargetAncestor,
        taskDescendsFromBase,
        remoteTaskIsAncestor,
        remoteFreshness: refresh.freshness,
        targetHasAdvancedSinceRecordedBase,
        needsReconciliationNow,
        targetIsAncestor,
        integrationReady: options.integrationReady,
        overlap,
    });
    return {
        branch, target, base, targetRef, targetFiles, taskFiles, overlap, ranges,
        remoteFreshness: refresh.freshness,
        refreshReason: refresh.reason,
        targetHasAdvancedSinceRecordedBase,
        targetIsAncestor,
        needsReconciliationNow,
        ...assessment,
    };
}

function printReport(report) {
    console.log('\nTASK HEALTH');
    console.log(`branch: ${report.branch}`);
    console.log(`recorded base: ${report.base}`);
    console.log(`current target: ${report.targetRef}`);
    console.log(`remote freshness: ${report.remoteFreshness}`);
    console.log(`target advanced since base: ${report.targetHasAdvancedSinceRecordedBase ? 'yes' : 'no'}`);
    console.log(`latest target contained: ${report.targetIsAncestor ? 'yes' : 'no'}`);
    console.log(`reconciliation required: ${report.needsReconciliationNow ? 'yes' : 'no'}`);
    console.log(`health: ${report.health}`);
    console.log(`integration state: ${report.integrationState}`);
    console.log(`risk: ${report.risk}`);
    console.log(`action: ${report.action}`);
    console.log(`reason: ${report.reason}`);
    if (report.refreshReason) console.log(`freshness detail: ${report.refreshReason}`);
    if (report.targetFiles.length > 0) console.log(`target-only files needing review: ${report.targetFiles.join(', ')}`);
    if (report.taskFiles.length > 0) console.log(`task-owned files: ${report.taskFiles.join(', ')}`);
    if (report.overlap.evidence.length > 0) console.log(`overlap evidence: ${report.overlap.evidence.join(', ')}`);
    if (report.needsReconciliationNow) {
        console.log('required before integration: reconcile latest target, review overlap, rerun focused tests, rerun Full Inspection');
    }
}

async function main() {
    const options = parseArgs(process.argv.slice(2));
    if (options.help) return printHelp();
    const cwd = git(['rev-parse', '--show-toplevel'], process.cwd());
    const report = inspectCurrentTask(cwd, options);
    printReport(report);
    if (report.action === 'STOP' || report.action === 'BLOCK') process.exitCode = 2;
    if (options.integrationReady && report.integrationState === INTEGRATION_STATE.WAITING_FOR_BASE_UPDATE) process.exitCode = 2;
}

const isMain = process.argv[1] && path.resolve(process.argv[1]) === path.resolve(fileURLToPath(import.meta.url));
if (isMain) main().catch((error) => {
    console.error(`TASK HEALTH BLOCKED: ${error.message}`);
    process.exit(2);
});
