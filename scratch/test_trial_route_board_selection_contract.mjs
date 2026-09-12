import assert from "node:assert/strict";
import fs from "node:fs";

const read = path => fs.readFileSync(new URL(path, import.meta.url), "utf8");

const runtimeBridge = read("../game/src/ui/trial_action_tray_runtime_bridge.js");
const routeBridge = read("../game/src/ui/trial_route_board_selection_bridge.js");
const routeCss = read("../game/css/2_center_area/trial_route_board_selection.css");
const indexHtml = read("../game/index.html");

assert.ok(runtimeBridge.includes("attachTrialRouteBoardSelection"), "Trial runtime attaches Board route selection");
assert.ok(routeBridge.includes("trial-route-entry-selector"), "Board route selector marker is created");
assert.ok(routeBridge.includes("selectTrialRoute"), "Board selector delegates to existing Trial route selection logic");
assert.ok(routeBridge.includes("event.stopPropagation()"), "Route selector click does not also select an interception cell");
assert.ok(indexHtml.includes("trial_route_board_selection.css"), "Board route selector stylesheet is loaded");
assert.ok(routeCss.includes(".trial-route-entry-selector"), "Board route selector has dedicated presentation styles");
assert.ok(routeCss.includes(".trial-route-list .trial-route-item"), "Legacy right route list is presented as summary during migration");

console.log("Trial Board route selection contract: PASS");
