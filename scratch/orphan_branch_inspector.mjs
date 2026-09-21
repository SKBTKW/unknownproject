import { execFileSync, spawnSync } from 'node:child_process';
import path from 'node:path';
import process from 'node:process';
import { fileURLToPath } from 'node:url';
import {
  ORPHAN_STATUS,
  classifyObservedBranch,
  isAoTTargetName,
  summarizeOrphanStatuses,
} from './orphan_branch_inspector_core.mjs';

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
    const detail = error?.stderr?.toString?.().trim();
    throw new Error(`git ${args.join(' ')} failed${detail ? `: ${detail}` : ''}`);
  }
}

function refExists(ref, cwd) {
  const result = spawnSync('git', ['show-ref', '--verify', '--quiet', ref], {
    cwd,
    windowsHide: true,
    stdio: 'ignore',
  });
  return result.status === 0;
}

function count(range, cwd) {
  return Number.parseInt(git(['rev-list', '--count', range], { cwd }), 10) || 0;
}

function parseArgs(argv) {
  const args = { target: '', json: false, noFetch: false };
  for (let i = 0; i < argv.length; i += 1) {
    const arg = argv[i];
    if (arg === '--target') args.target = argv[++i] || '';
    else if (arg === '--json') args.json = true;
    else if (arg === '--no-fetch') args.noFetch = true;
    else if (arg === '--help' || arg === '-h') args.help = true;
    else throw new Error(`Unknown argument: ${arg}`);
  }
  return args;
}

function listRefs(cwd) {
  const localRaw = git(['for-each-ref', '--format=%(refname:short) %(objectname)', 'refs/heads'], { cwd, allowFailure: true });
  const remoteRaw = git(['for-each-ref', '--format=%(refname:short) %(objectname)', 'refs/remotes/origin'], { cwd, allowFailure: true });
  const locals = new Map();
  const remotes = new Map();

  for (const line of localRaw.split(/\r?\n/).filter(Boolean)) {
    const space = line.lastIndexOf(' ');
    locals.set(line.slice(0, space), line.slice(space + 1));
  }
  for (const line of remoteRaw.split(/\r?\n/).filter(Boolean)) {
    const space = line.lastIndexOf(' ');
    const raw = line.slice(0, space);
    if (raw === 'origin/HEAD') continue;
    remotes.set(raw.replace(/^origin\//, ''), line.slice(space + 1));
  }
  return { locals, remotes };
}

function resolveTarget(explicit, cwd) {
  if (explicit) return explicit;
  const configured = git(['config', '--get', 'aot.authorizedBranch'], { cwd, allowFailure: true });
  if (configured) return configured;
  const current = git(['branch', '--show-current'], { cwd, allowFailure: true });
  if (isAoTTargetName(current)) return current;
  throw new Error('Target branch is ambiguous. Use --target AoTYYMMDD.');
}

export function inspectBranches({ cwd, target }) {
  if (!isAoTTargetName(target)) throw new Error(`Refusing non-AoT target: ${target}`);
  const targetRef = `origin/${target}`;
  if (!refExists(`refs/remotes/${targetRef}`, cwd)) throw new Error(`Missing ${targetRef}`);

  const { locals, remotes } = listRefs(cwd);
  const branches = [...new Set([...locals.keys(), ...remotes.keys()])].sort();
  const headGroups = new Map();

  for (const branch of branches) {
    const sha = remotes.get(branch) || locals.get(branch) || '';
    if (!sha) continue;
    if (!headGroups.has(sha)) headGroups.set(sha, []);
    headGroups.get(sha).push(branch);
  }

  return branches.map(branch => {
    const localSha = locals.get(branch) || '';
    const remoteSha = remotes.get(branch) || '';
    const compareRef = remoteSha ? `origin/${branch}` : branch;
    const ahead = count(`${targetRef}..${compareRef}`, cwd);
    const behind = count(`${compareRef}..${targetRef}`, cwd);
    const effectiveSha = remoteSha || localSha;
    const duplicateHeadBranches = (headGroups.get(effectiveSha) || []).filter(name => name !== branch);
    const classification = classifyObservedBranch({
      branch,
      target,
      ahead,
      behind,
      localSha,
      remoteSha,
      duplicateHeadBranches,
      protectedBranches: ['main'],
    });
    return {
      branch,
      localExists: Boolean(localSha),
      remoteExists: Boolean(remoteSha),
      localSha,
      remoteSha,
      ahead,
      behind,
      ...classification,
    };
  });
}

function printReport(target, items) {
  console.log('\n============================================================');
  console.log('🔎 AoT Orphan / Noncanonical Branch Inspector — READ ONLY');
  console.log(`Target: ${target}`);
  console.log('============================================================\n');

  for (const item of items) {
    if ([ORPHAN_STATUS.PROTECTED, ORPHAN_STATUS.CURRENT_TASK].includes(item.status)) continue;
    const icon = item.status === ORPHAN_STATUS.REVIEW_REQUIRED || item.status === ORPHAN_STATUS.LOCAL_REMOTE_MISMATCH ? '⛔' : '⚠️';
    console.log(`${icon} [${item.status}] ${item.branch}`);
    console.log(`   local=${item.localExists ? 'yes' : 'no'} remote=${item.remoteExists ? 'yes' : 'no'} ahead=${item.ahead} behind=${item.behind}`);
    for (const reason of item.reasons) console.log(`   - ${reason}`);
  }

  const summary = summarizeOrphanStatuses(items);
  console.log('\nSummary:', Object.entries(summary).map(([k,v]) => `${k}=${v}`).join(' '));
  console.log('No branches were modified or deleted.');
}

async function main() {
  const args = parseArgs(process.argv.slice(2));
  if (args.help) {
    console.log('Usage: node scratch/orphan_branch_inspector.mjs --target AoTYYMMDD [--json] [--no-fetch]');
    console.log('Read-only inspector. It never creates, merges, resets, or deletes branches.');
    return;
  }

  const cwd = git(['rev-parse', '--show-toplevel'], { cwd: process.cwd() });
  const target = resolveTarget(args.target, cwd);
  if (!args.noFetch) git(['fetch', 'origin', '--prune'], { cwd });

  const items = inspectBranches({ cwd, target });
  if (args.json) {
    console.log(JSON.stringify({ target, summary: summarizeOrphanStatuses(items), branches: items }, null, 2));
  } else {
    printReport(target, items);
  }
}

const isMain = process.argv[1] && path.resolve(process.argv[1]) === path.resolve(fileURLToPath(import.meta.url));
if (isMain) main().catch(error => {
  console.error(`\n❌ Orphan Branch Inspector aborted: ${error.message}`);
  process.exit(1);
});
