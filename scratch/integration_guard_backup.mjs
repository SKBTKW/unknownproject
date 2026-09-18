import { createHash } from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import { execFileSync } from 'node:child_process';
import { mkdtempSync, rmSync } from 'node:fs';

function git(cwd, ...args) {
  return execFileSync('git', args, {
    cwd,
    encoding: 'utf8',
    windowsHide: true,
    stdio: ['ignore', 'pipe', 'pipe'],
  }).trim();
}

function sha256File(filepath) {
  const hash = createHash('sha256');
  hash.update(fs.readFileSync(filepath));
  return hash.digest('hex');
}

function listBundleHeads(cwd, bundlePath) {
  const output = git(cwd, 'bundle', 'list-heads', bundlePath);
  const heads = new Map();
  for (const line of output.split(/\r?\n/).filter(Boolean)) {
    const [sha, ...nameParts] = line.trim().split(/\s+/);
    heads.set(nameParts.join(' '), sha);
  }
  return heads;
}

export function verifyBundleRestorable(bundlePath, requiredShas) {
  const verifyParent = mkdtempSync(path.join(os.tmpdir(), 'aot-integration-backup-verify-'));
  const verifyRepo = path.join(verifyParent, 'mirror.git');
  try {
    execFileSync('git', ['clone', '--mirror', '-q', bundlePath, verifyRepo], {
      windowsHide: true,
      stdio: 'ignore',
    });
    const missing = [];
    for (const sha of requiredShas) {
      try {
        execFileSync('git', ['cat-file', '-e', `${sha}^{commit}`], {
          cwd: verifyRepo,
          windowsHide: true,
          stdio: 'ignore',
        });
      } catch {
        missing.push(sha);
      }
    }
    if (missing.length > 0) throw new Error(`Backup restore verification failed; missing commit(s): ${missing.join(', ')}`);
    return true;
  } finally {
    rmSync(verifyParent, { recursive: true, force: true });
  }
}

export function createVerifiedBackup({
  cwd, backupRoot, repoName, target, targetSha, tasks, worktrees, sessionId, createdAt = new Date(),
}) {
  const sessionDir = path.join(backupRoot, repoName, target, sessionId);
  fs.mkdirSync(sessionDir, { recursive: true });
  const bundlePath = path.join(sessionDir, `${repoName}.bundle`);
  const manifestPath = path.join(sessionDir, 'manifest.json');
  const checksumPath = path.join(sessionDir, 'SHA256SUM.txt');
  const failurePath = path.join(sessionDir, 'BACKUP_FAILED.txt');

  try {
    git(cwd, 'bundle', 'create', bundlePath, '--all');
    git(cwd, 'bundle', 'verify', bundlePath);
    const bundleHeads = listBundleHeads(cwd, bundlePath);
    const requiredShas = [targetSha, ...tasks.map((task) => task.sha)].filter(Boolean);
    verifyBundleRestorable(bundlePath, requiredShas);

    const bundleSha256 = sha256File(bundlePath);
    const manifest = {
      schemaVersion: 1,
      sessionId,
      createdAt: createdAt.toISOString(),
      target,
      targetSha,
      tasks: tasks.map((task) => ({ branch: task.branch, sha: task.sha, source: task.source })),
      worktrees: worktrees.map((entry) => ({
        path: entry.path,
        branch: entry.branch,
        locked: Boolean(entry.locked),
        prunable: Boolean(entry.prunable),
      })),
      bundle: {
        filename: path.basename(bundlePath),
        sha256: bundleSha256,
        headCount: bundleHeads.size,
        verified: true,
        restoreVerified: true,
      },
    };
    fs.writeFileSync(manifestPath, `${JSON.stringify(manifest, null, 2)}\n`, 'utf8');
    fs.writeFileSync(checksumPath, `${bundleSha256}  ${path.basename(bundlePath)}\n`, 'utf8');
    return { sessionDir, bundlePath, manifestPath, checksumPath, failurePath, bundleSha256, manifest };
  } catch (error) {
    try {
      fs.writeFileSync(failurePath, `${new Date().toISOString()}\n${error?.stack || error?.message || String(error)}\n`, 'utf8');
    } catch {}
    throw error;
  }
}
