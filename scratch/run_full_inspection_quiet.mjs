import { createHash } from 'node:crypto';
import { spawn, execFileSync } from 'node:child_process';
import { createWriteStream, existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { arch, platform, tmpdir } from 'node:os';
import path from 'node:path';
import process from 'node:process';
import { fileURLToPath } from 'node:url';

const SCRIPT_PATH = fileURLToPath(import.meta.url);
const DEFAULT_LOG_ROOT = path.join(tmpdir(), 'aot-full-inspection');

function git(args, cwd) {
    return execFileSync('git', args, { cwd, encoding: 'utf8', windowsHide: true }).trim();
}

function optionalGit(args, cwd) {
    try { return git(args, cwd); } catch { return null; }
}

function sha256File(filepath) {
    return createHash('sha256').update(readFileSync(filepath)).digest('hex');
}

function optionalSha256(filepath) {
    return existsSync(filepath) ? sha256File(filepath) : null;
}

export function isPathInside(parentPath, candidatePath) {
    const relative = path.relative(path.resolve(parentPath), path.resolve(candidatePath));
    return relative === '' || (!relative.startsWith('..') && !path.isAbsolute(relative));
}

export function parseInspectionMetrics(output) {
    const match = (pattern) => output.match(pattern)?.slice(1).map(Number) || null;
    const supplemental = match(/Executed:\s*(\d+);\s*PASS:\s*(\d+);\s*non-PASS:\s*(\d+)/);
    const ui = match(/UI検問結果:\s*(\d+)\s*PASS\s*\/\s*(\d+)\s*FAIL/);
    const stage1E2E = match(/Stage1 E2E audit checks:\s*(\d+)\s*PASS\s*\/\s*(\d+)\s*FAIL/);
    const firstRun = match(/FirstRun Stage1 completion certification:\s*PASS=(\d+)\s*FAIL=(\d+)/);
    return {
        supplemental: supplemental ? { executed: supplemental[0], passed: supplemental[1], failed: supplemental[2] } : null,
        uiLifecycle: ui ? { passed: ui[0], failed: ui[1] } : null,
        stage1E2E: stage1E2E ? { passed: stage1E2E[0], failed: stage1E2E[1] } : null,
        firstRun: firstRun ? { passed: firstRun[0], failed: firstRun[1] } : null,
    };
}

export function resolveExternalLogRoot(repoRoot, requestedRoot = DEFAULT_LOG_ROOT) {
    const resolved = path.resolve(requestedRoot);
    if (isPathInside(repoRoot, resolved)) {
        throw new Error('INSPECTION_LOG_ROOT_MUST_BE_OUTSIDE_REPOSITORY');
    }
    return resolved;
}

export function buildInspectionFingerprint(repoRoot, metrics, elapsedSeconds, logPath) {
    const runnerPath = path.join(repoRoot, 'scratch', 'run_full_inspection.mjs');
    const registryPath = path.join(repoRoot, 'scratch', 'test_registry.json');
    const lockPath = path.join(repoRoot, 'package-lock.json');
    const targetBranch = optionalGit(['config', '--get', 'aot.authorizedBranch'], repoRoot);
    let targetSha = null;
    if (targetBranch) {
        targetSha = optionalGit(['rev-parse', `origin/${targetBranch}`], repoRoot);
    }
    const status = git(['status', '--porcelain'], repoRoot);
    return {
        schemaVersion: 1,
        kind: 'AOT_FULL_INSPECTION_RECEIPT',
        outcome: status ? 'FAIL_DIRTY_AFTER_INSPECTION' : 'PASS',
        createdAt: new Date().toISOString(),
        elapsedSeconds: Number(elapsedSeconds),
        headSha: git(['rev-parse', 'HEAD'], repoRoot),
        treeSha: git(['rev-parse', 'HEAD^{tree}'], repoRoot),
        branch: git(['rev-parse', '--abbrev-ref', 'HEAD'], repoRoot),
        gitClean: !status,
        targetBranch,
        targetSha,
        environment: {
            node: process.version,
            platform: platform(),
            arch: arch(),
        },
        inputs: {
            runnerSha256: sha256File(runnerPath),
            registrySha256: sha256File(registryPath),
            packageLockSha256: optionalSha256(lockPath),
        },
        metrics,
        detailedLog: logPath,
    };
}

function formatMetric(label, metric) {
    if (!metric) return `${label}: PASS (count unavailable)`;
    if ('executed' in metric) return `${label}: ${metric.passed}/${metric.executed} PASS`;
    return `${label}: ${metric.passed} PASS / ${metric.failed} FAIL`;
}

async function closeStream(stream) {
    await new Promise((resolve, reject) => {
        stream.on('error', reject);
        stream.end(resolve);
    });
}

async function main() {
    const repoRoot = git(['rev-parse', '--show-toplevel'], process.cwd());
    const logArgIndex = process.argv.indexOf('--log-dir');
    const requestedRoot = logArgIndex >= 0 ? process.argv[logArgIndex + 1] : process.env.AOT_INSPECTION_LOG_DIR;
    if (logArgIndex >= 0 && !requestedRoot) throw new Error('MISSING_LOG_DIRECTORY');
    const logRoot = resolveExternalLogRoot(repoRoot, requestedRoot || DEFAULT_LOG_ROOT);
    mkdirSync(logRoot, { recursive: true });

    const stamp = new Date().toISOString().replace(/[:.]/g, '-');
    const baseName = `full-inspection-${stamp}-${process.pid}`;
    const logPath = path.join(logRoot, `${baseName}.log`);
    const receiptPath = path.join(logRoot, `${baseName}.receipt.json`);
    const logStream = createWriteStream(logPath, { flags: 'wx' });
    const startedAt = Date.now();

    console.log(`Full Inspection: RUNNING (details: ${logPath})`);
    const child = spawn(process.execPath, [path.join(repoRoot, 'scratch', 'run_full_inspection.mjs')], {
        cwd: repoRoot,
        stdio: ['ignore', 'pipe', 'pipe'],
        windowsHide: true,
    });
    child.stdout.pipe(logStream, { end: false });
    child.stderr.pipe(logStream, { end: false });
    for (const signal of ['SIGINT', 'SIGTERM']) {
        process.once(signal, () => child.kill(signal));
    }

    const exitCode = await new Promise((resolve, reject) => {
        child.on('error', reject);
        child.on('close', resolve);
    });
    await closeStream(logStream);

    const output = readFileSync(logPath, 'utf8');
    const metrics = parseInspectionMetrics(output);
    const elapsedSeconds = ((Date.now() - startedAt) / 1000).toFixed(2);

    if (exitCode !== 0) {
        const tail = output.trim().split(/\r?\n/).slice(-40).join('\n');
        console.error(`Full Inspection: FAIL (exit ${exitCode}, ${elapsedSeconds}s)`);
        console.error(tail);
        console.error(`Detailed log: ${logPath}`);
        process.exitCode = 1;
        return;
    }

    const receipt = buildInspectionFingerprint(repoRoot, metrics, elapsedSeconds, logPath);
    writeFileSync(receiptPath, `${JSON.stringify(receipt, null, 2)}\n`, 'utf8');
    if (receipt.outcome !== 'PASS') {
        console.error(`Full Inspection: ${receipt.outcome}`);
        console.error(`Receipt: ${receiptPath}`);
        process.exitCode = 1;
        return;
    }

    console.log('Full Inspection: Layer 1-6 ALL PASS');
    console.log(formatMetric('Supplemental', metrics.supplemental));
    console.log(formatMetric('UI lifecycle', metrics.uiLifecycle));
    console.log(formatMetric('Stage1 E2E', metrics.stage1E2E));
    console.log(formatMetric('FirstRun', metrics.firstRun));
    console.log(`Elapsed: ${elapsedSeconds}s`);
    console.log(`Receipt: ${receiptPath}`);
    console.log(`Detailed log: ${logPath}`);
}

if (process.argv[1] && path.resolve(process.argv[1]) === SCRIPT_PATH) {
    main().catch((error) => {
        console.error(`Full Inspection quiet runner failed: ${error.message}`);
        process.exitCode = 1;
    });
}
