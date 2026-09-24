import assert from "node:assert/strict";
import fs from "node:fs";
import attachWeb25DBoardRuntime, {
    attachWeb25DBoardRuntime as namedAttach,
    resolveWeb25DViewportProjection
} from "../game/src/ui/web25d_board_runtime_bridge.js";
import legacyAttach, {
    attachWeb25DValidationRuntime,
    resolveWeb25DViewportProjection as legacyProjection
} from "../game/src/ui/web25d_validation_runtime_bridge.js";

assert.equal(attachWeb25DBoardRuntime, namedAttach);
assert.equal(attachWeb25DValidationRuntime, attachWeb25DBoardRuntime);
assert.equal(legacyAttach, attachWeb25DBoardRuntime);
assert.equal(legacyProjection, resolveWeb25DViewportProjection);

assert.deepEqual(
    resolveWeb25DViewportProjection({ width: 584, height: 584, rows: 5, columns: 5 }),
    legacyProjection({ width: 584, height: 584, rows: 5, columns: 5 })
);

const indexSource = fs.readFileSync(new URL("../game/index.html", import.meta.url), "utf8");
assert.equal(indexSource.includes("attachWeb25DBoardRuntime"), true);
assert.equal(indexSource.includes("web25d_board_runtime_bridge.js"), true);
assert.equal(indexSource.includes("attachWeb25DValidationRuntime(ui)"), false);
assert.equal(indexSource.includes("web25d_validation_runtime_bridge.js?v="), false);

const productionSource = fs.readFileSync(
    new URL("../game/src/ui/web25d_board_runtime_bridge.js", import.meta.url),
    "utf8"
);
assert.equal(productionSource.includes("web25DBoardRuntime"), true);
assert.equal(productionSource.includes("web25dBoardCanvas"), true);
assert.equal(productionSource.includes("web25dValidationCanvas"), false);
assert.equal(productionSource.includes("web25DValidationRuntime = runtime"), true);
assert.equal(productionSource.includes("BoardPresentationData read model"), true);
assert.equal(productionSource.includes("state.grid"), false);

const compatibilitySource = fs.readFileSync(
    new URL("../game/src/ui/web25d_validation_runtime_bridge.js", import.meta.url),
    "utf8"
);
assert.equal(compatibilitySource.includes("Deprecated compatibility shim"), true);
assert.equal(compatibilitySource.includes("new Web25DPhaseFRenderer"), false);

console.log("✅ Web 2.5D production runtime boundary PASS");
