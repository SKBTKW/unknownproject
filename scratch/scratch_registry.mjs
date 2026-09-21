import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { spawnSync } from 'node:child_process';

export const REPOSITORY_ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const SUITES = new Set(['existing', 'supplemental', 'quarantined']);
const TEST_PATH = /^scratch\/(?:[a-zA-Z0-9_-]+\/)*test_[a-zA-Z0-9_-]+\.(?:mjs|js|py)$/;
const ENTRY_POINTS = new Set([
    'scratch/run_full_inspection.mjs',
    'scratch/test_task_health.mjs',
    '.github/workflows/full-inspection.yml',
]);

function resolvedFile(root, relative) {
    const absolute = path.resolve(root, relative);
    const actual = fs.realpathSync(absolute);
    const within = path.relative(fs.realpathSync(root), actual);
    if (within.startsWith(`..${path.sep}`) || within === '..' || path.isAbsolute(within)) {
        throw new Error(`Path escapes repository: ${relative}`);
    }
    if (!fs.statSync(actual).isFile()) throw new Error(`Not a file: ${relative}`);
    return actual;
}

export function discoverTests(root) {
    const found = [];
    function walk(relative) {
        for (const item of fs.readdirSync(path.join(root, relative), { withFileTypes: true })) {
            const child = `${relative}/${item.name}`;
            if (relative === 'scratch' && ['backup_snapshots', '__pycache__'].includes(item.name)) continue;
            if (item.isSymbolicLink()) throw new Error(`Symlinks are not supported in test discovery: ${child}`);
            if (item.isDirectory()) walk(child);
            else if (/^test_.*\.(mjs|js|py)$/.test(item.name)) found.push(child);
        }
    }
    walk('scratch');
    return found.sort();
}

export function validateRegistry(registry, root = REPOSITORY_ROOT) {
    const errors = [];
    const counts = { existing: 0, supplemental: 0, quarantined: 0 };
    if (registry?.schemaVersion !== 1 || !Array.isArray(registry?.tests)) {
        return { errors: ['Expected schemaVersion 1 and a tests array.'], counts };
    }
    const discovered = new Set(discoverTests(root));
    const registered = new Set();
    for (const entry of registry.tests) {
        const name = entry?.path;
        if (typeof name !== 'string' || !TEST_PATH.test(name)) {
            errors.push(`Invalid test path: ${String(name)}`);
            continue;
        }
        if (registered.has(name)) errors.push(`Duplicate registration: ${name}`);
        registered.add(name);
        if (!SUITES.has(entry.suite)) errors.push(`Invalid suite: ${name}`);
        else counts[entry.suite]++;
        if (typeof entry.purpose !== 'string' || !entry.purpose.trim()) errors.push(`Missing purpose: ${name}`);
        if (!discovered.has(name)) errors.push(`Registered test is missing: ${name}`);
        try { resolvedFile(root, name); } catch (error) { errors.push(error.message); }
        if (entry.suite === 'existing') {
            if (!Array.isArray(entry.entryPoints) || !entry.entryPoints.length) {
                errors.push(`Missing existing entry point: ${name}`);
                continue;
            }
            for (const caller of entry.entryPoints) {
                if (!ENTRY_POINTS.has(caller)) {
                    errors.push(`Unsupported entry point: ${caller}`);
                    continue;
                }
                try {
                    const source = fs.readFileSync(resolvedFile(root, caller), 'utf8');
                    const references = source.match(/(?:scratch\/)?test_[a-zA-Z0-9_-]+\.(?:mjs|js|py)/g) || [];
                    const expected = caller === 'scratch/test_task_health.mjs' ? path.posix.basename(name) : name;
                    if (!references.includes(expected)) errors.push(`Entry point no longer references ${name}: ${caller}`);
                } catch (error) { errors.push(error.message); }
            }
        }
        if (entry.suite === 'quarantined') {
            for (const key of ['reason', 'nextAction']) {
                if (typeof entry[key] !== 'string' || !entry[key].trim()) errors.push(`Missing quarantine ${key}: ${name}`);
            }
        }
    }
    for (const name of discovered) if (!registered.has(name)) errors.push(`Unregistered test: ${name}`);
    return { errors, counts };
}

