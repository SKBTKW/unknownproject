import assert from "node:assert/strict";
import {
    INVESTIGATION_CATEGORIES,
    WORLD_DISCOVERY_CATEGORIES,
    isThreatInvestigationCategory,
    isWorldDiscoveryCategory,
    resolveInvestigationDomain,
    routeInvestigationRequest,
    createFollowUpInvestigationHandoff
} from "../game/src/investigation/systems/investigation_composition_router.js";
import { createDiscoveryLedger } from "../game/src/investigation/domain/world_discovery.js";
import { createKnownEnemyState } from "../game/src/warning/domain/known_enemy_state.js";

console.log("\n🧪 Running Investigation Composition Router Contract Tests...");

// 1. Categories
assert.equal(isThreatInvestigationCategory("THREAT"), true);
assert.equal(isThreatInvestigationCategory("TERRAIN"), false);
assert.equal(isWorldDiscoveryCategory("TERRAIN"), true);
assert.equal(isWorldDiscoveryCategory("RESOURCE"), true);
assert.equal(isWorldDiscoveryCategory("WATER"), true);
assert.equal(isWorldDiscoveryCategory("RUIN"), true);
assert.equal(isWorldDiscoveryCategory("NATURAL_HERITAGE"), true);
assert.equal(isWorldDiscoveryCategory("THREAT"), false);

// 2. Domain resolution
assert.equal(resolveInvestigationDomain("THREAT"), "ENEMY_INVESTIGATION");
assert.equal(resolveInvestigationDomain("RUIN"), "WORLD_DISCOVERY");
assert.equal(resolveInvestigationDomain("UNKNOWN"), null);

// 3. Routing requests
const threatReq = routeInvestigationRequest({
    category: "THREAT",
    sourceType: "FOOTPRINTS",
    phase: "BASIC"
});
assert.equal(threatReq.domain, "ENEMY_INVESTIGATION");
assert.equal(threatReq.category, "THREAT");

const worldReq = routeInvestigationRequest({
    category: "RUIN",
    sourceType: "ANCIENT_ARCHIVE",
    phase: "BASIC"
});
assert.equal(worldReq.domain, "WORLD_DISCOVERY");
assert.equal(worldReq.category, "RUIN");

assert.throws(() => routeInvestigationRequest({ category: "INVALID" }), /UNKNOWN_INVESTIGATION_CATEGORY/);
assert.throws(() => routeInvestigationRequest({}), /INVESTIGATION_CATEGORY_REQUIRED/);

// 4. Follow-up handoff with shared CheckResult
const checkResult = { diceRoll: 10, success: true, margin: 2 };
const handoff = createFollowUpInvestigationHandoff({
    category: "RUIN",
    parentReportId: "report-1",
    checkResult
});
assert.equal(handoff.domain, "WORLD_DISCOVERY");
assert.equal(handoff.parentReportId, "report-1");
assert.deepEqual(handoff.checkResult, checkResult);
// CheckResult must be an immutable deep clone
checkResult.diceRoll = 999;
assert.equal(handoff.checkResult.diceRoll, 10);

// 5. Authority separation verification
const knownEnemy = createKnownEnemyState();
const ledger = createDiscoveryLedger();
assert.equal(Array.isArray(knownEnemy.reports), true);
assert.equal(ledger.schemaVersion, 1);
assert.equal(Array.isArray(ledger.reports), true);
// Authorities have different schema and properties
assert.equal(knownEnemy.schemaVersion, undefined);
assert.equal(ledger.observedTags, undefined);

console.log("✅ Investigation Composition Router Contract Tests PASS\n");
