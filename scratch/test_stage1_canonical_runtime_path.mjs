import assert from "node:assert/strict";
import fs from "node:fs";
import { spawnSync } from "node:child_process";

const e2ePath = new URL("./test_stage1_e2e.mjs", import.meta.url);
const source = fs.readFileSync(e2ePath, "utf8");

// This gate owns orchestration and evidence only. It must never force canonical
// progression by mutating the authorities it is supposed to inspect.
const forbiddenWrites = [
    /state\.stage\s*=\s*/,
    /state\.stage\.id\s*=\s*/,
    /state\.nextTrialTurn\s*=\s*/,
    /warningStateService\.[A-Za-z0-9_]+\s*=\s*/,
    /trueEnemyStateService\.[A-Za-z0-9_]+\s*=\s*/,
    /trialController\.state\.[A-Za-z0-9_]+\s*=\s*/
];

for (const pattern of forbiddenWrites) {
    assert.equal(
        pattern.test(source),
        false,
        `Stage1 E2E must not force canonical progression via ${pattern}`
    );
}

for (const required of [
    "GameEngine.createGame",
    "engine.nextTurn()",
    "engine.executeInvestigationCard",
    "attachTrialRuntimeSubsystems",
    "attachTrialLaunchSubsystem",
    "engine.retryPendingTrialLaunch",
    "trialController.confirmInterceptionPlan",
    "trialController.activateInterceptionPlan",
    "trialController.completeTrial",
    "trialController.settleTrialResult",
    "completeAfterPresentationCleanup",
    "engine.postTrialProgressionService?.canResumeNormalProgression"
]) {
    assert.ok(
        source.includes(required),
        `Stage1 E2E canonical path is missing required public boundary: ${required}`
    );
}

const result = spawnSync(process.execPath, [e2ePath.pathname], {
    cwd: process.cwd(),
    stdio: "inherit",
    encoding: "utf8"
});

if (result.error) throw result.error;
assert.equal(
    result.status,
    0,
    `Stage1 canonical runtime path blocked with exit code ${result.status}`
);

console.log("PASS Stage1 canonical runtime path gate");