export function runTest(entry, root = REPOSITORY_ROOT, { timeoutMs = 30000, python = 'python' } = {}) {
    if (!TEST_PATH.test(entry.path)) throw new Error(`Invalid test path: ${entry.path}`);
    const target = resolvedFile(root, entry.path);
    const isPython = entry.path.endsWith('.py');
    const start = Date.now();
    const result = spawnSync(isPython ? python : process.execPath, isPython ? ['-B', target] : [target], {
        cwd: root,
        shell: false,
        windowsHide: true,
        encoding: 'utf8',
        timeout: timeoutMs,
        killSignal: 'SIGKILL',
        maxBuffer: 2 * 1024 * 1024,
        env: { ...process.env, PYTHONDONTWRITEBYTECODE: '1', PYTHONIOENCODING: 'utf-8' },
    });
    const status = result.error?.code === 'ETIMEDOUT' ? 'TIMEOUT'
        : result.error ? 'ERROR' : result.status === 0 ? 'PASS' : 'FAIL';
    return {
        path: entry.path, status, exitCode: result.status, signal: result.signal,
        durationMs: Date.now() - start,
        output: `${result.stdout || ''}${result.stderr || ''}${result.error ? `\n${result.error.message}` : ''}`,
    };
}

export function main(args = process.argv.slice(2)) {
    const json = args.includes('--json');
    const options = args.filter(value => value !== '--json');
    const mode = options[0] || '--check';
    const suite = options[1];
    if (!((['--check', '--list'].includes(mode) && options.length <= 1)
        || (mode === '--run' && options.length === 2 && ['supplemental', 'quarantined'].includes(suite)))) {
        console.error('Usage: node scratch/scratch_registry.mjs [--check | --list | --run supplemental | --run quarantined] [--json]');
        return 2;
    }
    const registry = JSON.parse(fs.readFileSync(path.join(REPOSITORY_ROOT, 'scratch/test_registry.json'), 'utf8'));
    const validation = validateRegistry(registry);
    if (validation.errors.length) {
        if (json) console.log(JSON.stringify({ ...validation, results: [] }, null, 2));
        else console.error(validation.errors.join('\n'));
        return 1;
    }
    if (mode === '--run' && validation.counts[suite] === 0) {
        const error = `No tests registered in requested suite: ${suite}`;
        if (json) console.log(JSON.stringify({ errors: [error], results: [] }, null, 2));
        else console.error(error);
        return 1;
    }
    if (mode === '--list') {
        console.log(json ? JSON.stringify(registry, null, 2)
            : registry.tests.map(entry => `${entry.suite.padEnd(13)} ${entry.path}${entry.reason ? `: ${entry.reason}` : ''}`).join('\n'));
        return 0;
    }
    const results = [];
    if (mode === '--run') {
        for (const entry of registry.tests.filter(entry => entry.suite === suite)) {
            const result = runTest(entry);
            results.push(result);
            if (!json) {
                console.log(`${result.status}: ${result.path} (${result.durationMs} ms)`);
                if (result.status !== 'PASS') console.error(result.output);
            }
        }
    }
    const report = {
        ...validation, mode, suite: suite || null, results,
        passed: results.filter(result => result.status === 'PASS').length,
        failed: results.filter(result => result.status !== 'PASS').length,
        notRun: registry.tests.length - results.length,
    };
    if (json) console.log(JSON.stringify(report, null, 2));
    else {
        console.log(`Registry: ${validation.counts.existing} existing, ${validation.counts.supplemental} supplemental, ${validation.counts.quarantined} quarantined.`);
        console.log(`Executed: ${results.length}; PASS: ${report.passed}; non-PASS: ${report.failed}; not run: ${report.notRun}.`);
        if (validation.counts.quarantined > 0) {
            console.log('Quarantined tests remain unresolved; registry validation is not a full test pass.');
        } else {
            console.log('No quarantined tests registered.');
        }
    }
    return report.failed ? 1 : 0;
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
    try { process.exitCode = main(); }
    catch (error) {
        if (process.argv.includes('--json')) console.log(JSON.stringify({ errors: [error.message], results: [] }, null, 2));
        else console.error(error.message);
        process.exitCode = 1;
    }
}