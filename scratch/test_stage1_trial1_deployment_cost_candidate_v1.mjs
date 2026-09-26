import assert from "node:assert/strict";

import {
    evaluateDeploymentProfileAgainstSamples,
    STAGE1_TRIAL1_PROBE_PLANS
} from "./trial_deployment_balance_probe.mjs";
import {
    STAGE1_TRIAL1_DEPLOYMENT_COST_CANDIDATES,
    STAGE1_TRIAL1_LIVE_ENVELOPE_20260924
} from "./stage1_trial1_deployment_cost_candidates.mjs";

function median(values) {
    const sorted = [...values].sort((a, b) => a - b);
    const mid = Math.floor(sorted.length / 2);
    return sorted.length % 2 === 0
        ? (sorted[mid - 1] + sorted[mid]) / 2
        : sorted[mid];
}

function summarizePlan(rows, planId) {
    const selected = rows.filter(row => row.planId === planId);
    const foodShares = selected.map(row => row.foodSharePct / 100);
    const materialShares = selected.map(row => row.materialSharePct / 100);
    return {
        rowCount: selected.length,
        affordableCount: selected.filter(row => row.affordable).length,
        food: {
            min: Math.min(...foodShares),
            median: median(foodShares),
            max: Math.max(...foodShares)
        },
        material: {
            min: Math.min(...materialShares),
            median: median(materialShares),
            max: Math.max(...materialShares)
        }
    };
}

function formatPct(value) {
    return (value * 100).toFixed(1) + "%";
}

function runCandidate(id, profile) {
    const result = evaluateDeploymentProfileAgainstSamples({
        profile,
        samples: STAGE1_TRIAL1_LIVE_ENVELOPE_20260924,
        plans: STAGE1_TRIAL1_PROBE_PLANS
    });
    assert.equal(result.success, true, `${id} profile must resolve`);

    const summary = Object.fromEntries(
        STAGE1_TRIAL1_PROBE_PLANS.map(plan => [
            plan.id,
            summarizePlan(result.rows, plan.id)
        ])
    );

    console.log(`\n${id}`);
    for (const plan of STAGE1_TRIAL1_PROBE_PLANS) {
        const row = summary[plan.id];
        console.log(
            [
                plan.id,
                `affordable=${row.affordableCount}/${row.rowCount}`,
                `food=${formatPct(row.food.min)}..${formatPct(row.food.max)} med=${formatPct(row.food.median)}`,
                `mat=${formatPct(row.material.min)}..${formatPct(row.material.max)} med=${formatPct(row.material.median)}`
            ].join(" ")
        );
    }

    return { result, summary };
}

console.log("\n=== Stage1 Trial1 deployment cost candidate audit ===");

const soft = runCandidate("SOFT", STAGE1_TRIAL1_DEPLOYMENT_COST_CANDIDATES.SOFT);
const dramatic = runCandidate("DRAMATIC", STAGE1_TRIAL1_DEPLOYMENT_COST_CANDIDATES.DRAMATIC);
const overload = runCandidate("OVERLOAD", STAGE1_TRIAL1_DEPLOYMENT_COST_CANDIDATES.OVERLOAD);

assert.equal(
    dramatic.result.rows.every(row => row.affordable === true),
    true,
    "DRAMATIC candidate must remain affordable across all eight live Verse15 samples"
);

const heavy = dramatic.summary.HEAVY_DEFENSE_FAR;
assert.ok(
    heavy.food.median >= 0.68 && heavy.food.median <= 0.74,
    `DRAMATIC heavy food median must sit near 70%: ${formatPct(heavy.food.median)}`
);
assert.ok(
    heavy.material.median >= 0.65 && heavy.material.median <= 0.71,
    `DRAMATIC heavy material median must sit near 70%: ${formatPct(heavy.material.median)}`
);

const all = dramatic.summary.ALL_DEFENSE_FAR;
assert.ok(
    all.food.median >= 0.73 && all.food.median <= 0.79,
    `DRAMATIC full food median must sit in the high-70% band: ${formatPct(all.food.median)}`
);
assert.ok(
    all.material.median >= 0.72 && all.material.median <= 0.78,
    `DRAMATIC full material median must sit in the high-70% band: ${formatPct(all.material.median)}`
);

assert.ok(
    dramatic.summary.HEAVY_DEFENSE_FAR.food.min < 0.55
        && dramatic.summary.HEAVY_DEFENSE_FAR.material.min < 0.60,
    "wealthier/prepared runs must retain a meaningful burden advantage instead of paying a fixed stock percentage"
);

assert.ok(
    soft.summary.HEAVY_DEFENSE_FAR.food.median < dramatic.summary.HEAVY_DEFENSE_FAR.food.median
        && soft.summary.HEAVY_DEFENSE_FAR.material.median < dramatic.summary.HEAVY_DEFENSE_FAR.material.median,
    "SOFT must remain a clearly lower-pressure comparison band"
);

assert.equal(
    overload.result.rows.some(row => row.affordable === false),
    true,
    "OVERLOAD must demonstrate the upper boundary where linear costs become unsafe for live Stage1 samples"
);

console.log(
    [
        "CANDIDATE_RESULT",
        "DRAMATIC remains non-canonical",
        `heavyMedian=🌾${formatPct(heavy.food.median)}/🧱${formatPct(heavy.material.median)}`,
        `allMedian=🌾${formatPct(all.food.median)}/🧱${formatPct(all.material.median)}`,
        "production profile remains UNRESOLVED"
    ].join(" ")
);

console.log("✅ Stage1 Trial1 deployment cost candidate audit PASS");
