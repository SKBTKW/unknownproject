import assert from 'node:assert/strict';
import fs from 'node:fs';
import { spawnSync } from 'node:child_process';

const ROOT = new URL('../', import.meta.url);
const read = path => fs.readFileSync(new URL(path, ROOT), 'utf8');

const checks = [
    ['Phase A projection / hit-test', 'scratch/web25d_phase_a_validation.mjs'],
    ['Canvas logical input', 'scratch/web25d_canvas_renderer_validation.mjs'],
    ['Phase B elevation / greenery', 'scratch/web25d_phase_b_visual_validation.mjs'],
    ['Board action gateway', 'scratch/web25d_board_action_gateway_validation.mjs'],
    ['2D / 2.5D Trial input semantics', 'scratch/test_trial_2d_25d_input_semantics.mjs'],
    ['Phase E Zone / Link', 'scratch/web25d_phase_e_zone_link_validation.mjs'],
    ['Phase F tactical visuals', 'scratch/web25d_phase_f_tactical_visual_validation.mjs']
];

console.log('\n--- Web 2.5D A-F Integration Validation ---');

for (const [label, path] of checks) {
    assert.ok(fs.existsSync(new URL(path, ROOT)), `missing validation script: ${path}`);
    const result = spawnSync(process.execPath, [path], {
        cwd: new URL('.', ROOT),
        stdio: 'inherit'
    });
    assert.equal(result.status, 0, `${label} validation failed`);
}

const runtimeBridge = read('game/src/ui/web25d_validation_runtime_bridge.js');
const phaseF = read('game/src/presentation/web25d_phase_f_renderer.js');
const presentationData = read('game/src/presentation/board_presentation_data_service.js');

assert.match(runtimeBridge, /Web25DPhaseFRenderer/, 'runtime must be wired to the Phase F renderer');
assert.doesNotMatch(phaseF, /\bGameState\b|\bTrialState\b/, 'Phase F renderer must not read GameState or TrialState directly');
assert.match(phaseF, /readModel\?\.trial\?\.available/, 'Phase F renderer must honor presentation-filtered Trial availability');

for (const forbidden of ['screenX', 'screenY', 'worldX', 'worldY', 'worldZ', 'zIndex', 'meshHeight', 'elevationPixelHeight']) {
    assert.ok(!presentationData.includes(forbidden), `portable BoardPresentationData must not expose renderer-local field: ${forbidden}`);
}

console.log('WEB25D_A_TO_F_INTEGRATION_VALIDATION_OK');
