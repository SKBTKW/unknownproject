import { execFileSync, spawnSync } from 'child_process';
import path from 'path';
import process from 'process';
import readline from 'readline/promises';
import { fileURLToPath } from 'url';

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

export function extractTargets(refNames) {
    const targets = new Set();
    for (const rawName of refNames) {
        const name = rawName.replace(/^origin\//, '');
        const match = name.match(/^aot-task\/(AoT\d{6,})\//);
        if (match) targets.add(match[1]);
    }
    return [...targets].sort((a, b) => b.localeCompare(a, 'en'));
}

export function isCleanConfirmation(value) {
    return String(value ?? '').trim().toLowerCase() === 'clean';
}

function discoverTargets(cwd) {
    const raw = git([
        'for-each-ref',
        '--format=%(refname:short)',
        'refs/heads/aot-task/',
        'refs/remotes/origin/aot-task/',
    ], { cwd, allowFailure: true });
    const refs = raw ? raw.split(/\r?\n/).filter(Boolean) : [];
    return extractTargets(refs);
}

async function chooseTarget(targets) {
    if (targets.length === 0) return '';
    const rl = readline.createInterface({ input: process.stdin, output: process.stdout });
    try {
        console.log('掃除するTASKの対象を選択してください。\n');
        targets.forEach((target, index) => console.log(`${index + 1}. ${target}`));
        console.log('0. Cancel\n');

        while (true) {
            const answer = (await rl.question('番号: ')).trim();
            if (answer === '0' || answer === '') return '';
            const index = Number.parseInt(answer, 10);
            if (Number.isInteger(index) && index >= 1 && index <= targets.length) {
                return targets[index - 1];
            }
            console.log(`1〜${targets.length}、または0を入力してください。`);
        }
    } finally {
        rl.close();
    }
}

function runSweeper(cwd, args) {
    const scriptPath = path.join(cwd, 'scratch', 'task_sweeper.mjs');
    const result = spawnSync(process.execPath, [scriptPath, ...args], {
        cwd,
        stdio: 'inherit',
        windowsHide: false,
    });
    return result.status ?? 1;
}

async function requestCleanConfirmation(target) {
    const rl = readline.createInterface({ input: process.stdin, output: process.stdout });
    try {
        console.log(`\n選択中: ${target}`);
        const answer = await rl.question('SAFE項目を削除するなら clean と入力してください（大文字小文字は不問）。Enterでキャンセル: ');
        return isCleanConfirmation(answer);
    } finally {
        rl.close();
    }
}

async function main() {
    const cwd = git(['rev-parse', '--show-toplevel'], { cwd: process.cwd() });

    console.log('Refreshing origin refs...');
    git(['fetch', 'origin', '--prune'], { cwd });

    const targets = discoverTargets(cwd);
    if (targets.length === 0) {
        console.log('\nTASK branches: none');
        return;
    }

    const target = await chooseTarget(targets);
    if (!target) {
        console.log('\nCancelled. Nothing was deleted.');
        return;
    }

    const dryRunStatus = runSweeper(cwd, ['--target', target]);
    if (dryRunStatus !== 0) {
        throw new Error(`Task Sweeper dry run failed with code ${dryRunStatus}`);
    }

    if (!(await requestCleanConfirmation(target))) {
        console.log('\nCancelled. Nothing was deleted.');
        return;
    }

    const cleanupStatus = runSweeper(cwd, ['--target', target, '--execute', '--confirm', 'CLEAN']);
    if (cleanupStatus !== 0) {
        throw new Error(`Task Sweeper cleanup failed with code ${cleanupStatus}`);
    }
}

const isMain = process.argv[1] && path.resolve(process.argv[1]) === path.resolve(fileURLToPath(import.meta.url));
if (isMain) {
    main().catch((error) => {
        console.error(`\n❌ AoT Task Sweeper launcher aborted: ${error.message}`);
        process.exit(1);
    });
}
