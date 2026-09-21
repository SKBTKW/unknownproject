import assert from 'node:assert/strict';
import { test } from 'node:test';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { spawnSync } from 'node:child_process';
import { discoverTests, validateRegistry, runTest } from './scratch_registry.mjs';

function fixture(t) {
    const root = fs.mkdtempSync(path.join(os.tmpdir(), 'aot-registry-test-'));
    t.after(() => fs.rmSync(root, { recursive: true, force: true }));
    const write = (name, text = '') => {
        const target = path.join(root, name);
        fs.mkdirSync(path.dirname(target), { recursive: true });
        fs.writeFileSync(target, text);
    };
    write('scratch/test_example.mjs', 'console.log("fixture ok");');
    const entry = { path: 'scratch/test_example.mjs', suite: 'supplemental', purpose: 'Example contract' };
    return { root, write, entry, registry: { schemaVersion: 1, tests: [entry] } };
}

test('a registered supplemental test passes inventory validation', t => {
    const { root, registry } = fixture(t);
    assert.deepEqual(validateRegistry(registry, root), {
        errors: [], counts: { existing: 0, supplemental: 1, quarantined: 0 },
    });
});

test('new nested tests are detected even before Git staging', t => {
    const { root, write, registry } = fixture(t);
    write('scratch/new_tests/test_new.mjs');
    assert.ok(validateRegistry(registry, root).errors.includes('Unregistered test: scratch/new_tests/test_new.mjs'));
});

test('backup snapshots and Python caches do not become runnable tests', t => {
    const { root, write } = fixture(t);
    write('scratch/backup_snapshots/old/test_old.mjs');
    write('scratch/__pycache__/test_old.py');
    assert.deepEqual(discoverTests(root), ['scratch/test_example.mjs']);
});

test('missing test files fail validation', t => {
    const { root, registry } = fixture(t);
    fs.unlinkSync(path.join(root, 'scratch/test_example.mjs'));
    assert.ok(validateRegistry(registry, root).errors.some(error => error.includes('Registered test is missing')));
});

test('duplicate entries cannot inflate coverage counts silently', t => {
    const { root, registry, entry } = fixture(t);
    registry.tests.push({ ...entry });
    assert.ok(validateRegistry(registry, root).errors.some(error => error.includes('Duplicate registration')));
});

test('unknown suites and missing purposes fail validation', t => {
    const { root, registry, entry } = fixture(t);
    entry.suite = 'ignored';
    delete entry.purpose;
    assert.equal(validateRegistry(registry, root).errors.length, 2);
});

test('quarantine requires both a reason and a next action', t => {
    const { root, registry, entry } = fixture(t);
    entry.suite = 'quarantined';
    assert.equal(validateRegistry(registry, root).errors.length, 2);
    entry.reason = 'Legacy mock does not implement current DOM API.';
    entry.nextAction = 'Repair mock and run the UI contract.';
    assert.deepEqual(validateRegistry(registry, root).errors, []);
});

test('an existing route must still reference the registered test', t => {
    const { root, write, registry, entry } = fixture(t);
    entry.suite = 'existing';
    entry.entryPoints = ['scratch/run_full_inspection.mjs'];
    write(entry.entryPoints[0], 'runCommand("node", ["scratch/test_example.mjs"]);');
    assert.deepEqual(validateRegistry(registry, root).errors, []);
    write(entry.entryPoints[0], 'runCommand("node", ["scratch/test_example_other.mjs"]);');
    assert.ok(validateRegistry(registry, root).errors.some(error => error.includes('no longer references')));
});

test('indirect task-health tests retain their basename-based route', t => {
    const { root, write, registry, entry } = fixture(t);
    entry.suite = 'existing';
    entry.entryPoints = ['scratch/test_task_health.mjs'];
    write(entry.entryPoints[0], "const scripts = ['test_example.mjs'];");
    registry.tests.push({ path: entry.entryPoints[0], suite: 'supplemental', purpose: 'Caller fixture' });
    assert.deepEqual(validateRegistry(registry, root).errors, []);
});

test('existing tests cannot silently lose their entry point metadata', t => {
    const { root, registry, entry } = fixture(t);
    entry.suite = 'existing';
    assert.ok(validateRegistry(registry, root).errors.some(error => error.includes('Missing existing entry point')));
    entry.entryPoints = ['scratch/unknown_runner.mjs'];
    assert.ok(validateRegistry(registry, root).errors.some(error => error.includes('Unsupported entry point')));
});

test('traversal and shell-looking paths are rejected before execution', t => {
    const { root, registry, entry } = fixture(t);
    for (const invalid of ['scratch/../test_outside.mjs', 'scratch/test_x.mjs;echo bad', 'C:/test_x.mjs']) {
        entry.path = invalid;
        assert.ok(validateRegistry(registry, root).errors.some(error => error.includes('Invalid test path')));
        assert.throws(() => runTest(entry, root), /Invalid test path/);
    }
});

test('malformed registry fails closed', t => {
    const { root } = fixture(t);
    for (const registry of [null, {}, { schemaVersion: 2, tests: [] }]) {
        assert.equal(validateRegistry(registry, root).errors.length, 1);
    }
});

test('runner executes with repository cwd even when its path contains spaces', t => {
    const { root, write, entry } = fixture(t);
    const nested = path.join(root, 'repository with spaces');
    write('repository with spaces/scratch/test_example.mjs', 'console.log(process.cwd());');
    const result = runTest(entry, nested);
    assert.equal(result.status, 'PASS');
    assert.equal(result.output.trim(), nested);
});

test('nonzero exit is reported as failure with diagnostic output', t => {
    const { root, write, entry } = fixture(t);
    write(entry.path, 'console.error("deliberate failure"); process.exitCode = 7;');
    const result = runTest(entry, root);
    assert.equal(result.status, 'FAIL');
    assert.equal(result.exitCode, 7);
    assert.match(result.output, /deliberate failure/);
});

test('a hung test is timed out rather than reported as success', t => {
    const { root, write, entry } = fixture(t);
    write(entry.path, 'setInterval(() => {}, 1000);');
    assert.equal(runTest(entry, root, { timeoutMs: 200 }).status, 'TIMEOUT');
});

test('missing Python runtime is an error rather than a skipped pass', t => {
    const { root, write, entry } = fixture(t);
    entry.path = 'scratch/test_example.py';
    write(entry.path, 'print("ok")');
    const result = runTest(entry, root, { python: path.join(root, 'missing-python-executable') });
    assert.equal(result.status, 'ERROR');
    assert.notEqual(result.exitCode, 0);
});

test('CLI JSON distinguishes inventory validation from actual execution', () => {
    const script = fileURLToPath(new URL('./scratch_registry.mjs', import.meta.url));
    const child = spawnSync(process.execPath, [script, '--check', '--json'], {
        cwd: os.tmpdir(), encoding: 'utf8', shell: false, windowsHide: true,
    });
    assert.equal(child.status, 0, child.stderr || child.stdout);
    const report = JSON.parse(child.stdout);
    assert.equal(report.mode, '--check');
    assert.deepEqual(report.results, []);
    assert.equal(report.passed, 0);
    assert.equal(report.notRun, Object.values(report.counts).reduce((a, b) => a + b, 0));
});

test('CLI rejects unsupported suites instead of silently executing nothing', () => {
    const script = fileURLToPath(new URL('./scratch_registry.mjs', import.meta.url));
    const child = spawnSync(process.execPath, [script, '--run', 'existing'], {
        encoding: 'utf8', shell: false, windowsHide: true,
    });
    assert.equal(child.status, 2);
    assert.match(child.stderr, /Usage:/);
});
