import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import {
    buildUnityRuntimeFixtureSet,
    checkUnityRuntimeFixtures,
    writeUnityRuntimeFixtures
} from "./unity_runtime_fixture_tool.mjs";

const fixtureSet = buildUnityRuntimeFixtureSet();
assert.deepEqual(
    Object.keys(fixtureSet).sort(),
    [
        "unity_board_input_select_cell_v1.json",
        "unity_runtime_contract_manifest_v1.json",
        "unity_runtime_handoff_v1.json",
        "unity_trial_board_input_matrix_v1.json",
        "unity_trial_runtime_handoff_v1.json"
    ].sort()
);

const repositoryCheck = checkUnityRuntimeFixtures();
assert.equal(repositoryCheck.ok, true);
assert.deepEqual(repositoryCheck.mismatches, []);

const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), "aot-unity-fixtures-"));
try {
    const writeResult = writeUnityRuntimeFixtures({ fixtureDir: tempDir });
    assert.equal(writeResult.written, 5);

    const tempCheck = checkUnityRuntimeFixtures({ fixtureDir: tempDir });
    assert.equal(tempCheck.ok, true);
    assert.deepEqual(tempCheck.mismatches, []);

    fs.writeFileSync(
        path.join(tempDir, "unity_board_input_select_cell_v1.json"),
        "{}\n",
        "utf8"
    );
    const drift = checkUnityRuntimeFixtures({ fixtureDir: tempDir });
    assert.equal(drift.ok, false);
    assert.deepEqual(drift.mismatches, ["unity_board_input_select_cell_v1.json"]);
} finally {
    fs.rmSync(tempDir, { recursive: true, force: true });
}

console.log("✅ Unity runtime fixture generator PASS");
