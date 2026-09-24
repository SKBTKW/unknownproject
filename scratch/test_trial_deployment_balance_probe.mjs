import { GameEngine } from "../game/src/core/game_engine.js";
import assert from "node:assert/strict";
import {
    evaluateDeploymentProfileAgainstSamples,
    evaluateFirstRunBurdenAgainstSamples,
    resolveFirstRunBurdenShare,
    summarizeDeploymentBalanceRows,
    STAGE1_TRIAL1_AUDIT_ENVELOPE_20260923,
    STAGE1_TRIAL1_PROBE_PLANS,
    UNRESOLVED_DEPLOYMENT_PROFILE
} from "./trial_deployment_balance_probe.mjs";

{
    const liveStage1Engine = GameEngine.createGame({ runSeed: 20260924, firstRun: true });
    assert.equal(liveStage1Engine.trialDeploymentAttachment?.success, true);
    assert.equal(typeof liveStage1Engine.trialDeploymentService?.previewPlan, "function");
    console.log("LIVE_STAGE1_DEPLOYMENT_PROFILE=FIRST_RUN_TRIAL1_RELATIVE_V1");

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
        assert.equal(result.rows.length, 8);

        const summary = summarizeDeploymentBalanceRows(result.rows);
        summaries.push({ id: experiment.id, ...summary });

        console.log(
            `${experiment.id}: affordable=${summary.affordableCount}/${summary.rowCount} maxFood=${summary.maxFoodSharePct.toFixed(1)}% maxMat=${summary.maxMaterialSharePct.toFixed(1)}% minRemaining=🌾${summary.minFoodRemaining}/🧱${summary.minMaterialRemaining}`
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
                    `remaining=🌾${row.foodRemaining}/🧱${row.materialRemaining}`,
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


{
    const firstRun = evaluateFirstRunBurdenAgainstSamples({
        samples: STAGE1_TRIAL1_AUDIT_ENVELOPE_20260923,
        plans: STAGE1_TRIAL1_PROBE_PLANS
    });
    assert.equal(firstRun.success, true);
    assert.equal(firstRun.rows.length, 8);

    console.log("=== FirstRun Deployment Burden Probe ===");
    for (const row of firstRun.rows) {
        console.log(
            [
                row.sampleId,
                row.planId,
                `def=${row.requestedDefense}/${row.defenseAvailable}`,
                `dist=${row.distance}`,
                `share=${(row.burdenShare * 100).toFixed(1)}%`,
                `cost=🌾${row.foodCost}/🧱${row.materialCost}`,
                `remaining=🌾${row.foodRemaining}/🧱${row.materialRemaining}`
            ].join(" ")
        );
    }

    const heavyMin = firstRun.rows.find(row =>
        row.sampleId === "V15_MIN_OBSERVED"
        && row.planId === "HEAVY_DEFENSE_FAR"
    );
    const allMin = firstRun.rows.find(row =>
        row.sampleId === "V15_MIN_OBSERVED"
        && row.planId === "ALL_DEFENSE_FAR"
    );
    const halfFarMin = firstRun.rows.find(row =>
        row.sampleId === "V15_MIN_OBSERVED"
        && row.planId === "HALF_DEFENSE_FAR"
    );

    assert.ok(heavyMin);
    assert.ok(allMin);
    assert.ok(halfFarMin);

    assert.ok(
        heavyMin.burdenShare >= 0.74 && heavyMin.burdenShare <= 0.76,
        "heavy first-run commitment should land around 75% burden"
    );
    assert.equal(
        Number(allMin.burdenShare.toFixed(2)),
        0.80,
        "all-defense far deployment should cap at 80% burden"
    );
    assert.ok(
        halfFarMin.burdenShare >= 0.57 && halfFarMin.burdenShare <= 0.59,
        "half-defense far deployment should stay dramatic without matching full mobilization"
    );

    assert.equal(
        Number(resolveFirstRunBurdenShare({
            requestedDefense: 27,
            defenseAvailable: 27,
            distance: 4
        }).toFixed(2)),
        0.80
    );
}
