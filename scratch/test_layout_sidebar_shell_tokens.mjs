import assert from "node:assert/strict";
import fs from "node:fs";

const read = path => fs.readFileSync(new URL(path, import.meta.url), "utf8");

const tokensCss = read("../game/css/0_global_common/layout_tokens.css");
const sidebarCss = read("../game/css/4_right_sidebar/right_sidebar.css");

assert.ok(tokensCss.includes("--layout-right-sidebar-width"));
assert.ok(tokensCss.includes("--layout-right-sidebar-gap"));
assert.ok(tokensCss.includes("--layout-right-sidebar-padding-block"));
assert.ok(tokensCss.includes("--layout-right-sidebar-padding-inline"));

assert.ok(sidebarCss.includes("width: var(--layout-right-sidebar-width)"));
assert.ok(sidebarCss.includes("gap: var(--layout-right-sidebar-gap)"));
assert.ok(sidebarCss.includes("padding: var(--layout-right-sidebar-padding-block) var(--layout-right-sidebar-padding-inline)"));

assert.ok(!sidebarCss.includes("width: 280px"));
assert.ok(!sidebarCss.includes("gap: 14px"));
assert.ok(!sidebarCss.includes("padding: 14px 12px"));

console.log("Layout sidebar shell token ownership: PASS");
