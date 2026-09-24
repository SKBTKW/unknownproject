import assert from "node:assert/strict";

import {
    evaluateDeploymentProfileAgainstSamples
} from "./trial_deployment_balance_probe.mjs";

/**
 * Snapshot captured by the live Stage1 audit after HQ base yield became 5/5/5/1.
 * Source run: AoT Full Inspection #923.
 *
 * This is deliberately a dated fit target, not a replacement for the live
 * audit. If the live audit moves, this fit test must be refreshed from its
 * output before selecting product balance.
 */
const LIVE_V15_SAMPLES_20260924 = Object.freeze([
    Object.freeze({ id: "LIVE_20260920", food: 431, material: 409, defense: 36 }),
    Object.freeze({ id: "LIVE_20260921", food: 400, material: 282, defense: 24 }),
    Object.freeze({ id: "LIVE_20260922", food: 513, material: 388, defense: 26 }),
    Object.freeze({ id: "LIVE_20260923", food: 576, material: 222, defense: 22 }),
    Object.freeze({ id: "LIVE_20260924", food: 366, material: 248, defense: 24 }),
    Object.freeze({ id: "LIVE_20260925", food: 615, material: 281, defense: 21 }),
    Object.freeze({ id: "LIVE_20260926", food: 480, material: 347, defense: 27 }),
    Object.freeze({ id: "LIVE_20260927", food: 404, material: 340, defense: 32 })
]);

const ALL_DEFENSE_FAR = Object.freeze([
    Object.freeze({
        id: "ALL_DEFENSE_FAR",
        requestedDefense: Number.MAX_SAFE_INTEGER,
        distance: 4
    })
]);

const TARGET_MIN = 0.70;
const TARGET_MAX = 0.80;

function scoreProfile(profile) {
    const result = evaluateDeploymentProfileAgainstSamples({
        profile,
        samples: LIVE_V15_SAMPLES_20260924,
        plans: ALL_DEFENSE_FAR
    });
    assert.equal(result.success, true);

    const shares = result.rows.flatMap(row => [
        row.foodSharePct / 100,
        row.materialSharePct / 100
    ]);
    const inBand = shares.filter(value => value >= TARGET_MIN && value <= TARGET_MAX).length;
    const rmse = Math.sqrt(
        shares.reduce((sum, value) => sum + ((value - 0.75) ** 2), 0) / shares.length
    );

    return {
        profile,
        rows: result.rows,
        shares,
        inBand,
        total: shares.length,
        rmse,
        minShare: Math.min(...shares),
        maxShare: Math.max(...shares)
    };
}

function searchLinearProfiles() {
    const candidates = [];

    // Deliberately broad enough to contain the old LIGHT/MEDIUM/HEAVY bands
    // and much steeper candidates. Coarse 0.5 / integer steps keep CI cheap
    // while proving whether the current fixed v1 shape can fit the live runs.
    for (let foodBase = 0; foodBase <= 160; foodBase += 20) {
        for (let foodPerDefense2 = 8; foodPerDefense2 <= 32; foodPerDefense2 += 1) {
            const foodPerDefense = foodPerDefense2 / 2;
            for (let foodPerDistance = 0; foodPerDistance <= 12; foodPerDistance += 2) {
                for (let materialBase = 0; materialBase <= 120; materialBase += 20) {
                    for (let materialPerDefense2 = 4; materialPerDefense2 <= 24; materialPerDefense2 += 1) {
                        const materialPerDefense = materialPerDefense2 / 2;
                        for (let materialPerDistance = 0; materialPerDistance <= 10; materialPerDistance += 2) {
                            const scored = scoreProfile({
                                status: "RESOLVED",
                                food: {
                                    base: foodBase,
                                    perDefense: foodPerDefense,
                                    perDistance: foodPerDistance
                                },
                                material: {
                                    base: materialBase,
                                    perDefense: materialPerDefense,
                                    perDistance: materialPerDistance
                                }
                            });

                            if (scored.rows.every(row => row.affordable === true)) {
                                candidates.push(scored);
                            }
                        }
                    }
                }
            }
        }
    }

    candidates.sort((a, b) =>
        (b.inBand - a.inBand)
        || (a.rmse - b.rmse)
        || (a.maxShare - b.maxShare)
    );
    return candidates;
}

console.log("\n=== Stage1 Trial1 fixed-linear cost fit ===");

const candidates = searchLinearProfiles();
assert.ok(candidates.length > 0);

const best = candidates[0];
console.log(
    "BEST_LINEAR_PROFILE",
    JSON.stringify({
        profile: best.profile,
        inBand: `${best.inBand}/${best.total}`,
        rmse: Number(best.rmse.toFixed(4)),
        shareRange: [
            Number((best.minShare * 100).toFixed(1)),
            Number((best.maxShare * 100).toFixed(1))
        ]
    })
);

for (const row of best.rows) {
    console.log(
        [
            "BEST_LINEAR_ROW",
            row.sampleId,
            `🌾${row.foodCost}/${row.foodAvailable}=${row.foodSharePct.toFixed(1)}%`,
            `🧱${row.materialCost}/${row.materialAvailable}=${row.materialSharePct.toFixed(1)}%`,
            `🛡️${row.requestedDefense}/${row.defenseAvailable}`
        ].join(" ")
    );
}

// A single fixed linear profile cannot keep both resources near 70-80% across
// the current live Stage1 population. This assertion protects us from silently
// promoting a coefficient set that only looks correct on one seed.
assert.ok(
    best.inBand < best.total,
    "fixed linear v1 unexpectedly fits all live food/material shares; revisit the need for relative FirstRun burden"
);
assert.ok(
    best.minShare < TARGET_MIN || best.maxShare > TARGET_MAX,
    "fixed linear v1 must expose its cross-seed spread instead of being treated as a stable 70-80% policy"
);

console.log(
    "FIT_DECISION",
    "fixed linear coefficients are insufficient for a stable 70-80% FirstRun spectacle target;"
    + " keep product profile unresolved until a relative-resource FirstRun policy is explicitly designed"
);
console.log("✅ Stage1 Trial1 fixed-linear cost fit PASS");
