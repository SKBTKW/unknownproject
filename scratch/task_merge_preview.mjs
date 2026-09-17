import { spawnSync } from 'child_process';

export const MERGE_PREVIEW_STATUS = Object.freeze({
    NOT_REQUIRED: 'NOT_REQUIRED',
    CLEAN: 'CLEAN',
    CONFLICT: 'CONFLICT',
    UNKNOWN: 'UNKNOWN',
});

function runGit(cwd, args) {
    const result = spawnSync('git', args, {
        cwd,
        encoding: 'utf8',
        windowsHide: true,
    });
    return {
        status: result.status,
        stdout: result.stdout || '',
        stderr: result.stderr || '',
        error: result.error || null,
        signal: result.signal || null,
    };
}

function failureReason(result, fallback) {
    if (result.error?.message) return result.error.message;
    const stderr = result.stderr.trim();
    if (stderr) return stderr.split(/\r?\n/)[0];
    if (result.signal) return `git terminated by ${result.signal}`;
    return fallback;
}

/**
 * Preview merging targetSha into headSha without moving refs or changing the
 * index/worktree. `git merge-tree --write-tree` may write unreachable Git
 * objects, but it does not update branch history or checkout state.
 */
export function previewMerge(cwd, targetSha, headSha = 'HEAD') {
    if (!cwd || !targetSha || !headSha) {
        return {
            status: MERGE_PREVIEW_STATUS.UNKNOWN,
            conflictPaths: [],
            mergeTreeSha: '',
            reason: 'merge preview requires cwd, target SHA, and head SHA',
        };
    }

    const containment = runGit(cwd, ['merge-base', '--is-ancestor', targetSha, headSha]);
    if (containment.status === 0) {
        return {
            status: MERGE_PREVIEW_STATUS.NOT_REQUIRED,
            conflictPaths: [],
            mergeTreeSha: '',
            reason: 'Latest target is already contained in TASK HEAD.',
        };
    }
    if (containment.status !== 1) {
        return {
            status: MERGE_PREVIEW_STATUS.UNKNOWN,
            conflictPaths: [],
            mergeTreeSha: '',
            reason: failureReason(containment, `merge-base failed with status ${containment.status}`),
        };
    }

    const result = runGit(cwd, [
        'merge-tree',
        '--write-tree',
        '--name-only',
        '--no-messages',
        '-z',
        headSha,
        targetSha,
    ]);
    const fields = result.stdout.split('\0').filter(Boolean);
    const mergeTreeSha = fields[0] || '';
    const conflictPaths = [...new Set(fields.slice(1))];

    if (result.status === 0) {
        return {
            status: MERGE_PREVIEW_STATUS.CLEAN,
            conflictPaths: [],
            mergeTreeSha,
            reason: 'Virtual three-way merge completed without content conflicts.',
        };
    }
    if (result.status === 1) {
        return {
            status: MERGE_PREVIEW_STATUS.CONFLICT,
            conflictPaths,
            mergeTreeSha,
            reason: 'Virtual three-way merge detected Git conflicts.',
        };
    }
    return {
        status: MERGE_PREVIEW_STATUS.UNKNOWN,
        conflictPaths: [],
        mergeTreeSha,
        reason: failureReason(result, `merge-tree failed with status ${result.status}`),
    };
}
