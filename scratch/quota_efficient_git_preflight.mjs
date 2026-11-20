import { execFileSync } from 'node:child_process';
import path from 'node:path';
import process from 'node:process';
import { fileURLToPath } from 'node:url';

const SCRIPT_PATH = fileURLToPath(import.meta.url);

function git(args, cwd, { allowFailure = false } = {}) {
    try {
        return execFileSync('git', args, { cwd, encoding: 'utf8', windowsHide: true }).trim();
    } catch (error) {
        if (allowFailure) return null;
        throw error;
    }
}

export function summarizeNumstat(output) {
    const rows = output.trim() ? output.trim().split(/\r?\n/) : [];
    return rows.reduce((summary, row) => {
        const [added, deleted] = row.split('\t');
        summary.files += 1;
        if (added === '-' || deleted === '-') summary.binaryFiles += 1;
        else {
            summary.insertions += Number(added);
            summary.deletions += Number(deleted);
        }
        return summary;
    }, { files: 0, insertions: 0, deletions: 0, binaryFiles: 0 });
}

function parseArgs(argv) {
    const result = { json: false };
    for (let index = 0; index < argv.length; index += 1) {
        if (argv[index] === '--json') {
            result.json = true;
            continue;
        }
        const value = argv[index + 1];
        if (!value) throw new Error(`MISSING_VALUE:${argv[index]}`);
        result[argv[index].replace(/^--/, '')] = value;
        index += 1;
    }
    if (!result.target || !result.task) throw new Error('USAGE: --target <branch> --task <branch> [--json]');
    return result;
}

export function inspectGitPreflight(repoRoot, { target, task }) {
    const targetRef = `origin/${target}`;
    const taskRef = task.startsWith('origin/') ? task : `origin/${task}`;
    const targetSha = git(['rev-parse', targetRef], repoRoot);
    const taskSha = git(['rev-parse', taskRef], repoRoot);
    const ancestor = git(['merge-base', '--is-ancestor', targetRef, taskRef], repoRoot, { allowFailure: true }) !== null;
    return {
        schemaVersion: 1,
        mutation: 'NONE',
        currentBranch: git(['rev-parse', '--abbrev-ref', 'HEAD'], repoRoot),
        worktreeClean: git(['status', '--porcelain'], repoRoot) === '',
        target: { branch: target, ref: targetRef, sha: targetSha },
        task: { branch: task.replace(/^origin\//, ''), ref: taskRef, sha: taskSha },
        mergeBase: git(['merge-base', targetRef, taskRef], repoRoot),
        targetContained: ancestor,
        taskTree: git(['rev-parse', `${taskRef}^{tree}`], repoRoot),
        change: summarizeNumstat(git(['diff', '--numstat', `${targetRef}...${taskRef}`], repoRoot)),
    };
}

async function main() {
    const args = parseArgs(process.argv.slice(2));
    const repoRoot = git(['rev-parse', '--show-toplevel'], process.cwd());
    const report = inspectGitPreflight(repoRoot, args);
    if (args.json) {
        console.log(JSON.stringify(report));
        return;
    }
    console.log(`Git preflight: ${report.worktreeClean && report.targetContained ? 'READY' : 'BLOCKED'}`);
    console.log(`target ${report.target.branch}: ${report.target.sha}`);
    console.log(`task ${report.task.branch}: ${report.task.sha}`);
    console.log(`tree: ${report.taskTree}`);
    console.log(`change: ${report.change.files} files, +${report.change.insertions}/-${report.change.deletions}, binary ${report.change.binaryFiles}`);
    console.log(`clean: ${report.worktreeClean}; target contained: ${report.targetContained}; mutation: NONE`);
    if (!report.worktreeClean || !report.targetContained) process.exitCode = 1;
}

if (process.argv[1] && path.resolve(process.argv[1]) === SCRIPT_PATH) {
    main().catch((error) => {
        console.error(`Git preflight failed: ${error.message}`);
        process.exitCode = 1;
    });
}
