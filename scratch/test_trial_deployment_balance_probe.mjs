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
    const experiments = [
        {
            id: "LIGHT",
            profile: {
                status: "RESOLVED",
                food: { base: 0, perDefense: 1, perDistance: 2 },
                material: { base: 0, perDefense: 0.5, perDistance: 1 }
            }
        },
        {
            id: "MEDIUM",
            profile: {
                status: "RESOLVED",
                food: { base: 0, perDefense: 2, perDistance: 4 },
                material: { base: 0, perDefense: 1, perDistance: 2 }
            }
        },
        {
            id: "HEAVY",
            profile: {
                status: "RESOLVED",
                food: { base: 0, perDefense: 4, perDistance: 6 },
                material: { base: 0, perDefense: 2, perDistance: 3 }
            }
        }
    ];

    console.log("=== Trial Deployment Balance Probe / Stage1 audit envelope ===");
    const summaries = [];
    for (const experiment of experiments) {
        const result = evaluateDeploymentProfileAgainstSamples({
            profile: experiment.profile,
            samples: STAGE1_TRIAL1_AUDIT_ENVELOPE_20260923,
            plans: STAGE1_TRIAL1_PROBE_PLANS
        });
        assert.equal(result.success, true);
        assert.equal(result.rows.length, 6);

        const summary = summarizeDeploymentBalanceRows(result.rows);
        summaries.push({ id: experiment.id, ...summary });

        console.log(
            `${experiment.id}: affordable=${summary.affordableCount}/${summary.rowCount} maxFood=${summary.maxFoodSharePct.toFixed(1)}% maxMat=${summary.maxMaterialSharePct.toFixed(1)}%`
        );
        for (const row of result.rows) {
            console.log(
                [
                    experiment.id,
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

    assert.equal(
        summaries.every(summary => summary.affordableCount === summary.rowCount),
        true,
        "all three experiment bands remain affordable against the current Stage1 observed envelope"
    );
    assert.ok(summaries[1].maxFoodSharePct > summaries[0].maxFoodSharePct);
    assert.ok(summaries[2].maxFoodSharePct > summaries[1].maxFoodSharePct);
    assert.ok(summaries[1].maxMaterialSharePct > summaries[0].maxMaterialSharePct);
    assert.ok(summaries[2].maxMaterialSharePct > summaries[1].maxMaterialSharePct);
}

console.log("test_trial_deployment_balance_probe: PASS");
