const TARGET_PATTERN = /^AoT\d{6}$/;
const SEGMENT_PATTERN = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;

export function isCanonicalTaskBranch(branch, target) {
    if (!TARGET_PATTERN.test(target)) return false;
    const prefix = `aot-task/${target}/`;
    if (!branch.startsWith(prefix)) return false;
    const parts = branch.slice(prefix.length).split('/');
    return parts.length === 2 && parts.every((part) => SEGMENT_PATTERN.test(part));
}

export function expectedTaskBranchPattern(target) {
    return `aot-task/${target}/<domain>/<task-id>`;
}
