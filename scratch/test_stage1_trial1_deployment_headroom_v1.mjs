import assert from "node:assert/strict";

import {
    evaluateDeploymentProfileAgainstSamples,
    STAGE1_TRIAL1_PROBE_PLANS
} from "./trial_deployment_balance_probe.mjs";
import {
    STAGE1_TRIAL1_DEPLOYMENT_COST_CANDIDATES,
    STAGE1_TRIAL1_LIVE_ENVELOPE_20260924
} from "./stage1_trial1_deployment_cost_candidates.mjs";

const PRETRIAL_SPEND_STRESS_CASES = Object.freeze([
    Object.freeze({
        id: "NO_PRETRIAL_SPEND",
        foodSpent: 0,
        materialSpent: 0
    }),
    Object.freeze({
        id: "ONE_MATERIAL_SINK",
        foodSpent: 0,
        materialSpent: 20
    }),
    Object.freeze({
        id: "TWO_MATERIAL_SINKS",
        foodSpent: 0,
        materialSpent: 40
    }),
    Object.freeze({
        id: "MIXED_PREPARATION",
        foodSpent: 20,
        materialSpent: 40
    })
]);

function median(values) {
    const sorted = [...values].sort((a, b) => a - b);
    const mid = Math.floor(sorted.length / 2);
    return sorted.length % 2 === 0
        ? (sorted[mid - 1] + sorted[mid]) / 2
        : sorted[mid];
}

function applyStressCase(stressCase) {
    return STAGE1_TRIAL1_LIVE_ENVELOPE_20260924.map(sample => Object.freeze({
        ...sample,
        id: `${sample.id}__${stressCase.id}`,
        food: Math.max(0, sample.food - stressCase.foodSpent),
        material: Math.max(0, sample.material - stressCase.materialSpent)
    }));
}

function summarizePlan(rows, planId) {
    const selected = rows.filter(row => row.planId === planId);
    const foodShares = selected.map(row => row.foodSharePct / 100);
    const materialShares = selected.map(row => row.materialSharePct / 100);
    return {
        rows: selected.length,
        affordable: selected.filter(row => row.affordable).length,
        foodMedian: median(foodShares),
        foodMax: Math.max(...foodShares),
        materialMedian: median(materialShares),
        materialMax: Math.max(...materialShares)
    };
}

function auditCandidate(candidateId, profile) {
    const cases = [];
    for (const stressCase of PRETRIAL_SPEND_STRESS_CASES) {
        const samples = applyStressCase(stressCase);
        const result = evaluateDeploymentProfileAgainstSamples({
            profile,
            samples,
            plans: STAGE1_TRIAL1_PROBE_PLANS
        });
        assert.equal(result.success, true);

        const heavy = summarizePlan(result.rows, "HEAVY_DEFENSE_FAR");
        const all = summarizePlan(result.rows, "ALL_DEFENSE_FAR");
        cases.push({ stressCase, result, heavy, all });

        console.log(
            [
                candidateId,
                stressCase.id,
                `heavy=${heavy.affordable}/${heavy.rows}`,
                `heavyMed=🌾${(heavy.foodMedian * 100).toFixed(1)}%/🧱${(heavy.materialMedian * 100).toFixed(1)}%`,
                `heavyMax=🌾${(heavy.foodMax * 100).toFixed(1)}%/🧱${(heavy.materialMax * 100).toFixed(1)}%`,
                `all=${all.affordable}/${all.rows}`,
                `allMed=🌾${(all.foodMedian * 100).toFixed(1)}%/🧱${(all.materialMedian * 100).toFixed(1)}%`,
                `allMax=🌾${(all.foodMax * 100).toFixed(1)}%/🧱${(all.materialMax * 100).toFixed(1)}%`
            ].join(" ")
        );
    }
    return cases;
}

console.log("\n=== Stage1 Trial1 deployment headroom audit ===");

const dramaticCases = auditCandidate(
    "DRAMATIC",
    STAGE1_TRIAL1_DEPLOYMENT_COST_CANDIDATES.DRAMATIC
);
const resilientCases = auditCandidate(
    "RESILIENT",
    STAGE1_TRIAL1_DEPLOYMENT_COST_CANDIDATES.RESILIENT
);

const dramaticMixed = dramaticCases.find(entry =>
    entry.stressCase.id === "MIXED_PREPARATION"
);
assert.ok(dramaticMixed);
assert.equal(
    dramaticMixed.heavy.affordable,
    7,
    "DRAMATIC 80%-defense heavy commitment should expose at least one mixed-spend affordability failure"
);
assert.equal(
    dramaticMixed.all.affordable,
    6,
    "DRAMATIC full commitment should expose the same mixed-spend headroom risk"
);

assert.equal(
    resilientCases.every(entry =>
        entry.result.rows.every(row => row.affordable === true)
    ),
    true,
    "RESILIENT candidate must preserve affordability for every plan across all defined pre-Trial spend stress cases"
);

const resilientNoSpend = resilientCases.find(entry =>
    entry.stressCase.id === "NO_PRETRIAL_SPEND"
);
const resilientMixed = resilientCases.find(entry =>
    entry.stressCase.id === "MIXED_PREPARATION"
);
assert.ok(resilientNoSpend);
assert.ok(resilientMixed);

assert.ok(
    resilientNoSpend.heavy.foodMedian >= 0.60
        && resilientNoSpend.heavy.foodMedian <= 0.66,
    "RESILIENT no-spend heavy food median should remain visibly costly"
);
assert.ok(
    resilientNoSpend.heavy.materialMedian >= 0.55
        && resilientNoSpend.heavy.materialMedian <= 0.61,
    "RESILIENT no-spend heavy material median should remain visibly costly"
);
assert.ok(
    resilientMixed.heavy.foodMedian >= 0.62
        && resilientMixed.heavy.foodMedian <= 0.66,
    "RESILIENT mixed-spend 80%-defense heavy food median should remain in the low/mid-60% band"
);
assert.ok(
    resilientMixed.heavy.materialMedian >= 0.62
        && resilientMixed.heavy.materialMedian <= 0.66,
    "RESILIENT mixed-spend 80%-defense heavy material median should remain in the low/mid-60% band"
);
assert.ok(
    resilientMixed.all.foodMedian >= 0.69
        && resilientMixed.all.foodMedian <= 0.74,
    "RESILIENT mixed-spend full food median should land around low-70%"
);
assert.ok(
    resilientMixed.all.materialMedian >= 0.69
        && resilientMixed.all.materialMedian <= 0.75,
    "RESILIENT mixed-spend full material median should land around low-70%"
);

console.log(
    [
        "HEADROOM_RESULT",
        "DRAMATIC unsafe after mixed spend",
        "RESILIENT survives 8/8",
        "RESILIENT remains non-canonical",
        "next gate requires representative executable Stage1 spend paths"
    ].join(" ")
);

console.log("✅ Stage1 Trial1 deployment headroom audit PASS");
