import assert from "node:assert/strict";
import {
    evaluateDeploymentProfileAgainstSamples,
    summarizeDeploymentBalanceRows,
    STAGE1_TRIAL1_AUDIT_ENVELOPE_20260923,
    STAGE1_TRIAL1_PROBE_PLANS,
    UNRESOLVED_DEPLOYMENT_PROFILE
} from "./trial_deployment_balance_probe.mjs";

{
    const unresolved = evaluateDeploymentProfileAgainstSamples({
        profile: UNRESOLVED_DEPLOYMENT_PROFILE,
        samples: STAGE1_TRIAL1_AUDIT_ENVELOPE_20260923,
        plans: STAGE1_TRIAL1_PROBE_PLANS
    });
    assert.equal(unresolved.success, false);
    assert.equal(unresolved.reason, "PROFILE_UNRESOLVED");
}

{
    const experimental = {
        status: "RESOLVED",
        food: {
            base: 0,
            perDefense: 1,
            perDistance: 2
        },
        material: {
            base: 0,
            perDefense: 0.5,
            perDistance: 1
        }
    };

    const result = evaluateDeploymentProfileAgainstSamples({
        profile: experimental,
        samples: STAGE1_TRIAL1_AUDIT_ENVELOPE_20260923,
        plans: STAGE1_TRIAL1_PROBE_PLANS
    });
    assert.equal(result.success, true);
    assert.equal(result.rows.length, 6);
    assert.equal(result.rows.every(row => row.affordable), true);

    const summary = summarizeDeploymentBalanceRows(result.rows);
    assert.equal(summary.rowCount, 6);
    assert.equal(summary.affordableCount, 6);
    assert.ok(summary.maxFoodSharePct > 0);
    assert.ok(summary.maxMaterialSharePct > 0);

    console.log("=== Trial Deployment Balance Probe / Stage1 audit envelope ===");
    for (const row of result.rows) {
        console.log(
            [
                row.sampleId,
                row.planId,
                `def=${row.requestedDefense}/${row.defenseAvailable}`,
                `dist=${row.distance}`,
                `food=${row.foodCost}/${row.foodAvailable} (${row.foodSharePct.toFixed(1)}%)`,
                `mat=${row.materialCost}/${row.materialAvailable} (${row.materialSharePct.toFixed(1)}%)`,
                `affordable=${row.affordable}`
            ].join(" ")
        );
    }
}

console.log("test_trial_deployment_balance_probe: PASS");
