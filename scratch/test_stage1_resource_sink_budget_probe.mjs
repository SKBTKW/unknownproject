import assert from "node:assert/strict";
import {
    projectStage1SinkBudget,
    resolveRequiredPreTrialSpendShare,
    resolveTotalSpendShare,
    STAGE1_SINK_BUDGET_BANDS,
    STAGE1_V15_BASELINE_ENVELOPE_20260924
} from "./stage1_resource_sink_budget_probe.mjs";

assert.equal(
    Number(resolveRequiredPreTrialSpendShare({
        targetTotalSpendShare: 0.70,
        deploymentSpendShare: 0.40
    }).toFixed(2)),
    0.50
);
assert.equal(
    Number(resolveRequiredPreTrialSpendShare({
        targetTotalSpendShare: 0.75,
        deploymentSpendShare: 0.45
    }).toFixed(4)),
    0.5455
);
assert.equal(
    Number(resolveRequiredPreTrialSpendShare({
        targetTotalSpendShare: 0.80,
        deploymentSpendShare: 0.50
    }).toFixed(2)),
    0.60
);

console.log("=== Stage1 Resource Sink Budget Probe ===");
for (const band of STAGE1_SINK_BUDGET_BANDS) {
    const preTrialSpendShare = resolveRequiredPreTrialSpendShare(band);
    const total = resolveTotalSpendShare({
        preTrialSpendShare,
        deploymentSpendShare: band.deploymentSpendShare
    });
    assert.ok(Math.abs(total - band.targetTotalSpendShare) < 1e-9);

    console.log(
        `${band.id}: preTrial=${(preTrialSpendShare * 100).toFixed(1)}% deployment=${(band.deploymentSpendShare * 100).toFixed(1)}% total=${(total * 100).toFixed(1)}%`
    );

    for (const sample of STAGE1_V15_BASELINE_ENVELOPE_20260924) {
        const row = projectStage1SinkBudget({
            sample,
            preTrialSpendShare,
            deploymentSpendShare: band.deploymentSpendShare
        });
        assert.ok(row.finalFood >= 0);
        assert.ok(row.finalMaterial >= 0);
        console.log(
            [
                band.id,
                sample.id,
                `baseline=🌾${row.baselineFood}/🧱${row.baselineMaterial}`,
                `preTrialSpend=🌾${row.preTrialFoodSpend}/🧱${row.preTrialMaterialSpend}`,
                `beforeTrial=🌾${row.foodBeforeDeployment}/🧱${row.materialBeforeDeployment}`,
                `deploymentSpend=🌾${row.deploymentFoodSpend}/🧱${row.deploymentMaterialSpend}`,
                `final=🌾${row.finalFood}/🧱${row.finalMaterial}`
            ].join(" ")
        );
    }
}

console.log("test_stage1_resource_sink_budget_probe: PASS");
