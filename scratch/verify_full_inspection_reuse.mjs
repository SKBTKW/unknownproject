import { createHash } from 'node:crypto';
import { execFileSync } from 'node:child_process';
import { arch, platform } from 'node:os';
import { existsSync, readFileSync } from 'node:fs';
import path from 'node:path';
import process from 'node:process';
import { fileURLToPath } from 'node:url';

const SCRIPT_PATH = fileURLToPath(import.meta.url);

function sha256File(filepath) {
    return createHash('sha256').update(readFileSync(filepath)).digest('hex');
}

function git(args, cwd) {
    return execFileSync('git', args, { cwd, encoding: 'utf8', windowsHide: true }).trim();
}

export function assessInspectionReuse({ receipt, observed, maxAgeHours = 24 }) {
    const reasons = [];
    const ageMs = observed.now - Date.parse(receipt.createdAt);
    if (receipt.schemaVersion !== 1 || receipt.kind !== 'AOT_FULL_INSPECTION_RECEIPT') reasons.push('INVALID_RECEIPT_SCHEMA');
    if (receipt.outcome !== 'PASS' || receipt.gitClean !== true) reasons.push('INSPECTION_NOT_CLEAN_PASS');
    if (!Number.isFinite(ageMs) || ageMs < 0 || ageMs > maxAgeHours * 3600_000) reasons.push('RECEIPT_EXPIRED');
    if (receipt.headSha !== observed.sourceSha) reasons.push('SOURCE_HEAD_CHANGED');
    if (receipt.treeSha !== observed.sourceTree) reasons.push('SOURCE_TREE_CHANGED');
    if (receipt.treeSha !== observed.integrationTree) reasons.push('INTEGRATION_TREE_DIFFERS');
    if (receipt.targetSha !== observed.remoteTargetSha) reasons.push('TARGET_DRIFT');
    if (receipt.environment?.node !== observed.node
        || receipt.environment?.platform !== observed.platform
        || receipt.environment?.arch !== observed.arch) reasons.push('ENVIRONMENT_CHANGED');
    if (receipt.inputs?.runnerSha256 !== observed.runnerSha256) reasons.push('RUNNER_CHANGED');
    if (receipt.inputs?.registrySha256 !== observed.registrySha256) reasons.push('REGISTRY_CHANGED');
    if ((receipt.inputs?.packageLockSha256 || null) !== (observed.packageLockSha256 || null)) reasons.push('DEPENDENCY_LOCK_CHANGED');
    if (!observed.gitClean) reasons.push('INTEGRATION_WORKTREE_DIRTY');
    return Object.freeze({ ready: reasons.length === 0, reasons: Object.freeze(reasons) });
}

function parseArgs(argv) {
    const values = {};
    for (let index = 0; index < argv.length; index += 1) {
        const key = argv[index];
        if (!key.startsWith('--')) throw new Error(`UNEXPECTED_ARGUMENT:${key}`);
        const value = argv[index + 1];
        if (!value || value.startsWith('--')) throw new Error(`MISSING_VALUE:${key}`);
        values[key.slice(2)] = value;
        index += 1;
    }
    return values;
}

function observedState(repoRoot, receipt, sourceRef, integrationRef) {
    const runnerPath = path.join(repoRoot, 'scratch', 'run_full_inspection.mjs');
    const registryPath = path.join(repoRoot, 'scratch', 'test_registry.json');
    const lockPath = path.join(repoRoot, 'package-lock.json');
    const targetRef = `origin/${receipt.targetBranch}`;
    return {
        now: Date.now(),
        sourceSha: git(['rev-parse', sourceRef], repoRoot),
        sourceTree: git(['rev-parse', `${sourceRef}^{tree}`], repoRoot),
        integrationTree: git(['rev-parse', `${integrationRef}^{tree}`], repoRoot),
        remoteTargetSha: git(['rev-parse', targetRef], repoRoot),
        node: process.version,
        platform: platform(),
        arch: arch(),
        runnerSha256: sha256File(runnerPath),
        registrySha256: sha256File(registryPath),
        packageLockSha256: existsSync(lockPath) ? sha256File(lockPath) : null,
        gitClean: git(['status', '--porcelain'], repoRoot) === '',
    };
}

async function main() {
    const args = parseArgs(process.argv.slice(2));
    if (!args.receipt || !args['source-ref']) {
        throw new Error('USAGE: --receipt <path> --source-ref <task-ref> [--integration-ref HEAD] [--max-age-hours 24]');
    }
    const repoRoot = git(['rev-parse', '--show-toplevel'], process.cwd());
    const receipt = JSON.parse(readFileSync(path.resolve(args.receipt), 'utf8'));
    if (typeof receipt.targetBranch !== 'string' || !receipt.targetBranch || typeof receipt.targetSha !== 'string') {
        throw new Error('RECEIPT_TARGET_PROVENANCE_REQUIRED');
    }
    const observed = observedState(repoRoot, receipt, args['source-ref'], args['integration-ref'] || 'HEAD');
    const result = assessInspectionReuse({
        receipt,
        observed,
        maxAgeHours: Number(args['max-age-hours'] || 24),
    });
    if (!result.ready) {
        console.error(`Full Inspection reuse: BLOCKED (${result.reasons.join(', ')})`);
        process.exitCode = 1;
        return;
    }
    console.log('Full Inspection reuse: READY');
    console.log(`tree: ${receipt.treeSha}`);
    console.log(`source: ${observed.sourceSha}`);
    console.log(`target base: ${observed.remoteTargetSha}`);
    console.log('Required next checks: pre_write_linter + task-focused smoke; target-push CI remains mandatory.');
}

if (process.argv[1] && path.resolve(process.argv[1]) === SCRIPT_PATH) {
    main().catch((error) => {
        console.error(`Full Inspection reuse verification failed: ${error.message}`);
        process.exitCode = 1;
    });
}
