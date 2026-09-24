import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const workflowPath = new URL('../.github/workflows/full-inspection.yml', import.meta.url);
const source = readFileSync(workflowPath, 'utf8').replace(/\r\n/g, '\n');
const runnerPath = new URL('./run_full_inspection.mjs', import.meta.url);
const runnerSource = readFileSync(runnerPath, 'utf8').replace(/\r\n/g, '\n');
const scratchValidationPath = new URL('../.github/workflows/scratch-validation.yml', import.meta.url);
const scratchValidationSource = readFileSync(scratchValidationPath, 'utf8').replace(/\r\n/g, '\n');

let passed = 0;
function check(condition, label) {
    assert.equal(Boolean(condition), true, label);
    passed += 1;
    console.log(`  PASS: ${label}`);
}

check(/\bon:\s*\n[\s\S]*?\bpull_request:\s*\n\s*branches:/m.test(source), 'pull_request trigger is preserved');
check(/\bpush:\s*\n\s*branches:\s*\n\s*- ["']AoT\*["']/m.test(source), 'AoT target push trigger is enabled');
check((source.match(/- ["']AoT\*["']/g) || []).length >= 2, 'both PR and push are restricted to AoT targets');
check(source.includes("github.event_name == 'pull_request'") && source.includes('github.event.pull_request.number') && source.includes('github.ref_name'), 'concurrency key is event-aware');
check(/- name: Validate TASK branch contract\n\s*if: github\.event_name == 'pull_request'/m.test(source), 'TASK branch contract runs only for PR events');
check(/- name: Prepare AoT PR inspection state\n\s*if: github\.event_name == 'pull_request'/m.test(source), 'PR preparation is isolated to PR events');
check(/- name: Prepare AoT target push inspection state\n\s*if: github\.event_name == 'push'/m.test(source), 'target preparation is isolated to push events');
check(source.includes('AOT_TARGET_BRANCH: ${{ github.ref_name }}') && source.includes('AOT_TARGET_SHA: ${{ github.sha }}'), 'push inspection binds branch and exact event SHA');
check(source.includes('REMOTE_TARGET_SHA="$(git rev-parse "origin/${AOT_TARGET_BRANCH}")"') && source.includes('"${REMOTE_TARGET_SHA}" != "${AOT_TARGET_SHA}"'), 'push inspection fails closed if target advances');
check(source.includes('git config --local aot.workMode DIRECT') && source.includes('git branch --set-upstream-to="origin/${AOT_TARGET_BRANCH}"'), 'post-merge inspection uses DIRECT same-name target tracking');
check(source.includes('test -z "$(git status --porcelain)"') && source.includes('node scratch/run_full_inspection.mjs'), 'post-merge inspection requires a clean tree and delegates tests to the canonical runner');
check(!source.includes('Run Task Sweeper safety contract') && !source.includes('Run Trial runtime focused tests') && !source.includes('Run Advisor dialogue focused tests'), 'workflow does not duplicate focused tests owned by the canonical runner');
check(runnerSource.includes('scratch/test_full_inspection_workflow_contract.mjs') && runnerSource.includes('scratch/test_task_sweeper.mjs') && runnerSource.includes('game/src/trial/dev/diagnose_trial_launch_coordinator.mjs'), 'canonical runner owns workflow contract, safety, and focused runtime checks');
check(/pull_request:\s*\n\s*branches:\s*\[main\]/m.test(scratchValidationSource) && /push:\s*\n\s*branches:\s*\[main\]/m.test(scratchValidationSource) && !scratchValidationSource.includes('AoT*'), 'standalone scratch validation is main-only so AoT does not execute supplemental tests twice');

console.log(`Full Inspection workflow contract: ${passed}/11 PASS`);